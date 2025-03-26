/**
 * Gerenciamento de controles para o jogo Snake Battle Royale
 */

class Controls {
  constructor(socket) {
    this.socket = socket;
    this.direction = { x: 0, y: 0 };
    this.isMobile = this.checkIfMobile();
    this.touchControls = document.getElementById('mobile-controls');
    
    // Inicializar controles
    this.init();
    
    // Adicionar listener para mudanças de tamanho da janela
    window.addEventListener('resize', () => {
      const wasMobile = this.isMobile;
      this.isMobile = this.checkIfMobile();
      
      // Se o estado mudou, atualizar a interface
      if (wasMobile !== this.isMobile) {
        this.updateControlsVisibility();
      }
    });
  }
  
  // Verificar se é dispositivo móvel
  checkIfMobile() {
    // Verificação mais robusta para dispositivos móveis
    const userAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const touchScreen = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (navigator.msMaxTouchPoints > 0);
    const smallScreen = window.innerWidth <= 768;
    
    // Considerar dispositivo móvel se pelo menos dois critérios forem atendidos
    // ou se for explicitamente um dispositivo móvel pelo userAgent
    const isMobile = userAgent || (touchScreen && smallScreen);
    
    console.log('Detecção de dispositivo móvel:', {
      userAgent,
      touchScreen,
      smallScreen,
      resultado: isMobile
    });
    
    return isMobile;
  }
  
  // Atualizar visibilidade dos controles com base no tipo de dispositivo
  updateControlsVisibility() {
    if (this.isMobile) {
      this.touchControls.classList.remove('hidden');
      console.log('Controles touch ativados');
    } else {
      this.touchControls.classList.add('hidden');
      console.log('Controles touch desativados');
    }
  }
  
  // Inicializar controles
  init() {
    // Configurar visibilidade dos controles
    this.updateControlsVisibility();
    
    // Configurar controles de acordo com o dispositivo
    if (this.isMobile) {
      this.setupTouchControls();
      console.log('Controles touch inicializados');
    }
    
    // Sempre configurar controles de teclado (para compatibilidade com teclados externos em dispositivos móveis)
    this.setupKeyboardControls();
    console.log('Controles de teclado inicializados');
  }
  
  // Configurar controles de teclado
  setupKeyboardControls() {
    document.addEventListener('keydown', (event) => {
      if (!this.socket) return;
      
      let newDirection = { ...this.direction };
      
      switch (event.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          if (this.direction.y !== 1) { // Não permitir movimento para baixo se estiver indo para cima
            newDirection = { x: 0, y: -1 };
          }
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          if (this.direction.y !== -1) { // Não permitir movimento para cima se estiver indo para baixo
            newDirection = { x: 0, y: 1 };
          }
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          if (this.direction.x !== 1) { // Não permitir movimento para direita se estiver indo para esquerda
            newDirection = { x: -1, y: 0 };
          }
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          if (this.direction.x !== -1) { // Não permitir movimento para esquerda se estiver indo para direita
            newDirection = { x: 1, y: 0 };
          }
          break;
        default:
          return; // Ignorar outras teclas
      }
      
      // Verificar se a direção mudou
      if (newDirection.x !== this.direction.x || newDirection.y !== this.direction.y) {
        this.direction = newDirection;
        this.socket.emit('updateDirection', this.direction);
        console.log('Direção atualizada (teclado):', this.direction);
      }
    });
  }
  
  // Configurar controles touch
  setupTouchControls() {
    const upBtn = document.getElementById('up-btn');
    const downBtn = document.getElementById('down-btn');
    const leftBtn = document.getElementById('left-btn');
    const rightBtn = document.getElementById('right-btn');
    
    // Função para lidar com eventos de toque
    const handleTouch = (newDirection) => {
      if (!this.socket) return;
      
      // Verificar se a direção mudou
      if (newDirection.x !== this.direction.x || newDirection.y !== this.direction.y) {
        this.direction = newDirection;
        this.socket.emit('updateDirection', this.direction);
        console.log('Direção atualizada (touch):', this.direction);
      }
    };
    
    // Adicionar eventos de toque e clique para compatibilidade com simuladores
    const addEvents = (element, direction) => {
      // Evento de toque para dispositivos reais
      element.addEventListener('touchstart', (e) => {
        e.preventDefault();
        handleTouch(direction);
      }, { passive: false });
      
      // Evento de clique para simular toque em navegadores desktop
      element.addEventListener('mousedown', () => {
        handleTouch(direction);
      });
    };
    
    // Configurar eventos para cada botão
    addEvents(upBtn, { x: 0, y: -1 });
    addEvents(downBtn, { x: 0, y: 1 });
    addEvents(leftBtn, { x: -1, y: 0 });
    addEvents(rightBtn, { x: 1, y: 0 });
    
    // Prevenir comportamentos padrão de toque que podem interferir com o jogo
    this.touchControls.addEventListener('touchmove', (e) => {
      e.preventDefault();
    }, { passive: false });
    
    // Adicionar suporte a gestos deslizantes (swipes) na tela do jogo
    const gameCanvas = document.getElementById('game-canvas');
    let touchStartX = 0;
    let touchStartY = 0;
    
    gameCanvas.addEventListener('touchstart', (e) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }, { passive: true });
    
    gameCanvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
    }, { passive: false });
    
    gameCanvas.addEventListener('touchend', (e) => {
      if (!this.socket) return;
      
      const touchEndX = e.changedTouches[0].clientX;
      const touchEndY = e.changedTouches[0].clientY;
      
      const diffX = touchEndX - touchStartX;
      const diffY = touchEndY - touchStartY;
      
      // Determinar a direção do swipe (se for significativo)
      if (Math.abs(diffX) > 30 || Math.abs(diffY) > 30) {
        let newDirection = { ...this.direction };
        
        if (Math.abs(diffX) > Math.abs(diffY)) {
          // Swipe horizontal
          if (diffX > 0 && this.direction.x !== -1) {
            newDirection = { x: 1, y: 0 };
          } else if (diffX < 0 && this.direction.x !== 1) {
            newDirection = { x: -1, y: 0 };
          }
        } else {
          // Swipe vertical
          if (diffY > 0 && this.direction.y !== -1) {
            newDirection = { x: 0, y: 1 };
          } else if (diffY < 0 && this.direction.y !== 1) {
            newDirection = { x: 0, y: -1 };
          }
        }
        
        // Verificar se a direção mudou
        if (newDirection.x !== this.direction.x || newDirection.y !== this.direction.y) {
          this.direction = newDirection;
          this.socket.emit('updateDirection', this.direction);
          console.log('Direção atualizada (swipe):', this.direction);
        }
      }
    }, { passive: true });
  }
  
  // Resetar direção
  reset() {
    this.direction = { x: 0, y: 0 };
  }
}

// Exportar classe
window.Controls = Controls;
