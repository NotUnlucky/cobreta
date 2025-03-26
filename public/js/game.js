/**
 * Lu00f3gica principal do jogo Snake Battle Royale
 */

class Game {
  constructor(canvas, gridSize = 40) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.gridSize = gridSize;
    this.cellSize = 0;
    this.players = new Map();
    this.food = [];
    this.safeZone = {
      radius: gridSize / 2,
      shrinking: false
    };
    this.localPlayerId = null;
    this.score = 0;
    this.gameOver = false;
    this.winner = null;
    this.lastFrameTime = 0;
    this.animationFrameId = null;
    this.shrinkTimer = 30; // Temporizador para o encolhimento da zona em segundos
    
    // Configurau00e7u00e3o de FPS
    this.targetFPS = 20; // Alterado para 20 FPS para um equilu00edbrio entre fluidez e desempenho
    this.frameInterval = 1000 / this.targetFPS;
    this.frameTimer = 0;
    
    // Redimensionar o canvas
    this.resize();
    
    // Adicionar evento de redimensionamento
    window.addEventListener('resize', () => this.resize());
  }
  
  // Inicializar o jogo
  init(playerId) {
    this.localPlayerId = playerId;
    this.gameOver = false;
    this.winner = null;
    this.score = 0;
    this.lastFrameTime = performance.now();
    
    // Iniciar o loop de renderizau00e7u00e3o
    this.startRenderLoop();
  }
  
  // Redimensionar o canvas
  resize() {
    this.cellSize = gameUtils.resizeCanvas(this.canvas, this.gridSize);
  }
  
  // Atualizar o estado do jogo com dados do servidor
  updateGameState(data) {
    // Atualizar jogadores
    if (data.players) {
      // Limpar jogadores que nu00e3o estu00e3o mais no jogo
      const currentPlayerIds = data.players.map(p => p.id);
      Array.from(this.players.keys()).forEach(id => {
        if (!currentPlayerIds.includes(id)) {
          this.players.delete(id);
        }
      });
      
      // Atualizar ou adicionar jogadores
      data.players.forEach(playerData => {
        const player = this.players.get(playerData.id) || {};
        Object.assign(player, playerData);
        this.players.set(playerData.id, player);
        
        // Atualizar pontuau00e7u00e3o do jogador local
        if (playerData.id === this.localPlayerId) {
          this.score = playerData.score;
          document.getElementById('score').textContent = this.score;
        }
      });
      
      // Atualizar contador de jogadores vivos
      const alivePlayers = Array.from(this.players.values()).filter(p => p.alive).length;
      document.getElementById('alive-players').textContent = alivePlayers;
    }
    
    // Atualizar comida
    if (data.food) {
      this.food = data.food;
    }
    
    // Atualizar zona segura
    if (data.safeZone) {
      this.safeZone = data.safeZone;
    }
  }
  
  // Atualizar o temporizador de encolhimento da zona
  updateShrinkTimer(data) {
    if (data && data.seconds !== undefined) {
      this.shrinkTimer = data.seconds;
    }
  }
  
  // Processar fim de jogo
  handleGameOver(data) {
    this.gameOver = true;
    this.winner = data.winner;
    this.stopRenderLoop();
    
    // Mostrar tela de fim de jogo
    const winnerName = this.winner ? (this.winner === this.localPlayerId ? 'Vocu00ea' : 'Outro jogador') : 'Ninguu00e9m';
    document.getElementById('winner-name').textContent = winnerName;
    gameUtils.showScreen('game-over-screen');
  }
  
  // Iniciar o loop de renderizau00e7u00e3o
  startRenderLoop() {
    if (this.animationFrameId) return;
    
    const animate = (timestamp) => {
      const deltaTime = timestamp - this.lastFrameTime;
      
      // Limitar a taxa de quadros para 30 FPS
      this.frameTimer += deltaTime;
      
      if (this.frameTimer >= this.frameInterval) {
        this.lastFrameTime = timestamp;
        
        // Renderizar o jogo
        this.render(deltaTime);
        
        // Resetar o temporizador de quadros, mantendo o excedente para o pru00f3ximo quadro
        // Isso garante uma taxa de quadros mais estável
        this.frameTimer %= this.frameInterval;
      }
      
      if (!this.gameOver) {
        this.animationFrameId = requestAnimationFrame(animate);
      }
    };
    
    this.lastFrameTime = performance.now();
    this.frameTimer = 0;
    this.animationFrameId = requestAnimationFrame(animate);
  }
  
  // Parar o loop de renderizau00e7u00e3o
  stopRenderLoop() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }
  
  // Renderizar o jogo
  render(deltaTime) {
    // Limpar o canvas
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Desenhar a grade (opcional)
    this.drawGrid();
    
    // Desenhar a zona segura
    this.drawSafeZone();
    
    // Desenhar a comida
    this.drawFood();
    
    // Desenhar as cobras
    this.drawSnakes();
    
    // Desenhar o temporizador da zona
    this.drawShrinkTimer();
  }
  
  // Desenhar a grade
  drawGrid() {
    this.ctx.strokeStyle = '#111';
    this.ctx.lineWidth = 0.5;
    
    for (let i = 0; i <= this.gridSize; i++) {
      const pos = i * this.cellSize;
      
      // Linhas horizontais
      this.ctx.beginPath();
      this.ctx.moveTo(0, pos);
      this.ctx.lineTo(this.canvas.width, pos);
      this.ctx.stroke();
      
      // Linhas verticais
      this.ctx.beginPath();
      this.ctx.moveTo(pos, 0);
      this.ctx.lineTo(pos, this.canvas.height);
      this.ctx.stroke();
    }
  }
  
  // Desenhar a zona segura
  drawSafeZone() {
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;
    const radius = this.safeZone.radius * this.cellSize;
    
    // Desenhar cu00edrculo da zona segura
    this.ctx.strokeStyle = '#f00';
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([5, 5]);
    this.ctx.beginPath();
    this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    this.ctx.stroke();
    this.ctx.setLineDash([]);
    
    // Desenhar u00e1rea fora da zona segura (semi-transparente)
    this.ctx.fillStyle = 'rgba(255, 0, 0, 0.1)';
    this.ctx.beginPath();
    this.ctx.rect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2, true);
    this.ctx.fill();
  }
  
  // Desenhar a comida
  drawFood() {
    this.ctx.fillStyle = '#ff0000';
    this.ctx.font = `${Math.floor(this.cellSize * 0.8)}px Arial`;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    
    this.food.forEach(food => {
      const x = food.x * this.cellSize + this.cellSize / 2;
      const y = food.y * this.cellSize + this.cellSize / 2;
      
      // Desenhar comida como um emoji de mau00e7u00e3
      this.ctx.fillText('\uD83C\uDF4E', x, y);
    });
  }
  
  // Desenhar as cobras
  drawSnakes() {
    this.players.forEach(player => {
      if (!player.segments || !player.alive) return;
      
      const { segments, color } = player;
      const isLocalPlayer = player.id === this.localPlayerId;
      
      // Desenhar cada segmento da cobra
      segments.forEach((segment, index) => {
        const x = segment.x * this.cellSize;
        const y = segment.y * this.cellSize;
        
        // Cor mais clara para a cabeu00e7a
        if (index === 0) {
          // Desenhar cabeu00e7a
          this.ctx.fillStyle = isLocalPlayer ? '#fff' : this.lightenColor(color, 30);
          gameUtils.drawRoundedRect(
            this.ctx,
            x + 1,
            y + 1,
            this.cellSize - 2,
            this.cellSize - 2,
            this.cellSize / 4,
            this.ctx.fillStyle
          );
          
          // Desenhar olhos
          this.ctx.fillStyle = '#000';
          const eyeSize = this.cellSize / 6;
          const eyeOffset = this.cellSize / 4;
          
          // Olho esquerdo
          this.ctx.beginPath();
          this.ctx.arc(
            x + eyeOffset + eyeSize,
            y + eyeOffset + eyeSize,
            eyeSize,
            0,
            Math.PI * 2
          );
          this.ctx.fill();
          
          // Olho direito
          this.ctx.beginPath();
          this.ctx.arc(
            x + this.cellSize - eyeOffset - eyeSize,
            y + eyeOffset + eyeSize,
            eyeSize,
            0,
            Math.PI * 2
          );
          this.ctx.fill();
        } else {
          // Desenhar corpo
          this.ctx.fillStyle = isLocalPlayer ? '#0f0' : color;
          gameUtils.drawRoundedRect(
            this.ctx,
            x + 2,
            y + 2,
            this.cellSize - 4,
            this.cellSize - 4,
            this.cellSize / 5,
            this.ctx.fillStyle
          );
        }
      });
    });
  }
  
  // Clarear uma cor
  lightenColor(color, percent) {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) + amt;
    const G = (num >> 8 & 0x00FF) + amt;
    const B = (num & 0x0000FF) + amt;
    
    return '#' + (
      0x1000000 +
      (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
      (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
      (B < 255 ? B < 1 ? 0 : B : 255)
    ).toString(16).slice(1);
  }
  
  // Desenhar o temporizador de encolhimento da zona
  drawShrinkTimer() {
    // Configurar estilo do texto
    this.ctx.fillStyle = '#FF0000';
    this.ctx.font = '20px Arial';
    this.ctx.textAlign = 'right';
    this.ctx.textBaseline = 'top';
    
    // Formatar o tempo (minutos:segundos)
    const minutes = Math.floor(this.shrinkTimer / 60);
    const seconds = this.shrinkTimer % 60;
    const formattedTime = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    
    // Desenhar o texto
    this.ctx.fillText(`A zona fecha em: ${formattedTime}`, this.canvas.width - 10, 10);
  }
}

// Exportar classe
window.Game = Game;
