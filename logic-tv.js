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
    people:[], state:null,timer:null,qrLoading:null,hostId:'logic-tv-'+uuid(),busy:false};
  function uuid(){return crypto.randomUUID ? crypto.randomUUID():Date.now()+'-'+Math.random().toString(36).slice(2);}
  function clean(s){return String(s||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,5);}
  function code(){const b=new Uint8Array(5);crypto.getRandomValues(b);return Array.from(b,x=>alphabet[x%alphabet.length]).join('');}
  function esc(s=''){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function config(){const c=window.FOURPLAY_SUPABASE||{};return {url:String(c.url||''),key:String(c.key||'')};}
  function configured(){const c=config();return /^https:\/\/.+\.supabase\.co$/i.test(c.url)&&c.key.length>20;}
  function question(){return DATA.questions[TV.state?.index||0];}
  function teamName(i){return i===0?'Розовые':'Фиолетовые';}
  function members(i){return (TV.state?.players||[]).filter(p=>p.team===i);}
  function persist(){try{if(TV.code&&TV.state)sessionStorage.setItem('4play.logic.tv.'+TV.code,JSON.stringify(TV.state));}catch{}}
  function readSaved(){try{const s=JSON.parse(sessionStorage.getItem('4play.logic.tv.'+TV.code)||'null');return s?.gameId==='logic'&&s.code===TV.code?s:null;}catch{return null;}}
  function header(label='Логическая вечеринка'){
    return '<header class="logic-header"><div class="logic-brand">4PLAY <span>ЛОГИКА</span></div><div class="logic-label">'+esc(label)+'</div><div class="logic-row"><span class="logic-label">'+(TV.online?'● Онлайн':'○ Подключение')+'</span><a class="logic-button" href="./?tv">← Каталог</a></div></header>';
  }
  function frame(body,label){root.innerHTML='<section class="logic-tv">'+header(label)+body+'</section>'; }
  function renderIntro(error=''){
    frame('<main class="logic-intro"><div class="logic-label">Новое игровое шоу AlterNative</div><h1>А у вас есть<br>логика?</h1><p>Две команды. Четыре раунда. Двенадцать загадок. Собери друзей с любыми смартфонами и подключайся по QR-коду.</p><div class="logic-row"><button class="primary" data-logic-tv="create">Создать игру</button></div>'+(error?'<div class="logic-error">'+esc(error)+'</div>':'')+'</main>','Выбирай игру');
  }
  function playerList(team){
    const a=(TV.state?.players||[]).filter(p=>p.team===team);
    return a.length?a.map(p=>'<span class="logic-player-tag">'+esc(p.name)+'</span>').join(''):'<div class="logic-hint">Ожидаем игроков…</div>';
  }
  function renderLobby(){
    const count=TV.state?.players?.length||0;
    frame('<main class="logic-lobby"><div class="logic-panel"><div class="logic-label">Комната для 2–8 игроков</div><div class="logic-code">'+esc(TV.code)+'</div><p class="logic-hint">'+count+' из 8 подключились · команды формируются автоматически</p><div class="logic-players"><div class="logic-team"><h3>● '+teamName(0)+'</h3>'+playerList(0)+'</div><div class="logic-team"><h3>● '+teamName(1)+'</h3>'+playerList(1)+'</div></div><div class="logic-row" style="margin-top:30px"><button class="primary" data-logic-tv="start" '+(count<2?'disabled':'')+'>Начать шоу</button></div></div><div class="logic-panel"><div id="logicQr" class="logic-qr" aria-label="QR код комнаты">'+esc(TV.code)+'</div><p class="logic-hint">Сканируйте QR камерой телефона<br>или введите код комнаты.</p><div class="logic-label">'+esc(location.origin+location.pathname)+'</div></div></main>','Игроки и команды');
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
    const description=person?'<div class="logic-buzz">Первым нажал: '+esc(person?.name||'Игрок')+' · '+teamName(s.buzz.team)+'</div>':'<div class="logic-hint">Кто знает ответ, нажмите кнопку на телефоне!</div>';
    const control=person?'<button class="primary" data-logic-tv="right">✓ Верно · +1</button><button data-logic-tv="wrong">✕ Не угадали</button><button data-logic-tv="reveal">Показать ответ</button>':'<button data-logic-tv="reveal">Показать ответ</button>';
    frame('<main class="logic-arena">'+scores()+'<div class="logic-stage"><div class="logic-label">Вопрос '+(s.index+1)+' из '+DATA.questions.length+' · '+esc(round?.name||'')+'</div><h1>'+esc(round?.hint||'')+'</h1>'+tiles(q)+description+'</div><div class="logic-ribbon">'+control+'</div></main>','Раунд '+(DATA.rounds.findIndex(r=>r.id===q.round)+1)+' / 4');
    tick();
  }
  function renderReveal(){
    const q=question(),s=TV.state;
    frame('<main class="logic-arena">'+scores().replace('id="logicClock" class="logic-clock">45','class="logic-clock">✓')+'<div class="logic-stage"><div class="logic-label">Разгадка · вопрос '+(s.index+1)+'</div>'+tiles(q)+'<div class="logic-answer">'+esc(q.answer)+'</div><p class="logic-explain">'+esc(q.explain)+'</p></div><div class="logic-ribbon"><button class="primary" data-logic-tv="next">'+(s.index+1<DATA.questions.length?'Следующая загадка →':'Финал →')+'</button></div></main>','Ответ раскрыт');
  }
  function renderFinal(){
    const scores=TV.state.scores;
    const winner=scores[0]===scores[1]?'Ничья!':teamName(scores[0]>scores[1]?0:1)+' победили!';
    frame('<main class="logic-final"><div class="logic-label">Финал вечеринки</div><h1>🏆 '+esc(winner)+'</h1><div class="logic-code">'+scores[0]+' : '+scores[1]+'</div><p class="logic-hint">Спасибо за игру! Готовы ещё немного напрячь извилины?</p><div class="logic-row"><button class="primary" data-logic-tv="rematch">Реванш</button><button data-logic-tv="lobby">В лобби</button></div></main>','Результаты');
  }
  function render(){
    clearInterval(TV.timer);TV.timer=null;
    if(!TV.state)return renderIntro();
    if(TV.state.phase==='lobby')return renderLobby();
    if(TV.state.phase==='question')return renderQuestion();
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
    if(TV.state?.phase!=='lobby')return;
    const prev=new Map((TV.state.players||[]).map(p=>[p.id,p.team]));
    let n=[0,0];
    const people=TV.people.map(p=>{
      const previous=prev.get(p.id);
      const team=(previous===0||previous===1)?previous:(n[0]<=n[1]?0:1);
      n[team]++;return {...p,team};
    });
    // Keep the two teams reasonably balanced if people leave and rejoin.
    if(Math.abs(n[0]-n[1])>1)people.forEach((p,i)=>p.team=i%2);
    if(JSON.stringify(people)===JSON.stringify(TV.state.players))return;
    await change(s=>{s.players=people;});
  }
  function tick(){
    if(TV.state?.phase!=='question')return;
    const seconds=Math.ceil(Math.max(0,TV.state.deadline-Date.now())/1000);
    const node=root.querySelector('#logicClock');
    if(node){node.textContent=String(seconds);node.classList.toggle('urgent',seconds<=10);}
    if(seconds<=0){clearInterval(TV.timer);TV.timer=null;void reveal();return;}
    if(!TV.timer)TV.timer=setInterval(tick,250);
  }
  async function reveal(){if(TV.state?.phase!=='question')return;await change(s=>{s.phase='reveal';s.deadline=0;});}
  async function buzz(payload){
    const id=String(payload?.playerId||''),s=TV.state;
    if(!s||s.phase!=='question'||s.buzz||s.deadline<Date.now())return;
    const player=s.players.find(p=>p.id===id);
    if(!player||s.blockedTeams?.includes(player.team)||!TV.people.some(p=>p.id===id))return;
    await change(next=>{if(next.phase!=='question'||next.buzz)return false;next.buzz={playerId:id,team:player.team};next.deadline=Date.now()+15000;});
  }
  async function adjudicate(correct){
    const s=TV.state;if(s?.phase!=='question'||!s.buzz)return;
    if(correct)await change(next=>{next.scores[next.buzz.team]++;next.phase='reveal';next.deadline=0;});
    else await change(next=>{
      next.blockedTeams=[...(next.blockedTeams||[]),next.buzz.team];
      next.buzz=null;
      next.deadline=next.blockedTeams.length===2?Date.now():Date.now()+Math.max(10,Math.min(25,next.timeRemaining||20));
    });
  }
  async function next(){
    await change(s=>{
      if(s.phase!=='reveal')return false;
      s.index++;
      if(s.index>=DATA.questions.length){s.phase='final';return;}
      s.phase='question';s.buzz=null;s.blockedTeams=[];s.deadline=Date.now()+45*1000;
    });
  }
  async function start(){
    if(TV.state?.phase!=='lobby'||TV.state.players.length<2)return;
    await change(s=>{s.phase='question';s.index=0;s.scores=[0,0];s.buzz=null;s.blockedTeams=[];s.deadline=Date.now()+45000;});
  }
  async function reset(toLobby){
    await change(s=>{s.index=0;s.scores=[0,0];s.buzz=null;s.blockedTeams=[];s.deadline=0;s.phase=toLobby?'lobby':'question';if(!toLobby)s.deadline=Date.now()+45000;});
    if(toLobby)await presence();
  }
  async function createRoom(){
    if(TV.busy)return;
    if(!configured())return renderIntro('Сначала нужно настроить Supabase Realtime.');
    TV.busy=true;TV.code=TV.code||code();
    history.replaceState(null,'','./?logic-tv='+encodeURIComponent(TV.code));
    TV.state=readSaved()||{gameId:'logic',code:TV.code,version:1,phase:'lobby',players:[],index:0,scores:[0,0],deadline:0,buzz:null,blockedTeams:[]};
    persist();render();
    try{
      const {createClient}=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
      const c=config();TV.client=createClient(c.url,c.key,{auth:{persistSession:false}});
      TV.channel=TV.client.channel('4play-logic:'+TV.code,{config:{broadcast:{self:false}}});
      TV.channel.on('presence',{event:'sync'},()=>void presence())
        .on('broadcast',{event:'hello'},()=>void broadcast())
        .on('broadcast',{event:'buzz'},({payload})=>void buzz(payload))
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
  root.addEventListener('click',event=>{
    const action=event.target.closest('[data-logic-tv]')?.dataset.logicTv;
    if(!action)return;
    if(action==='create')void createRoom();
    if(action==='start')void start();
    if(action==='right')void adjudicate(true);
    if(action==='wrong')void adjudicate(false);
    if(action==='reveal')void reveal();
    if(action==='next')void next();
    if(action==='rematch')void reset(false);
    if(action==='lobby')void reset(true);
  });
  addEventListener('beforeunload',()=>{clearInterval(TV.timer);if(TV.client&&TV.channel)void TV.client.removeChannel(TV.channel);});
  if(TV.code)void createRoom();else renderIntro();
})();
