/* ---------- Profiles ---------- */
const Profiles={
  data:{current:null,list:[]},
  load(){try{const d=JSON.parse(localStorage.getItem("ts-profiles")||"null");if(d&&Array.isArray(d.list))this.data=d}catch(_){}},
  save(){try{localStorage.setItem("ts-profiles",JSON.stringify(this.data))}catch(_){}},
  cur(){return this.data.list.find(p=>p.id===this.data.current)||null},
  create(name){const p={id:"p"+Date.now().toString(36),name:name.slice(0,24),created:new Date().toISOString(),rom:null,level:1,sessions:[]};this.data.list.push(p);this.data.current=p.id;this.save();return p},
  select(id){this.data.current=id;this.save()},
  remove(id){this.data.list=this.data.list.filter(p=>p.id!==id);if(this.data.current===id)this.data.current=this.data.list[0]?.id||null;this.save()}
};
Profiles.load();

/* ---------- Guided exercises ---------- */
const SHAPES={
  hline:{label:"Line across",lvl:1,gen:s=>[[.5-s/2,.5],[.5+s/2,.5]]},
  vline:{label:"Line up and down",lvl:1,gen:s=>[[.5,.5-s/2],[.5,.5+s/2]]},
  diag:{label:"Diagonal line",lvl:1,gen:s=>[[.5-s/2,.5+s/2],[.5+s/2,.5-s/2]]},
  circle:{label:"Circle",lvl:2,gen:s=>Array.from({length:65},(_,i)=>{const a=Math.PI+i/64*2*Math.PI;return[.5+s/2*Math.cos(a),.5+s/2*Math.sin(a)]})},
  square:{label:"Square",lvl:2,gen:s=>{const h=s/2;return[[.5-h,.5-h],[.5+h,.5-h],[.5+h,.5+h],[.5-h,.5+h],[.5-h,.5-h]]}},
  zigzag:{label:"Zigzag",lvl:3,gen:s=>Array.from({length:7},(_,i)=>[.5-s/2+i*s/6,.5+(i%2?-1:1)*s/5])},
  wave:{label:"Wave",lvl:3,gen:s=>Array.from({length:49},(_,i)=>[.5-s/2+i*s/48,.5+s/5*Math.sin(i/48*4*Math.PI)])},
  spiral:{label:"Spiral",lvl:4,gen:s=>Array.from({length:97},(_,i)=>{const u=i/96,a=u*4*Math.PI,r=s/2*(.15+.85*u);return[.5+r*Math.cos(a),.5+r*Math.sin(a)]})},
  eight:{label:"Figure eight",lvl:5,gen:s=>Array.from({length:97},(_,i)=>{const a=i/96*2*Math.PI;return[.5+s/2*Math.sin(a),.5+s/4*Math.sin(2*a)]})}
};
const LEVELS=[null,{size:.35,tol:.06,time:20},{size:.45,tol:.05,time:18},{size:.55,tol:.045,time:16},{size:.65,tol:.04,time:15},{size:.75,tol:.035,time:14}];
const SESSION_LEN=5;
let P=null;
function pickShape(level,recent){
  const pool=Object.keys(SHAPES).filter(k=>SHAPES[k].lvl<=level&&!recent.includes(k));
  const fresh=pool.filter(k=>SHAPES[k].lvl===level);
  const from=fresh.length&&Math.random()<.5?fresh:pool.length?pool:Object.keys(SHAPES).filter(k=>SHAPES[k].lvl<=level);
  return from[Math.random()*from.length|0]}
function practiceSens(p){return p&&p.rom?Math.min(90,Math.max(12,.8*Math.min(p.rom.x,p.rom.y))):S.sens}
function fmt(v,d=0){return v==null||!isFinite(v)?"–":(+v).toFixed(d)}

function renderHub(){
  const p=Profiles.cur();
  $("#pfSelect").innerHTML=Profiles.data.list.map(x=>`<option value="${esc(x.id)}"${x.id===Profiles.data.current?" selected":""}>${esc(x.name)}</option>`).join("");
  $("#pfSelect").hidden=!Profiles.data.list.length;$("#pfNone").hidden=!!Profiles.data.list.length;
  $("#pfStats").innerHTML=p?`<div class="kpi"><b>${p.level}</b><span>Level of 5</span></div><div class="kpi"><b>${p.sessions.length}</b><span>Sessions</span></div><div class="kpi"><b>${p.rom?fmt(p.rom.x)+"° × "+fmt(p.rom.y)+"°":"Not set"}</b><span>Comfortable range</span></div>`:"";
  ["#pCal","#pStart","#pProg","#pDel"].forEach(id=>$(id).disabled=!p);
  $("#pStartHint").textContent=!p?"Create a profile to begin.":!p.rom?"Tip: calibrate your range first so exercises fit your comfortable movement.":"";
}
function openPractice(){renderHub();show("s-practice")}
$("#pfSelect").onchange=e=>{Profiles.select(e.target.value);renderHub()};
$("#pfCreate").onclick=()=>{const n=$("#pfName").value.trim();if(!n){$("#pfName").focus();return}Profiles.create(n);$("#pfName").value="";renderHub()};
$("#pDel").onclick=()=>{const p=Profiles.cur();if(!p)return;const b=$("#pDel");if(b.dataset.confirm!=="1"){b.dataset.confirm="1";b.textContent=`Tap again to delete ${p.name}`;setTimeout(()=>{b.dataset.confirm="";b.textContent="Delete profile"},4000);return}b.dataset.confirm="";b.textContent="Delete profile";Profiles.remove(p.id);renderHub()};
$("#pBack").onclick=()=>show("s-home");
$("#pStart").onclick=async()=>{if(!(await readyToDraw()))return;startSession()};
$("#pCal").onclick=async()=>{if(!(await readyToDraw()))return;startCalibration()};
$("#pProg").onclick=()=>openProgress();

/* ---------- Range calibration ---------- */
let CAL=null;
function startCalibration(){
  CAL={t0:0,pts:[],x0:null,y0:null,raf:0,state:"ready"};
  $("#calTitle").textContent="Calibrate your range";$("#calMsg").textContent="Hold the phone the way you will play. When the count starts, move your wrist slowly as far as is comfortable: left, right, up, down and around. Never push into pain.";
  $("#calResult").hidden=true;$("#calGo").hidden=false;$("#calGo").textContent="Start (8 seconds)";$("#calSave").hidden=$("#calGames").hidden=true;
  show("s-cal");drawCal();
}
function calAim(){if(S.input==="gyro"&&ori.b!=null){const t=aim();return{x:t.x,y:t.y}}return{x:calMouse.x,y:calMouse.y}}
const calMouse={x:0,y:0};
$("#calCv").addEventListener("pointermove",e=>{if(S.input!=="finger")return;const r=e.target.getBoundingClientRect();calMouse.x=((e.clientX-r.left)/r.width-.5)*80;calMouse.y=((e.clientY-r.top)/r.height-.5)*80});
$("#calGo").onclick=()=>{
  const a=calAim();CAL.x0=a.x;CAL.y0=a.y;CAL.pts=[];CAL.state="run";CAL.t0=performance.now();$("#calGo").hidden=true;say("Move slowly as far as is comfortable");
  const step=now=>{if(!CAL||CAL.state!=="run")return;const a=calAim();CAL.pts.push([wrap(a.x-CAL.x0),a.y-CAL.y0]);
    const left=8-(now-CAL.t0)/1000;$("#calMsg").textContent=left>0?`Keep moving… ${Math.ceil(left)} s`:"Done";drawCal();
    if(left<=0)return finishCal();CAL.raf=requestAnimationFrame(step)};CAL.raf=requestAnimationFrame(step)};
function drawCal(){
  const c=$("#calCv"),k=devicePixelRatio,n=c.clientWidth*k;c.width=c.height=n;const g=c.getContext("2d");
  g.fillStyle="#fff";g.fillRect(0,0,n,n);g.strokeStyle="#E1EBF2";g.lineWidth=k;for(let i=1;i<8;i++){const p=i*n/8;g.beginPath();g.moveTo(p,0);g.lineTo(p,n);g.moveTo(0,p);g.lineTo(n,p);g.stroke()}
  g.strokeStyle="#A9C2D6";g.beginPath();g.moveTo(n/2,0);g.lineTo(n/2,n);g.moveTo(0,n/2);g.lineTo(n,n/2);g.stroke();
  if(!CAL||!CAL.pts.length)return;const sc=n/80;
  g.strokeStyle="rgba(58,134,255,.7)";g.lineWidth=2*k;g.beginPath();CAL.pts.forEach(([x,y],i)=>{const X=n/2+x*sc,Y=n/2+y*sc;i?g.lineTo(X,Y):g.moveTo(X,Y)});g.stroke();
  const l=CAL.pts[CAL.pts.length-1];g.fillStyle="#FF5A36";g.beginPath();g.arc(n/2+l[0]*sc,n/2+l[1]*sc,7*k,0,7);g.fill();
  if(CAL.rom){g.strokeStyle="#14946C";g.lineWidth=2.5*k;g.strokeRect(n/2+CAL.box[0]*sc,n/2+CAL.box[1]*sc,CAL.rom.x*sc,CAL.rom.y*sc)}
}
function finishCal(){
  CAL.state="done";const xs=CAL.pts.map(p=>p[0]).sort((a,b)=>a-b),ys=CAL.pts.map(p=>p[1]).sort((a,b)=>a-b);
  const q=(a,p)=>a[Math.round(p*(a.length-1))];
  CAL.rom={x:Math.max(4,q(xs,.97)-q(xs,.03)),y:Math.max(4,q(ys,.97)-q(ys,.03))};CAL.box=[q(xs,.03),q(ys,.03)];drawCal();
  $("#calTitle").textContent="Your comfortable range";
  $("#calMsg").textContent="";$("#calResult").hidden=false;
  $("#calResult").innerHTML=`<div class="kpi"><b>${fmt(CAL.rom.x)}°</b><span>Side to side</span></div><div class="kpi"><b>${fmt(CAL.rom.y)}°</b><span>Up and down</span></div>`;
  say(`Side to side ${Math.round(CAL.rom.x)} degrees. Up and down ${Math.round(CAL.rom.y)} degrees.`);
  $("#calSave").hidden=$("#calGames").hidden=false;$("#calGo").hidden=false;$("#calGo").textContent="Try again";
}
$("#calSave").onclick=()=>{const p=Profiles.cur();if(p&&CAL&&CAL.rom){p.rom={...CAL.rom,date:new Date().toISOString()};Profiles.save()}openPractice()};
$("#calGames").onclick=()=>{const p=Profiles.cur();if(p&&CAL&&CAL.rom){p.rom={...CAL.rom,date:new Date().toISOString()};Profiles.save();S.sens=Math.round(practiceSens(p));syncSettings()}openPractice()};
$("#calBack").onclick=()=>{if(CAL)cancelAnimationFrame(CAL.raf);CAL=null;openPractice()};

/* ---------- Session ---------- */
function startSession(){
  const p=Profiles.cur();if(!p)return;
  P={profile:p,i:0,exercises:[],recent:[],level0:p.level,prevSens:S.sens};
  S.sens=practiceSens(p);keepAwake();nextExercise();
}
function nextExercise(){
  const p=P.profile;
  if(P.i>=SESSION_LEN)return finishSession();
  const key=pickShape(p.level,P.recent.slice(-2)),sh=SHAPES[key],lv=LEVELS[p.level],tpl={pts:sh.gen(lv.size),tol:lv.tol};
  P.recent.push(key);
  handoff({label:`Exercise ${P.i+1} of ${SESSION_LEN} · Level ${p.level}`,who:sh.label,info:"Trace the dotted blue path from the green dot to the orange ring. Stay inside the light band.",
    hint:S.ctrl==="look"?"Hold the phone up like a camera. Move slowly and smoothly; accuracy matters more than speed.":"Hold the phone comfortably. Move slowly and smoothly; accuracy matters more than speed.",go:"Start exercise",
    onGo:()=>startDraw({who:`${p.name} · Practice`,word:sh.label,strokes:[],dur:lv.time,mark:tpl.pts[0],template:tpl,steady:true,onEnd:()=>scoreExercise(key,tpl)})});
  say(`Exercise ${P.i+1}. ${sh.label}`);
}
function scoreExercise(key,tpl){
  const p=P.profile,tr=Motor.trace(D.strokes,tpl),m=Motor.metrics(D.samples);
  const ex={shape:key,label:SHAPES[key].label,level:p.level,score:tr.score,coverage:tr.coverage,accuracy:tr.accuracy,tremorAmp:+m.tremorAmp.toFixed(3),tremorHz:m.tremorHz,smooth:m.smooth,ldlj:m.ldlj==null?null:+m.ldlj.toFixed(2),speed:+m.speed.toFixed(1),romX:+m.romX.toFixed(1),romY:+m.romY.toFixed(1),active:+m.active.toFixed(1),img:snapshotWithTemplate(D.strokes,tpl)};
  P.exercises.push(ex);P.i++;
  const before=p.level;if(tr.score>=80&&p.level<5)p.level++;else if(tr.score<50&&p.level>1)p.level--;
  const change=p.level>before?"Great control. The next exercise will be a bit harder.":p.level<before?"Let's make the next one a bit easier.":"Same level for the next exercise.";
  $("#exTitle").textContent=ex.label;$("#exScore").textContent=ex.score;
  $("#exChips").innerHTML=[["Path covered",ex.coverage+"%"],["Accuracy",ex.accuracy+"%"],["Steadiness",steadiness(ex.tremorAmp)],["Smoothness",ex.smooth==null?"–":ex.smooth]].map(([a,b])=>`<div class="kpi"><b>${b}</b><span>${a}</span></div>`).join("");
  $("#exImg").src=ex.img;$("#exNext").textContent=P.i>=SESSION_LEN?"See session summary":"Next exercise";$("#exAdapt").textContent=change;
  show("s-ex");say(`Score ${ex.score}. ${change}`);
}
function steadiness(amp){return amp==null?"–":Math.round(Math.max(0,Math.min(100,100-amp*60)))}
function snapshotWithTemplate(strokes,tpl){const n=220,c=document.createElement("canvas");c.width=c.height=n;const x=c.getContext("2d");paintPaper(x,n,false);drawTemplate(x,tpl,n,.6,true);strokes.forEach(s=>drawStroke(x,{...s,w:Math.max(s.w,.012)},n));return c.toDataURL("image/png")}
$("#exNext").onclick=()=>nextExercise();
$("#exStop").onclick=()=>finishSession();
function avg(a,k){const v=a.map(e=>e[k]).filter(x=>x!=null&&isFinite(x));return v.length?v.reduce((s,x)=>s+x,0)/v.length:null}
function finishSession(){
  const p=P.profile;S.sens=P.prevSens;
  if(!P.exercises.length){P=null;return openPractice()}
  const s={date:new Date().toISOString(),level0:P.level0,level1:p.level,exercises:P.exercises.map(({img,...e})=>e),
    avg:{score:avg(P.exercises,"score"),coverage:avg(P.exercises,"coverage"),accuracy:avg(P.exercises,"accuracy"),tremorAmp:avg(P.exercises,"tremorAmp"),smooth:avg(P.exercises,"smooth"),speed:avg(P.exercises,"speed"),romX:avg(P.exercises,"romX"),romY:avg(P.exercises,"romY")}};
  p.sessions.push(s);Profiles.save();
  const prev=p.sessions[p.sessions.length-2];
  $("#psTitle").textContent=`Session score ${Math.round(s.avg.score)}`;
  $("#psInfo").textContent=prev?`Last session: ${Math.round(prev.avg.score)}. Level ${s.level0} → ${s.level1}.`:`First session saved. Level ${s.level0} → ${s.level1}.`;
  $("#psCards").innerHTML=P.exercises.map(e=>cardHTML({img:e.img,name:`${e.label} · level ${e.level}`,sub:`Covered ${e.coverage}% · accuracy ${e.accuracy}% · steadiness ${steadiness(e.tremorAmp)}`,meter:e.score,pc:String(e.score),win:e.score>=80})).join("");
  say(`Session complete. Score ${Math.round(s.avg.score)}`);
  P=null;show("s-psum");
}
$("#psProg").onclick=()=>openProgress();$("#psHub").onclick=()=>openPractice();
