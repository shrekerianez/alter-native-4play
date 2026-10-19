(() => {
  const params = new URL(location.href).searchParams;
  if (!params.has('tv')) return;

  const PACKS = ['relationships','spicy','party','awkward','life','dark_humor'];
  const CATEGORY_META = {
    relationships: ['❤️','Отношения'],
    spicy: ['🔥','Погорячее 18+'],
    party: ['🥂','Вечеринка'],
    awkward: ['🫠','Неловко'],
    life: ['🧾','Жизнь'],
    dark_humor: ['💀','Чёрный юмор']
  };
  const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  const root = document.querySelector('#app');
  const TV = {
    code: cleanCode(params.get('tv') || ''),
    hostId: `tv-${crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`}`,
    state: null,
    players: [],
    cards: [],
    client: null,
    channel: null,
    status: 'idle',
    timerId: null,
    qrLoading: null
  };

  document.documentElement.classList.add('tv-mode');
  document.body.classList.add('tv-mode');

  function cleanCode(value) {
    return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
  }

  function generateCode() {
    const bytes = new Uint8Array(5);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, byte => ALPHABET[byte % ALPHABET.length]).join('');
  }

  function esc(value = '') {
    return String(value).replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
  }

  function config() {
    const value = window.FOURPLAY_SUPABASE || {};
    return { url: String(value.url || '').trim(), key: String(value.key || '').trim() };
  }

  function configured() {
    const c = config();
    return /^https:\/\/.+\.supabase\.co$/i.test(c.url) && c.key.length > 20;
  }

  function shuffle(items) {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function clone(value) {
    return typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value));
  }

  function canStart(count) {
    return count === 2 || count === 4;
  }

  function makeTeams(players) {
    const ids = shuffle(players.map(player => player.id));
    if (ids.length === 2) return [[ids[0]], [ids[1]]];
    if (ids.length === 4) return [[ids[0], ids[1]], [ids[2], ids[3]]];
    return [[], []];
  }

  function isDuel(state = TV.state) {
    return Array.isArray(state?.teams) && state.teams.length === 2 && state.teams.every(team => Array.isArray(team) && team.length === 1);
  }

  function roundSeconds(state = TV.state) {
    return Number(state?.settings?.seconds || 60);
  }

  function totalTurns(state = TV.state) {
    return Number(state?.settings?.turns || state?.totalTurns || 8);
  }

  function roles(state = TV.state) {
    const team = state?.teams?.[state.turn] || [];
    const duel = isDuel(state);
    const index = team.length ? Number(state?.explainerIndex?.[state.turn] || 0) % team.length : 0;
    const explainerId = team[index] || '';
    const guesserId = duel ? state?.teams?.[state.turn === 0 ? 1 : 0]?.[0] : team[(index + 1) % Math.max(team.length, 1)];
    return { team, duel, explainerId, guesserId };
  }

  function players() {
    return TV.state?.players?.length ? TV.state.players : TV.players;
  }

  function nameById(id) {
    return players().find(player => player.id === id)?.name || 'Игрок';
  }

  function scoreLabels(state = TV.state) {
    return isDuel(state)
      ? [nameById(state?.teams?.[0]?.[0]), nameById(state?.teams?.[1]?.[0])]
      : ['Команда 1', 'Команда 2'];
  }

  function header(kicker = 'Главный экран') {
    const online = TV.status === 'connected';
    return `<header class="tv-top"><div class="tv-brand"><span class="tv-brand-mark">4P</span><span>AlterNative · 4PLAY</span></div><div class="tv-kicker">${esc(kicker)}</div><div class="tv-status ${online ? 'online' : ''}"><i></i>${online ? 'TV ведущий' : 'Подключение'}</div></header>`;
  }

  function inviteUrl() {
    const url = new URL(location.href);
    url.search = '';
    url.hash = '';
    url.searchParams.set('room', TV.code);
    url.searchParams.set('tvhost', '1');
    return url.toString();
  }

  function renderEntry(message = '') {
    clearInterval(TV.timerId);
    root.innerHTML = `<section class="tv-shell">${header('TV режим')}<div class="tv-entry-card"><div class="tv-logo">4PLAY</div><h1>Выбери игру</h1><p>Телевизор ведёт вечеринку, а любые смартфоны подключаются по QR-коду. Выбирай, во что играем.</p><div class="tv-host-actions"><a class="tv-logic-launch" href="./?logic-tv">🧠 4PLAY Логика · Новинка</a><button type="button" data-tv-action="create-room">Ну ты понял · Играть</button></div>${message ? `<div class="tv-error">${esc(message)}</div>` : ''}</div></section>`;
  }

  function flattenPresence() {
    if (!TV.channel) return [];
    return Object.values(TV.channel.presenceState()).flat().filter(Boolean).filter(item => item.role !== 'tv').map(item => ({
      id: String(item.id || ''),
      name: String(item.name || 'Игрок').slice(0, 20),
      joinedAt: Number(item.joinedAt || Date.now())
    })).filter(item => item.id).sort((a,b) => a.joinedAt - b.joinedAt || a.id.localeCompare(b.id)).slice(0, 4);
  }

  function playerChips(list) {
    if (!list.length) return '<div class="tv-small">Ждём игроков…</div>';
    return `<div class="tv-players">${list.map(player => `<div class="tv-player"><span>${esc(player.name.slice(0,1).toUpperCase())}</span><strong>${esc(player.name)}</strong></div>`).join('')}</div>`;
  }

  function renderLobby() {
    const list = players();
    const ready = canStart(list.length);
    root.innerHTML = `<section class="tv-shell">${header('Лобби')}<div class="tv-lobby-grid"><div class="tv-panel"><div class="tv-eyebrow">Код комнаты</div><div class="tv-code">${esc(TV.code)}</div><div class="tv-small">${list.length} из 4 игроков</div>${playerChips(list)}<div class="tv-host-actions"><button type="button" data-tv-action="prepare" ${ready ? '' : 'disabled'}>${list.length === 2 ? 'Играть вдвоём' : list.length === 4 ? 'Разделить на команды' : list.length === 3 ? 'Нужен четвёртый' : 'Ждём второго игрока'}</button></div></div><div class="tv-panel"><div class="tv-qr" id="tvQr"></div><h2>Сканируй камерой</h2><p class="tv-hint">Телефон сразу поймёт, что ведущий здесь телевизор.</p></div></div></section>`;
    renderQr();
  }

  function settingButtons(key, values, current, suffix = '') {
    return `<div class="tv-setting-row">${values.map(value => `<button type="button" data-tv-setting="${key}" data-tv-value="${value}" class="${Number(current) === value ? 'selected' : ''}">${value}${suffix}</button>`).join('')}</div>`;
  }

  function renderSetup() {
    const s = TV.state;
    const duel = isDuel(s);
    const settings = s.settings || { seconds:60, turns:8 };
    const teams = (s.teams || []).map((team, index) => `<div class="tv-team"><span>${duel ? `Игрок ${index + 1}` : `Команда ${index + 1}`}</span><strong>${esc(team.map(nameById).join(' + ') || '—')}</strong></div>`).join('');
    root.innerHTML = `<section class="tv-shell">${header('Ну ты понял')}<div class="tv-setup-wrap"><div class="tv-eyebrow">${duel ? 'Дуэль 1 × 1' : 'Команды 2 × 2'}</div><h1 class="tv-setup-title">Настройка партии</h1><div class="tv-teams">${teams}</div><div class="tv-settings-grid"><div class="tv-setting-card"><span>Время хода</span>${settingButtons('seconds',[30,45,60,90],settings.seconds,'с')}</div><div class="tv-setting-card"><span>Количество ходов</span>${settingButtons('turns',[4,6,8,10],settings.turns)}</div></div><div class="tv-category-host">${PACKS.map(id => { const [icon,title] = CATEGORY_META[id]; const selected = s.selectedCategories.includes(id); return `<button type="button" data-tv-category="${id}" class="${selected ? 'selected' : ''}"><span>${icon}</span><strong>${title}</strong></button>`; }).join('')}</div><div class="tv-host-actions inline"><button type="button" data-tv-action="reshuffle">${duel ? 'Поменять, кто начинает' : 'Перемешать команды'}</button><button type="button" data-tv-action="start-match" ${s.selectedCategories.length ? '' : 'disabled'}>Начать игру</button></div></div></section>`;
  }

  function scoreBar(state, labels, middle) {
    return `<div class="tv-score-line"><div><span>${esc(labels[0])}</span><strong>${Number(state.scores?.[0] || 0)}</strong></div>${middle}<div><span>${esc(labels[1])}</span><strong>${Number(state.scores?.[1] || 0)}</strong></div></div>`;
  }

  function renderReady() {
    const s = TV.state;
    const r = roles(s);
    const labels = scoreLabels(s);
    root.innerHTML = `<section class="tv-shell">${header('Ну ты понял')}${scoreBar(s, labels, `<div class="tv-turn">Ход ${Number(s.currentTurn || 1)} / ${totalTurns(s)}</div>`)}<div class="tv-center"><div class="tv-eyebrow">Следующий ход</div><h1 class="tv-title">${esc(nameById(r.explainerId))}</h1><p class="tv-versus">объясняет · ${esc(nameById(r.guesserId))} угадывает</p><p class="tv-hint">Нажать «Начать» должен объясняющий на своём телефоне.</p></div></section>`;
  }

  function renderRound() {
    const s = TV.state;
    const r = roles(s);
    const labels = scoreLabels(s);
    root.innerHTML = `<section class="tv-shell">${header('Ну ты понял')}${scoreBar(s, labels, '<div id="tvTimer" class="tv-timer">—</div>')}<div class="tv-center"><div class="tv-eyebrow">Ход ${Number(s.currentTurn || 1)} / ${totalTurns(s)}</div><h1 class="tv-title">${esc(nameById(r.explainerId))} → ${esc(nameById(r.guesserId))}</h1><p class="tv-versus">Объясняй. Угадывай. Не пались.</p><p class="tv-hint">Секретное слово остаётся на телефоне объясняющего. На TV видны ход, время и счёт.</p></div></section>`;
    startTimer();
  }

  function renderFinal() {
    clearInterval(TV.timerId);
    const s = TV.state;
    const labels = scoreLabels(s);
    const a = Number(s.scores?.[0] || 0);
    const b = Number(s.scores?.[1] || 0);
    const winner = a === b ? -1 : a > b ? 0 : 1;
    root.innerHTML = `<section class="tv-shell">${header('Финал')}<div class="tv-center"><div class="tv-trophy">${winner < 0 ? '🤝' : '🏆'}</div><div class="tv-eyebrow">${winner < 0 ? 'Ничья' : 'Победитель'}</div><h1 class="tv-title">${winner < 0 ? 'Ничья' : esc(labels[winner])}</h1><div class="tv-final-score">${a} : ${b}</div><div class="tv-host-actions inline"><button type="button" data-tv-action="lobby">В каталог / лобби</button><button type="button" data-tv-action="rematch">Реванш</button></div></div></section>`;
  }

  function renderState() {
    if (!TV.state) return renderLobby();
    if (TV.state.phase === 'lobby') return renderLobby();
    if (TV.state.phase === 'setup') return renderSetup();
    if (TV.state.phase === 'ready') return renderReady();
    if (TV.state.phase === 'round') return renderRound();
    if (TV.state.phase === 'final') return renderFinal();
    renderLobby();
  }

  async function loadCards() {
    const results = await Promise.allSettled(PACKS.map(async pack => {
      const response = await fetch(`./data/${pack}.json`, { cache:'no-store' });
      if (!response.ok) throw new Error(pack);
      return response.json();
    }));
    TV.cards = results.filter(result => result.status === 'fulfilled').flatMap(result => Array.isArray(result.value.cards) ? result.value.cards : []);
  }

  function nextDeckCard(state) {
    let next = Number(state.deckPos ?? -1) + 1;
    if (!Array.isArray(state.deckIds) || !state.deckIds.length || next >= state.deckIds.length) {
      state.deckIds = shuffle(TV.cards.filter(card => state.selectedCategories.includes(card.category)).map(card => card.id));
      next = 0;
    }
    state.deckPos = next;
    state.currentCardId = state.deckIds[next] || null;
  }

  async function broadcastState() {
    if (!TV.channel || !TV.state) return;
    await TV.channel.send({ type:'broadcast', event:'state', payload:{ state:TV.state } });
  }

  async function updateState(mutator) {
    if (!TV.state) return;
    const next = clone(TV.state);
    const changed = mutator(next);
    if (changed === false) return;
    next.version = Number(next.version || 0) + 1;
    TV.state = next;
    renderState();
    await broadcastState();
  }

  async function syncPresence() {
    const list = flattenPresence();
    TV.players = list;
    if (!TV.state) return;
    if (TV.state.phase === 'lobby') {
      TV.state = { ...TV.state, players:list, version:Number(TV.state.version || 0) + 1 };
      renderLobby();
      await broadcastState();
    }
  }

  async function handleAction(payload) {
    if (!TV.state) return;
    const actorId = String(payload?.actorId || '');
    const action = payload?.action || {};
    await updateState(state => {
      if (action.type === 'start-round' && state.phase === 'ready') {
        const r = roles(state);
        if (actorId !== r.explainerId) return false;
        nextDeckCard(state);
        state.roundEndsAt = Date.now() + roundSeconds(state) * 1000;
        state.phase = 'round';
        return true;
      }
      if (action.type === 'score' && state.phase === 'round' && action.cardId === state.currentCardId) {
        const r = roles(state);
        const delta = Number(action.delta);
        const explainer = actorId === r.explainerId;
        const judge = !r.duel && !r.team.includes(actorId);
        const valid = r.duel ? (explainer && [-1,0,1].includes(delta)) : ((explainer && [0,1].includes(delta)) || (judge && delta === -1));
        if (!valid) return false;
        state.scores[state.turn] += delta;
        nextDeckCard(state);
        return true;
      }
      return false;
    });
  }

  async function prepareGame() {
    const list = [...TV.players];
    if (!canStart(list.length)) return;
    TV.state = {
      version:Number(TV.state?.version || 0) + 1,
      phase:'setup',
      hostId:TV.hostId,
      hostType:'tv',
      players:list,
      teams:makeTeams(list),
      selectedCategories:[...PACKS],
      settings:{ seconds:60, turns:8 },
      scores:[0,0],
      turn:0,
      currentTurn:1,
      totalTurns:8,
      explainerIndex:[0,0],
      deckIds:[],
      deckPos:-1,
      currentCardId:null,
      roundEndsAt:0
    };
    renderSetup();
    await broadcastState();
  }

  async function startMatch() {
    await updateState(state => {
      if (state.phase !== 'setup' || !state.selectedCategories.length) return false;
      state.scores = [0,0];
      state.turn = 0;
      state.currentTurn = 1;
      state.explainerIndex = [0,0];
      state.totalTurns = totalTurns(state);
      state.deckIds = shuffle(TV.cards.filter(card => state.selectedCategories.includes(card.category)).map(card => card.id));
      state.deckPos = -1;
      state.currentCardId = null;
      state.roundEndsAt = 0;
      state.phase = 'ready';
      return true;
    });
  }

  async function endRound() {
    if (TV.state?.phase !== 'round') return;
    await updateState(state => {
      state.roundEndsAt = 0;
      if (!isDuel(state)) state.explainerIndex[state.turn] += 1;
      if (state.currentTurn >= totalTurns(state)) state.phase = 'final';
      else {
        state.currentTurn += 1;
        state.turn = state.turn === 0 ? 1 : 0;
        state.phase = 'ready';
      }
      return true;
    });
  }

  function startTimer() {
    clearInterval(TV.timerId);
    const tick = () => {
      const node = root.querySelector('#tvTimer');
      if (!node || TV.state?.phase !== 'round') return;
      const left = Math.max(0, Number(TV.state.roundEndsAt || 0) - Date.now());
      const seconds = Math.ceil(left / 1000);
      node.textContent = String(seconds);
      node.classList.toggle('urgent', seconds <= 10);
      if (left <= 0) endRound();
    };
    tick();
    TV.timerId = setInterval(tick, 250);
  }

  async function loadQrLibrary() {
    if (window.QRCode) return window.QRCode;
    if (TV.qrLoading) return TV.qrLoading;
    TV.qrLoading = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js';
      script.async = true;
      script.onload = () => window.QRCode ? resolve(window.QRCode) : reject(new Error('QR unavailable'));
      script.onerror = reject;
      document.head.appendChild(script);
    });
    return TV.qrLoading;
  }

  async function renderQr() {
    const box = root.querySelector('#tvQr');
    if (!box || box.childNodes.length) return;
    try {
      const QRCode = await loadQrLibrary();
      new QRCode(box, { text:inviteUrl(), width:260, height:260, colorDark:'#08080b', colorLight:'#ffffff', correctLevel:QRCode.CorrectLevel.M });
    } catch {
      box.textContent = TV.code;
    }
  }

  async function disconnect() {
    clearInterval(TV.timerId);
    try { if (TV.client && TV.channel) await TV.client.removeChannel(TV.channel); } catch {}
    TV.channel = null;
    TV.client = null;
    TV.state = null;
    TV.players = [];
    TV.status = 'idle';
  }

  async function createRoom(code = '') {
    if (!configured()) return renderEntry('Realtime сейчас недоступен.');
    await disconnect();
    await loadCards();
    TV.code = cleanCode(code) || generateCode();
    TV.status = 'connecting';
    const url = new URL(location.href);
    url.search = '';
    url.searchParams.set('tv', TV.code);
    history.replaceState(null, '', url);
    TV.state = {
      version:1,
      phase:'lobby',
      hostId:TV.hostId,
      hostType:'tv',
      players:[],
      teams:[[],[]],
      selectedCategories:[...PACKS],
      settings:{ seconds:60, turns:8 },
      scores:[0,0], turn:0, currentTurn:1, totalTurns:8, explainerIndex:[0,0], deckIds:[], deckPos:-1, currentCardId:null, roundEndsAt:0
    };
    renderLobby();
    try {
      const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
      const cfg = config();
      TV.client = createClient(cfg.url, cfg.key, { auth:{ persistSession:false } });
      TV.channel = TV.client.channel(`4play:${TV.code}`, { config:{ broadcast:{ self:true } } });
      TV.channel
        .on('presence', { event:'sync' }, syncPresence)
        .on('broadcast', { event:'hello' }, broadcastState)
        .on('broadcast', { event:'action' }, ({payload}) => handleAction(payload))
        .subscribe(async status => {
          if (status === 'SUBSCRIBED') {
            TV.status = 'connected';
            renderState();
            await broadcastState();
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            TV.status = 'error';
            renderEntry('Не удалось создать комнату. Проверь интернет.');
          }
        });
    } catch (error) {
      console.error('4PLAY TV host failed', error);
      TV.status = 'error';
      renderEntry('Не удалось создать комнату.');
    }
  }

  root.addEventListener('click', async event => {
    const actionButton = event.target.closest('[data-tv-action]');
    if (actionButton) {
      const action = actionButton.dataset.tvAction;
      if (action === 'create-room') return createRoom();
      if (action === 'prepare') return prepareGame();
      if (action === 'start-match') return startMatch();
      if (action === 'reshuffle') return updateState(state => { if (state.phase !== 'setup') return false; state.teams = isDuel(state) ? [state.teams[1],state.teams[0]] : makeTeams(state.players); return true; });
      if (action === 'rematch') return updateState(state => { if (state.phase !== 'final') return false; state.scores=[0,0]; state.turn=0; state.currentTurn=1; state.explainerIndex=[0,0]; state.deckPos=-1; state.currentCardId=null; state.roundEndsAt=0; state.phase='ready'; return true; });
      if (action === 'lobby') return updateState(state => { state.phase='lobby'; state.players=[...TV.players]; state.teams=[[],[]]; state.scores=[0,0]; state.currentCardId=null; state.roundEndsAt=0; return true; });
    }

    const setting = event.target.closest('[data-tv-setting]');
    if (setting && TV.state?.phase === 'setup') {
      const key = setting.dataset.tvSetting;
      const value = Number(setting.dataset.tvValue);
      return updateState(state => {
        if (key === 'seconds' && [30,45,60,90].includes(value)) state.settings.seconds = value;
        else if (key === 'turns' && [4,6,8,10].includes(value)) { state.settings.turns = value; state.totalTurns = value; }
        else return false;
        return true;
      });
    }

    const category = event.target.closest('[data-tv-category]');
    if (category && TV.state?.phase === 'setup') {
      const id = category.dataset.tvCategory;
      return updateState(state => {
        state.selectedCategories = state.selectedCategories.includes(id) ? state.selectedCategories.filter(item => item !== id) : [...state.selectedCategories,id];
        return true;
      });
    }
  });

  addEventListener('beforeunload', disconnect);
  TV.code ? createRoom(TV.code) : renderEntry();
})();
