/* Scanner for TV-room QR codes; only activated by a phone's own camera gesture.
   Native BarcodeDetector first, jsQR fallback on iOS/Safari. */
(() => {
  'use strict';
  if(new URLSearchParams(location.search).has('logic-tv'))return;
  const CDN='https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';
  let overlay=null,stream=null,frameId=0,active=false,readerPromise=null,video=null,canvas=null;
  let onResult=null,onClose=null,lastScan=0,detector=null,decoder=null;
  function stopStream(){
    if(frameId)cancelAnimationFrame(frameId);
    frameId=0;
    if(stream){for(const track of stream.getTracks())track.stop();stream=null;}
    if(video){video.pause();video.srcObject=null;}
    video=null;canvas=null;
  }
  function close(){
    active=false;stopStream();
    overlay?.remove();overlay=null;
    const callback=onClose;onClose=null;onResult=null;
    callback?.();
  }
  function decodeCode(value){
    const text=String(value||'').trim();
    if(/^[A-HJ-NP-Z2-9]{5}$/i.test(text))return text.toUpperCase();
    let url;
    try{url=new URL(text);}catch{return '';}
    if(url.origin!==location.origin||url.pathname!==location.pathname)return '';
    const code=(url.searchParams.get('logic-room')||'').toUpperCase();
    return /^[A-HJ-NP-Z2-9]{5}$/.test(code)?code:'';
  }
  function status(message){const el=overlay?.querySelector('[data-scan-status]');if(el)el.textContent=message;}
  async function prepareDecoder(){
    if('BarcodeDetector' in window){
      try{
        const formats=await window.BarcodeDetector.getSupportedFormats();
        if(formats.includes('qr_code')){
          detector=new window.BarcodeDetector({formats:['qr_code']});
          return;
        }
      }catch(e){console.warn('QR BarcodeDetector not available:',e);}
    }
    if(window.jsQR){decoder=window.jsQR;return;}
    if(!readerPromise){
      readerPromise=new Promise((resolve,reject)=>{
        const script=document.createElement('script');
        script.src=CDN;script.async=true;
        script.onload=()=>window.jsQR?resolve(window.jsQR):reject(new Error('QR reader not loaded'));
        script.onerror=()=>reject(new Error('QR reader cannot load'));
        document.head.appendChild(script);
      }).catch(e=>{readerPromise=null;throw e;});
    }
    decoder=await readerPromise;
  }
  async function scan(){
    if(!active||!video||video.readyState<2){if(active)frameId=requestAnimationFrame(scan);return;}
    const now=performance.now();
    if(now-lastScan<140){frameId=requestAnimationFrame(scan);return;}
    lastScan=now;
    try{
      let value='';
      if(detector){
        const list=await detector.detect(video);
        value=list?.[0]?.rawValue||'';
      }else if(decoder){
        const w=video.videoWidth,h=video.videoHeight;
        if(w&&h){
          // 480 px decoding width minimizes CPU and battery cost.
          const width=Math.min(480,w),height=Math.max(1,Math.round(h*width/w));
          canvas.width=width;canvas.height=height;
          const ctx=canvas.getContext('2d',{willReadFrequently:true});
          ctx.drawImage(video,0,0,width,height);
          const image=ctx.getImageData(0,0,width,height);
          value=decoder(image.data,width,height,{inversionAttempts:'attemptBoth'})?.data||'';
        }
      }
      if(!active)return;
      if(value){
        const code=decodeCode(value);
        if(code){
          const callback=onResult;
          close();
          callback?.(code);
          return;
        }
        status('Этот QR-код не относится к комнате 4PLAY Логика.');
      }
    }catch(e){console.warn('QR frame',e);}
    if(active)frameId=requestAnimationFrame(scan);
  }
  async function open(options={}){
    if(active)return;
    active=true;onResult=options.onResult||null;onClose=options.onClose||null;
    overlay=document.createElement('div');
    overlay.className='logic-scan-overlay';
    overlay.innerHTML='<section class="logic-scanner" role="dialog" aria-modal="true" aria-label="Сканировать QR-код комнаты">'
      +'<header><strong>Сканируй QR с телевизора</strong><button type="button" data-scan-close aria-label="Закрыть сканер">✕</button></header>'
      +'<div class="logic-camera-box"><video autoplay muted playsinline></video><div class="logic-camera-frame"></div></div>'
      +'<p data-scan-status role="status">Наведи камеру на QR-код комнаты 4PLAY.</p>'
      +'<button type="button" data-scan-close class="logic-scan-manual">Ввести код вручную</button></section>';
    overlay.addEventListener('click',e=>{if(e.target.closest('[data-scan-close]'))close();});
    document.body.appendChild(overlay);
    video=overlay.querySelector('video');canvas=document.createElement('canvas');
    if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia){
      status('Камера недоступна. Введи код комнаты вручную.');
      return;
    }
    try{
      // Camera permission is requested directly from a real user tap.
      stream=await navigator.mediaDevices.getUserMedia({
        audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}}
      });
      if(!active){stopStream();return;}
      video.srcObject=stream;await video.play();
      if(!active)return;
      status('Наведи камеру на QR-код на экране телевизора.');
      await prepareDecoder();
      if(active)frameId=requestAnimationFrame(scan);
    }catch(e){
      console.warn('4PLAY QR scanner:',e);
      if(active)status(e?.name==='NotAllowedError'
        ?'Доступ к камере запрещён. Разреши его в настройках браузера или введи код вручную.'
        :'Не удалось включить сканирование. Используй ручной ввод кода.');
      stopStream();
    }
  }
  addEventListener('pagehide',()=>{if(active)close();});
  window.FOURPLAY_QR_SCANNER={open,close,decodeCode};
})();