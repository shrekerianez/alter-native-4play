/* 4PLAY Logic: conservative Russian spelling-tolerant answer checker.
   Executed by the TV host only, never used by a phone to award points. */
(() => {
  'use strict';
  function normalize(value) {
    return String(value ?? '')
      .normalize('NFKC')
      .toLocaleLowerCase('ru-RU')
      .replace(/ё/g, 'е')
      .replace(/[^а-яa-z0-9]+/g, ' ')
      .trim()
      .replace(/\s+/g, ' ');
  }

  // Optimal-string-alignment edit distance: insert, delete, replace,
  // or swap two neighbouring letters (a common mobile-keyboard typo).
  function distance(a, b, limit = Infinity) {
    if (Math.abs(a.length - b.length) > limit) return limit + 1;
    const rows = Array.from({length:a.length+1}, () => new Uint16Array(b.length+1));
    for (let i=0;i<=a.length;i++) rows[i][0]=i;
    for (let j=0;j<=b.length;j++) rows[0][j]=j;
    for (let i=1;i<=a.length;i++){
      let best=Infinity;
      for (let j=1;j<=b.length;j++){
        const cost=a[i-1]===b[j-1]?0:1;
        let v=Math.min(rows[i-1][j]+1, rows[i][j-1]+1, rows[i-1][j-1]+cost);
        if(i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1]) v=Math.min(v,rows[i-2][j-2]+1);
        rows[i][j]=v;
        if(v<best)best=v;
      }
      if(best>limit) return limit+1;
    }
    return rows[a.length][b.length];
  }

  function check(typed, questionOrAnswers) {
    const variants = Array.isArray(questionOrAnswers)
      ? questionOrAnswers
      : [questionOrAnswers?.answer, ...(questionOrAnswers?.aliases || [])];
    const guess=normalize(typed);
    if(!guess || guess.length>70) return {correct:false,typo:false};
    const compactGuess=guess.replace(/ /g,'');
    if(!compactGuess) return {correct:false,typo:false};

    for(const variant of variants){
      const correct=normalize(variant);
      if(!correct)continue;
      if(guess===correct || compactGuess===correct.replace(/ /g,'')){
        return {correct:true,typo:false};
      }
    }

    for(const variant of variants){
      const correct=normalize(variant);
      const target=correct.replace(/ /g,'');
      if(!target)continue;
      // Short answers like "шар" or "мёд" must match exactly.
      // With longer words allow a small number of keyboard mistakes.
      const allowed=target.length>=12 ? 2 : target.length>=5 ? 1 : 0;
      if(!allowed)continue;
      if(Math.abs(compactGuess.length-target.length)>allowed)continue;
      if(distance(compactGuess,target,allowed)<=allowed){
        return {correct:true,typo:true};
      }
    }
    return {correct:false,typo:false};
  }
  window.FOURPLAY_LOGIC_CHECK={normalize,check};
})();
