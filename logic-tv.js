(() => {
  const params = new URLSearchParams(location.search);
  if (!params.has('logic-tv')) return;
  const DATA = window.FOURPLAY_LOGIC_DATA;
  const root = document.querySelector('#app');
  if (!DATA || !root) return;
  document.documentElement.classList.add('logic-tv-mode');
  document.body.classList.add('logic-tv-mode');
  const alphabet = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  const TV = {code:clean(params.get('logic-tv')), client:null,channel:null,online:false,
    people:[], state:null,timer:null,botTimer:null,qrLoading:null,hostId:'logic-tv-'+uuid(),busy:false};
  const REVEAL_MS=7500;
  const TEST_BOT_ID='logic-test-bot';
  const BOT_RESPONSE_DELAY_MS=2800;
  function uuid(){return crypto.randomUUID ? crypto.randomUUID():Date.now()+'-'+Math.random().toString(36).slice(2);}
  function clean(s){return String(s||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,5);}
  function code(){const b=new Uint8Array(5);crypto.getRandomValues(b);return Array.from(b,x=>alphabet[x%alphabet.length]).join('');}
  function esc(s=''){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function config(){const c=window.FOURPLAY_SUPABASE||{};return {url:String(c.url||''),key:String(c.key||'')};}
  function configured(){const c=config();return /^https:\/\/.+\.supabase\.co$/i.test(c.url)&&c.key.length>20;}
  function question(){return DATA.questions[TV.state?.index||0];}
  function teamName(i){return i===0?'Розовые':'Фиолетовые';}
  function members(i){return (TV.state?.players||[]).filter(p=>p.team===i);}
  function testBotEnabled(state=TV.state){
    return !!state?.testBotEnabled && (state.players||[]).some(p=>p.id===TEST_BOT_ID);
  }
  function shouldTestBotReply(state=TV.state){
    if(!state||state.phase!=='question'||state.buzz||!testBotEnabled(state))return false;
    const bot=state.players.find(p=>p.id===TEST_BOT_ID);
    const human=state.players.find(p=>p.id!==TEST_BOT_ID);
    return !!human && !!bot && state.blockedTeams?.includes(human.team)
      && !state.blockedTeams.includes(bot.team)
      && Date.now()<state.deadline;
  }
  function queueBotReply(){
    clearTimeout(TV.botTimer);TV.botTimer=null;
    if(!shouldTestBotReply())return;
    const atIndex=TV.state.index;
    TV.botTimer=setTimeout(async()=>{
      TV.botTimer=null;
      if(!shouldTestBotReply()||TV.state.index!==atIndex)return;
      await change(state=>{
        if(!shouldTestBotReply(state)||state.index!==atIndex)return false;
        const bot=state.players.find(p=>p.id===TEST_BOT_ID);
        const correct=state.index%2===0;
        state.lastResult={playerId:TEST_BOT_ID,correct,typo:false,expired:false,testBot:true};
        state.deadline=0;
        if(correct)state.scores[bot.team]+=1;
        else state.blockedTeams.push(bot.team);
        state.phase='reveal';
        state.revealEndsAt=Date.now()+REVEAL_MS;
      });
    },BOT_RESPONSE_DELAY_MS);
  }
  function persist(){try{if(TV.code&&TV.state)sessionStorage.setItem('4play.logic.tv.'+TV.code,JSON.stringify(TV.state));}catch{}}
  function readSaved(){try{const s=JSON.parse(sessionStorage.getItem('4play.logic.tv.'+TV.code)||'null');return s?.gameId==='logic'&&s.code===TV.code?s:null;}catch{return null;}}
  function header(label='Логическая вечеринка'){
    return '<header class="logic-header"><div class="logic-brand">4PLAY <span>ЛОГИКА</span></div><div class="logic-label">'+esc(label)+'</div><div class="logic-row"><span class="logic-label">'+(TV.online?'● Онлайн':'○ Подключение')+'</span><span class="logic-label">Управление со смартфонов</span></div></header>';
  }
  function frame(body,label){root.innerHTML='<section class="logic-tv">'+header(label)+body+'</section>'; }
  function renderIntro(error=''){
    frame('<main class="logic-intro"><div class="logic-label">Игровой экран · AlterNative</div><h1>А у вас есть<br>логика?</h1><p>Создаём комнату автоматически. Всё управление будет на телефонах участников.</p><div class="logic-label">Подключение к игровому серверу…</div>'+(error?'<div class="logic-error">'+esc(error)+'</div>':'')+'</main>','4PLAY Логика');
  }
  function playerList(team){
    const a=(TV.state?.players||[]).filter(p=>p.team===team);
    return a.length?a.map(p=>'<span class="logic-player-tag">'+(p.id===TEST_BOT_ID?'🤖 ':'')+esc(p.name)+'</span>').join(''):'<div class="logic-hint">Ожидаем игроков…</div>';
  }
  function renderLobby(){
    const count=TV.state?.players?.length||0;
    frame('<main class="logic-lobby"><div class="logic-panel"><div class="logic-label">Комната для 2–8 игроков</div><div class="logic-code">'+esc(TV.code)+'</div><p class="logic-hint">'+count+' из 8 игроков'+(testBotEnabled()?' · 🧪 тестовый бот':'')+' · команды формируются автоматически</p><div class="logic-players"><div class="logic-team"><h3>● '+teamName(0)+'</h3>'+playerList(0)+'</div><div class="logic-team"><h3>● '+teamName(1)+'</h3>'+playerList(1)+'</div></div><div class="logic-row" style="margin-top:30px"><div class="logic-hint">'+(count<2?'Ждём минимум двух игроков…':'Организатор запускает шоу на своём смартфоне')+'</div></div></div><div class="logic-panel"><div id="logicQr" class="logic-qr" aria-label="QR код комнаты">'+esc(TV.code)+'</div><p class="logic-hint">Сканируйте QR камерой телефона<br>или введите код комнаты.</p><div class="logic-label">'+esc(location.origin+location.pathname)+'</div></div></main>','Игроки и команды');
    renderQr();
  }
  function tiles(q){
    if(!q)return '';
    return '<div class="logic-tiles">'+q.tiles.map((tile,i)=> (i&&q.round==='formula'||i&&q.round==='movie' ? '<span class="logic-plus">+</span>':'')+'<div class="logic-tile"><small>'+String(i+1)+'</small><span>'+esc(tile)+'</span></div>').join('')+'</div>';
  }
  function scores(){
    return '<div class="logic-topline"><div class="logic-score"><small>Розовые</small><strong>'+Number(TV.state?.scores?.[0]||0)+'</strong></div><div id="logicClock" class="logic-clock">45</div><div class="logic-score"><small>Фиолетовые</small><strong>'+Number(TV.state?.scores?.[1]||0)+'</strong></div></div>';
  }
  function renderQuestion(){
    const q=question(), s=TV.state, round=DATA.rounds.find(r=>r.id===q?.round);
    const person=s?.buzz && s.players.find(p=>p.id===s.buzz.playerId);
    let description;
    if(person) description='<div class="logic-buzz">'+esc(person.name)+' · '+teamName(s.buzz.team)+' · вводит ответ на смартфоне</div>';
    else if(shouldTestBotReply(s)) description='<div class="logic-buzz">🤖 Тест-бот думает…</div>';
    else if(s.lastResult && !s.lastResult.correct) description='<div class="logic-buzz">Ответ не засчитан. Шанс другой команде!</div>';
    else description='<div class="logic-hint">Знаешь ответ? Нажми «ЗНАЮ!» на телефоне, затем напиши ответ.</div>';
    const control='<div class="logic-hint">Ответы принимаются со смартфонов · управление у организатора.</div>';
    frame('<main class="logic-arena">'+scores()+'<div class="logic-stage"><div class="logic-label">Вопрос '+(s.index+1)+' из '+DATA.questions.length+' · '+esc(round?.name||'')+'</div><h1>'+esc(round?.hint||'')+'</h1>'+tiles(q)+description+'</div><div class="logic-ribbon">'+control+'</div></main>','Раунд '+(DATA.rounds.findIndex(r=>r.id===q.round)+1)+' / 4');
    tick();
  }
  function renderReveal(){
    const q=question(),s=TV.state;
    frame('<main class="logic-arena">'+scores().replace('id="logicClock" class="logic-clock">45','class="logic-clock">✓')+'<div class="logic-stage"><div class="logic-label">Разгадка · вопрос '+(s.index+1)+'</div>'+tiles(q)+'<div class="logic-answer">'+esc(q.answer)+'</div><p class="logic-explain">'+esc(q.explain)+'</p></div><div class="logic-ribbon"><div class="logic-hint">'+(s.index+1<DATA.questions.length?'Следующая загадка':'Финальные результаты')+' автоматически через <strong id="logicNextClock">8</strong> с</div></div></main>','Ответ раскрыт');
    tick();
  }
  function renderFinal(){
    const scores=TV.state.scores;
    const winner=scores[0]===scores[1]?'Ничья!':teamName(scores[0]>scores[1]?0:1)+' победили!';
    frame('<main class="logic-final"><div class="logic-label">Финал вечеринки</div><h1>🏆 '+esc(winner)+'</h1><div class="logic-code">'+scores[0]+' : '+scores[1]+'</div><p class="logic-hint">Спасибо за игру! Готовы ещё немного напрячь извилины?</p><div class="logic-hint">Организатор выбирает реванш или возврат в лобби на своём смартфоне.</div></main>','Результаты');
  }
  function render(){
    clearInterval(TV.timer);TV.timer=null;
    clearTimeout(TV.botTimer);TV.botTimer=null;
    if(!TV.state)return renderIntro();
    if(TV.state.phase==='lobby')return renderLobby();
    if(TV.state.phase==='question'){renderQuestion();queueBotReply();return;}
    if(TV.state.phase==='reveal')return renderReveal();
    if(TV.state.phase==='final')return renderFinal();
    renderLobby();
  }
  async function broadcast(){
    if(!TV.channel||!TV.state)return;
    try {await TV.channel.send({type:'broadcast',event:'state',payload:{state:TV.state}});}catch(e){console.warn('Logic state send',e);}
  }
  async function change(mutator){
    if(!TV.state)return;
    const s=JSON.parse(JSON.stringify(TV.state));
    if(mutator(s)===false)return;
    s.version=(Number(s.version)||0)+1;TV.state=s;persist();render();await broadcast();
  }
  function currentPresence(){
    if(!TV.channel)return [];
    const values=Object.values(TV.channel.presenceState()).flat().filter(p=>p?.role==='logic-player'&&p.id);
    const seen=new Map();
    for(const p of values)if(!seen.has(p.id))seen.set(p.id,{id:String(p.id),name:String(p.name||'Игрок').slice(0,20),joinedAt:Number(p.joinedAt)||Date.now()});
    return [...seen.values()].sort((a,b)=>a.joinedAt-b.joinedAt||a.id.localeCompare(b.id)).slice(0,8);
  }
  async function presence(){
    TV.people=currentPresence();
    if(!TV.state)return;
    if(TV.state.phase!=='lobby'){
      const online=new Set(TV.people.map(p=>p.id));
      const nextId=(online.has(TV.state.controllerId)?TV.state.controllerId:null)
        ||TV.state.players.find(p=>p.id!==TEST_BOT_ID&&online.has(p.id))?.id||'';
      if(nextId!==TV.state.controllerId)await change(s=>{s.controllerId=nextId;});
      return;
    }
    const humans=TV.people;
    const previous=new Map((TV.state.players||[]).filter(p=>p.id!==TEST_BOT_ID).map(p=>[p.id,p.team]));
    const testBot=!!TV.state.testBotEnabled && humans.length===1;
    const n=[0,0];
    const players=humans.map(p=>{
      const prev=previous.get(p.id);
      const team=testBot?0:((prev===0||prev===1)?prev:(n[0]<=n[1]?0:1));
      n[team]++;
      return {...p,team};
    });
    if(!testBot&&Math.abs(n[0]-n[1])>1)players.forEach((p,i)=>p.team=i%2);
    if(testBot)players.push({id:TEST_BOT_ID,name:'Тест-бот',team:1,isBot:true});
    const controllerId=humans[0]?.id||'';
    if(JSON.stringify(players)===JSON.stringify(TV.state.players)
      &&controllerId===TV.state.controllerId
      &&testBot===!!TV.state.testBotEnabled)return;
    await change(s=>{s.players=players;s.controllerId=controllerId;s.testBotEnabled=testBot;});
  }
  function tick(){
    const s=TV.state;
    if(!s)return;
    if(s.phase==='reveal'){
      const seconds=Math.ceil(Math.max(0,Number(s.revealEndsAt||0)-Date.now())/1000);
      const node=root.querySelector('#logicNextClock');
      if(node)node.textContent=String(seconds);
      if(seconds<=0){
        clearInterval(TV.timer);TV.timer=null;
        void next();
        return;
      }
      if(!TV.timer)TV.timer=setInterval(tick,250);
      return;
    }
    if(s.phase!=='question')return;
    const seconds=Math.ceil(Math.max(0,Number(s.deadline||0)-Date.now())/1000);
    const node=root.querySelector('#logicClock');
    if(node){node.textContent=String(seconds);node.classList.toggle('urgent',seconds<=10);}
    if(seconds<=0){
      clearInterval(TV.timer);TV.timer=null;
      if(s.buzz)void expireAnswer(s.buzz.attemptId);
      else void reveal();
      return;
    }
    if(!TV.timer)TV.timer=setInterval(tick,250);
  }
  async function reveal(){
    if(TV.state?.phase!=='question')return;
    await change(s=>{s.phase='reveal';s.deadline=0;s.buzz=null;s.revealEndsAt=Date.now()+REVEAL_MS;});
  }
  async function buzz(payload){
    const id=String(payload?.playerId||''),s=TV.state;
    if(!s||s.phase!=='question'||s.buzz||s.deadline<=Date.now()||Number(payload?.index)!==s.index)return;
    const player=s.players.find(p=>p.id===id);
    if(!player||s.blockedTeams?.includes(player.team)||!TV.people.some(p=>p.id===id))return;
    await change(next=>{
      if(next.phase!=='question'||next.buzz||next.deadline<=Date.now())return false;
      next.buzz={playerId:id,team:player.team,attemptId:uuid()};
      next.deadline=Date.now()+15000;
      next.lastResult=null;
    });
  }
  async function finishAttempt(attemptId, typed, expired=false){
    const s=TV.state;
    if(!s||s.phase!=='question'||!s.buzz||s.buzz.attemptId!==attemptId)return;
    const result=expired?{correct:false,typo:false}:window.FOURPLAY_LOGIC_CHECK.check(typed,question());
    await change(next=>{
      if(next.phase!=='question'||next.buzz?.attemptId!==attemptId)return false;
      const playerId=next.buzz.playerId;
      const team=next.buzz.team;
      next.lastResult={playerId,correct:result.correct,typo:result.typo,expired};
      next.buzz=null;
      next.deadline=0; // Stop the current timer immediately on accepted submission.
      if(result.correct){
        next.scores[team]++;
        next.phase='reveal';
        next.revealEndsAt=Date.now()+REVEAL_MS;
      } else {
        next.blockedTeams=[...(next.blockedTeams||[]),team];
        if(next.blockedTeams.length>=2){next.phase='reveal';next.revealEndsAt=Date.now()+REVEAL_MS;}
        else next.deadline=Date.now()+20000; // Fresh chance for the other team.
      }
    });
  }
  async function expireAnswer(attemptId){
    await finishAttempt(attemptId,'',true);
  }
  async function submitAnswer(payload){
    const s=TV.state;
    if(!s||s.phase!=='question'||!s.buzz)return;
    const id=String(payload?.playerId||'');
    const input=String(payload?.text||'').trim();
    if(s.buzz.playerId!==id||s.buzz.attemptId!==payload?.attemptId
      ||Number(payload?.index)!==s.index||!input||input.length>70)return;
    if(s.deadline<=Date.now())return expireAnswer(s.buzz.attemptId);
    await finishAttempt(s.buzz.attemptId,input);
  }
  async function next(){
    await change(s=>{
      if(s.phase!=='reveal')return false;
      s.index++;
      if(s.index>=DATA.questions.length){s.phase='final';return;}
      s.phase='question';s.buzz=null;s.blockedTeams=[];s.lastResult=null;s.revealEndsAt=0;s.deadline=Date.now()+45*1000;
    });
  }
  async function start(){
    if(TV.state?.phase!=='lobby'||TV.state.players.length<2)return;
    await change(s=>{s.phase='question';s.index=0;s.scores=[0,0];s.buzz=null;s.blockedTeams=[];s.lastResult=null;s.revealEndsAt=0;s.deadline=Date.now()+45000;});
  }
  async function reset(toLobby){
    await change(s=>{s.index=0;s.scores=[0,0];s.buzz=null;s.blockedTeams=[];s.lastResult=null;s.revealEndsAt=0;s.deadline=0;s.phase=toLobby?'lobby':'question';if(!toLobby)s.deadline=Date.now()+45000;});
    if(toLobby)await presence();
  }
  async function handleControl(payload){
    const s=TV.state;
    const id=String(payload?.playerId||'');
    const online=TV.people.some(p=>p.id===id);
    if(!s||!id||!online||id!==s.controllerId||!s.players.some(p=>p.id===id))return;
    switch(payload?.command){
      case 'test-bot':
        if(s.phase==='lobby'&&TV.people.length===1){
          await change(next=>{next.testBotEnabled=!next.testBotEnabled;});
          await presence();
        }
        break;
      case 'start': if(s.phase==='lobby')await start();break;
      case 'skip': if(s.phase==='question')await reveal();break;
      case 'rematch': if(s.phase==='final')await reset(false);break;
      case 'lobby': if(s.phase==='final')await reset(true);break;
    }
  }
  async function createRoom(){
    if(TV.busy)return;
    if(!configured())return renderIntro('Сначала нужно настроить Supabase Realtime.');
    TV.busy=true;TV.code=TV.code||code();
    history.replaceState(null,'','./?logic-tv='+encodeURIComponent(TV.code));
    TV.state=readSaved()||{gameId:'logic',code:TV.code,version:1,phase:'lobby',players:[],index:0,scores:[0,0],deadline:0,buzz:null,blockedTeams:[],lastResult:null,controllerId:'',revealEndsAt:0,testBotEnabled:false};
    if(TV.state.phase==='reveal'&&!TV.state.revealEndsAt) TV.state.revealEndsAt=Date.now()+REVEAL_MS;
    persist();render();
    try{
      const {createClient}=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
      const c=config();TV.client=createClient(c.url,c.key,{auth:{persistSession:false}});
      TV.channel=TV.client.channel('4play-logic:'+TV.code,{config:{broadcast:{self:false}}});
      TV.channel.on('presence',{event:'sync'},()=>void presence())
        .on('broadcast',{event:'hello'},()=>void broadcast())
        .on('broadcast',{event:'buzz'},({payload})=>void buzz(payload))
        .on('broadcast',{event:'answer'},({payload})=>void submitAnswer(payload))
        .on('broadcast',{event:'control'},({payload})=>void handleControl(payload))
        .subscribe(async status=>{
          if(status==='SUBSCRIBED'){TV.online=true;render();await broadcast();await presence();}
          if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'){TV.online=false;renderIntro('Не удалось подключиться к комнате. Проверь интернет.');}
        });
    }catch(e){console.error('Logic host',e);renderIntro('Не удалось запустить комнату.');}
    finally{TV.busy=false;}
  }
  async function loadQr(){
    if(window.QRCode)return window.QRCode;
    if(TV.qrLoading)return TV.qrLoading;
    TV.qrLoading=new Promise((resolve,reject)=>{
      const script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js';
      script.onload=()=>window.QRCode?resolve(window.QRCode):reject(new Error('QR not available'));
      script.onerror=reject;document.head.appendChild(script);
    });
    return TV.qrLoading;
  }
  async function renderQr(){
    const node=root.querySelector('#logicQr');if(!node)return;
    const url=new URL(location.href);url.search='';url.searchParams.set('logic-room',TV.code);
    try{const QRCode=await loadQr();if(!node.isConnected)return;node.textContent='';
      new QRCode(node,{text:url.toString(),width:225,height:225,correctLevel:QRCode.CorrectLevel.M});
    }catch{if(node.isConnected)node.textContent=TV.code;}
  }
  addEventListener('beforeunload',()=>{clearTimeout(TV.botTimer);clearInterval(TV.timer);if(TV.client&&TV.channel)void TV.client.removeChannel(TV.channel);});
  renderIntro();
  void createRoom();
})();
