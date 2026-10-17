(() => {
  const params = new URL(location.href).searchParams;
  if (!params.has('tv')) return;

  const root = document.querySelector('#app');
  const TV = {
    code: cleanCode(params.get('tv') || ''), state: null, players: [], client: null,
    channel: null, status: 'idle', timerId: null, qrLoading: null
  };

  document.documentElement.classList.add('tv-mode');
  document.body.classList.add('tv-mode');

  function cleanCode(value) {
    return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
  }

  function esc(value = '') {
    return String(value).replace(/[&<>'"]/g, char => ({
      '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'
    }[char]));
  }

  function config() {
    const value = window.FOURPLAY_SUPABASE || {};
    return { url: String(value.url || '').trim(), key: String(value.key || '').trim() };
  }

  function configured() {
    const c = config();
    return /^https:\/\/.+\.supabase\.co$/i.test(c.url) && c.key.length > 20;
  }

  function inviteUrl() {
    const url = new URL(location.href);
    url.search = '';
    url.hash = '';
    url.searchParams.set('room', TV.code);
    return url.toString();
  }

  function flattenPresence() {
    if (!TV.channel) return [];
    return Object.values(TV.channel.presenceState()).flat().filter(Boolean).map(item => ({
      id: String(item.id || ''),
      name: String(item.name || 'Игрок').slice(0, 20),
      joinedAt: Number(item.joinedAt || 0)
    })).filter(item => item.id).sort((a,b) => a.joinedAt - b.joinedAt || a.id.localeCompare(b.id)).slice(0, 8);
  }

  function players() {
    return TV.state?.players?.length ? TV.state.players : TV.players;
  }

  function nameById(id) {
    return players().find(player => player.id === id)?.name || 'Игрок';
  }

  function isDuel(state = TV.state) {
    return Array.isArray(state?.teams) && state.teams.length === 2 && state.teams.every(team => Array.isArray(team) && team.length === 1);
  }

  function roles(state = TV.state) {
    if (!state?.teams?.[state.turn]?.length) return { explainerId:'', guesserId:'', duel:false };
    const duel = isDuel(state);
    const team = state.teams[state.turn];
    const index = Number(state.explainerIndex?.[state.turn] || 0) % team.length;
    const explainerId = team[index];
    const guesserId = duel ? state.teams[state.turn === 0 ? 1 : 0]?.[0] : team[(index + 1) % team.length];
    return { explainerId, guesserId, duel };
  }

  function scoreLabels(state = TV.state) {
    return isDuel(state)
      ? [nameById(state.teams?.[0]?.[0]), nameById(state.teams?.[1]?.[0])]
      : ['Команда 1', 'Команда 2'];
  }

  function header(kicker = 'Общий экран') {
    const online = TV.status === 'connected';
    return `<header class="tv-top">
      <div class="tv-brand"><span class="tv-brand-mark">4P</span><span>AlterNative · 4PLAY</span></div>
      <div class="tv-kicker">${esc(kicker)}</div>
      <div class="tv-status ${online ? 'online' : ''}"><i></i>${online ? 'Онлайн' : 'Подключение'}</div>
    </header>`;
  }

  function renderEntry(message = '') {
    clearInterval(TV.timerId);
    root.innerHTML = `<section class="tv-shell">
      ${header('Экран телевизора')}
      <div class="tv-entry-card">
        <div class="tv-logo">4PLAY</div>
        <h1>Главный экран вечеринки</h1>
        <p>Введи код комнаты. Телевизор подключится как общий экран и не займёт место игрока.</p>
        <form id="tvJoinForm" class="tv-code-form">
          <input name="code" value="${esc(TV.code)}" maxlength="5" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="7KQ2A" aria-label="Код комнаты">
          <button type="submit">Подключить экран</button>
        </form>
        ${message ? `<div class="tv-error">${esc(message)}</div>` : ''}
      </div>
    </section>`;
  }

  function playerChips(list) {
    if (!list.length) return '<div class="tv-small">Ждём игроков…</div>';
    return `<div class="tv-players">${list.map(player => `<div class="tv-player"><span>${esc(player.name.slice(0,1).toUpperCase())}</span><strong>${esc(player.name)}</strong></div>`).join('')}</div>`;
  }

  function renderLobby() {
    const list = players();
    root.innerHTML = `<section class="tv-shell">
      ${header('Лобби')}
      <div class="tv-lobby-grid">
        <div class="tv-panel">
          <div class="tv-eyebrow">Код комнаты</div>
          <div class="tv-code">${esc(TV.code)}</div>
          <div class="tv-small">${list.length} из 8 подключено</div>
          ${playerChips(list)}
        </div>
        <div class="tv-panel">
          <div class="tv-qr" id="tvQr"></div>
          <h2>Сканируй камерой</h2>
          <p class="tv-hint">Или открой 4PLAY на телефоне и введи код <strong>${esc(TV.code)}</strong>.</p>
        </div>
      </div>
    </section>`;
    renderQr();
  }

  function renderSetup() {
    const s = TV.state;
    const duel = isDuel(s);
    const settings = s.settings || {};
    const teams = (s.teams || []).map((team, index) => `<div class="tv-team"><span>${duel ? `Игрок ${index + 1}` : `Команда ${index + 1}`}</span><strong>${esc(team.map(nameById).join(' + ') || '—')}</strong></div>`).join('');
    root.innerHTML = `<section class="tv-shell">
      ${header('Ну ты понял')}
      <div class="tv-center">
        <div class="tv-eyebrow">${duel ? 'Дуэль 1 × 1' : 'Команды 2 × 2'}</div>
        <h1 class="tv-title">Готовимся</h1>
        <div class="tv-teams">${teams}</div>
        <div class="tv-meta"><span>${Number(settings.seconds || 60)} секунд</span><span>${Number(settings.turns || s.totalTurns || 8)} ходов</span><span>${s.selectedCategories?.length || 0} категорий</span></div>
        <p class="tv-hint">Ведущий настраивает партию на телефоне.</p>
      </div>
    </section>`;
  }

  function renderReady() {
    const s = TV.state;
    const r = roles(s);
    const labels = scoreLabels(s);
    root.innerHTML = `<section class="tv-shell">
      ${header('Ну ты понял')}
      ${scoreBar(s, labels, `<div class="tv-turn">Ход ${Number(s.currentTurn || 1)} / ${Number(s.totalTurns || s.settings?.turns || 8)}</div>`)}
      <div class="tv-center">
        <div class="tv-eyebrow">Следующий ход</div>
        <h1 class="tv-title">${esc(nameById(r.explainerId))}</h1>
        <p class="tv-versus">объясняет · ${esc(nameById(r.guesserId))} угадывает</p>
        <p class="tv-hint">Слово остаётся только на телефоне объясняющего. Телевизор не спойлерит.</p>
      </div>
    </section>`;
  }

  function scoreBar(s, labels, middle) {
    return `<div class="tv-score-line">
      <div><span>${esc(labels[0])}</span><strong>${Number(s.scores?.[0] || 0)}</strong></div>
      ${middle}
      <div><span>${esc(labels[1])}</span><strong>${Number(s.scores?.[1] || 0)}</strong></div>
    </div>`;
  }

  function renderRound() {
    const s = TV.state;
    const r = roles(s);
    const labels = scoreLabels(s);
    root.innerHTML = `<section class="tv-shell">
      ${header('Ну ты понял')}
      ${scoreBar(s, labels, '<div id="tvTimer" class="tv-timer">—</div>')}
      <div class="tv-center">
        <div class="tv-eyebrow">Ход ${Number(s.currentTurn || 1)} / ${Number(s.totalTurns || s.settings?.turns || 8)}</div>
        <h1 class="tv-title">${esc(nameById(r.explainerId))} → ${esc(nameById(r.guesserId))}</h1>
        <p class="tv-versus">Объясняй. Угадывай. Не пались.</p>
        <p class="tv-hint">Карточка и запрещённые слова видны только на нужных телефонах.</p>
      </div>
    </section>`;
    startTimer();
  }

  function renderFinal() {
    clearInterval(TV.timerId);
    const s = TV.state;
    const labels = scoreLabels(s);
    const a = Number(s.scores?.[0] || 0), b = Number(s.scores?.[1] || 0);
    const winner = a === b ? -1 : a > b ? 0 : 1;
    root.innerHTML = `<section class="tv-shell">
      ${header('Финал')}
      <div class="tv-center">
        <div class="tv-trophy">${winner < 0 ? '🤝' : '🏆'}</div>
        <div class="tv-eyebrow">${winner < 0 ? 'Ничья' : 'Победитель'}</div>
        <h1 class="tv-title">${winner < 0 ? 'Ничья' : esc(labels[winner])}</h1>
        <div class="tv-final-score">${a} : ${b}</div>
        <p class="tv-hint">Реванш запускается с телефона ведущего.</p>
      </div>
    </section>`;
  }

  function renderWaiting() {
    root.innerHTML = `<section class="tv-shell">
      ${header('Комната')}
      <div class="tv-center"><div class="tv-eyebrow">Комната</div><div class="tv-code">${esc(TV.code)}</div><h1 class="tv-title">Ждём ведущего</h1><p class="tv-hint">Экран уже подключён. Когда ведущий появится, состояние игры придёт сюда автоматически.</p></div>
    </section>`;
  }

  function renderState() {
    if (!TV.state) return TV.players.length ? renderLobby() : renderWaiting();
    switch (TV.state.phase) {
      case 'lobby': return renderLobby();
      case 'setup': return renderSetup();
      case 'ready': return renderReady();
      case 'round': return renderRound();
      case 'final': return renderFinal();
      default: return renderLobby();
    }
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
      new QRCode(box, { text: inviteUrl(), width:260, height:260, colorDark:'#08080b', colorLight:'#ffffff', correctLevel:QRCode.CorrectLevel.M });
    } catch {
      box.textContent = TV.code;
    }
  }

  async function disconnect() {
    clearInterval(TV.timerId);
    try { if (TV.channel && TV.client) await TV.client.removeChannel(TV.channel); } catch {}
    TV.channel = null; TV.client = null; TV.state = null; TV.players = []; TV.status = 'idle';
  }

  async function connect(code) {
    TV.code = cleanCode(code);
    if (TV.code.length !== 5) return renderEntry('Код комнаты должен состоять из пяти символов.');
    if (!configured()) return renderEntry('Realtime сейчас недоступен.');

    await disconnect();
    TV.status = 'connecting';
    renderWaiting();
    const url = new URL(location.href);
    url.search = '';
    url.searchParams.set('tv', TV.code);
    history.replaceState(null, '', url);

    try {
      const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
      const c = config();
      TV.client = createClient(c.url, c.key, { auth: { persistSession:false } });
      TV.channel = TV.client.channel(`4play:${TV.code}`, { config: { broadcast: { self:false } } });
      TV.channel
        .on('presence', { event:'sync' }, async () => {
          TV.players = flattenPresence();
          renderState();
          if (!TV.state && TV.players.length) {
            try { await TV.channel.send({ type:'broadcast', event:'hello', payload:{ source:'tv' } }); } catch {}
          }
        })
        .on('broadcast', { event:'state' }, ({payload}) => {
          if (!payload?.state) return;
          if (TV.state && Number(payload.state.version || 0) < Number(TV.state.version || 0)) return;
          TV.state = payload.state;
          renderState();
        })
        .subscribe(async status => {
          if (status === 'SUBSCRIBED') {
            TV.status = 'connected';
            TV.players = flattenPresence();
            renderState();
            await TV.channel.send({ type:'broadcast', event:'hello', payload:{ source:'tv' } });
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            TV.status = 'error'; renderWaiting();
          } else if (status === 'CLOSED') {
            TV.status = 'idle'; renderWaiting();
          }
        });
    } catch (error) {
      console.error('4PLAY TV connection failed', error);
      TV.status = 'error';
      renderEntry('Не удалось подключить экран. Проверь интернет и повтори.');
    }
  }

  root.addEventListener('submit', event => {
    const form = event.target.closest('#tvJoinForm');
    if (!form) return;
    event.preventDefault();
    connect(form.elements.code.value);
  });

  root.addEventListener('input', event => {
    if (event.target.matches('#tvJoinForm input[name="code"]')) event.target.value = cleanCode(event.target.value);
  });

  const guard = new MutationObserver(() => {
    if (!root.querySelector('.tv-shell')) TV.code && TV.channel ? renderState() : renderEntry();
  });
  guard.observe(root, { childList:true });

  addEventListener('beforeunload', disconnect);
  TV.code ? connect(TV.code) : renderEntry();
})();
