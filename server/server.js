const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { Game, STYLES } = require('./engine');

const app = express();
app.use(cors());
app.use(express.static(require('path').join(__dirname, '../client')));
app.get('/health', (_, res) => res.json({ ok: true, rulesVersion: '1.2' }));
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*', methods: ['GET', 'POST'] } });

const rooms = Object.create(null);
const code6 = () => Math.random().toString(36).substring(2, 8).toUpperCase();

function broadcast(room) {
  for (const m of room.members) {
    const sid = room.sockets[m.pid]; if (!sid) continue;
    const g = room.game;
    io.to(sid).emit('state', {code:room.code,me:m.pid,host:room.members[0].pid,started:!!g,
      members:room.members.map(x=>({pid:x.pid,name:x.name,bot:x.bot,style:x.style})),
      game:g ? g.view(m.pid) : null,replay:null,
      waiting:g ? g.players.filter(p=>g.phase==='placement'?p.placed===null:!p.ready).map(p=>p.name) : []});
  }
}
function nextEra(room) { if(!room.game || room.game.winner)return;room.game.startEra();pump(room); }
function pump(room) {
  const g=room.game;if(!g)return broadcast(room);
  clearTimeout(room.timer);room.timer=null;
  // Advance only automatic transitions. Human decisions remain explicit.
  for(let i=0;i<200;i++) {
    if(g.winner)break;
    if(g.botStep())continue;
    if(g.pending)break;
    if(g.phase==='negotiation' && (g.allReady() || Date.now()>=g.deadline)){g.beginPlacement();continue;}
    if(g.phase==='placement' && g.allIn()){g.beginTurns();continue;}
    if(g.phase==='end' && g.allReady()){g.finishEra();continue;}
    break;
  }
  broadcast(room);
  if(g.phase==='negotiation' && !g.pending)room.timer=setTimeout(()=>pump(room),Math.max(1,g.deadline-Date.now()));
  else if(g.phase==='between')room.timer=setTimeout(()=>nextEra(room),4000);
}
const find = (code, socket) => {
  const room = rooms[code];
  if (!room) return {};
  const pid = Object.keys(room.sockets).find(k => room.sockets[k] === socket.id);
  return { room, pid, g: room.game };
};

io.on('connection', socket => {
  socket.on('createRoom', ({ name, pid } = {}) => {
    if (typeof pid !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(pid)) return;
    name = typeof name === 'string' ? name.slice(0,32) : 'ตระกูล';
    const code = code6();
    const token = socket.handshake.auth?.token;
    if (typeof token !== 'string' || token.length < 16 || token.length > 128) return socket.emit('err','กรุณาโหลดหน้าเกมใหม่');
    rooms[code] = { code, members: [{ pid, name: name || 'ตระกูล', bot: false }], sockets: { [pid]: socket.id }, tokens: { [pid]: token }, game: null };
    socket.join(code); broadcast(rooms[code]);
  });
  socket.on('joinRoom', ({ code, name, pid } = {}) => {
    if (typeof pid !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(pid)) return;
    name = typeof name === 'string' ? name.slice(0,32) : 'ตระกูล';
    const room = rooms[code];
    if (!room) return socket.emit('err', 'ไม่พบห้อง');
    const old = room.members.find(m => m.pid === pid);
    const token = socket.handshake.auth?.token;
    if (typeof token !== 'string' || token.length < 16 || token.length > 128) return socket.emit('err','กรุณาโหลดหน้าเกมใหม่');
    if (old) {
      if (old.bot || room.tokens[pid] !== token) return socket.emit('err','รหัสผู้เล่นไม่ตรงกับเจ้าของเดิม');
      room.sockets[pid] = socket.id; socket.join(code); return broadcast(room);
    }
    if (room.game) return socket.emit('err', 'เกมเริ่มไปแล้ว');
    if (room.members.length >= 6) return socket.emit('err', 'ห้องเต็ม (สูงสุด 6 คน)');
    room.members.push({ pid, name: name || 'ตระกูล', bot: false });
    room.sockets[pid] = socket.id; socket.join(code); broadcast(room);
    room.tokens[pid] = token;
  });
  socket.on('addBot', ({ code, style }) => {
    const { room, pid: actor } = find(code, socket); if (!room || actor !== room.members[0].pid || room.game || room.members.length >= 6) return;
    if (!STYLES.includes(style)) return;
    const pid = 'bot_' + Math.random().toString(36).slice(2, 8);
    room.members.push({ pid, name: `Bot ${style} ${room.members.length}`, bot: true, style });
    broadcast(room);
  });
  socket.on('removeBot', ({ code, pid }) => {
    const { room, pid: actor } = find(code, socket); if (!room || actor !== room.members[0].pid || room.game) return;
    room.members = room.members.filter(m => !(m.pid === pid && m.bot)); broadcast(room);
  });
  socket.on('startGame', code => {
    const { room, pid } = find(code, socket);
    if (!room || room.game || pid !== room.members[0].pid) return;
    if (room.members.length < 3) return socket.emit('err', 'ต้องมีอย่างน้อย 3 คน (เพิ่มบอทได้)');
    room.game = new Game(room.members.map(m => ({ id: m.pid, name: m.name, bot: m.bot, style: m.style })));
    nextEra(room);
  });
  socket.on('leaveRoom', code => {
    const { room, pid } = find(code, socket); if (!room || !pid) return;
    delete room.sockets[pid]; socket.leave(code);
    if (!room.game) room.members = room.members.filter(m => m.pid !== pid);
    const humans = room.members.filter(m => !m.bot && room.sockets[m.pid]);
    if (!humans.length && !room.game) { clearTimeout(room.timer); delete rooms[code]; return; }
    if (!room.game) { while (room.members[0].bot) room.members.push(room.members.shift()); broadcast(room); }
  });
  socket.on('rematch', code => {
    const {room,pid,g}=find(code,socket);if(!g||g.phase!=='over'||pid!==room.members[0].pid)return;
    clearTimeout(room.timer);room.game=null;broadcast(room);
  });
  function command(event, fn) {
    socket.on(event, (data = {}) => {
      if (!data || typeof data !== 'object') return;
      const {room,pid,g}=find(data.code,socket);if(!g||!pid)return;
      try { if(!fn(g,pid,data))return socket.emit('err','ทำรายการไม่ได้ในช่วงนี้ หรือข้อมูลไม่ครบ');pump(room); }
      catch(e){console.error(event,e);socket.emit('err','ทำรายการไม่ได้ กรุณาลองใหม่');}
    });
  }
  command('submit',(g,id,d)=>g.submit(id,d.orders));
  command('ready',(g,id)=>g.setReady(id));
  command('action',(g,id,d)=>g.act(id,d.order));
  command('respond',(g,id,d)=>g.pending?.kind==='rebellion'?g.resolveRebellion(id,d):g.respond(id,d));
  command('endTurn',(g,id)=>g.endTurn(id));
  command('secret',(g,id,d)=>g.useSecret(id,Number(d.idx),d.mode));
  command('discardSecret',(g,id,d)=>g.discardOwnSecret(id,Number(d.idx)));
  command('bribe',(g,id,d)=>g.bribe(id,d.amount));
  command('release',(g,id)=>!g.pending&&g.phase!=='over'&&g.release(id));
  command('feast',(g,id)=>g.feast(id));
  command('offer',(g,id,d)=>g.offer(id,d));
  command('accept',(g,id,d)=>g.accept(id,Number(d.offerId)));
  command('favor',(g,id,d)=>g.favor(id,Number(d.tokenId),!!d.fulfill));
  socket.on('disconnect',()=>{for(const room of Object.values(rooms)){for(const [pid,sid] of Object.entries(room.sockets))if(sid===socket.id)delete room.sockets[pid];}});

});

const PORT = process.env.PORT || 3000;
if (require.main === module) server.listen(PORT, () => console.log(`Dynasty Server running on port ${PORT}`));
module.exports = { server, io };
