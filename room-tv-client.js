(() => {
  const SESSION_ID_KEY = '4play.playerId';
  const LAST_NAME_KEY = '4play.lastName';
  const rootDefault = () => document.querySelector('#app');

  const C = {
    root: null,
    cards: [],
    cardMap: new Map(),
    esc: value => String(value ?? ''),
    onExit: () => location.reload(),
    code: '',
    playerId: '',
    playerName: '',
    state: null,
    client: null,
    channel: null,
    status: 'idle',
    timerId: null
  };

  function config() {
    const value = window.FOURPLAY_SUPABASE || {};
    return { url: String(value.url || '').trim(), key: String(value.key || '').trim() };
  }

  function configured() {
    const c = config();
    return /^https:\/\/.+\.supabase\.co$/i.test(c.url) && c.key.length > 20;
  }

  function cleanCode(value) {
    return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
  }

  function getPlayerId() {
    let id = localStorage.getItem(SESSION_ID_KEY);
    if (!id) {
      id = crypto.randomUUID ? crypto.randomUUID() : `p-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      localStorage.setItem(SESSION_ID_KEY, id);
    }
    return id;
  }

  function clearTimer() {
    clearInterval(C.timerId);
    C.timerId = null;
  }

  function playerById(id) {
    return C.state?.players?.find(player => player.id === id) || null;
  }

  function nameById(id) {
    return playerById(id)?.name || 'Игрок';
  }

  function isDuel(state = C.state) {
    return Array.isArray(state?.teams) && state.teams.length === 2 && state.teams.every(team => Array.isArray(team) && team.length === 1);
  }

  function totalTurns(state = C.state) {
    return Number(state?.settings?.turns || state?.totalTurns || 8);
  }

  function roundSeconds(state = C.state) {
    return Number(state?.settings?.seconds || 60);
  }

  function roles(state = C.state) {
    const team = state?.teams?.[state.turn] || [];
    const duel = isDuel(state);
    const index = team.length ? Number(state?.explainerIndex?.[state.turn] || 0) % team.length : 0;
    const explainerId = team[index] || '';
    const guesserId = duel ? state?.teams?.[state.turn === 0 ? 1 : 0]?.[0] : team[(index + 1) % Math.max(team.length, 1)];
    return { team, duel, explainerId, guesserId };
  }

  function scoreLabels(state = C.state) {
    return isDuel(state)
      ? [nameById(state?.teams?.[0]?.[0]), nameById(state?.teams?.[1]?.[0])]
      : ['Команда 1', 'Команда 2'];
  }

  function topbar() {
    return `<div class="topbar"><button class="icon-btn" type="button" data-tvclient-action="exit" aria-label="Назад">‹</button><div class="brand-mini">AlterNative · 4PLAY</div><div class="room-dot ${C.status === 'connected' ? 'online' : ''}"></div></div>`;
  }

  function renderJoin(message = '') {
    clearTimer();
    const savedName = localStorage.getItem(LAST_NAME_KEY) || '';
    C.root.innerHTML = `<section class="screen room-screen">${topbar()}<h2 class="section-title">Войти к телевизору</h2><p class="section-copy">Телевизор уже создал комнату и ведёт игру. Тебе нужен только ник.</p><form id="tvClientJoinForm" class="form-list"><label class="field"><span>Код комнаты</span><input name="code" value="${C.esc(C.code)}" maxlength="5" readonly></label><label class="field"><span>Твоё имя</span><input name="name" value="${C.esc(savedName)}" maxlength="20" autocomplete="off" enterkeyhint="done" placeholder="Имя игрока"></label><div class="bottom-actions"><button class="btn btn-primary" type="submit">Подключиться</button>${message ? `<p class="error">${C.esc(message)}</p>` : ''}</div></form></section>`;
    setTimeout(() => C.root.querySelector('input[name="name"]')?.focus({ preventScroll:true }), 50);
  }

  function renderConnecting() {
    C.root.innerHTML = `<section class="screen room-screen">${topbar()}<div class="room-center"><div class="room-spinner"></div><h2 class="round-title">Подключаемся к TV</h2><p class="section-copy">Комната ${C.esc(C.code)} · ${C.esc(C.playerName)}</p></div></section>`;
  }

  function renderLobby() {
    clearTimer();
    const players = C.state?.players || [];
    C.root.innerHTML = `<section class="screen room-screen">${topbar()}<div class="room-code-block"><span>Комната телевизора</span><strong>${C.esc(C.code)}</strong><small>${players.length} из 4 игроков</small></div><div class="players-list">${[0,1,2,3].map(index => {
      const player = players[index];
      if (!player) return `<div class="player-row empty"><span class="player-avatar">${index + 1}</span><span><strong>Свободное место</strong><small>Подключение по QR с телевизора</small></span></div>`;
      const me = player.id === C.playerId;
      return `<div class="player-row"><span class="player-avatar">${C.esc(player.name.slice(0,1).toUpperCase())}</span><span><strong>${C.esc(player.name)}${me ? ' · ты' : ''}</strong><small>онлайн</small></span><span class="presence-check">✓</span></div>`;
    }).join('')}</div><div class="bottom-actions"><div class="waiting-pill">Телевизор управляет комнатой</div><p class="helper">Настройки, запуск и результаты появятся на главном экране.</p></div></section>`;
  }

  function renderSetup() {
    clearTimer();
    const s = C.state;
    const duel = isDuel(s);
    C.root.innerHTML = `<section class="screen room-screen">${topbar()}<h2 class="section-title">${duel ? 'Дуэль готова' : 'Команды готовы'}</h2><div class="team-grid">${(s.teams || []).map((team, i) => `<article class="team-card"><div class="team-label">${duel ? `Игрок ${i + 1}` : `Команда ${i + 1}`}</div><div class="team-name">${C.esc(team.map(nameById).join(' + ') || '—')}</div></article>`).join('')}</div><div class="bottom-actions"><div class="waiting-pill">Настройки выбираются на телевизоре</div><p class="helper">${roundSeconds(s)} секунд · ${totalTurns(s)} ходов · ${s.selectedCategories?.length || 0} категорий</p></div></section>`;
  }

  function renderReady() {
    clearTimer();
    const s = C.state;
    const r = roles(s);
    const labels = scoreLabels(s);
    const isExplainer = C.playerId === r.explainerId;
    const isGuesser = C.playerId === r.guesserId;
    let note = 'Следи за игрой на телевизоре.';
    if (isExplainer) note = 'Твой ход. Карточка появится только на твоём iPhone.';
    else if (isGuesser) note = 'Ты угадываешь. На телевизоре виден общий ход партии.';
    C.root.innerHTML = `<section class="screen room-screen">${topbar()}<div class="room-scorebar"><span>${C.esc(labels[0])} <strong>${Number(s.scores?.[0] || 0)}</strong></span><span>${Number(s.currentTurn || 1)}/${totalTurns(s)}</span><span>${C.esc(labels[1])} <strong>${Number(s.scores?.[1] || 0)}</strong></span></div><div class="round-ready"><div class="round-team">${r.duel ? `Ход: ${C.esc(nameById(r.explainerId))}` : `Ход команды ${Number(s.turn || 0) + 1}`}</div><h2 class="round-title">${C.esc(nameById(r.explainerId))} объясняет</h2><div class="round-members">${C.esc(nameById(r.guesserId))} угадывает</div><p class="round-note">${C.esc(note)}</p></div><div class="bottom-actions">${isExplainer ? `<button class="btn btn-primary" type="button" data-tvclient-action="start-round">Начать ${roundSeconds(s)} секунд</button>` : `<div class="waiting-pill">Ждём ${C.esc(nameById(r.explainerId))}</div>`}</div></section>`;
  }

  function currentCard() {
    return C.cardMap.get(C.state?.currentCardId) || null;
  }

  function renderRound() {
    const s = C.state;
    const r = roles(s);
    const card = currentCard();
    const labels = scoreLabels(s);
    const isExplainer = C.playerId === r.explainerId;
    const isGuesser = C.playerId === r.guesserId;
    const isJudge = !r.duel && !r.team.includes(C.playerId);
    const forbidden = card?.forbidden || [];
    let center = '';
    if (isExplainer) {
      center = `<article class="game-card room-game-card"><div class="card-kicker">4PLAY</div><div class="card-prompt">${C.esc(card?.prompt || '…')}</div>${forbidden.length ? `<div class="forbidden-title">Нельзя говорить</div><div class="forbidden">${forbidden.map(word => `<span>${C.esc(word)}</span>`).join('')}</div>` : ''}</article>`;
    } else if (isGuesser) {
      center = `<div class="role-card"><div class="role-emoji">👂</div><h2>Угадывай</h2><p>Смотри на объясняющего, а не в чужой телефон. Сложная социальная технология, но справимся.</p></div>`;
    } else if (isJudge) {
      center = `<div class="role-card"><div class="role-emoji">👀</div><h2>Контроль</h2><p>Следи за запрещёнными словами.</p><div class="forbidden opponent-forbidden">${forbidden.map(word => `<span>${C.esc(word)}</span>`).join('') || '<span>нет запретов</span>'}</div></div>`;
    } else {
      center = `<div class="role-card"><div class="role-emoji">📺</div><h2>Смотри на TV</h2><p>Сейчас играет другая команда.</p></div>`;
    }
    const explainerActions = r.duel
      ? `<div class="room-three-actions"><button class="score-btn bad" data-tvclient-score="-1">Нарушение<br>−1</button><button class="score-btn" data-tvclient-score="0">Пропуск</button><button class="score-btn good" data-tvclient-score="1">Угадано<br>+1</button></div>`
      : `<div class="room-two-actions"><button class="score-btn" data-tvclient-score="0">Пропуск</button><button class="score-btn good" data-tvclient-score="1">Угадано +1</button></div>`;
    C.root.innerHTML = `<section class="screen room-screen"><div class="game-head"><div class="score">${C.esc(labels[0])}<br><strong>${Number(s.scores?.[0] || 0)}</strong></div><div id="tvClientTimer" class="timer">${roundSeconds(s)}</div><div class="score right">${C.esc(labels[1])}<br><strong>${Number(s.scores?.[1] || 0)}</strong></div></div><div class="turn-label">${C.esc(nameById(r.explainerId))} → ${C.esc(nameById(r.guesserId))}</div><div class="card-wrap">${center}</div>${isExplainer ? explainerActions : ''}${isJudge ? `<button class="score-btn bad room-violation" data-tvclient-score="-1">Нарушение −1</button>` : ''}</section>`;
    startTimer();
  }

  function renderFinal() {
    clearTimer();
    const s = C.state;
    const duel = isDuel(s);
    const winner = Number(s.scores?.[0] || 0) === Number(s.scores?.[1] || 0) ? -1 : Number(s.scores?.[0] || 0) > Number(s.scores?.[1] || 0) ? 0 : 1;
    const title = winner < 0 ? 'Ничья' : duel ? `Победил ${C.esc(nameById(s.teams[winner][0]))}` : `Победила команда ${winner + 1}`;
    C.root.innerHTML = `<section class="screen room-screen">${topbar()}<div class="result-card room-final"><div class="result-emoji">${winner < 0 ? '🤝' : '🏆'}</div><h2 class="result-title">${title}</h2><div class="result-score">${Number(s.scores?.[0] || 0)} : ${Number(s.scores?.[1] || 0)}</div></div><div class="bottom-actions"><div class="waiting-pill">Реванш запускается на телевизоре</div><button class="btn btn-secondary" type="button" data-tvclient-action="exit">Выйти</button></div></section>`;
  }

  function renderState() {
    if (!C.state) return renderConnecting();
    if (C.state.phase === 'lobby') return renderLobby();
    if (C.state.phase === 'setup') return renderSetup();
    if (C.state.phase === 'ready') return renderReady();
    if (C.state.phase === 'round') return renderRound();
    if (C.state.phase === 'final') return renderFinal();
    renderLobby();
  }

  function startTimer() {
    clearTimer();
    const tick = () => {
      if (C.state?.phase !== 'round') return clearTimer();
      const seconds = Math.ceil(Math.max(0, Number(C.state.roundEndsAt || 0) - Date.now()) / 1000);
      const node = C.root.querySelector('#tvClientTimer');
      if (node) {
        node.textContent = String(seconds);
        node.classList.toggle('urgent', seconds <= 10);
      }
    };
    tick();
    C.timerId = setInterval(tick, 250);
  }

  async function sendAction(action) {
    if (!C.channel) return;
    await C.channel.send({ type:'broadcast', event:'action', payload:{ actorId:C.playerId, action } });
  }

  function receiveState(state) {
    if (!state || typeof state !== 'object') return;
    if (C.state && Number(state.version || 0) < Number(C.state.version || 0)) return;
    const known = Array.isArray(state.players) && state.players.some(player => player.id === C.playerId);
    if (state.phase !== 'lobby' && !known) return renderError('Партия уже идёт', 'Подключиться можно после возврата в лобби.');
    C.state = state;
    renderState();
  }

  function renderError(title, copy) {
    clearTimer();
    C.root.innerHTML = `<section class="screen room-screen">${topbar()}<div class="room-center"><div class="role-emoji">⚠️</div><h2 class="round-title">${C.esc(title)}</h2><p class="section-copy">${C.esc(copy)}</p><button class="btn btn-primary" type="button" data-tvclient-action="exit">На главный экран</button></div></section>`;
  }

  async function connect(name) {
    if (!configured()) return renderJoin('Realtime сейчас недоступен.');
    C.playerName = String(name || '').trim().slice(0,20);
    if (!C.playerName) return renderJoin('Напиши имя.');
    C.playerId = getPlayerId();
    localStorage.setItem(LAST_NAME_KEY, C.playerName);
    C.status = 'connecting';
    renderConnecting();
    try {
      const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
      const cfg = config();
      C.client = createClient(cfg.url, cfg.key, { auth:{ persistSession:false } });
      C.channel = C.client.channel(`4play:${C.code}`, { config:{ broadcast:{ self:true }, presence:{ key:C.playerId } } });
      C.channel
        .on('broadcast', { event:'state' }, ({payload}) => receiveState(payload?.state))
        .subscribe(async status => {
          if (status === 'SUBSCRIBED') {
            C.status = 'connected';
            await C.channel.track({ id:C.playerId, name:C.playerName, joinedAt:Date.now(), role:'player' });
            await C.channel.send({ type:'broadcast', event:'hello', payload:{ id:C.playerId, source:'tv-client' } });
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            C.status = 'error';
            renderError('Нет соединения', 'Телевизор или Supabase недоступен.');
          }
        });
    } catch (error) {
      console.error('4PLAY TV client failed', error);
      renderError('Не удалось подключиться', 'Проверь интернет и попробуй ещё раз.');
    }
  }

  async function disconnect(goHome = true) {
    clearTimer();
    try { if (C.channel) await C.channel.untrack(); } catch {}
    try { if (C.client && C.channel) await C.client.removeChannel(C.channel); } catch {}
    C.client = null;
    C.channel = null;
    C.state = null;
    C.status = 'idle';
    const url = new URL(location.href);
    url.searchParams.delete('room');
    url.searchParams.delete('tvhost');
    history.replaceState(null, '', url);
    if (goHome) C.onExit();
  }

  async function open({ root, cards, esc, onExit }) {
    C.root = root || rootDefault();
    C.cards = Array.isArray(cards) ? cards : [];
    C.cardMap = new Map(C.cards.map(card => [card.id, card]));
    C.esc = esc || C.esc;
    C.onExit = onExit || C.onExit;
    C.code = cleanCode(new URL(location.href).searchParams.get('room') || '');
    if (C.code.length !== 5) return renderError('Нет кода комнаты', 'Открой QR с телевизора ещё раз.');
    renderJoin();
  }

  document.addEventListener('submit', async event => {
    if (event.target.id !== 'tvClientJoinForm') return;
    event.preventDefault();
    await connect(event.target.elements.name.value);
  });

  document.addEventListener('click', async event => {
    if (!C.root || !C.root.contains(event.target)) return;
    const score = event.target.closest('[data-tvclient-score]');
    if (score && C.state?.phase === 'round') {
      score.disabled = true;
      await sendAction({ type:'score', delta:Number(score.dataset.tvclientScore), cardId:C.state.currentCardId });
      return;
    }
    const button = event.target.closest('[data-tvclient-action]');
    if (!button) return;
    if (button.dataset.tvclientAction === 'start-round') await sendAction({ type:'start-round' });
    if (button.dataset.tvclientAction === 'exit') await disconnect(true);
  });

  window.TVRoomClient = { open, disconnect, configured };
})();