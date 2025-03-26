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
const TARGET_FPS = 25; // Alterado para 20 FPS para um equilíbrio entre fluidez e desempenho
const FRAME_INTERVAL = 1000 / TARGET_FPS; // Intervalo entre frames em ms
const SNAKE_MOVE_INTERVAL = 350; // A cobra se move a cada 350ms, velocidade mais adequada para jogar
const FOOD_SPAWN_RATE = 0.02; // Probabilidade de comida aparecer por tick
const SHRINK_INTERVAL = 30000; // Intervalo para encolher a zona (30 segundos)
const SHRINK_AMOUNT = 1; // Quantidade de células que a zona encolhe por vez
const POWERUP_SPAWN_RATE = 0.005; // Probabilidade de power-up aparecer por tick
const BULLET_SPEED = 0.5; // Velocidade dos tiros em células por frame

// Armazenar salas de jogo
const gameRooms = new Map();

// Função para criar uma nova sala
function createGameRoom() {
  const roomId = uuidv4().substring(0, 6).toUpperCase(); // Código da sala de 6 caracteres
  
  const gameState = {
    players: new Map(),
    food: [],
    powerups: [], // Array para armazenar power-ups
    bullets: [], // Array para armazenar tiros
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
  
  // Gerar exatamente 3 comidas iniciais
  gameState.food = [];
  for (let i = 0; i < 3; i++) {
    spawnFood(gameState);
  }
  
  gameRooms.set(roomId, gameState);
  return roomId;
}

// Função para gerar comida aleatória
function spawnFood(gameState) {
  // Verificar se já atingiu o limite de 3 comidas
  if (gameState.food.length >= 3) {
    return; // Não gerar mais comida se já tiver 3
  }
  
  const x = Math.floor(Math.random() * gameState.gridSize);
  const y = Math.floor(Math.random() * gameState.gridSize);
  
  // Verificar se está dentro da zona segura
  const centerX = gameState.gridSize / 2;
  const centerY = gameState.gridSize / 2;
  const distance = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
  
  if (distance <= gameState.safeZone.radius) {
    gameState.food.push({ x, y, type: 'apple' }); // Adicionando tipo 'apple' para identificar
  } else {
    // Tentar novamente se estiver fora da zona
    spawnFood(gameState);
  }
}

// Função para gerar power-up aleatoriamente
function spawnPowerup(gameState) {
  // Verificar se já atingiu o limite de 2 power-ups
  if (gameState.powerups.length >= 2) {
    return; // Não gerar mais power-ups se já tiver 2
  }
  
  const x = Math.floor(Math.random() * gameState.gridSize);
  const y = Math.floor(Math.random() * gameState.gridSize);
  
  // Verificar se está dentro da zona segura
  const centerX = gameState.gridSize / 2;
  const centerY = gameState.gridSize / 2;
  const distance = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
  
  if (distance <= gameState.safeZone.radius) {
    // Escolher aleatoriamente entre power-up de arma e dash
    const powerupTypes = ['gun', 'dash'];
    const randomType = powerupTypes[Math.floor(Math.random() * powerupTypes.length)];
    
    gameState.powerups.push({ x, y, type: randomType });
  } else {
    // Tentar novamente se estiver fora da zona
    spawnPowerup(gameState);
  }
}

// Função para criar uma cobra para um novo jogador
function createSnake(gameState, playerId) {
  // Posição aleatória dentro da zona segura
  let x, y;
  let validPosition = false;
  
  // Tentar encontrar uma posição válida para a cobra
  while (!validPosition) {
    // Posição aleatória
    x = Math.floor(Math.random() * gameState.gridSize);
    y = Math.floor(Math.random() * gameState.gridSize);
    
    // Verificar se está dentro da zona segura
    const centerX = gameState.gridSize / 2;
    const centerY = gameState.gridSize / 2;
    const distance = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
    
    if (distance <= gameState.safeZone.radius - 2) {
      validPosition = true;
    }
  }
  
  // Criar cobra
  const snake = {
    id: playerId,
    segments: [],
    direction: '',  // Iniciar sem direção definida
    nextDirection: '', // Iniciar sem direção definida
    alive: true,
    score: 0,
    color: getRandomColor(),
    hasGun: false, // Novo atributo para indicar se o jogador tem uma arma
    canShoot: false, // Novo atributo para controlar se o jogador pode atirar
    hasDash: false, // Novo atributo para indicar se o jogador tem dash
    canDash: false, // Novo atributo para controlar se o jogador pode usar dash
    isDashing: false, // Indica se o jogador está em modo dash
    dashEndTime: 0 // Tempo em que o dash termina
  };
  
  // Adicionar segmentos iniciais
  for (let i = 0; i < INITIAL_SNAKE_LENGTH; i++) {
    snake.segments.unshift({ x: x - i, y });
  }
  
  // Adicionar ao estado do jogo
  gameState.players.set(playerId, snake);
  return snake;
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

// Função para criar um tiro
function createBullet(gameState, playerId) {
  const player = gameState.players.get(playerId);
  if (!player || !player.alive || !player.hasGun || !player.canShoot) return;
  
  // Obter a cabeça da cobra
  const head = player.segments[0];
  let directionX = 0;
  let directionY = 0;
  
  // Definir a direção do tiro com base na direção da cobra
  switch (player.direction) {
    case 'up':
      directionY = -1;
      break;
    case 'down':
      directionY = 1;
      break;
    case 'left':
      directionX = -1;
      break;
    case 'right':
      directionX = 1;
      break;
  }
  
  // Criar o tiro
  const bullet = {
    x: head.x,
    y: head.y,
    directionX,
    directionY,
    ownerId: playerId,
    active: true
  };
  
  // Adicionar o tiro ao jogo
  gameState.bullets.push(bullet);
  
  // Impedir que o jogador atire novamente até pegar outro power-up
  player.canShoot = false;
  player.hasGun = false;
  
  return bullet;
}

// Função para atualizar os tiros
function updateBullets(gameState) {
  const bulletsToRemove = [];
  
  // Atualizar posição dos tiros
  gameState.bullets.forEach((bullet, index) => {
    if (!bullet.active) {
      bulletsToRemove.push(index);
      return;
    }
    
    // Mover o tiro
    bullet.x += bullet.directionX * BULLET_SPEED;
    bullet.y += bullet.directionY * BULLET_SPEED;
    
    // Verificar se o tiro saiu do mapa
    if (bullet.x < 0 || bullet.x >= gameState.gridSize || 
        bullet.y < 0 || bullet.y >= gameState.gridSize) {
      bulletsToRemove.push(index);
      return;
    }
    
    // Verificar se o tiro saiu da zona segura
    const centerX = gameState.gridSize / 2;
    const centerY = gameState.gridSize / 2;
    const distance = Math.sqrt(Math.pow(bullet.x - centerX, 2) + Math.pow(bullet.y - centerY, 2));
    if (distance > gameState.safeZone.radius) {
      bulletsToRemove.push(index);
      return;
    }
    
    // Verificar colisões com jogadores
    gameState.players.forEach((player, playerId) => {
      // Não verificar colisão com o próprio atirador
      if (playerId === bullet.ownerId || !player.alive) return;
      
      // Verificar colisão com cada segmento da cobra
      player.segments.forEach((segment, segmentIndex) => {
        // Verificar se o tiro atingiu um segmento
        if (Math.floor(bullet.x) === segment.x && Math.floor(bullet.y) === segment.y) {
          // Marcar o tiro para remoção
          bulletsToRemove.push(index);
          
          // Aplicar dano à cobra
          if (player.segments.length > 3) {
            // Reduzir o tamanho da cobra em 3 segmentos
            player.segments = player.segments.slice(0, player.segments.length - 3);
            // Notificar o jogador que foi atingido
            io.to(playerId).emit('playerHit');
          } else {
            // Matar a cobra se ela tiver 3 ou menos segmentos
            player.alive = false;
            // Notificar o jogador que morreu
            io.to(playerId).emit('playerDied', playerId);
            // Dar pontos para o atirador
            const shooter = gameState.players.get(bullet.ownerId);
            if (shooter && shooter.alive) {
              shooter.score += 10;
            }
          }
          
          return;
        }
      });
    });
  });
  
  // Remover tiros inativos
  for (let i = bulletsToRemove.length - 1; i >= 0; i--) {
    gameState.bullets.splice(bulletsToRemove[i], 1);
  }
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
    
    // Verificar e remover comidas que estão fora da zona segura após o encolhimento
    const centerX = gameState.gridSize / 2;
    const centerY = gameState.gridSize / 2;
    const foodToRemove = [];
    
    gameState.food.forEach((food, index) => {
      const distance = Math.sqrt(Math.pow(food.x - centerX, 2) + Math.pow(food.y - centerY, 2));
      if (distance > gameState.safeZone.radius) {
        foodToRemove.push(index);
      }
    });
    
    // Remover comidas de trás para frente para não afetar os índices
    for (let i = foodToRemove.length - 1; i >= 0; i--) {
      gameState.food.splice(foodToRemove[i], 1);
    }
    
    // Gerar novas comidas para substituir as removidas
    for (let i = 0; i < foodToRemove.length; i++) {
      if (gameState.food.length < 3) {
        spawnFood(gameState);
      }
    }
    
    // Verificar e remover power-ups que estão fora da zona segura
    const powerupsToRemove = [];
    
    gameState.powerups.forEach((powerup, index) => {
      const distance = Math.sqrt(Math.pow(powerup.x - centerX, 2) + Math.pow(powerup.y - centerY, 2));
      if (distance > gameState.safeZone.radius) {
        powerupsToRemove.push(index);
      }
    });
    
    // Remover power-ups de trás para frente
    for (let i = powerupsToRemove.length - 1; i >= 0; i--) {
      gameState.powerups.splice(powerupsToRemove[i], 1);
    }
  }
  
  // Calcular tempo restante até o próximo encolhimento
  const timeUntilShrink = Math.max(0, gameState.safeZone.nextShrinkTime - currentTime);
  const secondsUntilShrink = Math.ceil(timeUntilShrink / 1000);
  
  // Enviar atualização do temporizador para os clientes
  io.to(roomId).emit('shrinkTimer', { seconds: secondsUntilShrink });
  
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
      
      // Verificar se o dash está ativo e se terminou
      if (player.isDashing && currentTime >= player.dashEndTime) {
        player.isDashing = false;
        io.to(playerId).emit('dashEnded');
      }
      
      // Atualizar direção
      player.direction = player.nextDirection;
      
      // Mover a cabeça
      const head = { ...player.segments[0] };
      
      // Só mover se houver uma direção definida
      if (!player.direction) {
        return; // Não mover se não houver direção definida
      }
      
      // Determinar a distância a mover (normal ou dash)
      const moveDistance = player.isDashing ? 4 : 1;
      
      // Converter direção string para movimento
      switch (player.direction) {
        case 'up':
          head.y -= moveDistance;
          break;
        case 'down':
          head.y += moveDistance;
          break;
        case 'left':
          head.x -= moveDistance;
          break;
        case 'right':
          head.x += moveDistance;
          break;
        default:
          // Se não houver direção, não mover
          return;
      }
      
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
      
      // Verificar colisão com power-ups
      gameState.powerups = gameState.powerups.filter((powerup, index) => {
        if (head.x === powerup.x && head.y === powerup.y) {
          // Aplicar efeito do power-up
          if (powerup.type === 'gun') {
            player.hasGun = true;
            player.canShoot = true;
            // Notificar o jogador que pegou uma arma
            io.to(playerId).emit('gunCollected');
          } else if (powerup.type === 'dash') {
            player.hasDash = true;
            player.canDash = true;
            // Notificar o jogador que pegou um dash
            io.to(playerId).emit('dashCollected');
          }
          return false; // Remover o power-up
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
  
  // Atualizar tiros
  updateBullets(gameState);
  
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
  
  // Chance de gerar power-up aleatório
  if (Math.random() < POWERUP_SPAWN_RATE) {
    spawnPowerup(gameState);
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
    powerups: gameState.powerups,
    safeZone: gameState.safeZone,
    bullets: gameState.bullets
  });
  
  // Atualizar temporizador de movimento da cobra
  gameState.snakeMoveTimer += deltaTime;
  
  // Limitar o valor máximo do temporizador para evitar movimentos muito rápidos após pausas ou lags
  if (gameState.snakeMoveTimer > SNAKE_MOVE_INTERVAL * 1.5) {
    gameState.snakeMoveTimer = SNAKE_MOVE_INTERVAL;
  }
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
    gameState.snakeMoveTimer = SNAKE_MOVE_INTERVAL - 50; // Iniciar próximo do limite para evitar movimento rápido inicial
    
    io.to(roomId).emit('gameStarted');
    
    // Iniciar loop do jogo com limitação de 20 FPS
    const gameLoop = () => {
      const currentTime = Date.now();
      const deltaTime = currentTime - gameState.lastUpdateTime;
      
      // Acumular tempo para o próximo frame
      gameState.frameTimer += deltaTime;
      
      // Atualizar apenas quando atingir o intervalo de frame (20 FPS)
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
    if (!player || !player.alive) return;
    
    // Evitar que a cobra volte sobre si mesma
    const currentDir = player.direction;
    if (
      (direction === 'up' && currentDir === 'down') ||
      (direction === 'down' && currentDir === 'up') ||
      (direction === 'left' && currentDir === 'right') ||
      (direction === 'right' && currentDir === 'left')
    ) {
      return;
    }
    
    // Atualizar direção
    player.nextDirection = direction;
    
    // Ajustar o temporizador de movimento para evitar movimentos muito rápidos após mudar de direção
    if (gameState.snakeMoveTimer > SNAKE_MOVE_INTERVAL / 2) {
      gameState.snakeMoveTimer = Math.min(gameState.snakeMoveTimer, SNAKE_MOVE_INTERVAL - 50);
    }
  });
  
  // Atirar
  socket.on('shoot', () => {
    const roomId = socket.data.roomId;
    if (!roomId || !gameRooms.has(roomId)) return;
    
    const gameState = gameRooms.get(roomId);
    createBullet(gameState, socket.id);
  });
  
  // Ativar dash
  socket.on('dash', () => {
    const roomId = socket.data.roomId;
    if (!roomId || !gameRooms.has(roomId)) return;
    
    const gameState = gameRooms.get(roomId);
    const player = gameState.players.get(socket.id);
    if (!player || !player.alive || !player.hasDash || !player.canDash) return;
    
    // Ativar o dash
    player.isDashing = true;
    player.dashEndTime = Date.now() + 1500; // Dash dura 1.5 segundos
    
    // Impedir que o jogador use dash novamente até pegar outro power-up
    player.canDash = false;
    player.hasDash = false;
    
    // Notificar o cliente que o dash foi ativado
    io.to(socket.id).emit('dashActivated');
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
