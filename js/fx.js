/* ---------- Sounds, vibration, the AI's voice, confetti and toasts ---------- */
const FX={sound:true,voice:true};
try{Object.assign(FX,JSON.parse(localStorage.getItem("ts-fx")||"{}"))}catch(_){}
let actx=null;
function tone(seq){
  if(!FX.sound)return;
  try{actx=actx||new(window.AudioContext||window.webkitAudioContext)();if(actx.state==="suspended")actx.resume();let t=actx.currentTime+.01;
    for(const[f,d,type="sine",v=.12]of seq){const o=actx.createOscillator(),g=actx.createGain();o.type=type;o.frequency.setValueAtTime(f,t);g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(.001,t+d);o.connect(g).connect(actx.destination);o.start(t);o.stop(t+d);t+=d*.8}}catch(_){}}
const SFX={
  go:()=>tone([[523,.1],[784,.18]]),
  guess:()=>tone([[660,.07,"triangle",.07]]),
  hit:()=>tone([[784,.09],[988,.09],[1319,.22]]),
  win:()=>tone([[523,.12],[659,.12],[784,.12],[1047,.34]]),
  badge:()=>tone([[880,.1,"triangle"],[1175,.1,"triangle"],[1568,.3,"triangle"]]),
  miss:()=>tone([[392,.14,"triangle",.09],[311,.26,"triangle",.09]])};
function buzz(p){if(!FX.sound)return;try{navigator.vibrate&&navigator.vibrate(p)}catch(_){}}

function speakNow(text){
  const es=I18N.lang==="es",lang=es?"es-US":"en-US";
  const tts=IS_APP&&window.Capacitor&&Capacitor.Plugins&&Capacitor.Plugins.TextToSpeech;
  if(tts){try{tts.stop().catch(()=>{}).finally(()=>tts.speak({text,lang,rate:1.05}).catch(()=>{}))}catch(_){}return}
  if(!("speechSynthesis" in window))return;
  try{speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang=lang;u.rate=1.08;u.pitch=1.1;speechSynthesis.speak(u)}catch(_){}}

const AI_LINES={
  en:{guess:["Hmm… {w}?","I think… {w}?","Could it be… {w}?","Is that… {w}?"],hit:["Oh, I know! {w}!","Got it: {w}!","That's {w}!"]},
  es:{guess:["Mmm… ¿{w}?","Creo que… ¿{w}?","¿Será… {w}?","¿Eso es… {w}?"],hit:["¡Ya sé! ¡{w}!","¡Lo tengo: {w}!","¡Es {w}!"]}};
let aiKey="",aiT=0;
function aiResetVoice(){aiKey="";aiT=0}
function aiComment(r,word){
  if(r.scribble||r.guess==="something else")return;
  const hit=r.guess===word&&r.acc>=50,key=(hit?"!":"")+r.guess,now=Date.now();
  if(key===aiKey||(!hit&&now-aiT<2200))return;
  aiKey=key;aiT=now;
  if(hit){SFX.hit();buzz([25,40,25])}else{SFX.guess();buzz(12)}
  if(!FX.voice)return;
  const L=AI_LINES[I18N.lang==="es"?"es":"en"][hit?"hit":"guess"],w=I18N.t(r.guess);
  speakNow(L[Math.floor(Math.random()*L.length)].replace("{w}",w))}

function confetti(n=140){
  if(matchMedia("(prefers-reduced-motion: reduce)").matches)return;
  const c=document.createElement("canvas");c.className="confetti";c.width=innerWidth*devicePixelRatio;c.height=innerHeight*devicePixelRatio;document.body.append(c);
  const x=c.getContext("2d"),cols=["#FF5A36","#14946C","#3A86FF","#E8A317","#8338EC","#FF4FA3"],W=c.width,H=c.height,k=devicePixelRatio;
  const P=Array.from({length:n},()=>({x:W/2+(Math.random()-.5)*W*.3,y:H*.35,vx:(Math.random()-.5)*14*k,vy:(-Math.random()*16-6)*k,r:Math.random()*6.3,vr:(Math.random()-.5)*.4,s:(5+Math.random()*6)*k,c:cols[Math.random()*cols.length|0]}));
  const t0=performance.now();
  (function f(now){x.clearRect(0,0,W,H);const age=(now-t0)/1000;
    for(const p of P){p.vy+=.45*k;p.vx*=.99;p.x+=p.vx;p.y+=p.vy;p.r+=p.vr;x.save();x.translate(p.x,p.y);x.rotate(p.r);x.globalAlpha=Math.max(0,1-age/2.2);x.fillStyle=p.c;x.fillRect(-p.s/2,-p.s/3,p.s,p.s*.66);x.restore()}
    if(age<2.2)requestAnimationFrame(f);else c.remove()})(t0)}

const toastQ=[];let toastOn=false;
function toast(html){toastQ.push(html);if(!toastOn)nextToast()}
function nextToast(){
  const h=toastQ.shift();if(h==null){toastOn=false;return}toastOn=true;
  if(typeof D!=="undefined"&&(D.state==="count"||D.state==="run")){toastQ.unshift(h);setTimeout(nextToast,500);return}
  let t=$("#toast");if(!t){t=document.createElement("div");t.id="toast";t.className="toast";t.setAttribute("role","status");document.body.append(t)}
  t.innerHTML=h;t.classList.add("on");let done=false;const hide=()=>{if(done)return;done=true;t.classList.remove("on");setTimeout(nextToast,350)};
  t.onclick=hide;setTimeout(hide,toastQ.length?2000:2600)}

function renderFx(){document.querySelectorAll("[data-fx]").forEach(b=>b.setAttribute("aria-pressed",!!FX[b.dataset.fx]))}
document.addEventListener("click",e=>{const b=e.target.closest("[data-fx]");if(!b)return;const k=b.dataset.fx;FX[k]=!FX[k];try{localStorage.setItem("ts-fx",JSON.stringify(FX))}catch(_){}renderFx();
  if(k==="sound"&&FX.sound)SFX.hit();if(k==="voice"&&FX.voice)speakNow(I18N.lang==="es"?"¡Hola! Te diré lo que veo.":"Hi! I'll tell you what I see.")});
renderFx();
