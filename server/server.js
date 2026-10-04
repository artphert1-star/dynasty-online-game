const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { Game, STYLES } = require('./engine');

const app = express();
app.use(cors());
app.get('/', (_, res) => res.send('Dynasty server OK (rules v0.8)'));
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*', methods: ['GET', 'POST'] } });

const rooms = {};
const code6 = () => Math.random().toString(36).substring(2, 8).toUpperCase();

function broadcast(room) {
  for (const m of room.members) {
    const sid = room.sockets[m.pid];
    if (!sid) continue;
    io.to(sid).emit('state', {
      code: room.code, me: m.pid, host: room.members[0].pid, started: !!room.game,
      members: room.members.map(x => ({ pid: x.pid, name: x.name, bot: x.bot, style: x.style })),
      game: room.game ? room.game.view(m.pid) : null,
      waiting: room.game ? room.game.players.filter(p => !p.placed).map(p => p.name) : [],
    });
  }
}
function nextEra(room) {
  const g = room.game;
  if (g.winner) return broadcast(room);
  g.startEra();
  tryResolve(room);
  broadcast(room);
}
function tryResolve(room) {
  const g = room.game;
  if (g.phase === 'orders' && g.allIn()) {
    g.resolve();
    broadcast(room);
    if (!g.winner) setTimeout(() => nextEra(room), 4000);
  }
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
  socket.on('submit', ({ code, orders }) => {
    const { room, pid, g } = find(code, socket); if (!g || g.phase !== 'orders') return;
    g.submit(pid, Array.isArray(orders) ? orders : []);
    broadcast(room); tryResolve(room);
  });
  socket.on('court', ({ code, choice }) => { const { room, pid, g } = find(code, socket); if (g && g.phase === 'orders') { g.court(pid, choice === 'A' ? 'A' : 'B'); broadcast(room); } });
  socket.on('secret', ({ code, idx, mode, target }) => {
    const { room, pid, g } = find(code, socket);
    if (g && g.phase === 'orders' && !g.P(pid).placed && g.useSecret(pid, idx, mode, target)) broadcast(room);
  });
  socket.on('opts', ({ code, defPay, bribe }) => {
    const { room, pid, g } = find(code, socket); if (!g) return;
    const p = g.P(pid); p.defPay = Math.max(0, Math.min(2, defPay | 0)); p.bribe = Math.max(0, Math.min(2, bribe | 0));
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Dynasty Server running on port ${PORT}`));
