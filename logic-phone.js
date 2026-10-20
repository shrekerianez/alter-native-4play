(() => {
  const params=new URLSearchParams(location.search);
  const code=String(params.get('logic-room')||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,5);
  if(!code)return;
  const root=document.querySelector('#app');
  const C={code,root,client:null,channel:null,state:null,playerId:'',name:'',online:false,buzzedIndex:null,joinedAt:0,answerSentToken:null};
  const KEY='4play.playerId',NAME_KEY='4play.lastName';
  function uuid(){return crypto.randomUUID?crypto.randomUUID():'p-'+Date.now()+'-'+Math.random().toString(36).slice(2);}
  function esc(s=''){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function config(){const v=window.FOURPLAY_SUPABASE||{};return {url:String(v.url||''),key:String(v.key||'')};}
  function configOkay(){const c=config();return /^https:\/\/.+\.supabase\.co$/i.test(c.url)&&c.key.length>20;}
  function member(){return C.state?.players?.find(p=>p.id===C.playerId);}
  function teamName(i){return i===0?'Розовые':'Фиолетовые';}
  function isOrganizer(){
    return !!member() && !!C.state?.controllerId && C.state.controllerId===C.playerId;
  }
  function organizerControls(phase){
    if(!isOrganizer())return '';
    const n=C.state.players?.length||0;
    const humans=C.state.players?.filter(p=>!p.isBot).length||0;
    const hasBot=!!C.state.testBotEnabled && C.state.players.some(p=>p.isBot);
    if(phase==='lobby'){
      return '<div class="logic-organizer"><div class="logic-label">Ты организатор вечеринки</div><p>'+(hasBot?'🧪 Тестовый режим: ты и виртуальный соперник. Бот отвечает только после твоей ошибки.':'Когда все подключатся, запускай шоу прямо отсюда.')+'</p>'+(humans===1?'<button type="button" class="logic-secondary" data-logic-phone="test-bot">'+(hasBot?'✕ Убрать тест-бота':'🤖 Добавить тест-бота')+'</button>':'')+'<button type="button" data-logic-phone="start" '+(n<2?'disabled':'')+'>▶ Начать шоу'+(n<2?' · ждём второго игрока':'')+'</button></div>';
    }
    if(phase==='question'){
      return '<div class="logic-organizer"><div class="logic-label">Управление игрой</div><button type="button" class="logic-secondary" data-logic-phone="skip">Пропустить загадку</button></div>';
    }
    if(phase==='final'){
      return '<div class="logic-organizer"><div class="logic-label">Управление вечеринкой</div><button type="button" data-logic-phone="rematch">↻ Реванш</button><button type="button" class="logic-secondary" data-logic-phone="lobby">В лобби</button></div>';
    }
    return '';
  }
  function header(){
    return '<div class="logic-phone-head"><strong>4PLAY · ЛОГИКА</strong><span>'+esc(C.code)+' · '+(C.online?'● Онлайн':'○ Связь')+'</span></div>';
  }
  function shell(body){root.innerHTML='<section class="screen logic-phone">'+header()+body+'</section>';}
  function renderJoin(error=''){
    const last=localStorage.getItem(NAME_KEY)||'';
    shell('<div class="logic-card" style="margin:auto 0"><div class="logic-label">Вечеринка на телевизоре</div><h1>Вход в игру</h1><p>Введи имя. Других приложений устанавливать не нужно.</p><div class="logic-label">Комната '+esc(C.code)+'</div><form id="logicJoin"><input name="name" maxlength="20" autocomplete="nickname" placeholder="Твоё имя" value="'+esc(last)+'" required><button type="submit">Присоединиться →</button></form>'+(error?'<div class="logic-error">'+esc(error)+'</div>':'')+'</div><a href="./" class="logic-link">На главную 4PLAY</a>');
  }
  function renderWaiting(){
    shell('<div class="logic-card" style="margin:auto 0;text-align:center"><div class="logic-label">Комната '+esc(C.code)+'</div><h1>'+(C.client?'Восстанавливаем связь…':'Подключаемся…')+'</h1><p>Комната сохранена. Вернёшься в игру, как только соединение восстановится.</p></div>');
  }
  function scores(){
    const s=C.state;
    return '<div class="logic-scoreboard"><div><small>Розовые</small><strong>'+Number(s?.scores?.[0]||0)+'</strong></div><div><small>Фиолетовые</small><strong>'+Number(s?.scores?.[1]||0)+'</strong></div></div>';
  }
  function renderLobby(){
    const p=member();
    shell('<div class="logic-card" style="margin-top:28px"><div class="logic-label">Комната '+esc(C.code)+'</div><h1>Ты в игре!</h1><p class="logic-team-name">'+esc(C.name)+' · '+(p?'Команда «'+teamName(p.team)+'»':'Подключаем к команде…')+'</p><p>'+(isOrganizer()?'Ты управляешь игрой. Пульт телевизора не нужен.':'Ждём, пока организатор начнёт игру.')+'</p>'+scores()+'<div class="logic-label">Игроков: '+(C.state?.players?.length||0)+' из 8'+(C.state?.testBotEnabled?' · 🧪 один настоящий + бот':'')+'</div></div>'+organizerControls('lobby')+'<div class="logic-status">Смотри на телевизор 📺</div>');
  }
  function renderQuestion(){
    const s=C.state,p=member(),blocked=s.blockedTeams?.includes(p?.team);
    const somebody=s.buzz;
    const ownTurn=somebody?.playerId===C.playerId;
    const sent=ownTurn&&C.answerSentToken===somebody.attemptId;
    const disabled=!p||blocked||!!somebody||C.buzzedIndex===s.index||Date.now()>=Number(s.deadline||0);
    let description='Твоя команда: '+(p?teamName(p.team):'ожидание');
    if(blocked)description='Ваша команда уже использовала попытку';
    if(somebody)description=ownTurn?(sent?'Ответ отправлен. Проверяем…':'Твой ход! Напиши ответ.'):'Отвечает '+esc(s.players.find(x=>x.id===s.buzz.playerId)?.name||'игрок');
    if(!somebody&&s.lastResult&&!s.lastResult.correct)description=s.lastResult.testBot?'🤖 Тест-бот ошибся. Теперь твоя очередь!':s.testBotEnabled?'Неверный ответ. 🤖 Тест-бот сейчас ответит.':'Предыдущий ответ неверный. Ход переходит другой команде.';
    let controls='';
    if(ownTurn&&!sent){
      controls='<form id="logicAnswerForm" class="logic-answer-form"><label for="logicAnswerInput" class="logic-label">Твой ответ</label><input id="logicAnswerInput" name="answer" type="text" maxlength="70" minlength="1" autocomplete="off" autocapitalize="sentences" enterkeyhint="send" placeholder="Напиши разгадку…" required><button class="logic-send" type="submit">Отправить ответ →</button><p>Пиши как знаешь: небольшие опечатки допускаются. Кнопка «Отправить» сразу остановит таймер на TV.</p></form>';
    } else if(ownTurn&&sent) {
      controls='<div class="logic-status">✓ Ответ отправлен<br>Ожидаем проверки на телевизоре</div>';
    } else {
      controls='<button class="logic-buzzer" data-logic-phone="buzz" '+(disabled?'disabled':'')+'>'+(somebody?'ОТВЕЧАЮТ':blocked?'ПОПЫТКА ИСЧЕРПАНА':C.buzzedIndex===s.index?'НАЖАТО':'ЗНАЮ!')+'</button>';
    }
    const body='<div class="logic-card" style="margin-top:24px"><div class="logic-label">Загадка '+(s.index+1)+' / '+(window.FOURPLAY_LOGIC_DATA?.questions.length||12)+'</div><h1>Смотри на TV</h1><p>Найди связь между изображениями.</p>'+scores()+'</div><div class="logic-status">'+description+'</div>'+controls+organizerControls('question');
    shell(body);
    if(ownTurn&&!sent)root.querySelector('#logicAnswerInput')?.focus({preventScroll:true});
  }
  function renderReveal(){
    const q=window.FOURPLAY_LOGIC_DATA?.questions[C.state.index];
    const result=C.state?.lastResult;
    const botMessage=result?.testBot?'<p class="logic-bot-result">🤖 Тест-бот: '+(result.correct?'ответил правильно (+1)':'ошибся (0 очков)')+'</p>':'';
    shell('<div class="logic-card" style="margin-top:30px;text-align:center"><div class="logic-label">Правильный ответ</div><h1>'+esc(q?.answer||'Разгадка на TV')+'</h1><p>'+esc(q?.explain||'')+'</p>'+botMessage+scores()+'</div><div class="logic-status">Следующий вопрос появится автоматически через несколько секунд.</div>');
  }
  function renderFinal(){
    const s=C.state;
    const winner=s.scores[0]===s.scores[1]?'Ничья':teamName(s.scores[0]>s.scores[1]?0:1);
    shell('<div class="logic-card" style="margin:auto 0;text-align:center"><div class="logic-label">Конец игры</div><h1>🏆 '+esc(winner)+'</h1>'+scores()+'<p>Телевизор показывает результаты. Реванш запускает организатор со смартфона.</p></div>'+organizerControls('final')+'<div class="logic-status">Спасибо за игру!</div>');
  }
  function render(){
    if(!C.online)return renderWaiting();
    if(!C.state)return renderWaiting();
    if(C.state.phase==='lobby')return renderLobby();
    if(!member())return shell('<div class="logic-card" style="margin:auto 0"><h1>Игра уже идёт</h1><p>Новые участники смогут присоединиться в следующем лобби.</p></div>');
    if(C.state.phase==='question')return renderQuestion();
    if(C.state.phase==='reveal')return renderReveal();
    if(C.state.phase==='final')return renderFinal();
    renderWaiting();
  }
  function receive(state){
    if(!state||state.gameId!=='logic'||state.code!==C.code)return;
    if(C.state&&Number(state.version)<Number(C.state.version))return;
    if(C.state&&state.index!==C.state.index){C.buzzedIndex=null;C.answerSentToken=null;}
    // If another player was judged incorrect, previously losing buzzers may try again.
    else if(C.state?.buzz&&state.phase==='question'&&!state.buzz)C.buzzedIndex=null;
    if(!state.buzz||state.buzz.attemptId!==C.answerSentToken)C.answerSentToken=null;
    C.state=state;render();
  }
  async function buzz(){
    const s=C.state,p=member();
    if(!p||s?.phase!=='question'||s.buzz||s.blockedTeams?.includes(p.team)||C.buzzedIndex===s.index||Date.now()>=s.deadline)return;
    C.buzzedIndex=s.index;render();
    try{await C.channel.send({type:'broadcast',event:'buzz',payload:{playerId:C.playerId,index:s.index}});}
    catch(e){console.error('Logic buzz failed',e);C.buzzedIndex=null;render();}
  }
  async function sendAnswer(text){
    const s=C.state;
    const typed=String(text||'').trim();
    if(!s||s.phase!=='question'||s.buzz?.playerId!==C.playerId||!typed||typed.length>70
      ||Date.now()>=s.deadline||C.answerSentToken===s.buzz.attemptId)return;
    const token=s.buzz.attemptId;
    C.answerSentToken=token;
    render(); // Disable form immediately; TV host stops its timer upon receiving this answer.
    try {
      await C.channel.send({type:'broadcast',event:'answer',payload:{
        playerId:C.playerId,index:s.index,attemptId:token,text:typed
      }});
    } catch(e){
      console.error('Logic answer failed',e);
      if(C.state?.buzz?.attemptId===token)C.answerSentToken=null;
      render();
    }
  }
  async function sendControl(command){
    if(!isOrganizer()||!['start','skip','rematch','lobby','test-bot'].includes(command)||!C.channel)return;
    const phase=C.state?.phase;
    if(command==='test-bot'&&(phase!=='lobby'||C.state.players.filter(p=>!p.isBot).length!==1))return;
    if(command==='start' && (phase!=='lobby'||C.state.players.length<2))return;
    if(command==='skip' && phase!=='question')return;
    if((command==='rematch'||command==='lobby') && phase!=='final')return;
    const button=root.querySelector('[data-logic-phone="'+command+'"]');
    if(button)button.disabled=true;
    try{
      await C.channel.send({type:'broadcast',event:'control',payload:{playerId:C.playerId,command}});
    }catch(e){
      console.error('Logic organizer control failed',e);
      if(button?.isConnected)button.disabled=false;
    }
  }
  async function connect(name){
    if(C.client)return;
    C.name=String(name||'').trim().slice(0,20);
    if(!C.name)return renderJoin('Введи имя игрока.');
    if(!configOkay())return renderJoin('Realtime не настроен.');
    C.playerId=localStorage.getItem(KEY)||uuid();
    localStorage.setItem(KEY,C.playerId);localStorage.setItem(NAME_KEY,C.name);
    C.joinedAt=Date.now();
    renderWaiting();
    try{
      const {createClient}=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
      const c=config();C.client=createClient(c.url,c.key,{auth:{persistSession:false}});
      C.channel=C.client.channel('4play-logic:'+C.code,{config:{presence:{key:C.playerId},broadcast:{self:false}}});
      C.channel.on('broadcast',{event:'state'},({payload})=>receive(payload?.state))
        .subscribe(async status=>{
          if(status==='SUBSCRIBED'){
            C.online=true;
            await C.channel.track({role:'logic-player',id:C.playerId,name:C.name,joinedAt:C.joinedAt});
            await C.channel.send({type:'broadcast',event:'hello',payload:{playerId:C.playerId}});
            render();
          }else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'){
            // Preserve the existing channel and player identity while Supabase reconnects.
            console.warn('4PLAY Logic: телефон восстанавливает связь:',status);
            C.online=false;
            renderWaiting();
          }
        });
    }catch(e){console.error('Logic phone join',e);C.client=null;C.channel=null;renderJoin('Не удалось подключиться.');}
  }
  root.addEventListener('submit',event=>{
    if(event.target.id==='logicAnswerForm'){
      event.preventDefault();
      void sendAnswer(event.target.elements.answer.value);
      return;
    }
    if(event.target.id!=='logicJoin')return;
    event.preventDefault();void connect(event.target.elements.name.value);
  });
  root.addEventListener('click',event=>{
    const action=event.target.closest('[data-logic-phone]')?.dataset.logicPhone;
    if(action==='buzz')void buzz();
    if(action==='retry')void connect(C.name);
    if(['start','skip','rematch','lobby','test-bot'].includes(action))void sendControl(action);
  });
  addEventListener('beforeunload',()=>{if(C.client&&C.channel)void C.client.removeChannel(C.channel);});
  renderJoin();
})();
