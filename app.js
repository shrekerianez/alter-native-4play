const result = document.querySelector('#result');
const checkButton = document.querySelector('#checkPwa');

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

checkButton?.addEventListener('click', () => {
  const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  result.textContent = standalone
    ? 'Запущено как установленное PWA.'
    : 'Сейчас открыто в браузере. Добавь 4PLAY на экран «Домой».';
});
