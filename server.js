const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(express.static(path.join(__dirname, 'public')));

// Configurações do jogo
const GRID_SIZE = 40;
const INITIAL_SNAKE_LENGTH = 3;
const TARGET_FPS = 10; // Reduzido para 10 FPS para minimizar o lag
const FRAME_INTERVAL = 1000 / TARGET_FPS; // Intervalo entre frames em ms
const SNAKE_MOVE_INTERVAL = 200; // A cobra se move a cada 200ms, independente do FPS
const FOOD_SPAWN_RATE = 0.02; // Probabilidade de comida aparecer por tick
const SHRINK_INTERVAL = 30000; // Intervalo para encolher a zona (30 segundos)
const SHRINK_AMOUNT = 1; // Quantidade de células que a zona encolhe por vez

// Armazenar salas de jogo
const gameRooms = new Map();

// Função para criar uma nova sala
function createGameRoom() {
  const roomId = uuidv4().substring(0, 6).toUpperCase(); // Código da sala de 6 caracteres
  
  const gameState = {
    players: new Map(),
    food: [],
    gridSize: GRID_SIZE,
    safeZone: {
      radius: GRID_SIZE / 2,
      shrinking: false,
      nextShrinkTime: Date.now() + SHRINK_INTERVAL
    },
    gameStarted: false,
    gameOver: false,
    winner: null,
    lastUpdateTime: Date.now(),
    frameTimer: 0, // Temporizador para controle de FPS
    snakeMoveTimer: 0 // Temporizador para controle de movimento da cobra
  };
  
  // Gerar comida inicial
  for (let i = 0; i < 5; i++) {
    spawnFood(gameState);
  }
  
  gameRooms.set(roomId, gameState);
  return roomId;
}

// Função para gerar comida aleatória
function spawnFood(gameState) {
  const x = Math.floor(Math.random() * gameState.gridSize);
  const y = Math.floor(Math.random() * gameState.gridSize);
  
  // Verificar se está dentro da zona segura
  const centerX = gameState.gridSize / 2;
  const centerY = gameState.gridSize / 2;
  const distance = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
  
  if (distance <= gameState.safeZone.radius) {
    gameState.food.push({ x, y });
  } else {
    // Tentar novamente se estiver fora da zona
    spawnFood(gameState);
  }
}

// Função para criar uma cobra para um novo jogador
function createSnake(gameState, playerId) {
  // Posição aleatória dentro da zona segura
  const centerX = gameState.gridSize / 2;
  const centerY = gameState.gridSize / 2;
  
  // Gerar posição aleatória dentro da zona segura
  const angle = Math.random() * 2 * Math.PI;
  const distance = Math.random() * (gameState.safeZone.radius * 0.7); // 70% do raio para não ficar muito perto da borda
  
  const headX = Math.floor(centerX + Math.cos(angle) * distance);
  const headY = Math.floor(centerY + Math.sin(angle) * distance);
  
  // Criar segmentos da cobra
  const segments = [];
  for (let i = 0; i < INITIAL_SNAKE_LENGTH; i++) {
    segments.push({ x: headX, y: headY });
  }
  
  return {
    id: playerId,
    segments,
    direction: { x: 0, y: 0 },
    nextDirection: { x: 0, y: 0 },
    score: 0,
    alive: true,
    color: getRandomColor()
  };
}

// Gerar cor aleatória para a cobra
function getRandomColor() {
  const colors = [
    '#FF5733', // Vermelho
    '#33FF57', // Verde
    '#3357FF', // Azul
    '#F3FF33', // Amarelo
    '#FF33F3', // Rosa
    '#33FFF3', // Ciano
    '#FF8C33', // Laranja
    '#8C33FF'  // Roxo
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

// Atualizar o estado do jogo
function updateGameState(roomId) {
  const gameState = gameRooms.get(roomId);
  if (!gameState || !gameState.gameStarted || gameState.gameOver) return;
  
  const currentTime = Date.now();
  const deltaTime = currentTime - gameState.lastUpdateTime;
  gameState.lastUpdateTime = currentTime;
  
  // Verificar se é hora de encolher a zona
  if (currentTime >= gameState.safeZone.nextShrinkTime && gameState.safeZone.radius > 5) {
    gameState.safeZone.radius -= SHRINK_AMOUNT;
    gameState.safeZone.nextShrinkTime = currentTime + SHRINK_INTERVAL;
    io.to(roomId).emit('zoneUpdate', gameState.safeZone);
  }
  
  // Inicializar contadores de jogadores vivos
  let alivePlayers = 0;
  let lastAlivePlayer = null;
  
  // Contar jogadores vivos
  gameState.players.forEach((player, playerId) => {
    if (player.alive) {
      alivePlayers++;
      lastAlivePlayer = playerId;
    }
  });
  
  // Verificar se é hora de mover a cobra
  if (gameState.snakeMoveTimer >= SNAKE_MOVE_INTERVAL) {
    gameState.snakeMoveTimer = 0;
    
    // Mover cobras
    gameState.players.forEach((player, playerId) => {
      if (!player.alive) return;
      
      // Atualizar direção
      player.direction = { ...player.nextDirection };
      
      // Se a cobra não estiver se movendo, pular
      if (player.direction.x === 0 && player.direction.y === 0) return;
      
      // Mover a cabeça
      const head = { ...player.segments[0] };
      head.x += player.direction.x;
      head.y += player.direction.y;
      
      // Verificar colisão com as bordas
      if (head.x < 0) head.x = gameState.gridSize - 1;
      if (head.x >= gameState.gridSize) head.x = 0;
      if (head.y < 0) head.y = gameState.gridSize - 1;
      if (head.y >= gameState.gridSize) head.y = 0;
      
      // Verificar se está fora da zona segura
      const centerX = gameState.gridSize / 2;
      const centerY = gameState.gridSize / 2;
      const distance = Math.sqrt(Math.pow(head.x - centerX, 2) + Math.pow(head.y - centerY, 2));
      
      if (distance > gameState.safeZone.radius) {
        player.alive = false;
        io.to(roomId).emit('playerDied', playerId);
        return;
      }
      
      // Verificar colisão com outras cobras (incluindo a própria)
      let collision = false;
      gameState.players.forEach((otherPlayer) => {
        if (!otherPlayer.alive) return;
        
        otherPlayer.segments.forEach((segment, index) => {
          // Ignorar a cabeça da própria cobra
          if (otherPlayer.id === player.id && index === 0) return;
          
          if (head.x === segment.x && head.y === segment.y) {
            collision = true;
          }
        });
      });
      
      if (collision) {
        player.alive = false;
        io.to(roomId).emit('playerDied', playerId);
        return;
      }
      
      // Verificar colisão com comida
      let foodEaten = false;
      gameState.food = gameState.food.filter((food, index) => {
        if (head.x === food.x && head.y === food.y) {
          foodEaten = true;
          player.score += 10;
          return false; // Remover a comida
        }
        return true;
      });
      
      // Adicionar nova cabeça
      player.segments.unshift(head);
      
      // Remover a cauda se não comeu
      if (!foodEaten) {
        player.segments.pop();
      } else {
        // Gerar nova comida
        spawnFood(gameState);
      }
    });
    
    // Recontar jogadores vivos após movimentos
    alivePlayers = 0;
    lastAlivePlayer = null;
    gameState.players.forEach((player, playerId) => {
      if (player.alive) {
        alivePlayers++;
        lastAlivePlayer = playerId;
      }
    });
  }
  
  // Verificar condição de vitória
  if (alivePlayers <= 1 && gameState.players.size > 1) {
    gameState.gameOver = true;
    gameState.winner = lastAlivePlayer;
    io.to(roomId).emit('gameOver', { winner: lastAlivePlayer });
  }
  
  // Chance de gerar comida aleatória
  if (Math.random() < FOOD_SPAWN_RATE) {
    spawnFood(gameState);
  }
  
  // Enviar atualização para todos os jogadores na sala
  io.to(roomId).emit('gameUpdate', {
    players: Array.from(gameState.players.entries()).map(([id, player]) => ({
      id,
      segments: player.segments,
      score: player.score,
      alive: player.alive,
      color: player.color
    })),
    food: gameState.food,
    safeZone: gameState.safeZone
  });
  
  // Atualizar temporizador de movimento da cobra
  gameState.snakeMoveTimer += deltaTime;
}

// Configurar Socket.IO
io.on('connection', (socket) => {
  console.log(`Jogador conectado: ${socket.id}`);
  
  // Listar salas disponíveis
  socket.on('getRooms', () => {
    const rooms = Array.from(gameRooms.entries()).map(([id, state]) => ({
      id,
      players: state.players.size,
      maxPlayers: 10,
      inProgress: state.gameStarted
    }));
    socket.emit('roomList', rooms);
  });
  
  // Criar nova sala
  socket.on('createRoom', (playerName, callback) => {
    const roomId = createGameRoom();
    socket.join(roomId);
    
    const gameState = gameRooms.get(roomId);
    const snake = createSnake(gameState, socket.id);
    gameState.players.set(socket.id, snake);
    
    socket.data.roomId = roomId;
    socket.data.playerName = playerName;
    
    callback({ roomId, playerId: socket.id });
    
    // Notificar outros jogadores
    io.to(roomId).emit('playerJoined', {
      id: socket.id,
      name: playerName
    });
  });
  
  // Entrar em uma sala existente
  socket.on('joinRoom', (data, callback) => {
    const { roomId, playerName } = data;
    
    if (!gameRooms.has(roomId)) {
      callback({ success: false, message: 'Sala não encontrada' });
      return;
    }
    
    const gameState = gameRooms.get(roomId);
    
    if (gameState.gameStarted) {
      callback({ success: false, message: 'Jogo já iniciado' });
      return;
    }
    
    if (gameState.players.size >= 10) {
      callback({ success: false, message: 'Sala cheia' });
      return;
    }
    
    socket.join(roomId);
    
    const snake = createSnake(gameState, socket.id);
    gameState.players.set(socket.id, snake);
    
    socket.data.roomId = roomId;
    socket.data.playerName = playerName;
    
    callback({ 
      success: true, 
      playerId: socket.id,
      players: Array.from(gameState.players.keys()).map(id => ({
        id,
        name: id === socket.id ? playerName : 'Jogador'
      }))
    });
    
    // Notificar outros jogadores
    socket.to(roomId).emit('playerJoined', {
      id: socket.id,
      name: playerName
    });
  });
  
  // Iniciar o jogo
  socket.on('startGame', () => {
    const roomId = socket.data.roomId;
    if (!roomId || !gameRooms.has(roomId)) return;
    
    const gameState = gameRooms.get(roomId);
    gameState.gameStarted = true;
    gameState.lastUpdateTime = Date.now();
    gameState.frameTimer = 0; // Temporizador para controle de FPS
    gameState.snakeMoveTimer = 0; // Temporizador para controle de movimento da cobra
    
    io.to(roomId).emit('gameStarted');
    
    // Iniciar loop do jogo com limitação de 10 FPS
    const gameLoop = () => {
      const currentTime = Date.now();
      const deltaTime = currentTime - gameState.lastUpdateTime;
      
      // Acumular tempo para o próximo frame
      gameState.frameTimer += deltaTime;
      
      // Atualizar apenas quando atingir o intervalo de frame (10 FPS)
      if (gameState.frameTimer >= FRAME_INTERVAL) {
        updateGameState(roomId);
        
        // Manter o excedente para o próximo frame para manter a taxa de quadros estável
        gameState.frameTimer %= FRAME_INTERVAL;
        gameState.lastUpdateTime = currentTime;
      }
      
      // Verificar se o jogo acabou ou a sala está vazia
      const updatedGameState = gameRooms.get(roomId);
      if (!updatedGameState || updatedGameState.gameOver || updatedGameState.players.size === 0) {
        // Remover sala após 1 minuto se o jogo acabou
        if (updatedGameState && updatedGameState.gameOver) {
          setTimeout(() => {
            gameRooms.delete(roomId);
          }, 60000);
        }
        return; // Parar o loop
      }
      
      // Continuar o loop
      setTimeout(gameLoop, 1);
    };
    
    // Iniciar o loop do jogo
    gameLoop();
  });
  
  // Atualizar direção da cobra
  socket.on('updateDirection', (direction) => {
    const roomId = socket.data.roomId;
    if (!roomId || !gameRooms.has(roomId)) return;
    
    const gameState = gameRooms.get(roomId);
    const player = gameState.players.get(socket.id);
    
    if (player && player.alive) {
      // Evitar que a cobra volte sobre si mesma
      const currentDir = player.direction;
      if (
        (direction.x === 1 && currentDir.x === -1) ||
        (direction.x === -1 && currentDir.x === 1) ||
        (direction.y === 1 && currentDir.y === -1) ||
        (direction.y === -1 && currentDir.y === 1)
      ) {
        return;
      }
      
      player.nextDirection = direction;
    }
  });
  
  // Desconexão do jogador
  socket.on('disconnect', () => {
    console.log(`Jogador desconectado: ${socket.id}`);
    
    const roomId = socket.data.roomId;
    if (roomId && gameRooms.has(roomId)) {
      const gameState = gameRooms.get(roomId);
      
      // Remover jogador
      gameState.players.delete(socket.id);
      
      // Notificar outros jogadores
      io.to(roomId).emit('playerLeft', socket.id);
      
      // Verificar se a sala está vazia
      if (gameState.players.size === 0) {
        gameRooms.delete(roomId);
      } 
      // Verificar condição de vitória se o jogo já começou
      else if (gameState.gameStarted && !gameState.gameOver) {
        let alivePlayers = 0;
        let lastAlivePlayer = null;
        
        gameState.players.forEach((player, playerId) => {
          if (player.alive) {
            alivePlayers++;
            lastAlivePlayer = playerId;
          }
        });
        
        if (alivePlayers <= 1 && gameState.players.size > 0) {
          gameState.gameOver = true;
          gameState.winner = lastAlivePlayer;
          io.to(roomId).emit('gameOver', { winner: lastAlivePlayer });
        }
      }
    }
  });
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
