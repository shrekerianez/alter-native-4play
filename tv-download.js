(() => {
  const TV_APP = {
    version: '0.1.0-dev',
    size: '2,6 МБ',
    url: 'https://github.com/shrekerianez/alter-native-4play-tv/releases/download/v0.1.0-dev/4PLAY-TV-v0.1.0-dev-debug.apk'
  };

  function mountTvDownloadCard() {
    const newGameButton = document.querySelector('.bottom-actions [data-action="new-game"]');
    const host = newGameButton?.closest('.bottom-actions');

    if (!host || host.querySelector('.tv-download-card')) return;

    const card = document.createElement('a');
    card.className = 'tv-download-card';
    card.href = TV_APP.url;
    card.target = '_blank';
    card.rel = 'noopener';
    card.setAttribute('aria-label', `Скачать 4PLAY TV ${TV_APP.version} для Android TV и Google TV`);
    card.innerHTML = `
      <span class="tv-download-icon" aria-hidden="true"></span>
      <span class="tv-download-copy">
        <span class="tv-download-title">4PLAY TV <span class="tv-download-badge">DEV</span></span>
        <span class="tv-download-subtitle">Android TV · Google TV</span>
      </span>
      <span class="tv-download-info">
        <span>${TV_APP.version}</span>
        <small>${TV_APP.size}</small>
      </span>
      <span class="tv-download-arrow" aria-hidden="true">↓</span>`;

    newGameButton.insertAdjacentElement('afterend', card);
  }

  const appRoot = document.querySelector('#app');
  if (!appRoot) return;

  new MutationObserver(mountTvDownloadCard).observe(appRoot, {
    childList: true,
    subtree: true
  });

  mountTvDownloadCard();
})();
