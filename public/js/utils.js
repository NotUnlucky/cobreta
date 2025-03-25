/**
 * Funções utilitárias para o jogo Snake Battle Royale
 */

// Função para gerar uma cor aleatória em formato hexadecimal
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

// Função para ajustar o tamanho do canvas de acordo com o tamanho da tela
function resizeCanvas(canvas, gridSize) {
  const maxSize = Math.min(window.innerWidth, window.innerHeight) - 50;
  const size = Math.floor(maxSize / gridSize) * gridSize;
  
  canvas.width = size;
  canvas.height = size;
  
  return size / gridSize; // Retorna o tamanho de cada célula
}

// Função para desenhar um texto com estilo retrô
function drawRetroText(ctx, text, x, y, fontSize = 16, color = '#0f0') {
  ctx.font = `${fontSize}px 'Press Start 2P', cursive`;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
}

// Função para desenhar um retângulo com bordas arredondadas
function drawRoundedRect(ctx, x, y, width, height, radius, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  ctx.fill();
}

// Função para mostrar uma tela e esconder as outras
function showScreen(screenId) {
  const screens = document.querySelectorAll('.screen');
  screens.forEach(screen => {
    screen.classList.add('hidden');
  });
  
  const targetScreen = document.getElementById(screenId);
  if (targetScreen) {
    targetScreen.classList.remove('hidden');
  }
}

// Função para copiar texto para a área de transferência
function copyToClipboard(text) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}

// Função para calcular a distância entre dois pontos
function calculateDistance(x1, y1, x2, y2) {
  return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
}

// Função para verificar colisão entre dois objetos
function checkCollision(obj1, obj2) {
  return obj1.x === obj2.x && obj1.y === obj2.y;
}

// Função para limitar um valor entre um mínimo e um máximo
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

// Exportar funções
window.gameUtils = {
  getRandomColor,
  resizeCanvas,
  drawRetroText,
  drawRoundedRect,
  showScreen,
  copyToClipboard,
  calculateDistance,
  checkCollision,
  clamp
};
