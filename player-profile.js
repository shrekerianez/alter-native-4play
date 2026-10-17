(() => {
  const PROFILE_KEY = '4play.playerProfile';
  const LAST_NAME_KEY = '4play.lastName';
  const PLAYER_ID_KEY = '4play.playerId';
  const EMOJIS = ['😎','🤠','🥳','😈','🤡','🦊','🐼','🦄'];
  const root = document.querySelector('#app');

  const profilesByName = new Map();
  let scannerStream = null;
  let scannerFrame = 0;
  let jsQrLoading = null;
  let previousMarkup = '';
  let profileClient = null;
  let profileChannel = null;
  let profileRoom = '';
  let lastTracked = '';

  function cleanCode(value) {
    return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
  }

  function searchParams() {
    return new URL(location.href).searchParams;
  }

  function currentRoom() {
    const p = searchParams();
    return cleanCode(p.get('tv') || p.get('room') || '');
  }

  function isTvScreen() {
    return searchParams().has('tv');
  }

  function getPlayerId() {
    let id = localStorage.getItem(PLAYER_ID_KEY);
    if (!id) {
      id = crypto.randomUUID ? crypto.randomUUID() : `p-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      localStorage.setItem(PLAYER_ID_KEY, id);
    }
    return id;
  }

  function loadProfile() {
    try {
      const saved = JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null');
      if (saved?.type === 'photo' && /^data:image\//.test(saved.value || '')) return saved;
      if (saved?.type === 'emoji' && saved.value) return saved;
    } catch {}
    return { type:'emoji', value:'😎' };
  }

  function saveProfile(profile) {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    refreshProfilePicker();
    void trackCurrentProfile(true);
  }

  function esc(value = '') {
    return String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  }

  function profilePickerMarkup() {
    const profile = loadProfile();
    const preview = profile.type === 'photo'
      ? `<img src="${esc(profile.value)}" alt="Твоё фото">`
      : `<span>${esc(profile.value)}</span>`;

    return `<div class="player-profile-card" data-player-profile-card>
      <div class="player-profile-head">
        <div class="player-profile-preview">${preview}</div>
        <div><strong>Твоя аватарка</strong><small>Будет видна на телевизоре и у игроков.</small></div>
      </div>
      <div class="player-profile-emojis">
        ${EMOJIS.map(emoji => `<button type="button" data-profile-emoji="${emoji}" class="${profile.type === 'emoji' && profile.value === emoji ? 'selected' : ''}" aria-label="Аватар ${emoji}">${emoji}</button>`).join('')}
      </div>
      <label class="player-photo-button">
        <input type="file" accept="image/*" data-profile-photo>
        <span>📷</span><strong>Выбрать фото</strong>
      </label>
    </div>`;
  }

  function refreshProfilePicker() {
    const card = root?.querySelector('[data-player-profile-card]');
    if (!card) return;
    const wrapper = document.createElement('div');
    wrapper.innerHTML = profilePickerMarkup();
    card.replaceWith(wrapper.firstElementChild);
  }

  function enhanceHome() {
    const title = root?.querySelector('h1');
    const actions = root?.querySelector('.bottom-actions');
    if (title?.textContent.trim() !== '4PLAY' || !actions || actions.querySelector('[data-tv-connect-launch]')) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn-secondary';
    button.dataset.tvConnectLaunch = '1';
    button.textContent = 'Подключиться к TV';
    actions.appendChild(button);
  }

  function enhanceTvClientJoin() {
    const form = root?.querySelector('#tvClientJoinForm');
    if (!form || form.dataset.profileEnhanced === '1') return;
    form.dataset.profileEnhanced = '1';

    const scan = document.createElement('button');
    scan.type = 'button';
    scan.className = 'btn btn-primary room-scan-button';
    scan.dataset.profileScan = '1';
    scan.innerHTML = '<span class="room-scan-icon">⌁</span> Сканировать QR';
    form.insertAdjacentElement('afterbegin', scan);

    const code = form.querySelector('input[name="code"]');
    if (code) code.readOnly = false;

    const actions = form.querySelector('.bottom-actions');
    actions?.insertAdjacentHTML('beforebegin', profilePickerMarkup());
  }

  function renderTvConnect() {
    root.innerHTML = `<section class="screen room-screen">
      <div class="topbar"><button class="icon-btn" type="button" data-profile-home aria-label="Назад">‹</button><div class="brand-mini">AlterNative · 4PLAY</div><div></div></div>
      <h2 class="section-title">Подключиться к TV</h2>
      <p class="section-copy">Сканируй QR на телевизоре или введи код комнаты вручную.</p>
      <button class="btn btn-primary room-scan-button" type="button" data-profile-scan><span class="room-scan-icon">⌁</span> Сканировать QR</button>
      <div class="room-or"><span>или</span></div>
      <form id="profileTvCodeForm" class="form-list">
        <label class="field"><span>Код комнаты</span><input name="code" maxlength="5" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="7KQ2A"></label>
        <div class="bottom-actions"><button class="btn btn-secondary" type="submit">Продолжить</button><p class="error" data-profile-code-error></p></div>
      </form>
    </section>`;
    setTimeout(() => root.querySelector('input[name="code"]')?.focus({preventScroll:true}), 50);
  }

  function goHome() {
    void stopScanner();
    const url = new URL(location.href);
    url.search = '';
    location.href = url.toString();
  }

  function goToTvRoom(code) {
    const clean = cleanCode(code);
    if (clean.length !== 5) return false;
    void stopScanner();
    const url = new URL(location.href);
    url.search = '';
    url.searchParams.set('room', clean);
    url.searchParams.set('tvhost', '1');
    location.href = url.toString();
    return true;
  }

  function roomFromQr(raw) {
    const value = String(raw || '').trim();
    try {
      const url = new URL(value);
      const code = cleanCode(url.searchParams.get('room') || '');
      if (code.length === 5) return code;
    } catch {}
    const direct = cleanCode(value);
    return direct.length === 5 ? direct : '';
  }

  async function loadJsQr() {
    if (window.jsQR) return window.jsQR;
    if (jsQrLoading) return jsQrLoading;
    jsQrLoading = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';
      script.async = true;
      script.onload = () => window.jsQR ? resolve(window.jsQR) : reject(new Error('jsQR unavailable'));
      script.onerror = reject;
      document.head.appendChild(script);
    });
    return jsQrLoading;
  }

  async function startScanner() {
    if (!navigator.mediaDevices?.getUserMedia) return showScannerMessage('Камера недоступна. Введи код комнаты вручную.');

    previousMarkup = root.innerHTML;
    root.innerHTML = `<section class="screen room-screen qr-scan-screen">
      <div class="topbar"><button class="icon-btn" type="button" data-profile-scan-cancel aria-label="Закрыть">‹</button><div class="brand-mini">Сканирование QR</div><div></div></div>
      <div class="qr-camera-wrap"><video data-qr-video autoplay muted playsinline></video><div class="qr-camera-frame"><i></i><i></i><i></i><i></i></div></div>
      <p class="section-copy qr-scan-help">Наведи iPhone на QR-код на телевизоре.</p>
      <p class="error" data-qr-error></p>
    </section>`;

    try {
      scannerStream = await navigator.mediaDevices.getUserMedia({ audio:false, video:{ facingMode:{ ideal:'environment' } } });
      const video = root.querySelector('[data-qr-video]');
      video.srcObject = scannerStream;
      await video.play();
      void scanLoop(video);
    } catch (error) {
      console.error('4PLAY camera failed', error);
      showScannerMessage('Не удалось открыть камеру. Разреши доступ к камере или введи код вручную.');
    }
  }

  async function scanLoop(video) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently:true });
    let detector = null;
    try {
      if ('BarcodeDetector' in window) detector = new BarcodeDetector({ formats:['qr_code'] });
    } catch {}

    let jsQR = null;
    if (!detector) {
      try { jsQR = await loadJsQr(); } catch {}
    }

    const tick = async () => {
      if (!scannerStream || !video.isConnected) return;
      let raw = '';
      try {
        if (detector) {
          raw = (await detector.detect(video))?.[0]?.rawValue || '';
        } else if (jsQR && video.videoWidth && video.videoHeight) {
          const scale = Math.min(1, 640 / video.videoWidth);
          canvas.width = Math.round(video.videoWidth * scale);
          canvas.height = Math.round(video.videoHeight * scale);
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
          raw = jsQR(image.data, image.width, image.height, { inversionAttempts:'dontInvert' })?.data || '';
        }
      } catch {}

      const code = roomFromQr(raw);
      if (code) return void goToTvRoom(code);
      scannerFrame = requestAnimationFrame(tick);
    };

    tick();
  }

  function showScannerMessage(message) {
    const error = root?.querySelector('[data-qr-error]');
    if (error) error.textContent = message;
    else renderTvConnect();
  }

  async function stopScanner(restore = false) {
    cancelAnimationFrame(scannerFrame);
    scannerFrame = 0;
    scannerStream?.getTracks().forEach(track => track.stop());
    scannerStream = null;

    if (restore && previousMarkup) {
      root.innerHTML = previousMarkup;
      previousMarkup = '';
      enhanceTvClientJoin();
    }
  }

  function readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function compressPhoto(file) {
    const dataUrl = await readFile(file);
    const image = new Image();
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
      image.src = dataUrl;
    });

    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const crop = Math.min(image.naturalWidth, image.naturalHeight);
    const sx = Math.max(0, (image.naturalWidth - crop) / 2);
    const sy = Math.max(0, (image.naturalHeight - crop) / 2);
    ctx.drawImage(image, sx, sy, crop, crop, 0, 0, size, size);
    return canvas.toDataURL('image/jpeg', 0.68);
  }

  function supabaseConfig() {
    const value = window.FOURPLAY_SUPABASE || {};
    return { url:String(value.url || '').trim(), key:String(value.key || '').trim() };
  }

  async function ensureProfileChannel() {
    const room = currentRoom();
    const cfg = supabaseConfig();
    if (room.length !== 5 || !/^https:\/\/.+\.supabase\.co$/i.test(cfg.url) || cfg.key.length < 20) return;

    if (profileChannel && profileRoom === room) {
      if (!isTvScreen()) void trackCurrentProfile();
      return;
    }

    try {
      if (profileClient && profileChannel) await profileClient.removeChannel(profileChannel);
      const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
      profileClient = createClient(cfg.url, cfg.key, { auth:{ persistSession:false } });
      profileRoom = room;
      const key = isTvScreen() ? `tv-profile-${Date.now()}` : `profile-${getPlayerId()}`;
      profileChannel = profileClient.channel(`4play-profile:${room}`, { config:{ presence:{ key } } });

      profileChannel.on('presence', { event:'sync' }, () => {
        profilesByName.clear();
        Object.values(profileChannel.presenceState()).flat().forEach(item => {
          if (item?.name && item?.profile) profilesByName.set(String(item.name), item.profile);
        });
        decoratePlayers();
      }).subscribe(async status => {
        if (status === 'SUBSCRIBED' && !isTvScreen()) await trackCurrentProfile(true);
      });
    } catch (error) {
      console.warn('4PLAY profile channel unavailable', error);
    }
  }

  async function trackCurrentProfile(force = false) {
    if (!profileChannel || isTvScreen()) return;
    const name = String(localStorage.getItem(LAST_NAME_KEY) || '').trim().slice(0, 20);
    if (!name) return;

    const payload = { id:getPlayerId(), name, profile:loadProfile(), updatedAt:Date.now() };
    const signature = JSON.stringify([payload.id, payload.name, payload.profile]);
    if (!force && signature === lastTracked) return;
    lastTracked = signature;
    try { await profileChannel.track(payload); } catch {}
  }

  function applyAvatar(node, profile, fallback = '?') {
    if (!node || !profile) return;
    node.classList.add('player-avatar-profiled');
    node.textContent = '';

    if (profile.type === 'photo' && /^data:image\//.test(profile.value || '')) {
      const img = document.createElement('img');
      img.src = profile.value;
      img.alt = '';
      node.appendChild(img);
    } else {
      node.textContent = profile.value || fallback;
    }
  }

  function decoratePlayers() {
    document.querySelectorAll('.tv-player').forEach(row => {
      const name = row.querySelector('strong')?.textContent.trim();
      const profile = profilesByName.get(name);
      if (profile) applyAvatar(row.querySelector('span'), profile, name?.slice(0,1));
    });

    document.querySelectorAll('.player-row').forEach(row => {
      const strong = row.querySelector('strong');
      if (!strong) return;
      const name = strong.textContent.replace(/\s·\sты$/, '').trim();
      const profile = profilesByName.get(name);
      if (profile) applyAvatar(row.querySelector('.player-avatar'), profile, name.slice(0,1));
    });
  }

  root?.addEventListener('click', event => {
    const emoji = event.target.closest('[data-profile-emoji]');
    if (emoji) {
      saveProfile({ type:'emoji', value:emoji.dataset.profileEmoji });
      return;
    }

    if (event.target.closest('[data-tv-connect-launch]')) return renderTvConnect();
    if (event.target.closest('[data-profile-scan]')) return void startScanner();
    if (event.target.closest('[data-profile-scan-cancel]')) return void stopScanner(true);
    if (event.target.closest('[data-profile-home]')) return goHome();
  });

  root?.addEventListener('change', async event => {
    const input = event.target.closest('[data-profile-photo]');
    if (!input?.files?.[0]) return;
    try {
      saveProfile({ type:'photo', value:await compressPhoto(input.files[0]) });
    } catch (error) {
      console.error('4PLAY photo resize failed', error);
    }
  });

  root?.addEventListener('submit', event => {
    const form = event.target.closest('#profileTvCodeForm');
    if (!form) return;
    event.preventDefault();
    const code = cleanCode(form.elements.code.value);
    if (!goToTvRoom(code)) form.querySelector('[data-profile-code-error]').textContent = 'Код состоит из пяти символов.';
  });

  const observer = new MutationObserver(() => {
    enhanceHome();
    enhanceTvClientJoin();
    decoratePlayers();
    void ensureProfileChannel();
  });
  if (root) observer.observe(root, { childList:true, subtree:true });

  addEventListener('pagehide', () => {
    void stopScanner();
    try { if (profileClient && profileChannel) profileClient.removeChannel(profileChannel); } catch {}
  });

  enhanceHome();
  enhanceTvClientJoin();
  decoratePlayers();
  void ensureProfileChannel();
})();
