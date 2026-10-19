/* Offline, dependency-free validation for the original 4PLAY Logic question pack. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const context={window:{}};
vm.runInNewContext(fs.readFileSync('logic-data.js','utf8'),context,{filename:'logic-data.js'});
const d=context.window.FOURPLAY_LOGIC_DATA;
assert.ok(d,'Question pack is registered');
assert.equal(d.rounds.length,4,'Exactly four game rounds');
assert.ok(d.questions.length>=12,'At least twelve playable puzzles');
const ids=new Set();
const rounds=new Set(d.rounds.map(r=>r.id));
for (const q of d.questions) {
  assert.ok(q.id && !ids.has(q.id),'Puzzle ids must be unique');
  ids.add(q.id);
  assert.ok(rounds.has(q.round),'Puzzle must belong to a supported round: '+q.id);
  assert.ok(Array.isArray(q.tiles),'Puzzle images must be an array: '+q.id);
  assert.ok(q.tiles.length === (q.round==='common'?3:q.round==='odd'?4:2),'Wrong tile count: '+q.id);
  assert.ok(q.tiles.every(t=>typeof t==='string'&&t.length>0),'Puzzle images required: '+q.id);
  assert.ok(typeof q.answer==='string'&&q.answer.length>=2,'Answer required: '+q.id);
  assert.ok(typeof q.explain==='string'&&q.explain.length>=12,'Explanation required: '+q.id);
}
for (const r of d.rounds)assert.ok(d.questions.filter(q=>q.round===r.id).length>=3,'At least 3 puzzles for '+r.id);
console.log('PASS: '+d.questions.length+' puzzles, '+d.rounds.length+' rounds, unique IDs, complete answers and explanations');
