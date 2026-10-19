const APP = {
  cards: [],
  deck: [],
  screen: 'home',
  players: ['', '', '', ''],
  teams: [[], []],
  scores: [0, 0],
  turn: 0,
  totalTurns: 8,
  currentTurn: 1,
  explainerIndex: [0, 0],
  running: false,
  seconds: 60,
  timerId: null,
  wakeLock: null,
  currentCard: null,
  selectedCategories: ['relationships','spicy','party','awkward','life','dark_humor'],
  error: ''
};

const app = document.querySelector('#app');
const PACKS = ['relationships','spicy','party','awkward','life','dark_humor'];

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

// The dedicated TV Logic and phone Logic routes own #app entirely.
const standaloneLogic = new URLSearchParams(location.search);
if (!standaloneLogic.has('logic-tv') && !standaloneLogic.has('logic-room')) init();

async function init() {
  try {
    const results = await Promise.allSettled(
      PACKS.map(async pack => {
        const response = await fetch(`./data/${pack}.json`, { cache: 'no-store' });
        if (!response.ok) throw new Error(pack);
        return response.json();
      })
    );
    APP.cards = results
      .filter(result => result.status === 'fulfilled')
      .flatMap(result => Array.isArray(result.value.cards) ? result.value.cards : []);
    if (!APP.cards.length) {
      const response = await fetch('./data/cards.json');
      const data = await response.json();
      APP.cards = Array.isArray(data.cards) ? data.cards : [];
    }
  } catch {
    APP.cards = [];
  }
  renderHome();
}

function esc(value = '') {
  return String(value).replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
}

function setScreen(name) {
  APP.screen = name;
  APP.error = '';
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function topbar(backAction = '', right = '') {
  return `<div class="topbar">${backAction ? `<button class="icon-btn" type="button" data-action="${backAction}" aria-label="Назад">‹</button>` : '<div></div>'}<div class="brand-mini">AlterNative · 4PLAY</div>${right || '<div></div>'}</div>`;
}

function renderHome() {
  setScreen('home');
  app.innerHTML = `
    <section class="screen">
      ${topbar()}
      <div class="hero">
        <div class="logo-mark" aria-hidden="true">4P</div>
        <h1>4PLAY</h1>
        <p class="subtitle">Ну ты понял</p>
        <p class="lead">Объясняй. Угадывай. Не называй запрещённые слова. И постарайся не опозориться перед друзьями.</p>
        <div class="badges"><span class="badge">4 игрока</span><span class="badge">2 × 2</span><span class="badge">18+</span><span class="badge">Офлайн</span></div>
      </div>
      <div class="bottom-actions">
        <button class="btn btn-primary" type="button" data-action="new-game">Новая игра</button>
        <p class="helper">Версия MVP · ${APP.cards.length || '…'} карточек</p>
      </div>
    </section>`;
}

function renderPlayers() {
  setScreen('players');
  const values = APP.players.map((p, i) => esc(p || `Игрок ${i + 1}`));
  app.innerHTML = `
    <section class="screen">
      ${topbar('home')}
      <h2 class="section-title">Кто играет?</h2>
      <p class="section-copy">Четыре человека. Имена нужны, чтобы потом было понятно, кого именно обвинять в поражении.</p>
      <form id="playersForm" class="form-list">
        ${values.map((value, i) => `<label class="field"><span>Игрок ${i + 1}</span><input name="player${i}" value="${value}" maxlength="20" autocomplete="off" enterkeyhint="next"></label>`).join('')}
        <div class="bottom-actions">
          <button class="btn btn-primary" type="submit">Разделить на команды</button>
          <p id="formError" class="error" role="alert"></p>
        </div>
      </form>
    </section>`;
  const first = app.querySelector('input');
  first?.focus({ preventScroll: true });
}

function savePlayers(form) {
  const names = [0,1,2,3].map(i => form.elements[`player${i}`].value.trim()).map((n,i) => n || `Игрок ${i+1}`);
  const normalized = names.map(n => n.toLocaleLowerCase('ru'));
  if (new Set(normalized).size !== 4) {
    app.querySelector('#formError').textContent = 'Имена должны отличаться.';
    return;
  }
  APP.players = names;
  shuffleTeams();
  renderTeams();
}

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function shuffleTeams() {
  const shuffled = shuffle(APP.players);
  APP.teams = [[shuffled[0], shuffled[1]], [shuffled[2], shuffled[3]]];
}

function renderTeams() {
  setScreen('teams');
  app.innerHTML = `
    <section class="screen">
      ${topbar('players')}
      <h2 class="section-title">Команды готовы</h2>
      <p class="section-copy">Случайное распределение. Не нравится партнёр? Судьба дала кнопку «Перемешать».</p>
      <div class="team-grid">
        ${APP.teams.map((team, i) => `<article class="team-card"><div class="team-label">Команда ${i + 1}</div><div class="team-name">${i === 0 ? 'Красные' : 'Фиолетовые'}</div><div class="team-members">${team.map(esc).join(' + ')}</div></article>`).join('')}
      </div>
      <div class="bottom-actions">
        <button class="btn btn-primary" type="button" data-action="categories">Настроить игру</button>
        <button class="btn btn-secondary" type="button" data-action="shuffle-teams">Перемешать</button>
        <p class="helper">8 ходов · 60 секунд на ход · ${APP.cards.length} карточек в колоде</p>
      </div>
    </section>`;
}

function renderCategories() {
  setScreen('categories');
  const meta = [
    ['relationships','❤️','Отношения','Бывшие, свидания, ревность и прочая человеческая дипломатия.'],
    ['spicy','🔥','Погорячее 18+','Секс, флирт, неловкие взрослые ситуации.'],
    ['party','🥂','Вечеринка','Похмелье, караоке, такси в четыре утра.'],
    ['awkward','🫠','Неловко','Сообщение не тому, забытые имена и социальные катастрофы.'],
    ['life','🧾','Жизнь','Работа, ипотека, ремонт и другие взрослые наказания.'],
    ['dark_humor','💀','Чёрный юмор','Абсурд, самоирония и события, которые лучше переживать смеясь.']
  ];
  app.innerHTML = `
    <section class="screen">
      ${topbar('teams')}
      <h2 class="section-title">Что играем?</h2>
      <p class="section-copy">Выбери категории. В колоду попадут только они.</p>
      <div class="category-list">
        ${meta.map(([id,icon,title,copy]) => {
          const selected = APP.selectedCategories.includes(id);
          const count = APP.cards.filter(card => card.category === id).length;
          return `<button class="category-row ${selected ? 'selected' : ''}" type="button" data-category="${id}" aria-pressed="${selected}">
            <span class="category-icon">${icon}</span>
            <span class="category-main"><strong>${title}</strong><small>${copy}</small></span>
            <span class="category-count">${count}</span>
            <span class="category-check">${selected ? '✓' : ''}</span>
          </button>`;
        }).join('')}
      </div>
      <div class="bottom-actions">
        <button class="btn btn-primary" type="button" data-action="launch-game" ${APP.selectedCategories.length ? '' : 'disabled'}>Начать игру</button>
        <p class="helper">Выбрано ${APP.selectedCategories.length} из 6 · ${APP.cards.filter(card => APP.selectedCategories.includes(card.category)).length} карточек</p>
      </div>
    </section>`;
}

function toggleCategory(id) {
  APP.selectedCategories = APP.selectedCategories.includes(id)
    ? APP.selectedCategories.filter(item => item !== id)
    : [...APP.selectedCategories, id];
  renderCategories();
}

function resetGame() {
  clearInterval(APP.timerId);
  APP.scores = [0,0];
  APP.turn = 0;
  APP.currentTurn = 1;
  APP.explainerIndex = [0,0];
  APP.running = false;
  APP.seconds = 60;
  APP.deck = shuffle(APP.cards.filter(card => APP.selectedCategories.includes(card.category)));
  APP.currentCard = null;
}

function renderRoundReady() {
  setScreen('round-ready');
  const teamIndex = APP.turn;
  const team = APP.teams[teamIndex];
  const explainer = team[APP.explainerIndex[teamIndex] % team.length];
  const guesser = team[(APP.explainerIndex[teamIndex] + 1) % team.length];
  app.innerHTML = `
    <section class="screen">
      ${topbar('confirm-exit')}
      <div class="round-ready">
        <div class="round-team">Ход ${APP.currentTurn} из ${APP.totalTurns} · Команда ${teamIndex + 1}</div>
        <h2 class="round-title">${esc(explainer)}, объясняешь ты</h2>
        <div class="round-members">${esc(guesser)} угадывает</div>
        <p class="round-note">Не произноси само слово, однокоренные и слова из списка запретов. За нарушение −1.</p>
      </div>
      <div class="bottom-actions">
        <button class="btn btn-primary" type="button" data-action="start-round">Начать 60 секунд</button>
        <p class="helper">Передай телефон объясняющему до нажатия кнопки.</p>
      </div>
    </section>`;
}

async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator) APP.wakeLock = await navigator.wakeLock.request('screen');
  } catch {}
}

function releaseWakeLock() {
  try { APP.wakeLock?.release(); } catch {}
  APP.wakeLock = null;
}

function nextCard() {
  if (!APP.deck.length) APP.deck = shuffle(APP.cards.filter(card => APP.selectedCategories.includes(card.category)));
  APP.currentCard = APP.deck.pop() || { category: '4PLAY', prompt: 'Карточки закончились', forbidden: [] };
}

function startRound() {
  APP.running = true;
  APP.seconds = 60;
  nextCard();
  requestWakeLock();
  renderGame();
  clearInterval(APP.timerId);
  APP.timerId = setInterval(() => {
    APP.seconds -= 1;
    const timer = app.querySelector('#timer');
    if (timer) timer.textContent = APP.seconds;
    if (APP.seconds <= 0) endRound();
  }, 1000);
}

function categoryLabel(card) {
  const labels = {relationships:'Отношения',spicy:'18+ · Погорячее',party:'Вечеринка',awkward:'Неловко',life:'Жизнь',dark_humor:'Чёрный юмор'};
  return labels[card?.category] || 'Ну ты понял';
}

function renderGame() {
  setScreen('game');
  const c = APP.currentCard;
  app.innerHTML = `
    <section class="screen">
      <div class="game-head">
        <div class="score">${esc(APP.teams[0].join(' + '))}<br><strong>${APP.scores[0]}</strong></div>
        <div id="timer" class="timer" aria-label="Осталось секунд">${APP.seconds}</div>
        <div class="score right">${esc(APP.teams[1].join(' + '))}<br><strong>${APP.scores[1]}</strong></div>
      </div>
      <div class="turn-label">Ходит команда ${APP.turn + 1}</div>
      <div class="card-wrap">
        <article class="game-card">
          <div class="card-kicker">${esc(categoryLabel(c))}</div>
          <div class="card-prompt">${esc(c?.prompt || '…')}</div>
          ${c?.forbidden?.length ? `<div class="forbidden-title">Нельзя говорить</div><div class="forbidden">${c.forbidden.map(word => `<span>${esc(word)}</span>`).join('')}</div>` : ''}
        </article>
      </div>
      <div class="score-actions">
        <button class="score-btn bad" type="button" data-score="-1">Нарушение<br>−1</button>
        <button class="score-btn" type="button" data-score="0">Пропуск</button>
        <button class="score-btn good" type="button" data-score="1">Угадано<br>+1</button>
      </div>
      <button class="btn btn-secondary" type="button" data-action="end-round" style="margin-top:10px">Завершить ход</button>
    </section>`;
}

function scoreCard(delta) {
  APP.scores[APP.turn] += delta;
  nextCard();
  renderGame();
}

function endRound() {
  if (!APP.running) return;
  APP.running = false;
  clearInterval(APP.timerId);
  APP.timerId = null;
  releaseWakeLock();
  APP.explainerIndex[APP.turn] += 1;
  if (APP.currentTurn >= APP.totalTurns) {
    renderFinal();
    return;
  }
  APP.currentTurn += 1;
  APP.turn = APP.turn === 0 ? 1 : 0;
  renderRoundReady();
}

function renderFinal() {
  setScreen('final');
  const [a,b] = APP.scores;
  const winner = a === b ? null : (a > b ? 0 : 1);
  const title = winner === null ? 'Ничья. Подозрительно.' : `Победила команда ${winner + 1}`;
  const members = winner === null ? 'Придётся сыграть ещё.' : APP.teams[winner].join(' + ');
  app.innerHTML = `
    <section class="screen">
      ${topbar()}
      <div class="result-card">
        <div class="result-emoji">${winner === null ? '🤝' : '🏆'}</div>
        <h2 class="result-title">${esc(title)}</h2>
        <p class="section-copy" style="margin-top:10px">${esc(members)}</p>
        <div class="result-score">${a} : ${b}</div>
      </div>
      <div class="bottom-actions">
        <button class="btn btn-primary" type="button" data-action="rematch">Реванш</button>
        <button class="btn btn-secondary" type="button" data-action="home">В меню</button>
      </div>
    </section>`;
}

function confirmExit() {
  if (window.confirm('Закончить текущую игру и выйти в меню?')) {
    clearInterval(APP.timerId);
    releaseWakeLock();
    renderHome();
  }
}

app.addEventListener('click', event => {
  const categoryButton = event.target.closest('[data-category]');
  if (categoryButton) {
    toggleCategory(categoryButton.dataset.category);
    return;
  }
  const scoreButton = event.target.closest('[data-score]');
  if (scoreButton && APP.running) {
    scoreCard(Number(scoreButton.dataset.score));
    return;
  }
  const button = event.target.closest('[data-action]');
  if (!button) return;
  switch (button.dataset.action) {
    case 'new-game': renderPlayers(); break;
    case 'home': renderHome(); break;
    case 'players': renderPlayers(); break;
    case 'shuffle-teams': shuffleTeams(); renderTeams(); break;
    case 'categories': renderCategories(); break;
    case 'launch-game': if (APP.selectedCategories.length) { resetGame(); renderRoundReady(); } break;
    case 'start-round': startRound(); break;
    case 'end-round': endRound(); break;
    case 'confirm-exit': confirmExit(); break;
    case 'rematch': resetGame(); renderRoundReady(); break;
  }
});

app.addEventListener('submit', event => {
  if (event.target.id === 'playersForm') {
    event.preventDefault();
    savePlayers(event.target);
  }
});

document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'visible' && APP.running && APP.wakeLock === null) requestWakeLock();
});
