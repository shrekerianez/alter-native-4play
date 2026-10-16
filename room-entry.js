(() => {
  const PACKS = ['relationships','spicy','party','awkward','life','dark_humor'];
  const root = document.querySelector('#app');
  let opening = false;

  function esc(value = '') {
    return String(value).replace(/[&<>'\"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[char]));
  }

  async function loadCards() {
    const results = await Promise.allSettled(PACKS.map(async pack => {
      const response = await fetch(`./data/${pack}.json`);
      if (!response.ok) throw new Error(pack);
      return response.json();
    }));
    return results.filter(r => r.status === 'fulfilled').flatMap(r => Array.isArray(r.value.cards) ? r.value.cards : []);
  }

  function backToLocal() {
    const url = new URL(location.href);
    url.searchParams.delete('room');
    location.href = url.toString();
  }

  async function openRoom() {
    if (opening || !window.RoomMode) return;
    opening = true;
    try {
      const cards = await loadCards();
      await window.RoomMode.open({ root, cards, esc, onExit: backToLocal });
    } finally {
      opening = false;
    }
  }

  function enhanceHome() {
    const screen = root?.querySelector('.screen');
    const homeTitle = root?.querySelector('h1');
    const actions = root?.querySelector('.bottom-actions');
    if (!screen || homeTitle?.textContent.trim() !== '4PLAY' || !actions) return;
    if (actions.querySelector('[data-room-launch]')) return;
    const localButton = actions.querySelector('[data-action="new-game"]');
    if (!localButton) return;
    localButton.textContent = 'Один iPhone';
    const roomButton = document.createElement('button');
    roomButton.className = 'btn btn-secondary';
    roomButton.type = 'button';
    roomButton.dataset.roomLaunch = 'true';
    roomButton.textContent = 'Комната · 2–4 iPhone';
    localButton.insertAdjacentElement('afterend', roomButton);
  }

  root?.addEventListener('click', event => {
    if (event.target.closest('[data-room-launch]')) openRoom();
  });

  const observer = new MutationObserver(enhanceHome);
  if (root) observer.observe(root, { childList: true, subtree: true });
  enhanceHome();

  window.addEventListener('load', () => {
    const room = new URL(location.href).searchParams.get('room');
    if (room) setTimeout(openRoom, 50);
  });
})();
