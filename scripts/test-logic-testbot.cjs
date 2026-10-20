/* Single-phone bot smoke test: mock DOM + Supabase presence, exercise real host code. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const timers=new Map();
let nextTimer=1;
const el={innerHTML:'',querySelector:()=>null};
const player={role:'logic-player',id:'human',name:'Тестер',joinedAt:1};
const second={role:'logic-player',id:'friend',name:'Друг',joinedAt:2};
let connected=[player];
const stateStore=new Map();
const ctx={
  window:{FOURPLAY_SUPABASE:{}},
  document:{querySelector:()=>el,documentElement:{classList:{add(){}}},body:{classList:{add(){}}}},
  location:{search:'?logic-tv',href:'https://example.org/?logic-tv',origin:'https://example.org',pathname:'/'},
  URLSearchParams,URL,Date,console,
  crypto:{randomUUID:()=>String(nextTimer++)},
  history:{replaceState(){}},
  sessionStorage:{setItem:(k,v)=>stateStore.set(k,v),getItem:k=>stateStore.get(k)||null},
  setTimeout:(cb,ms)=>{const id=nextTimer++;timers.set(id,{cb,ms});return id;},
  clearTimeout:id=>timers.delete(id),
  setInterval:()=>nextTimer++,
  clearInterval:()=>{},
  addEventListener:()=>{}
};
vm.runInNewContext(fs.readFileSync('logic-data.js','utf8'),ctx);
vm.runInNewContext(fs.readFileSync('logic-answer-check.js','utf8'),ctx);
let host=fs.readFileSync('logic-tv.js','utf8');
assert.match(host,/\}\)\(\);\s*$/);
host=host.replace(/\}\)\(\);\s*$/,'window.__test={TV,presence,handleControl,finishAttempt};})();');
vm.runInNewContext(host,ctx);
(async()=>{
 const {TV,presence,handleControl,finishAttempt}=ctx.window.__test;
 TV.code='ABCDE';
 TV.online=true;
 TV.channel={
   presenceState:()=>({users:connected}),
   send:async()=>{}
 };
 TV.state={gameId:'logic',code:'ABCDE',version:1,phase:'lobby',players:[],controllerId:'',
   index:0,scores:[0,0],deadline:0,buzz:null,blockedTeams:[],revealEndsAt:0,testBotEnabled:false};
 await presence();
 assert.equal(TV.state.players.length,1,'One human initially');
 assert.equal(TV.state.controllerId,'human','Human is organizer');
 await handleControl({playerId:'human',command:'test-bot'});
 assert.equal(TV.state.players.length,2,'Bot becomes second player');
 assert.equal(TV.state.players[0].team,0);
 assert.equal(TV.state.players[1].team,1);
 assert.equal(TV.state.players[1].isBot,true);
 await handleControl({playerId:'human',command:'start'});
 assert.equal(TV.state.phase,'question','Solo player can start');
 assert.ok(timers.get(TV.botTimer)?.ms>=18000,'Bot waits before competing');
 TV.state.buzz={playerId:'human',team:0,attemptId:'attempt-1'};
 TV.state.deadline=Date.now()+15000;
 await finishAttempt('attempt-1','неправильный ответ');
 assert.equal(TV.state.blockedTeams[0],0,'Failed human attempt blocks human team');
 const timer=timers.get(TV.botTimer);
 assert.equal(timer.ms,2800,'Bot reacts quickly to wrong answer');
 await timer.cb();
 assert.equal(TV.state.phase,'reveal','Virtual player resolves test question');
 assert.equal(TV.state.scores[1],1,'Bot scores on its scripted correct turn');
 TV.state.phase='lobby';
 connected=[player,second];
 await presence();
 assert.equal(TV.state.players.length,2,'Two real players replace bot');
 assert.equal(TV.state.testBotEnabled,false,'Bot is disabled when real friend joins');
 assert.ok(TV.state.players.every(p=>!p.isBot),'No bot in normal game');
 // Expand the lobby to twelve actual participants.
 TV.state.phase='lobby';
 connected=Array.from({length:12},(_,i)=>({
   role:'logic-player',id:i===0?'human':'player-'+i,name:'Игрок '+(i+1),joinedAt:i+1,
   avatar:{kind:'emoji',value:i===0?'🦄':'🤡'}
 }));
 await presence();
 assert.equal(TV.state.players.length,12,'All twelve players join the lobby');
 assert.equal(TV.state.players.filter(p=>p.team===0).length,6,'Team A has six');
 assert.equal(TV.state.players.filter(p=>p.team===1).length,6,'Team B has six');
 assert.equal(TV.state.players[0].avatar.value,'🦄','Custom emoji reaches TV state');

 await handleControl({playerId:'player-1',command:'rename-teams',names:['Не хозяин','Другая']});
 assert.ok(!TV.state.teamNames,'Non-organizer cannot rename teams');
 await handleControl({playerId:'human',command:'rename-teams',names:['Огурцы','Бешеные тапки']});
 assert.equal(TV.state.teamNames[0],'Огурцы','Organizer renames first team');
 assert.equal(TV.state.teamNames[1],'Бешеные тапки','Organizer renames second team');
 assert.ok(el.innerHTML.includes('Бешеные тапки'),'TV lobby shows renamed team');
 await handleControl({playerId:'human',command:'rename-teams',names:['Одинаковые','Одинаковые']});
 assert.equal(TV.state.teamNames[0],'Огурцы','Duplicate team names rejected');

 // JPEG thumbnails are transported through presence and persisted in host state.
 const photo='data:image/jpeg;base64,'+Buffer.from('tiny-pic').toString('base64');
 connected[1].avatar={kind:'photo',value:photo};
 await presence();
 assert.equal(TV.state.players[1].avatar.value,photo,'Photo arrives in game state');

 connected.push({role:'logic-player',id:'player-12',name:'13-й игрок',joinedAt:13});
 await presence();
 assert.equal(TV.state.players.length,12,'13th player is not admitted');

 console.log('PASS: solo bot, twelve balanced players, editable team names, emoji/photo avatars, room cap');
})().catch(err=>{console.error(err);process.exitCode=1;});
