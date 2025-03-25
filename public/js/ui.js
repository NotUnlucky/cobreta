/**
 * Gerenciamento da interface do usuu00e1rio para o jogo Snake Battle Royale
 */

class UI {
  constructor(socket) {
    this.socket = socket;
    this.screens = {
      start: document.getElementById('start-screen'),
      join: document.getElementById('join-screen'),
      roomList: document.getElementById('room-list-screen'),
      lobby: document.getElementById('lobby-screen'),
      game: document.getElementById('game-screen'),
      gameOver: document.getElementById('game-over-screen')
    };
    
    this.elements = {
      playerName: document.getElementById('player-name'),
      roomCode: document.getElementById('room-code'),
      roomIdDisplay: document.getElementById('room-id-display'),
      playerList: document.getElementById('player-list'),
      roomsContainer: document.getElementById('rooms-container'),
      score: document.getElementById('score'),
      alivePlayers: document.getElementById('alive-players'),
      winnerName: document.getElementById('winner-name')
    };
    
    this.buttons = {
      createRoom: document.getElementById('create-room-btn'),
      joinRoom: document.getElementById('join-room-btn'),
      roomList: document.getElementById('room-list-btn'),
      join: document.getElementById('join-btn'),
      back: document.getElementById('back-btn'),
      backFromList: document.getElementById('back-from-list-btn'),
      refreshRooms: document.getElementById('refresh-rooms-btn'),
      startGame: document.getElementById('start-game-btn'),
      leaveRoom: document.getElementById('leave-room-btn'),
      playAgain: document.getElementById('play-again-btn'),
      mainMenu: document.getElementById('main-menu-btn')
    };
    
    this.roomId = null;
    this.playerId = null;
    
    // Inicializar eventos da UI
    this.init();
  }
  
  // Inicializar eventos da UI
  init() {
    // Eventos da tela inicial
    this.buttons.createRoom.addEventListener('click', () => this.handleCreateRoom());
    this.buttons.joinRoom.addEventListener('click', () => gameUtils.showScreen('join-screen'));
    this.buttons.roomList.addEventListener('click', () => this.handleGetRooms());
    
    // Eventos da tela de entrar em sala
    this.buttons.join.addEventListener('click', () => this.handleJoinRoom());
    this.buttons.back.addEventListener('click', () => gameUtils.showScreen('start-screen'));
    
    // Eventos da tela de lista de salas
    this.buttons.backFromList.addEventListener('click', () => gameUtils.showScreen('start-screen'));
    this.buttons.refreshRooms.addEventListener('click', () => this.handleGetRooms());
    
    // Eventos da tela de sala de espera
    this.buttons.startGame.addEventListener('click', () => this.handleStartGame());
    this.buttons.leaveRoom.addEventListener('click', () => this.handleLeaveRoom());
    
    // Eventos da tela de fim de jogo
    this.buttons.playAgain.addEventListener('click', () => this.handlePlayAgain());
    this.buttons.mainMenu.addEventListener('click', () => this.handleMainMenu());
    
    // Adicionar evento de clique no cu00f3digo da sala para copiar
    this.elements.roomIdDisplay.addEventListener('click', () => {
      if (this.roomId) {
        gameUtils.copyToClipboard(this.roomId);
        alert('Cu00f3digo da sala copiado para a u00e1rea de transferu00eancia!');
      }
    });
    
    // Adicionar dica visual de que o cu00f3digo u00e9 clicu00e1vel
    this.elements.roomIdDisplay.style.cursor = 'pointer';
    this.elements.roomIdDisplay.title = 'Clique para copiar';
  }
  
  // Criar uma nova sala
  handleCreateRoom() {
    const playerName = this.elements.playerName.value.trim() || 'Jogador';
    
    if (this.socket) {
      this.socket.emit('createRoom', playerName, (response) => {
        if (response && response.roomId) {
          this.roomId = response.roomId;
          this.playerId = response.playerId;
          
          // Atualizar interface
          this.elements.roomIdDisplay.textContent = this.roomId;
          this.updatePlayerList([{ id: this.playerId, name: playerName }]);
          
          // Mostrar tela de sala de espera
          gameUtils.showScreen('lobby-screen');
        }
      });
    }
  }
  
  // Entrar em uma sala existente
  handleJoinRoom() {
    const roomId = this.elements.roomCode.value.trim().toUpperCase();
    const playerName = this.elements.playerName.value.trim() || 'Jogador';
    
    if (!roomId) {
      alert('Por favor, insira o cu00f3digo da sala!');
      return;
    }
    
    if (this.socket) {
      this.socket.emit('joinRoom', { roomId, playerName }, (response) => {
        if (response.success) {
          this.roomId = roomId;
          this.playerId = response.playerId;
          
          // Atualizar interface
          this.elements.roomIdDisplay.textContent = this.roomId;
          this.updatePlayerList(response.players);
          
          // Mostrar tela de sala de espera
          gameUtils.showScreen('lobby-screen');
        } else {
          alert(`Erro ao entrar na sala: ${response.message}`);
        }
      });
    }
  }
  
  // Obter lista de salas disponu00edveis
  handleGetRooms() {
    if (this.socket) {
      this.socket.emit('getRooms');
      gameUtils.showScreen('room-list-screen');
    }
  }
  
  // Atualizar lista de salas
  updateRoomList(rooms) {
    const container = this.elements.roomsContainer;
    container.innerHTML = '';
    
    if (rooms.length === 0) {
      container.innerHTML = '<p class="empty-list">Nenhuma sala disponu00edvel no momento.</p>';
      return;
    }
    
    rooms.forEach(room => {
      const roomElement = document.createElement('div');
      roomElement.className = 'room-item';
      roomElement.innerHTML = `
        <span>Sala: ${room.id}</span>
        <span>Jogadores: ${room.players}/${room.maxPlayers}</span>
        <span>${room.inProgress ? 'Em andamento' : 'Aguardando'}</span>
      `;
      
      // Adicionar evento de clique para entrar na sala
      if (!room.inProgress) {
        roomElement.addEventListener('click', () => {
          this.elements.roomCode.value = room.id;
          gameUtils.showScreen('join-screen');
        });
        roomElement.style.cursor = 'pointer';
      } else {
        roomElement.classList.add('in-progress');
      }
      
      container.appendChild(roomElement);
    });
  }
  
  // Atualizar lista de jogadores na sala
  updatePlayerList(players) {
    const list = this.elements.playerList;
    list.innerHTML = '';
    
    players.forEach(player => {
      const item = document.createElement('li');
      item.textContent = player.name;
      
      // Destacar o jogador local
      if (player.id === this.playerId) {
        item.classList.add('local-player');
        item.textContent += ' (vocu00ea)';
      }
      
      list.appendChild(item);
    });
    
    // Mostrar/ocultar botu00e3o de iniciar jogo
    // Apenas o criador da sala (primeiro jogador) pode iniciar o jogo
    const isRoomCreator = players.length > 0 && players[0].id === this.playerId;
    this.buttons.startGame.style.display = isRoomCreator ? 'block' : 'none';
  }
  
  // Adicionar um jogador u00e0 lista
  addPlayer(player) {
    const list = this.elements.playerList;
    const item = document.createElement('li');
    item.textContent = player.name;
    item.dataset.id = player.id;
    list.appendChild(item);
  }
  
  // Remover um jogador da lista
  removePlayer(playerId) {
    const list = this.elements.playerList;
    const item = list.querySelector(`li[data-id="${playerId}"]`);
    if (item) {
      list.removeChild(item);
    }
  }
  
  // Iniciar o jogo
  handleStartGame() {
    if (this.socket) {
      this.socket.emit('startGame');
    }
  }
  
  // Sair da sala
  handleLeaveRoom() {
    if (this.socket) {
      this.socket.disconnect();
      location.reload(); // Recarregar a pu00e1gina para reiniciar a conexu00e3o
    }
  }
  
  // Jogar novamente
  handlePlayAgain() {
    // Voltar para a tela de sala de espera
    gameUtils.showScreen('lobby-screen');
  }
  
  // Voltar para o menu principal
  handleMainMenu() {
    if (this.socket) {
      this.socket.disconnect();
      location.reload(); // Recarregar a pu00e1gina para reiniciar a conexu00e3o
    }
  }
}

// Exportar classe
window.UI = UI;
