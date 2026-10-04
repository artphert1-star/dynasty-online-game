const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

const rooms = {};
const generateRoomCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();

io.on('connection', (socket) => {
  socket.on('createRoom', (name) => {
    const code = generateRoomCode();
    rooms[code] = {
      code,
      players: [{ id: socket.id, name, isHost: true, type: 'human', stats: { rank: 1, gold: 3, influence: 0, intrigue: 2, might: 2, unrest: 1 } }],
      state: 'lobby'
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
      io.to(code).emit('updateRoom', rooms[code]);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Dynasty Server running on port ${PORT}`));
