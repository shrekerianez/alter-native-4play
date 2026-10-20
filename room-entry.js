(() => {
  const PACKS = ['relationships','spicy','party','awkward','life','dark_humor'];
  const root = document.querySelector('#app');
  let opening = false;

  function esc(value = '') {
    return String(value).replace(/[&<>'\"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[char]));
  }

  async function loadCards() {
    const results = await Promise.allSettled(PACKS.map(async pack => {
      const response = await fetch(`./data/${pack}.json`, { cache: 'no-store' });
      if (!response.ok) throw new Error(pack);
      return response.json();
    }));
    return results.filter(r => r.status === 'fulfilled').flatMap(r => Array.isArray(r.value.cards) ? r.value.cards : []);
  }

  function backToLocal() {
    const url = new URL(location.href);
    url.searchParams.delete('room');
    url.searchParams.delete('tvhost');
    location.href = url.toString();
  }

  async function openRoom() {
    if (opening) return;
    const params = new URL(location.href).searchParams;
    const tvHosted = params.get('tvhost') === '1';
    const client = tvHosted ? window.TVRoomClient : window.RoomMode;
    if (!client) return;
    opening = true;
    try {
      const cards = await loadCards();
      await client.open({ root, cards, esc, onExit: backToLocal });
    } catch (error) {
      console.error('4PLAY room open failed', error);
      root.innerHTML = '<section class="screen"><div class="hero"><div class="logo-mark">4P</div><h1>Не удалось открыть комнату</h1><p class="lead">Закрой приложение и открой снова. Локальный режим при этом не повреждён.</p></div><div class="bottom-actions"><button class="btn btn-primary" type="button" data-room-recover>На главный экран</button></div></section>';
    } finally {
      opening = false;
    }
  }

  function openLogicEntry() {
    root.innerHTML = `
      <section class="screen">
        <div class="topbar"><button type="button" class="icon-btn" data-logic-home aria-label="Назад">‹</button><div class="brand-mini">AlterNative · 4PLAY</div><div></div></div>
        <div class="hero"><div class="logo-mark">🧠</div><h1 style="font-size:48px">4PLAY Логика</h1><p class="lead">Сканируй QR на телевизоре или введи код комнаты.</p></div>
        <div class="logic-join-scan"><button type="button" class="btn btn-primary" data-logic-scan>📷 Сканировать QR-код</button></div>
        <form id="logicCodeForm" class="form-list">
          <label class="field"><span>Код комнаты</span><input name="code" maxlength="5" minlength="5" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="7KQ2A" required></label>
          <button class="btn btn-primary" type="submit">Присоединиться</button>
          <p id="logicCodeError" class="error" role="alert"></p>
        </form>
      </section>`;
    root.querySelector('[name="code"]')?.focus({preventScroll:true});
  }

  function enhanceHome() {
    const screen = root?.querySelector('.screen');
    const homeTitle = root?.querySelector('h1');
    const actions = root?.querySelector('.bottom-actions');
    if (!screen || homeTitle?.textContent.trim() !== '4PLAY' || !actions) return;

    if (screen.dataset.roomEnhanced === 'true') return;
    screen.dataset.roomEnhanced = 'true';

    const badges = root.querySelector('.badges');
    if (badges) badges.innerHTML = '<span class="badge">2–4 игрока</span><span class="badge">1×1 / 2×2</span><span class="badge">18+</span><span class="badge">PWA</span>';

    const localButton = actions.querySelector('[data-action="new-game"]');
    if (!localButton) return;
    localButton.textContent = 'Один iPhone · 4 игрока';

    const roomButton = document.createElement('button');
    roomButton.className = 'btn btn-secondary';
    roomButton.type = 'button';
    roomButton.dataset.roomLaunch = 'true';
    roomButton.textContent = 'Комната · 2–4 iPhone';
    localButton.insertAdjacentElement('afterend', roomButton);

    const logicButton = document.createElement('button');
    logicButton.className = 'btn btn-secondary';
    logicButton.type = 'button';
    logicButton.dataset.logicLaunch = 'true';
    logicButton.textContent = '🧠 Логика · Войти в игру';
    roomButton.insertAdjacentElement('afterend', logicButton);
    const scanButton=document.createElement('button');
    scanButton.className='btn btn-primary';
    scanButton.type='button';
    scanButton.dataset.logicScan='true';
    scanButton.textContent='📷 Сканировать QR с телевизора';
    logicButton.insertAdjacentElement('afterend',scanButton);
  }

  root?.addEventListener('click', event => {
    if (event.target.closest('[data-room-launch]')) openRoom();
    if (event.target.closest('[data-logic-launch]')) openLogicEntry();
    if (event.target.closest('[data-logic-scan]')) {
      if(!window.FOURPLAY_QR_SCANNER){openLogicEntry();return;}
      void window.FOURPLAY_QR_SCANNER.open({onResult: code=>{
        const url=new URL(location.href);url.search='';url.searchParams.set('logic-room',code);
        location.href=url.toString();
      }});
    }
    if (event.target.closest('[data-logic-home]')) backToLocal();
    if (event.target.closest('[data-room-recover]')) backToLocal();
  });

  root?.addEventListener('submit', event => {
    if (event.target.id !== 'logicCodeForm') return;
    event.preventDefault();
    const code = String(event.target.elements.code.value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code.length !== 5) {
      root.querySelector('#logicCodeError').textContent = 'Код должен состоять из пяти символов.';
      return;
    }
    const url = new URL(location.href);
    url.search = '';
    url.searchParams.set('logic-room', code);
    location.href = url.toString();
  });

  const observer = new MutationObserver(enhanceHome);
  if (root) observer.observe(root, { childList: true, subtree: true });
  enhanceHome();

  window.addEventListener('load', () => {
    const room = new URL(location.href).searchParams.get('room');
    if (room) setTimeout(openRoom, 50);
  });
})();
