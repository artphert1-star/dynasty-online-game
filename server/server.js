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

// กติกา v0.8: เกณฑ์ขึ้นยศ II (2), III (2), IV (4), V (5)
const promotionThresholds = { 1: 2, 2: 2, 3: 4, 4: 5 }; 

io.on('connection', (socket) => {
  socket.on('createRoom', (name) => {
    const code = generateRoomCode();
    rooms[code] = {
      code,
      players: [{ 
        id: socket.id, name, isHost: true, type: 'human', 
        stats: { rank: 1, gold: 3, influence: 0, intrigue: 2, might: 2, unrest: 1, maxBaseStat: 5, maxTotalStat: 6 } 
      }],
      state: 'lobby',
      logs: ['ห้องถูกสร้างแล้ว (ระบบอิงกติกา v0.8)']
    };
    socket.join(code);
    socket.emit('roomJoined', { code, playerId: socket.id });
    io.to(code).emit('updateRoom', rooms[code]);
  });

  socket.on('joinRoom', ({ code, name }) => {
    if (rooms[code] && rooms[code].state === 'lobby') {
      rooms[code].players.push({
        id: socket.id, name, isHost: false, type: 'human', 
        stats: { rank: 1, gold: 3, influence: 0, intrigue: 2, might: 2, unrest: 1, maxBaseStat: 5, maxTotalStat: 6 }
      });
      socket.join(code);
      socket.emit('roomJoined', { code, playerId: socket.id });
      io.to(code).emit('updateRoom', rooms[code]);
    }
  });

  // กติกา v0.8: บอท 6 สาย (Assassin, Climber, Warlord, Balanced, Schemer, Turtle)
  socket.on('addBot', ({ code, archetype }) => {
    if (rooms[code]) {
      const count = rooms[code].players.filter(p => p.type === 'bot').length + 1;
      rooms[code].players.push({
        id: `bot_${Date.now()}`, name: `Bot ${archetype} ${count}`, isHost: false, type: 'bot', archetype,
        stats: { rank: 1, gold: 3, influence: 2, intrigue: 2, might: 2, unrest: 1, maxBaseStat: 5, maxTotalStat: 6 }
      });
      io.to(code).emit('updateRoom', rooms[code]);
    }
  });

  socket.on('startGame', (code) => {
    if (rooms[code]) {
      rooms[code].state = 'playing';
      rooms[code].logs.push('🎮 เริ่มเกมยุคที่ 1 (ใช้กติกาเพดานสเตตัสไม่เกิน 6)');
      io.to(code).emit('updateRoom', rooms[code]);
    }
  });

  socket.on('playerAction', ({ code, action }) => {
    const room = rooms[code];
    if (!room) return;
    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;

    if (action === 'petition') {
      // เต๋าแสดงกำลัง: กำลังรบหาร 2 ปัดลง
      const mightDice = Math.floor(player.stats.might / 2);
      const totalDice = player.stats.influence + mightDice; 
      
      let successes = 0;
      for (let i = 0; i < totalDice; i++) {
        if ((Math.floor(Math.random() * 6) + 1) >= 4) successes++;
      }

      const required = promotionThresholds[player.stats.rank] || 99;
      if (successes >= required) {
        player.stats.rank += 1;
        player.stats.influence = Math.min(player.stats.influence + 2, player.stats.maxTotalStat); // ขึ้นยศสำเร็จ บารมี +2
        room.logs.unshift(`🏆 ${player.name} ขอเลื่อนยศสำเร็จ! (ทอยได้ ${successes}/${required}) เลื่อนเป็นยศ ${player.stats.rank}`);
      } else {
        room.logs.unshift(`❌ ${player.name} ขอเลื่อนยศล้มเหลว (ทอยได้ ${successes}/${required})`);
      }
    } else if (action === 'assassinate') {
      if (player.stats.gold >= 2) {
        player.stats.gold -= 2; // ต้นทุนลอบสังหาร 2 เงิน
        room.logs.unshift(`🗡️ ${player.name} จ่าย 2 เงิน ส่งมือสังหารออกไป!`);
      }
    } else if (action === 'realmTax') {
      player.stats.gold += (player.stats.rank + 1); // เงินตามยศปัจจุบัน + 1
      player.stats.unrest = Math.min(6, player.stats.unrest + 1); // ความไม่สงบ +1 (สูงสุด 6 คือกบฏ)
      room.logs.unshift(`💰 ${player.name} รีดภาษี! ได้เงินเพิ่ม แต่ความไม่สงบเพิ่มเป็น ${player.stats.unrest}/6`);
    }

    io.to(code).emit('updateRoom', room);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Dynasty Server running on port ${PORT}`));
