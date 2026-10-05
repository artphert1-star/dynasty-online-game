const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { Game, STYLES } = require('./engine');

const app = express();
app.use(cors());
app.use(express.static(require('path').join(__dirname, '../client')));
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*', methods: ['GET', 'POST'] } });

const rooms = {};
const code6 = () => Math.random().toString(36).substring(2, 8).toUpperCase();

function gameView(room, pid) {
  if (!room.game) return null;
  const v = room.game.view(pid), r = room.replay;
  if (r) { v.players = r.before[pid]; v.log = r.shown.slice(-40); v.winner = null; v.phase = 'resolve'; v.hist = v.hist.filter(h => h.era < v.era); }
  return v;
}
function broadcast(room) {
  for (const m of room.members) {
    const sid = room.sockets[m.pid];
    if (!sid) continue;
    io.to(sid).emit('state', {
      code: room.code, me: m.pid, host: room.members[0].pid, started: !!room.game,
      members: room.members.map(x => ({ pid: x.pid, name: x.name, bot: x.bot, style: x.style })),
      game: gameView(room, m.pid),
      replay: room.replay ? { cur: room.replay.cur && { ...room.replay.cur, faces: room.replay.cur.revealed ? room.replay.cur.faces : null, s: room.replay.cur.revealed ? room.replay.cur.s : null }, n: room.replay.done + 1, total: room.replay.total } : null,
      waiting: room.game ? room.game.players.filter(p => (room.game.phase === 'window' ? !p.ready : !p.placed)).map(p => p.name) : [],
    });
  }
}
function nextEra(room) {
  const g = room.game;
  if (!g || g.winner) return broadcast(room);
  g.startEra();
  broadcast(room);
  afterSubmit(room);
}
// ทุกคนวางคำสั่งครบ -> เปิดคำสั่ง + หน้าต่างความลับ (ข้อ 7) -> เมื่อทุกคนพร้อมจึงแก้ผล
function afterSubmit(room) {
 const g=room.game;if(!g)return;
 if(g.phase==='orders'&&g.allIn())g.openWindow();
 pump(room);broadcast(room);
}
function pump(room){
 const g=room.game;let limit=100;
 while(limit--&&!g.winner){
  if(g.pending&&g.pending.kind==='heir'){const p=g.P(g.pending.owner);if(!p.bot)break;g.chooseHeir(p.id,0,1);continue;}
  if(g.pending){const id=g.pending.responders[g.pending.idx],p=g.P(id);if(!p.bot)break;g.respond(id,{guard:true,pay:Math.min(2,Math.max(0,p.money-3)),lobby:'oppose'});continue;}
  if(g.phase==='turns'){const p=g.P(g.active());if(!p.bot)break;
   const o=g.botPlan(p).find(o=>!p.used.includes(o.type)&&(['petition','realm','family'].includes(o.type)?p.actions>0:['intrigue','kidnap','assassinate'].includes(o.type)&&p.placed.some(c=>c.type===o.type&&!c.opened&&!c.cancelled)));
   if(o){o.opt=o.opt==='tryst'?'spy':o.opt;o.soldiers=Math.min(2,p.soldiers);g.action(p.id,o);}else g.endTurn(p.id);continue;}
  if(g.phase==='end'){g.players.filter(p=>p.bot).forEach(p=>{p.bribe=Math.min(2,p.unrest,p.money);p.ready=true;});if(g.finishEra()&&!g.winner){setTimeout(()=>{if(room.game===g&&g.phase==='between')nextEra(room);},2500);}break;}
  break;
 }
}
function checkWindow(room) { const g = room.game; if (g && g.phase === 'window' && room.win && g.allReady()) closeWindow(room); }
function closeWindow(room) { if (!room.win) return; clearTimeout(room.win); room.win = null; startReplay(room); }
function startReplay(room) {
  const g = room.game;
  if (!g || g.phase !== 'window' || room.replay) return;
  const before = {}; for (const m of room.members) before[m.pid] = g.view(m.pid).players;
  g.resolve();   // คำนวณทั้งยุคที่ server (สุ่มเต๋าที่นี่) แล้วเล่นซ้ำให้ผู้เล่นกดทอยทีละคน
  room.replay = { ev: g.ev, i: 0, done: 0, total: g.ev.filter(e => e.t === 'roll').length, shown: [], before, cur: null, timer: null };
  step(room);
}
function step(room) {
  const r = room.replay; if (!r) return;
  clearTimeout(r.timer); r.cur = null;
  while (r.i < r.ev.length && r.ev[r.i].t === 'log') r.shown.push(r.ev[r.i++].text);
  const g = room.game;
  if (r.i >= r.ev.length) {
    room.replay = null; broadcast(room);
    if (!g.winner) setTimeout(() => { if (room.game === g && !room.replay) nextEra(room); }, 5000);
    return;
  }
  const e = r.ev[r.i]; r.cur = { pid: e.pid, name: e.name, label: e.label, n: e.n, faces: e.faces, s: e.s, die: !!e.die, revealed: false };
  broadcast(room);
  const who = room.members.find(m => m.pid === e.pid);
  r.timer = setTimeout(() => doRoll(room), (who && who.bot) || e.n === 0 ? 1300 : 45000);
}
function doRoll(room) {
  const r = room.replay; if (!r || !r.cur || r.cur.revealed) return;
  clearTimeout(r.timer); r.cur.revealed = true; broadcast(room);
  r.timer = setTimeout(() => {
    const e = r.ev[r.i++]; r.done++;
    r.shown.push(`🎲 ${e.name} — ${e.label}: [${e.faces.join(',')}] = ${e.s} สำเร็จ`);
    step(room);
  }, 2800);
}
const find = (code, socket) => {
  const room = rooms[code];
  if (!room) return {};
  const pid = Object.keys(room.sockets).find(k => room.sockets[k] === socket.id);
  return { room, pid, g: room.game };
};

io.on('connection', socket => {
  socket.on('createRoom', ({ name, pid }) => {
    const code = code6();
    rooms[code] = { code, members: [{ pid, name: name || 'ตระกูล', bot: false }], sockets: { [pid]: socket.id }, game: null };
    socket.join(code); broadcast(rooms[code]);
  });
  socket.on('joinRoom', ({ code, name, pid }) => {
    const room = rooms[code];
    if (!room) return socket.emit('err', 'ไม่พบห้อง');
    const old = room.members.find(m => m.pid === pid);
    if (old) { room.sockets[pid] = socket.id; socket.join(code); return broadcast(room); }
    if (room.game) return socket.emit('err', 'เกมเริ่มไปแล้ว');
    if (room.members.length >= 6) return socket.emit('err', 'ห้องเต็ม (สูงสุด 6 คน)');
    room.members.push({ pid, name: name || 'ตระกูล', bot: false });
    room.sockets[pid] = socket.id; socket.join(code); broadcast(room);
  });
  socket.on('addBot', ({ code, style }) => {
    const room = rooms[code]; if (!room || room.game || room.members.length >= 6) return;
    if (!STYLES.includes(style)) return;
    const pid = 'bot_' + Math.random().toString(36).slice(2, 8);
    room.members.push({ pid, name: `Bot ${style} ${room.members.length}`, bot: true, style });
    broadcast(room);
  });
  socket.on('removeBot', ({ code, pid }) => {
    const room = rooms[code]; if (!room || room.game) return;
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
    const { room, pid } = find(code, socket); if (!room) return;
    delete room.sockets[pid]; socket.leave(code);
    if (!room.game) room.members = room.members.filter(m => m.pid !== pid);
    const humans = room.members.filter(m => !m.bot && room.sockets[m.pid]);
    if (!humans.length) { delete rooms[code]; return; }
    if (!room.game) { while (room.members[0].bot) room.members.push(room.members.shift()); broadcast(room); }
  });
  socket.on('rematch', code => {
    const { room, pid, g } = find(code, socket);
    if (!g || g.phase !== 'over' || pid !== room.members[0].pid) return;
    room.game = null; room.replay = null; if (room.win) { clearTimeout(room.win); room.win = null; } broadcast(room);
  });
  socket.on('rollDice', code => {
    const { room, pid } = find(code, socket);
    if (room && room.replay && room.replay.cur && room.replay.cur.pid === pid) doRoll(room);
  });
  socket.on('submit', ({ code, orders }) => {
    const { room, pid, g } = find(code, socket); if (!g || g.phase !== 'orders') return;
    g.submit(pid, Array.isArray(orders) ? orders : []);
    broadcast(room); afterSubmit(room);
  });
  socket.on('court', ({ code, choice }) => { const { room, pid, g } = find(code, socket); if (g && g.phase === 'orders') { g.court(pid, choice === 'A' ? 'A' : 'B'); broadcast(room); } });
  socket.on('secret', ({ code, idx, mode, tok }) => {
    const { room, pid, g } = find(code, socket);
    if (g && g.useSecret(pid, idx | 0, mode, tok == null ? -1 : +tok)) { broadcast(room); }
  });
  socket.on('ready', code => {const {room,pid,g}=find(code,socket);if(!g)return;
 if(g.phase==='negotiation'){g.setReady(pid);if(g.allReady())g.beginPlacement();}
 else if(g.phase==='end')g.setReady(pid);
 afterSubmit(room);
 });
 socket.on('action', ({code,order})=>{const {room,pid,g}=find(code,socket);if(g&&g.action(pid,order)){pump(room);broadcast(room);}});
 socket.on('respond', data=>{const {room,pid,g}=find(data.code,socket);if(g&&g.respond(pid,data)){pump(room);broadcast(room);}});
 socket.on('endTurn', code=>{const {room,pid,g}=find(code,socket);if(g&&g.endTurn(pid)){pump(room);broadcast(room);}});
 socket.on('trade', data=>{const {room,pid,g}=find(data.code,socket);if(g&&g.trade(pid,data))broadcast(room);});
 socket.on('favor', data=>{const {room,pid,g}=find(data.code,socket);if(g&&g.favor(pid,data.idx,data.fulfill))broadcast(room);});
 socket.on('heirChoice', data=>{const {room,pid,g}=find(data.code,socket);if(g&&g.chooseHeir(pid,data.pick,data.spare)){pump(room);broadcast(room);}});
  socket.on('ransom', code => { const { room, pid, g } = find(code, socket); if (g && !room.replay && g.phase !== 'resolve' && g.ransom(pid)) broadcast(room); });
  socket.on('release', code => { const { room, pid, g } = find(code, socket); if (g && !room.replay && g.phase !== 'resolve' && g.release(pid)) broadcast(room); });
  socket.on('feast', code => { const { room, pid, g } = find(code, socket); if (g && g.feast(pid)) broadcast(room); });
  socket.on('opts', ({ code, defPay, bribe, rejectChild, rebelSoldiers }) => {
    const { room, pid, g } = find(code, socket); if (!g || !g.P(pid)) return;
    const p = g.P(pid); p.defPay = Math.max(0, Math.min(2, defPay | 0)); p.bribe = Math.max(0, Math.min(2, bribe | 0)); p.rejectChild = !!rejectChild; p.rebelSoldiers=Math.max(0,Math.min(2,rebelSoldiers|0));
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Dynasty Server running on port ${PORT}`));
