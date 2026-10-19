/* Original AlterNative 4PLAY Logic prototype puzzles. No television footage or question bank copied. */
(() => {
  const rounds = [
    { id: 'common', name: 'Найди общее', hint: 'Что объединяет три картинки?', color: '#8b6bff' },
    { id: 'odd', name: 'Убери лишнее', hint: 'Какая картинка выбивается из группы?', color: '#ffb55c' },
    { id: 'formula', name: 'Формула всего', hint: 'Сложи образы и назови результат', color: '#ff6288' },
    { id: 'movie', name: 'Киноребусы', hint: 'Какой фильм или мультфильм зашифрован?', color: '#50d5d0' }
  ];
  const questions = [
    { id:'common-01', round:'common', tiles:['🗝️','🎼','⛲'], answer:'Ключ', explain:'Ключ от двери, музыкальный ключ и водный ключ (родник).' },
    { id:'common-02', round:'common', tiles:['🌍','⚽','🎱'], answer:'Шар', explain:'Земной шар, футбольный мяч и бильярдный шар.' },
    { id:'common-03', round:'common', tiles:['🌋','🕯️','🐉'], answer:'Огонь', explain:'Извержение вулкана, пламя свечи и огнедышащий дракон.' },
    { id:'odd-01', round:'odd', tiles:['🐯','🦁','🐆','🐺'], answer:'Волк', explain:'Тигр, лев и леопард относятся к кошачьим, волк — к псовым.' },
    { id:'odd-02', round:'odd', tiles:['🍉','🍌','🍐','🥕'], answer:'Морковь', explain:'Остальные обычно едят как сладкие фрукты, а морковь — корнеплод.' },
    { id:'odd-03', round:'odd', tiles:['🧀','🥛','🧈','🍯'], answer:'Мёд', explain:'Сыр, молоко и сливочное масло — молочные продукты, мёд производят пчёлы.' },
    { id:'formula-01', round:'formula', tiles:['👑','🐸'], answer:'Царевна-лягушка', explain:'Царская корона плюс лягушка — героиня известной русской сказки.' },
    { id:'formula-02', round:'formula', tiles:['🌊','🐺'], answer:'Морской волк', explain:'Море плюс волк образуют выражение «морской волк».' },
    { id:'formula-03', round:'formula', tiles:['🌙','🚶'], answer:'Лунатик', explain:'Луна плюс человек, который ходит во сне: лунатик.' },
    { id:'movie-01', round:'movie', tiles:['🦁','👑'], answer:'Король Лев', explain:'Лев и корона — мультфильм «Король Лев».' },
    { id:'movie-02', round:'movie', tiles:['🏠','👦'], answer:'Один дома', explain:'Дом и мальчик — комедия «Один дома».' },
    { id:'movie-03', round:'movie', tiles:['🚢','🧊'], answer:'Титаник', explain:'Пассажирский лайнер и айсберг — фильм «Титаник».' }
  ];
  window.FOURPLAY_LOGIC_DATA = Object.freeze({
    title: '4PLAY Логика',
    rounds: Object.freeze(rounds),
    questions: Object.freeze(questions)
  });
})();
