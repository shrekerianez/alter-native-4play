(() => {
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
  const SESSION_ID_KEY = '4play.playerId';

  const RT = {
    root: null,
    cards: [],
    cardMap: new Map(),
    esc: value => String(value ?? ''),
    onExit: () => location.reload(),
    client: null,
    channel: null,
    code: '',
    playerId: '',
    playerName: '',
    players: [],
    isHost: false,
    state: null,
    timerId: null,
    connectionStatus: 'idle',
    error: '',
    pendingJoinCode: ''
  };

  function config() {
    const value = window.FOURPLAY_SUPABASE || {};
    return {
      url: String(value.url || '').trim(),
      key: String(value.key || '').trim()
    };
  }

  function configured() {
    const c = config();
    return /^https:\/\/.+\.supabase\.co$/i.test(c.url) && c.key.length > 20;
  }

  function getPlayerId() {
    let id = localStorage.getItem(SESSION_ID_KEY);
    if (!id) {
      id = crypto.randomUUID ? crypto.randomUUID() : `p-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      localStorage.setItem(SESSION_ID_KEY, id);
    }
    return id;
  }

  function stateKey(code = RT.code) {
    return `4play.roomState.${code}`;
  }

  function persistState(state) {
    RT.state = state;
    try { localStorage.setItem(stateKey(), JSON.stringify(state)); } catch {}
  }

  function loadPersistedState(code) {
    try {
      const raw = localStorage.getItem(stateKey(code));
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function cleanCode(value) {
    return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
  }

  function generateCode() {
    const bytes = new Uint8Array(5);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, b => ALPHABET[b % ALPHABET.length]).join('');
  }

  function shuffle(items) {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function clearTimer() {
    clearInterval(RT.timerId);
    RT.timerId = null;
  }

  function roomUrl() {
    const url = new URL(location.href);
    url.search = '';
    url.hash = '';
    url.searchParams.set('room', RT.code);
    return url.toString();
  }

  function topbar(backAction = 'room-exit') {
    return `<div class="topbar">
      <button class="icon-btn" type="button" data-room-action="${backAction}" aria-label="Назад">‹</button>
      <div class="brand-mini">AlterNative · 4PLAY</div>
      <div class="room-dot ${RT.connectionStatus === 'connected' ? 'online' : ''}" aria-label="${RT.connectionStatus === 'connected' ? 'Онлайн' : 'Не подключено'}"></div>
    </div>`;
  }

  function renderEntry() {
    clearTimer();
    const preset = cleanCode(RT.pendingJoinCode || new URL(location.href).searchParams.get('room') || '');
    RT.root.innerHTML = `
      <section class="screen room-screen">
        ${topbar('room-exit')}
        <h2 class="section-title">Комната</h2>
        <p class="section-copy">Четыре iPhone, одна игра. Карточки, таймер и счёт синхронизируются между всеми.</p>
        ${!configured() ? `<div class="room-warning"><strong>Realtime ещё не подключён</strong><span>Код комнаты уже готов в приложении, но для связи между iPhone нужно один раз указать Supabase Project URL и Publishable key.</span></div>` : ''}
        <div class="room-choice">
          <button class="room-choice-card" type="button" data-room-action="create-form" ${configured() ? '' : 'disabled'}>
            <span class="room-choice-icon">＋</span><span><strong>Создать комнату</strong><small>Ты будешь первым игроком и ведущим.</small></span>
          </button>
          <button class="room-choice-card" type="button" data-room-action="join-form" ${configured() ? '' : 'disabled'}>
            <span class="room-choice-icon">#</span><span><strong>Войти по коду</strong><small>Код из пяти символов от ведущего.</small></span>
          </button>
        </div>
        ${configured() ? '' : `<div class="bottom-actions"><button class="btn btn-secondary" type="button" data-room-action="setup-help">Как подключить Realtime</button></div>`}
        ${preset && configured() ? `<div class="room-invite"><span>В ссылке найден код</span><strong>${RT.esc(preset)}</strong><button class="btn btn-primary" type="button" data-room-action="join-prefilled">Войти в эту комнату</button></div>` : ''}
      </section>`;
  }

  function renderNameForm(mode, presetCode = '') {
    RT.root.innerHTML = `
      <section class="screen room-screen">
        ${topbar('room-entry')}
        <h2 class="section-title">${mode === 'create' ? 'Создать комнату' : 'Войти в комнату'}</h2>
        <p class="section-copy">Напиши своё имя. Никаких аккаунтов и регистраций, слава человеческому здравому смыслу.</p>
        <form id="roomJoinForm" class="form-list" data-mode="${mode}">
          ${mode === 'join' ? `<label class="field"><span>Код комнаты</span><input name="code" value="${RT.esc(cleanCode(presetCode))}" inputmode="text" maxlength="5" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="7KQ2A"></label>` : ''}
          <label class="field"><span>Твоё имя</span><input name="name" maxlength="20" autocomplete="off" enterkeyhint="done" placeholder="Имя игрока"></label>
          <div class="bottom-actions">
            <button class="btn btn-primary" type="submit">${mode === 'create' ? 'Создать' : 'Подключиться'}</button>
            <p id="roomFormError" class="error" role="alert"></p>
          </div>
        </form>
      </section>`;
    setTimeout(() => RT.root.querySelector('input[name="name"]')?.focus({preventScroll:true}), 50);
  }

  function renderConnecting() {
    RT.root.innerHTML = `
      <section class="screen room-screen">
        ${topbar('room-entry')}
        <div class="room-center">
          <div class="room-spinner" aria-hidden="true"></div>
          <h2 class="round-title">Подключаемся</h2>
          <p class="section-copy">Комната ${RT.esc(RT.code)} · ${RT.esc(RT.playerName)}</p>
        </div>
      </section>`;
  }

  function renderLobby() {
    clearTimer();
    const players = RT.state?.players?.length ? RT.state.players : RT.players;
    const full = players.length === 4;
    const hostId = RT.state?.hostId || players[0]?.id;
    RT.root.innerHTML = `
      <section class="screen room-screen">
        ${topbar()}
        <div class="room-code-block">
          <span>Код комнаты</span>
          <strong>${RT.esc(RT.code)}</strong>
          <small>${players.length} из 4 игроков</small>
        </div>
        <div class="room-share-row">
          <button class="btn btn-secondary" type="button" data-room-action="share-room">Поделиться ссылкой</button>
        </div>
        <div class="players-list">
          ${[0,1,2,3].map(index => {
            const p = players[index];
            if (!p) return `<div class="player-row empty"><span class="player-avatar">${index + 1}</span><span><strong>Ждём игрока…</strong><small>Пусть откроет ссылку или введёт код</small></span></div>`;
            const me = p.id === RT.playerId;
            const host = p.id === hostId;
            return `<div class="player-row"><span class="player-avatar">${RT.esc(p.name.slice(0,1).toUpperCase())}</span><span><strong>${RT.esc(p.name)}${me ? ' · ты' : ''}</strong><small>${host ? 'Ведущий · ' : ''}онлайн</small></span><span class="presence-check">✓</span></div>`;
          }).join('')}
        </div>
        <div class="bottom-actions">
          ${RT.isHost ? `<button class="btn btn-primary" type="button" data-room-action="prepare-game" ${full ? '' : 'disabled'}>Разделить на команды</button>` : `<div class="waiting-pill">${full ? 'Ведущий сейчас начнёт игру' : 'Ждём остальных игроков'}</div>`}
          <p class="helper">Если ведущий выйдет, роль автоматически перейдёт следующему подключённому игроку.</p>
        </div>
      </section>`;
  }

  function playerById(id) {
    return RT.state?.players?.find(p => p.id === id) || RT.players.find(p => p.id === id);
  }

  function nameById(id) {
    return playerById(id)?.name || 'Игрок';
  }

  function renderSetup() {
    clearTimer();
    const s = RT.state;
    RT.root.innerHTML = `
      <section class="screen room-screen">
        ${topbar()}
        <h2 class="section-title">Команды готовы</h2>
        <div class="team-grid">
          ${s.teams.map((team, i) => `<article class="team-card"><div class="team-label">Команда ${i + 1}</div><div class="team-name">${i === 0 ? 'Красные' : 'Фиолетовые'}</div><div class="team-members">${team.map(id => RT.esc(nameById(id))).join(' + ')}</div></article>`).join('')}
        </div>
        <h3 class="room-subtitle">Категории</h3>
        <div class="room-category-grid">
          ${PACKS.map(id => {
            const [icon,title] = CATEGORY_META[id];
            const selected = s.selectedCategories.includes(id);
            return `<button class="room-category ${selected ? 'selected' : ''}" type="button" data-room-category="${id}" ${RT.isHost ? '' : 'disabled'}><span>${icon}</span><strong>${title}</strong><small>${selected ? 'Включено' : 'Выключено'}</small></button>`;
          }).join('')}
        </div>
        <div class="bottom-actions">
          ${RT.isHost ? `<button class="btn btn-primary" type="button" data-room-action="start-match" ${s.selectedCategories.length ? '' : 'disabled'}>Начать игру</button><button class="btn btn-secondary" type="button" data-room-action="reshuffle-teams">Перемешать команды</button>` : `<div class="waiting-pill">Ведущий настраивает игру</div>`}
          <p class="helper">8 ходов · 60 секунд · карточку видит только объясняющий</p>
        </div>
      </section>`;
  }

  function roles(s = RT.state) {
    const team = s.teams[s.turn];
    const index = s.explainerIndex[s.turn] % team.length;
    return {
      team,
      explainerId: team[index],
      guesserId: team[(index + 1) % team.length]
    };
  }

  function renderReady() {
    clearTimer();
    const s = RT.state;
    const r = roles(s);
    const isExplainer = RT.playerId === r.explainerId;
    const isGuesser = RT.playerId === r.guesserId;
    const inActiveTeam = r.team.includes(RT.playerId);
    let roleText = 'Соперники готовятся следить за нарушениями.';
    if (isExplainer) roleText = 'Твой ход. Карточки появятся только на этом iPhone.';
    else if (isGuesser) roleText = 'Ты угадываешь. На твоём экране ответа не будет.';
    else if (!inActiveTeam) roleText = 'Следи за запрещёнными словами. Нарушение можно будет отметить со своего iPhone.';
    RT.root.innerHTML = `
      <section class="screen room-screen">
        ${topbar()}
        <div class="room-scorebar"><span>Команда 1 <strong>${s.scores[0]}</strong></span><span>${s.currentTurn}/${s.totalTurns}</span><span>Команда 2 <strong>${s.scores[1]}</strong></span></div>
        <div class="round-ready">
          <div class="round-team">Ход команды ${s.turn + 1}</div>
          <h2 class="round-title">${RT.esc(nameById(r.explainerId))} объясняет</h2>
          <div class="round-members">${RT.esc(nameById(r.guesserId))} угадывает</div>
          <p class="round-note">${RT.esc(roleText)}</p>
        </div>
        <div class="bottom-actions">
          ${isExplainer ? `<button class="btn btn-primary" type="button" data-room-action="start-round">Начать 60 секунд</button>` : `<div class="waiting-pill">Ждём ${RT.esc(nameById(r.explainerId))}</div>`}
        </div>
      </section>`;
  }

  function currentCard() {
    return RT.cardMap.get(RT.state?.currentCardId) || null;
  }

  function renderRound() {
    const s = RT.state;
    const r = roles(s);
    const card = currentCard();
    const isExplainer = RT.playerId === r.explainerId;
    const isGuesser = RT.playerId === r.guesserId;
    const isOpponent = !r.team.includes(RT.playerId);
    const forbidden = card?.forbidden || [];

    let center = '';
    if (isExplainer) {
      center = `<article class="game-card room-game-card"><div class="card-kicker">${RT.esc(CATEGORY_META[card?.category]?.[1] || '4PLAY')}</div><div class="card-prompt">${RT.esc(card?.prompt || '…')}</div>${forbidden.length ? `<div class="forbidden-title">Нельзя говорить</div><div class="forbidden">${forbidden.map(w => `<span>${RT.esc(w)}</span>`).join('')}</div>` : ''}</article>`;
    } else if (isGuesser) {
      center = `<div class="role-card"><div class="role-emoji">👂</div><h2>Угадывай</h2><p>Ответ видит только ${RT.esc(nameById(r.explainerId))}. Не подглядывай, мы всё-таки пытаемся изображать цивилизацию.</p></div>`;
    } else if (isOpponent) {
      center = `<div class="role-card"><div class="role-emoji">👀</div><h2>Следи за нарушением</h2><p>Запрещённые слова:</p><div class="forbidden opponent-forbidden">${forbidden.map(w => `<span>${RT.esc(w)}</span>`).join('') || '<span>нет</span>'}</div></div>`;
    }

    RT.root.innerHTML = `
      <section class="screen room-screen">
        <div class="game-head">
          <div class="score">Команда 1<br><strong>${s.scores[0]}</strong></div>
          <div id="roomTimer" class="timer">60</div>
          <div class="score right">Команда 2<br><strong>${s.scores[1]}</strong></div>
        </div>
        <div class="turn-label">${RT.esc(nameById(r.explainerId))} → ${RT.esc(nameById(r.guesserId))}</div>
        <div class="card-wrap">${center}</div>
        ${isExplainer ? `<div class="room-two-actions"><button class="score-btn" type="button" data-room-score="0">Пропуск</button><button class="score-btn good" type="button" data-room-score="1">Угадано +1</button></div>` : ''}
        ${isOpponent ? `<button class="score-btn bad room-violation" type="button" data-room-score="-1">Нарушение −1</button>` : ''}
      </section>`;
    startTimerTicker();
  }

  function renderFinal() {
    clearTimer();
    const s = RT.state;
    const winner = s.scores[0] === s.scores[1] ? -1 : (s.scores[0] > s.scores[1] ? 0 : 1);
    RT.root.innerHTML = `
      <section class="screen room-screen">
        ${topbar()}
        <div class="result-card room-final">
          <div class="result-emoji">${winner < 0 ? '🤝' : '🏆'}</div>
          <h2 class="result-title">${winner < 0 ? 'Ничья' : `Победила команда ${winner + 1}`}</h2>
          <div class="result-score">${s.scores[0]} : ${s.scores[1]}</div>
          ${winner >= 0 ? `<p class="section-copy">${s.teams[winner].map(id => RT.esc(nameById(id))).join(' + ')}</p>` : ''}
        </div>
        <div class="bottom-actions">${RT.isHost ? `<button class="btn btn-primary" type="button" data-room-action="rematch">Реванш</button>` : `<div class="waiting-pill">Ведущий решает судьбу реванша</div>`}<button class="btn btn-secondary" type="button" data-room-action="room-exit">Выйти из комнаты</button></div>
      </section>`;
  }

  function renderState() {
    if (!RT.state) return renderLobby();
    switch (RT.state.phase) {
      case 'lobby': renderLobby(); break;
      case 'setup': renderSetup(); break;
      case 'ready': renderReady(); break;
      case 'round': renderRound(); break;
      case 'final': renderFinal(); break;
      default: renderLobby();
    }
  }

  function startTimerTicker() {
    clearTimer();
    const tick = () => {
      if (RT.state?.phase !== 'round') return clearTimer();
      const leftMs = Math.max(0, Number(RT.state.roundEndsAt || 0) - Date.now());
      const seconds = Math.ceil(leftMs / 1000);
      const node = RT.root.querySelector('#roomTimer');
      if (node) node.textContent = String(seconds);
      if (leftMs <= 0 && RT.isHost && RT.state.phase === 'round') hostEndRound();
    };
    tick();
    RT.timerId = setInterval(tick, 250);
  }

  async function importSupabase() {
    return import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
  }

  function flattenPresence() {
    if (!RT.channel) return [];
    const state = RT.channel.presenceState();
    return Object.values(state).flat().filter(Boolean).map(item => ({
      id: String(item.id || ''),
      name: String(item.name || 'Игрок').slice(0,20),
      joinedAt: Number(item.joinedAt || Date.now())
    })).filter(p => p.id).sort((a,b) => a.joinedAt - b.joinedAt || a.id.localeCompare(b.id));
  }

  async function syncPresence() {
    const list = flattenPresence();
    const accepted = list.slice(0,4);
    RT.players = accepted;
    const admitted = accepted.some(p => p.id === RT.playerId);
    if (!admitted && list.some(p => p.id === RT.playerId)) {
      RT.error = 'Комната уже заполнена.';
      await disconnect(false);
      return renderRoomError('Комната заполнена', 'В ней уже четыре игрока. Пятый здесь нужен примерно как пятое колесо у телеги.');
    }

    const electedHost = accepted[0]?.id || '';
    const wasHost = RT.isHost;
    RT.isHost = electedHost === RT.playerId;

    if (!RT.state) RT.state = loadPersistedState(RT.code);
    if (RT.isHost) {
      if (!RT.state || RT.state.phase === 'lobby') {
        RT.state = {
          version: Number(RT.state?.version || 0) + 1,
          phase: 'lobby', hostId: RT.playerId, players: accepted,
          teams: [[],[]], selectedCategories: [...PACKS], scores: [0,0], turn: 0,
          currentTurn: 1, totalTurns: 8, explainerIndex: [0,0], deckIds: [], deckPos: -1,
          currentCardId: null, roundEndsAt: 0
        };
        persistState(RT.state);
        await broadcastState();
      } else if (!wasHost && RT.state.hostId !== RT.playerId) {
        RT.state = {...RT.state, hostId: RT.playerId, version: Number(RT.state.version || 0) + 1};
        persistState(RT.state);
        await broadcastState();
      }
    }
    renderState();
  }

  async function connectRoom(code, name, creating = false) {
    if (!configured()) return renderRoomError('Realtime не настроен', 'Нужно указать Supabase Project URL и Publishable key.');
    RT.code = cleanCode(code || generateCode());
    RT.playerName = String(name || '').trim().slice(0,20);
    RT.playerId = getPlayerId();
    RT.connectionStatus = 'connecting';
    if (creating) localStorage.removeItem(stateKey(RT.code));
    renderConnecting();

    try {
      const { createClient } = await importSupabase();
      const c = config();
      RT.client = createClient(c.url, c.key, { auth: { persistSession: false } });
      RT.channel = RT.client.channel(`4play:${RT.code}`, {
        config: { broadcast: { self: true }, presence: { key: RT.playerId } }
      });

      RT.channel
        .on('presence', { event: 'sync' }, syncPresence)
        .on('broadcast', { event: 'state' }, ({payload}) => receiveState(payload?.state))
        .on('broadcast', { event: 'action' }, ({payload}) => { if (RT.isHost) hostHandleAction(payload); })
        .on('broadcast', { event: 'hello' }, () => { if (RT.isHost) broadcastState(); })
        .subscribe(async status => {
          if (status === 'SUBSCRIBED') {
            RT.connectionStatus = 'connected';
            await RT.channel.track({ id: RT.playerId, name: RT.playerName, joinedAt: Date.now() });
            await RT.channel.send({ type:'broadcast', event:'hello', payload:{id:RT.playerId} });
            const url = new URL(location.href); url.searchParams.set('room', RT.code); history.replaceState(null,'',url);
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            RT.connectionStatus = 'error';
            renderRoomError('Не удалось подключиться', 'Realtime не отвечает. Проверь Project URL, ключ и интернет.');
          }
        });
    } catch (error) {
      console.error(error);
      RT.connectionStatus = 'error';
      renderRoomError('Не удалось подключиться', 'Проверь настройки Supabase и соединение с интернетом.');
    }
  }

  async function broadcastState() {
    if (!RT.channel || !RT.state) return;
    persistState(RT.state);
    await RT.channel.send({ type:'broadcast', event:'state', payload:{state:RT.state} });
  }

  function receiveState(state) {
    if (!state || typeof state !== 'object') return;
    if (RT.state && Number(state.version || 0) < Number(RT.state.version || 0)) return;
    const isKnownPlayer = Array.isArray(state.players) && state.players.some(p => p.id === RT.playerId);
    if (state.phase !== 'lobby' && !isKnownPlayer) {
      renderRoomError('Игра уже идёт', 'В эту комнату нельзя войти после начала партии.');
      return;
    }
    persistState(state);
    RT.isHost = state.hostId === RT.playerId || RT.isHost;
    renderState();
  }

  async function sendAction(action) {
    if (!RT.channel) return;
    await RT.channel.send({ type:'broadcast', event:'action', payload:{ actorId:RT.playerId, action } });
  }

  function nextDeckCard(state) {
    let next = Number(state.deckPos || -1) + 1;
    if (!Array.isArray(state.deckIds) || !state.deckIds.length || next >= state.deckIds.length) {
      state.deckIds = shuffle(RT.cards.filter(c => state.selectedCategories.includes(c.category)).map(c => c.id));
      next = 0;
    }
    state.deckPos = next;
    state.currentCardId = state.deckIds[next] || null;
  }

  async function hostHandleAction(payload) {
    if (!RT.isHost || !RT.state) return;
    const actorId = String(payload?.actorId || '');
    const action = payload?.action || {};
    const s = structuredClone ? structuredClone(RT.state) : JSON.parse(JSON.stringify(RT.state));

    if (action.type === 'toggle-category' && actorId === s.hostId && s.phase === 'setup') {
      s.selectedCategories = s.selectedCategories.includes(action.category) ? s.selectedCategories.filter(x => x !== action.category) : [...s.selectedCategories, action.category];
    } else if (action.type === 'reshuffle-teams' && actorId === s.hostId && s.phase === 'setup') {
      const ids = shuffle(s.players.map(p => p.id)); s.teams = [[ids[0],ids[1]],[ids[2],ids[3]]];
    } else if (action.type === 'start-match' && actorId === s.hostId && s.phase === 'setup' && s.selectedCategories.length) {
      s.scores = [0,0]; s.turn = 0; s.currentTurn = 1; s.explainerIndex = [0,0]; s.deckPos = -1;
      s.deckIds = shuffle(RT.cards.filter(c => s.selectedCategories.includes(c.category)).map(c => c.id));
      s.currentCardId = null; s.roundEndsAt = 0; s.phase = 'ready';
    } else if (action.type === 'start-round' && s.phase === 'ready') {
      const r = roles(s); if (actorId !== r.explainerId) return;
      nextDeckCard(s); s.roundEndsAt = Date.now() + 60000; s.phase = 'round';
    } else if (action.type === 'score' && s.phase === 'round' && action.cardId === s.currentCardId) {
      const r = roles(s); const isExplainer = actorId === r.explainerId; const isOpponent = !r.team.includes(actorId);
      const delta = Number(action.delta);
      if (!((isExplainer && (delta === 0 || delta === 1)) || (isOpponent && delta === -1))) return;
      s.scores[s.turn] += delta; nextDeckCard(s);
    } else if (action.type === 'rematch' && actorId === s.hostId && s.phase === 'final') {
      s.scores = [0,0]; s.turn = 0; s.currentTurn = 1; s.explainerIndex = [0,0]; s.deckPos = -1; s.currentCardId = null; s.roundEndsAt = 0; s.phase = 'ready';
    } else {
      return;
    }
    s.version = Number(s.version || 0) + 1;
    RT.state = s;
    await broadcastState();
  }

  async function hostPrepareGame() {
    if (!RT.isHost || RT.players.length !== 4) return;
    const ids = shuffle(RT.players.map(p => p.id));
    RT.state = {
      ...(RT.state || {}), version:Number(RT.state?.version || 0) + 1, phase:'setup', hostId:RT.playerId,
      players:[...RT.players], teams:[[ids[0],ids[1]],[ids[2],ids[3]]], selectedCategories:[...PACKS],
      scores:[0,0], turn:0, currentTurn:1, totalTurns:8, explainerIndex:[0,0], deckIds:[], deckPos:-1, currentCardId:null, roundEndsAt:0
    };
    await broadcastState();
  }

  async function hostEndRound() {
    if (!RT.isHost || RT.state?.phase !== 'round') return;
    const s = structuredClone ? structuredClone(RT.state) : JSON.parse(JSON.stringify(RT.state));
    s.roundEndsAt = 0;
    s.explainerIndex[s.turn] += 1;
    if (s.currentTurn >= s.totalTurns) s.phase = 'final';
    else { s.currentTurn += 1; s.turn = s.turn === 0 ? 1 : 0; s.phase = 'ready'; }
    s.version = Number(s.version || 0) + 1;
    RT.state = s;
    await broadcastState();
  }

  async function shareRoom() {
    const data = { title:'4PLAY — Ну ты понял', text:`Заходи в комнату ${RT.code}`, url:roomUrl() };
    try {
      if (navigator.share) await navigator.share(data);
      else { await navigator.clipboard.writeText(roomUrl()); showToast('Ссылка скопирована'); }
    } catch {}
  }

  function showToast(text) {
    const node = document.createElement('div'); node.className = 'room-toast'; node.textContent = text; document.body.appendChild(node);
    setTimeout(() => node.remove(), 1800);
  }

  function renderRoomError(title, copy) {
    clearTimer();
    RT.root.innerHTML = `<section class="screen room-screen">${topbar('room-entry')}<div class="room-center"><div class="role-emoji">⚠️</div><h2 class="round-title">${RT.esc(title)}</h2><p class="section-copy">${RT.esc(copy)}</p><button class="btn btn-primary" type="button" data-room-action="room-entry">Назад</button></div></section>`;
  }

  function renderSetupHelp() {
    RT.root.innerHTML = `<section class="screen room-screen">${topbar('room-entry')}<h2 class="section-title">Подключение Realtime</h2><div class="setup-steps"><div><span>1</span><p>Создай бесплатный проект Supabase.</p></div><div><span>2</span><p>В окне <strong>Connect</strong> скопируй Project URL и Publishable key.</p></div><div><span>3</span><p>Вставь их в <code>supabase-config.js</code>. База данных для комнат не нужна.</p></div></div><div class="room-warning"><strong>Почему это безопаснее</strong><span>Мы не используем secret/service-role ключ. В PWA хранится только публичный Publishable key.</span></div></section>`;
  }

  async function disconnect(goHome = true) {
    clearTimer();
    try { if (RT.channel) await RT.channel.untrack(); } catch {}
    try { if (RT.client && RT.channel) await RT.client.removeChannel(RT.channel); } catch {}
    RT.client = null; RT.channel = null; RT.connectionStatus = 'idle'; RT.players = []; RT.isHost = false; RT.state = null;
    const url = new URL(location.href); url.searchParams.delete('room'); history.replaceState(null,'',url);
    if (goHome) RT.onExit();
  }

  async function open({root, cards, esc, onExit}) {
    RT.root = root;
    RT.cards = Array.isArray(cards) ? cards : [];
    RT.cardMap = new Map(RT.cards.map(card => [card.id, card]));
    RT.esc = esc || RT.esc;
    RT.onExit = onExit || RT.onExit;
    RT.pendingJoinCode = cleanCode(new URL(location.href).searchParams.get('room') || '');
    renderEntry();
  }

  document.addEventListener('click', async event => {
    if (!RT.root || !RT.root.contains(event.target)) return;
    const score = event.target.closest('[data-room-score]');
    if (score && RT.state?.phase === 'round') {
      await sendAction({type:'score', delta:Number(score.dataset.roomScore), cardId:RT.state.currentCardId});
      return;
    }
    const category = event.target.closest('[data-room-category]');
    if (category && RT.isHost) { await sendAction({type:'toggle-category', category:category.dataset.roomCategory}); return; }
    const button = event.target.closest('[data-room-action]');
    if (!button) return;
    switch (button.dataset.roomAction) {
      case 'room-exit': await disconnect(true); break;
      case 'room-entry': renderEntry(); break;
      case 'create-form': renderNameForm('create'); break;
      case 'join-form': renderNameForm('join'); break;
      case 'join-prefilled': renderNameForm('join', RT.pendingJoinCode); break;
      case 'share-room': await shareRoom(); break;
      case 'prepare-game': await hostPrepareGame(); break;
      case 'reshuffle-teams': await sendAction({type:'reshuffle-teams'}); break;
      case 'start-match': await sendAction({type:'start-match'}); break;
      case 'start-round': await sendAction({type:'start-round'}); break;
      case 'rematch': await sendAction({type:'rematch'}); break;
      case 'setup-help': renderSetupHelp(); break;
    }
  });

  document.addEventListener('submit', async event => {
    if (event.target.id !== 'roomJoinForm') return;
    event.preventDefault();
    const form = event.target;
    const mode = form.dataset.mode;
    const name = form.elements.name.value.trim();
    const code = mode === 'join' ? cleanCode(form.elements.code.value) : generateCode();
    const error = form.querySelector('#roomFormError');
    if (!name) { error.textContent = 'Напиши имя.'; return; }
    if (mode === 'join' && code.length !== 5) { error.textContent = 'Код комнаты состоит из пяти символов.'; return; }
    await connectRoom(code, name, mode === 'create');
  });

  window.RoomMode = { open, configured, disconnect };
})();
