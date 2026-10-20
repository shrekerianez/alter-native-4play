/* Screen-fitting regression: always a 16:9 stage within the physical TV viewport. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const values={};
const scene={style:{setProperty:(k,v)=>{values[k]=v;}}};
const root={innerHTML:'',querySelector:(q)=>q==='.logic-tv'?scene:null};
const ctx={
 window:{innerWidth:1920,innerHeight:1080,FOURPLAY_SUPABASE:{}},
 document:{querySelector:()=>root,documentElement:{classList:{add(){}}},body:{classList:{add(){}}}},
 location:{search:'?logic-tv',href:'https://example.org/?logic-tv',origin:'https://example.org',pathname:'/'},
 URL,URLSearchParams,Date,console,
 crypto:{randomUUID:()=>String(Date.now())},
 history:{replaceState(){}},
 sessionStorage:{setItem:()=>{},getItem:()=>null},
 setTimeout:()=>1,clearTimeout:()=>{},setInterval:()=>1,clearInterval:()=>{},
 addEventListener:()=>{}
};
vm.runInNewContext(fs.readFileSync('logic-data.js','utf8'),ctx);
vm.runInNewContext(fs.readFileSync('logic-answer-check.js','utf8'),ctx);
let host=fs.readFileSync('logic-tv.js','utf8');
host=host.replace(/\}\)\(\);\s*$/,'window.__fitScreen=fitScreen;})();');
vm.runInNewContext(host,ctx);
function check(width,height,expectedScale,expectedX,expectedY){
  ctx.window.innerWidth=width;ctx.window.innerHeight=height;
  ctx.window.__fitScreen();
  assert.ok(Math.abs(Number(values['--logic-s'])-expectedScale)<.0001,JSON.stringify(values));
  assert.equal(values['--logic-x'],expectedX+'px');
  assert.equal(values['--logic-y'],expectedY+'px');
  const visibleWidth=1920*Number(values['--logic-s']);
  const visibleHeight=1080*Number(values['--logic-s']);
  assert.ok(visibleWidth<=width+.01&&visibleHeight<=height+.01,'Scene must fit');
}
check(1920,1080,1,0,0);
check(1280,720,2/3,0,0);
check(1024,768,1024/1920,0,96);
check(3840,2160,2,0,0);
const css=fs.readFileSync('logic.css','utf8');
assert.match(css,/body\.logic-tv-mode #app>\.logic-tv\{[^}]*width:1920px!important/);
assert.match(css,/body\.logic-tv-mode #app>\.logic-tv\{[^}]*height:1080px!important/);
assert.match(css,/body\.logic-tv-mode #app>\.logic-tv\{[^}]*overflow:hidden!important/);
console.log('PASS: fixed 1920×1080 stage, letterbox and zero clipping on common TV ratios');
