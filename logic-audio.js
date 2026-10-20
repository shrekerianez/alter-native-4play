/* Original procedural soundtrack for 4PLAY Logic, generated in Web Audio.
   No third-party music files, licensing requirements, or network downloads. */
(() => {
  'use strict';
  if(!new URLSearchParams(location.search).has('logic-tv')) return;
  const Context=window.AudioContext||window.webkitAudioContext;
  const SCALES={
    lobby:[220,329.63,261.63,329.63,196,293.66,246.94,293.66],
    question:[196,246.94,293.66,246.94,174.61,220,261.63,220],
    reveal:[261.63,329.63,392,329.63],
    final:[261.63,329.63,392,523.25,392,329.63,392,523.25]
  };
  let audio=null,master=null,interval=0,enabled=true,volume=.45,phase='intro',step=0;
  let lastTick='',attemptedUnlock=false;
  function prepare(){
    if(audio)return true;
    if(!Context)return false;
    try{
      audio=new Context();
      master=audio.createGain();
      master.gain.value=0;
      master.connect(audio.destination);
      return true;
    }catch(e){console.warn('4PLAY sound initialization:',e);return false;}
  }
  function note(hz,when,duration,level=.12,type='sine'){
    if(!audio||audio.state!=='running'||!master)return;
    const osc=audio.createOscillator(),amp=audio.createGain();
    osc.type=type;osc.frequency.setValueAtTime(hz,when);
    amp.gain.setValueAtTime(.0001,when);
    amp.gain.exponentialRampToValueAtTime(Math.max(.0002,level),when+.012);
    amp.gain.exponentialRampToValueAtTime(.0001,when+duration);
    osc.connect(amp);amp.connect(master);
    osc.start(when);osc.stop(when+duration+.025);
  }
  function cue(kind){
    if(!enabled||!audio||audio.state!=='running')return;
    const now=audio.currentTime+.018;
    if(kind==='join'){note(523.25,now,.13,.18,'triangle');note(659.25,now+.10,.19,.14,'triangle');}
    if(kind==='buzz'){note(587.33,now,.13,.22,'square');note(880,now+.10,.20,.20,'triangle');}
    if(kind==='correct'){[523.25,659.25,783.99,1046.50].forEach((hz,i)=>note(hz,now+i*.11,.40,.18,'triangle'));}
    if(kind==='wrong'){[311.13,246.94,196].forEach((hz,i)=>note(hz,now+i*.17,.30,.15,'sawtooth'));}
    if(kind==='question'){note(293.66,now,.15,.15,'sine');note(440,now+.12,.25,.12,'triangle');}
    if(kind==='victory'){[392,523.25,659.25,783.99,1046.5].forEach((hz,i)=>note(hz,now+i*.14,.50,.20,'triangle'));}
    if(kind==='tick')note(1000,now,.053,.07,'sine');
  }
  function beat(){
    if(!enabled||!audio||audio.state!=='running'||phase==='intro')return;
    const scale=SCALES[phase]||SCALES.lobby;
    const hz=scale[step%scale.length],t=audio.currentTime+.015;
    if(step%2===0)note(hz,t,.22,.038,'triangle');
    if(step%4===0)note(hz/2,t,.38,.042,'sine');
    if(phase==='question'&&step%2===1)note(780,t,.06,.024,'sine');
    step++;
  }
  function stopMusic(){if(interval){clearInterval(interval);interval=0;}}
  function startMusic(){
    stopMusic();step=0;
    if(!enabled||!audio||audio.state!=='running'||phase==='intro')return;
    beat();
    const tempo=phase==='question'?345:phase==='lobby'?490:phase==='reveal'?610:370;
    interval=setInterval(beat,tempo);
  }
  async function unlock(){
    if(!enabled||!prepare())return false;
    try{
      attemptedUnlock=true;
      if(audio.state!=='running')await audio.resume();
      if(audio.state!=='running')return false;
      master.gain.setTargetAtTime(volume,audio.currentTime,.07);
      if(!interval)startMusic();
      return true;
    }catch(e){console.warn('4PLAY audio blocked:',e);return false;}
  }
  function configure(options){
    const oldEnabled=enabled,oldVolume=volume;
    enabled=options?.enabled!==false;
    const n=Number(options?.volume);
    volume=Number.isFinite(n)?Math.max(0,Math.min(1,n)):.45;
    if(!enabled){
      stopMusic();
      if(master&&audio)master.gain.setTargetAtTime(0,audio.currentTime,.04);
      return;
    }
    if(!audio||audio.state!=='running'){void unlock();return;}
    if(!oldEnabled||volume!==oldVolume)master.gain.setTargetAtTime(volume,audio.currentTime,.07);
    if(!oldEnabled)startMusic();
  }
  function stateChanged(previous,next){
    if(!next)return;
    const oldPhase=phase;
    phase=next.phase||'intro';
    configure(next.sound||{enabled:true,volume:.45});
    if(phase!==oldPhase){startMusic();if(phase==='question')cue('question');if(phase==='final')cue('victory');}
    if(next.phase==='lobby'&&next.players?.length>(previous?.players?.length||0))cue('join');
    if(next.phase==='question'&&next.buzz?.attemptId&&next.buzz.attemptId!==previous?.buzz?.attemptId)cue('buzz');
    if(next.lastResult&&next.lastResult!==previous?.lastResult
       &&(next.lastResult.playerId!==previous?.lastResult?.playerId
          ||next.lastResult.correct!==previous?.lastResult?.correct
          ||next.lastResult.expired!==previous?.lastResult?.expired)){
      cue(next.lastResult.correct?'correct':'wrong');
    }
  }
  function countdown(seconds,key){
    if(!enabled||phase!=='question'||seconds>5||seconds<1)return;
    const stamp=String(key)+':'+seconds;
    if(lastTick===stamp)return;
    lastTick=stamp;cue('tick');
  }
  function resumeOnVisibility(){
    if(!document.hidden&&enabled&&attemptedUnlock&&audio?.state!=='running')void unlock();
  }
  document.addEventListener('visibilitychange',resumeOnVisibility);
  document.addEventListener('pointerdown',()=>{if(enabled&&audio?.state!=='running')void unlock();});
  window.FOURPLAY_LOGIC_AUDIO={stateChanged,countdown,configure,unlock};
})();