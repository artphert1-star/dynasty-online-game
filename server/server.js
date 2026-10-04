const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });

const rooms = {};
const generateRoomCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();

io.on('connection', (socket) => {
  socket.on('createRoom', (name) => {
    const code = generateRoomCode();
    rooms[code] = {
      code,
      players: [{ id: socket.id, name, isHost: true, type: 'human', stats: { rank: 1, gold: 3, influence: 0, intrigue: 2, might: 2, unrest: 1 } }],
      state: 'lobby',
      logs: ['ห้องถูกสร้างแล้ว']
    };
    socket.join(code);
    socket.emit('roomJoined', { code, playerId: socket.id });
    io.to(code).emit('updateRoom', rooms[code]);
  });

  socket.on('joinRoom', ({ code, name }) => {
    if (rooms[code] && rooms[code].state === 'lobby') {
      rooms[code].players.push({
        id: socket.id, name, isHost: false, type: 'human', stats: { rank: 1, gold: 3, influence: 0, intrigue: 2, might: 2, unrest: 1 }
      });
      socket.join(code);
      socket.emit('roomJoined', { code, playerId: socket.id });
      io.to(code).emit('updateRoom', rooms[code]);
    } else {
      socket.emit('errorMsg', 'ไม่พบห้องนี้ หรือเกมเริ่มไปแล้ว');
    }
  });

  socket.on('addBot', ({ code, archetype }) => {
    if (rooms[code]) {
      const count = rooms[code].players.filter(p => p.type === 'bot').length + 1;
      rooms[code].players.push({
        id: `bot_${Date.now()}`, name: `Bot ${archetype} ${count}`, isHost: false, type: 'bot', archetype,
        stats: { rank: 1, gold: 3, influence: 0, intrigue: 2, might: 2, unrest: 1 }
      });
      io.to(code).emit('updateRoom', rooms[code]);
    }
  });

  socket.on('startGame', (code) => {
    if (rooms[code]) {
      rooms[code].state = 'playing';
      rooms[code].logs.push('🎮 เริ่มเกมยุคที่ 1!');
      io.to(code).emit('updateRoom', rooms[code]);
    }
  });

  // ระบบแอ็กชันการเล่น
  socket.on('playerAction', ({ code, action }) => {
    const room = rooms[code];
    if (!room) return;
    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;

    if (action === 'rollDice') {
      const dice = Math.floor(Math.random() * 6) + 1;
      if (dice >= 4) {
        player.stats.gold += 2;
        room.logs.unshift(`🎲 ${player.name} ทอยเต๋าได้ ${dice} (สำเร็จ! +2 Gold)`);
      } else {
        player.stats.unrest = Math.min(6, player.stats.unrest + 1);
        room.logs.unshift(`🎲 ${player.name} ทอยเต๋าได้ ${dice} (ล้มเหลว! +1 ความไม่สงบ)`);
      }
    } else if (action === 'promoteRank') {
      if (player.stats.gold >= 3) {
        player.stats.gold -= 3;
        player.stats.rank += 1;
        player.stats.influence += 1;
        room.logs.unshift(`🏆 ${player.name} จ่าย 3 Gold เพื่อเลื่อนยศเป็น ยศ ${player.stats.rank}`);
      }
    } else if (action === 'recruitMight') {
      if (player.stats.gold >= 2) {
        player.stats.gold -= 2;
        player.stats.might += 1;
        room.logs.unshift(`⚔️ ${player.name} จ่าย 2 Gold เพื่อเพิ่มกำลังรบ (+1 Might)`);
      }
    }

    io.to(code).emit('updateRoom', room);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Dynasty Server running on port ${PORT}`));
