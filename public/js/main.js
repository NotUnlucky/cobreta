/**
 * Arquivo principal para inicializar o jogo Snake Battle Royale
 */

// Variáveis globais
let socket;
let game;
let ui;
let controls;

// Função para inicializar o jogo
function init() {
  // Conectar ao servidor Socket.IO
  socket = io();
  
  // Inicializar interface do usuário
  ui = new UI(socket);
  
  // Configurar eventos do Socket.IO
  setupSocketEvents();
}

// Configurar eventos do Socket.IO
function setupSocketEvents() {
  // Evento de conexão
  socket.on('connect', () => {
    console.log('Conectado ao servidor!');
  });
  
  // Evento de desconexão
  socket.on('disconnect', () => {
    console.log('Desconectado do servidor!');
  });
  
  // Evento de erro de conexão
  socket.on('connect_error', (error) => {
    console.error('Erro de conexão:', error);
    alert('Não foi possível conectar ao servidor. Tente novamente mais tarde.');
  });
  
  // Evento de lista de salas
  socket.on('roomList', (rooms) => {
    ui.updateRoomList(rooms);
  });
  
  // Evento de jogador entrou na sala
  socket.on('playerJoined', (player) => {
    ui.addPlayer(player);
  });
  
  // Evento de jogador saiu da sala
  socket.on('playerLeft', (playerId) => {
    ui.removePlayer(playerId);
  });
  
  // Evento de início de jogo
  socket.on('gameStarted', () => {
    // Inicializar o jogo
    const canvas = document.getElementById('game-canvas');
    game = new Game(canvas);
    game.init(ui.playerId);
    
    // Inicializar controles
    controls = new Controls(socket);
    
    // Mostrar tela do jogo
    gameUtils.showScreen('game-screen');
  });
  
  // Evento de atualização do jogo
  socket.on('gameUpdate', (data) => {
    if (game) {
      game.updateGameState(data);
    }
  });
  
  // Evento de atualização da zona
  socket.on('zoneUpdate', (zoneData) => {
    if (game) {
      game.safeZone = zoneData;
    }
  });
  
  // Evento de atualização do temporizador de encolhimento
  socket.on('shrinkTimer', (timerData) => {
    if (game) {
      game.updateShrinkTimer(timerData);
    }
  });
  
  // Evento de jogador morreu
  socket.on('playerDied', (playerId) => {
    if (game && playerId === ui.playerId) {
      // Se o jogador local morreu, exibir mensagem
      console.log('Você morreu!');
    }
  });
  
  // Evento de fim de jogo
  socket.on('gameOver', (data) => {
    if (game) {
      game.handleGameOver(data);
    }
  });
}

// Inicializar quando o documento estiver pronto
document.addEventListener('DOMContentLoaded', init);

// Prevenir comportamentos padrão de toque que podem interferir com o jogo
document.addEventListener('touchmove', (e) => {
  if (e.target.id === 'game-canvas') {
    e.preventDefault();
  }
}, { passive: false });

// Desabilitar zoom em dispositivos móveis
document.addEventListener('gesturestart', (e) => {
  e.preventDefault();
});

// Tratar redimensionamento da janela
window.addEventListener('resize', () => {
  if (game) {
    game.resize();
  }
});
