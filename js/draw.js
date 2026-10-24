/* ---------- Drawing engine ---------- */
const cv=$("#cv"),ctx=cv.getContext("2d");
const D={sheet:600,strokes:null,cur:null,color:COLORS[0],size:SIZES[1],pen:false,pos:{x:.5,y:.5},tgt:{x:.5,y:.5},state:"idle",t0:0,samples:[],template:null,steady:false,dur:10,base:0,mark:null,onEnd:null,px:300,raf:0};
function paintPaper(c,n,grid,lw=1){c.fillStyle="#fff";c.fillRect(0,0,n,n);if(!grid)return;
  c.lineWidth=lw;for(let i=1;i<10;i++){const p=Math.round(i*n/10)+.5;c.strokeStyle=i===5?"#A9C2D6":"#E1EBF2";c.beginPath();c.moveTo(p,0);c.lineTo(p,n);c.moveTo(0,p);c.lineTo(n,p);c.stroke()}
  c.fillStyle="#A9C2D6";c.beginPath();c.arc(n/2,n/2,3,0,7);c.fill()}
function drawStroke(c,s,n){if(!s.pts.length)return;c.strokeStyle=s.c;c.lineWidth=Math.max(1,s.w*n);c.lineCap=c.lineJoin="round";c.beginPath();
  const p=s.pts;c.moveTo(p[0][0]*n,p[0][1]*n);if(p.length===1)c.lineTo(p[0][0]*n+.1,p[0][1]*n);
  for(let i=1;i<p.length-1;i++){const mx=(p[i][0]+p[i+1][0])/2,my=(p[i][1]+p[i+1][1])/2;c.quadraticCurveTo(p[i][0]*n,p[i][1]*n,mx*n,my*n)}
  if(p.length>1){const l=p[p.length-1];c.lineTo(l[0]*n,l[1]*n)}c.stroke()}
function render(){
  const k=devicePixelRatio,w=cv.width,h=cv.height,W=D.sheet*k,ox=Math.round(w/2-D.pos.x*W),oy=Math.round(h/2-D.pos.y*W);
  const cam=!$("#camv").hidden;
  if(cam){ctx.clearRect(0,0,w,h);ctx.save();ctx.translate(ox,oy);ctx.fillStyle="rgba(255,255,255,.5)";ctx.fillRect(0,0,W,W);ctx.strokeStyle="rgba(255,255,255,.95)";ctx.lineWidth=2*k;ctx.strokeRect(0,0,W,W)}
  else{ctx.fillStyle="#C9D6E0";ctx.fillRect(0,0,w,h);ctx.fillStyle="rgba(19,33,60,.16)";ctx.fillRect(ox+4*k,oy+6*k,W,W);ctx.save();ctx.translate(ox,oy);paintPaper(ctx,W,true,k)}
  if(D.template)drawTemplate(ctx,D.template,W,k);
  for(const s of D.strokes||[])drawStroke(ctx,s,W);
  if(D.mark){ctx.strokeStyle="#FF5A36";ctx.lineWidth=2.5*k;ctx.setLineDash([6*k,5*k]);ctx.beginPath();ctx.arc(D.mark[0]*W,D.mark[1]*W,16*k,0,7);ctx.stroke();ctx.setLineDash([])}
  ctx.restore();
  const cx=w/2,cy=h/2,r=13*k;
  ctx.strokeStyle="rgba(19,33,60,.35)";ctx.lineWidth=1.5*k;ctx.beginPath();
  for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){ctx.moveTo(cx+dx*(r+5*k),cy+dy*(r+5*k));ctx.lineTo(cx+dx*(r+22*k),cy+dy*(r+22*k))}ctx.stroke();
  ctx.strokeStyle=D.pen?"#14946C":"#13213C";ctx.lineWidth=3*k;ctx.beginPath();ctx.arc(cx,cy,r,0,7);ctx.stroke();
  ctx.fillStyle=D.color==="eraser"?"#bbb":D.color;ctx.beginPath();ctx.arc(cx,cy,Math.max(2.5*k,D.size*W/2),0,7);ctx.fill();
  const m=72*k,mx=w-m-10*k,my=10*k;
  ctx.fillStyle="rgba(19,33,60,.2)";ctx.fillRect(mx+2*k,my+3*k,m,m);
  ctx.save();ctx.translate(mx,my);paintPaper(ctx,m,false);if(D.template)drawTemplate(ctx,D.template,m,k*.35,true);for(const s of D.strokes||[])drawStroke(ctx,{...s,w:Math.max(s.w,.02)},m);
  const vw=w/W*m,vh=h/W*m;ctx.strokeStyle="#3A86FF";ctx.lineWidth=1.5*k;ctx.strokeRect(D.pos.x*m-vw/2,D.pos.y*m-vh/2,vw,vh);
  ctx.fillStyle=D.pen?"#14946C":"#FF5A36";ctx.beginPath();ctx.arc(D.pos.x*m,D.pos.y*m,3*k,0,7);ctx.fill();
  ctx.strokeStyle="#9FB3C4";ctx.lineWidth=k;ctx.strokeRect(0,0,m,m);ctx.restore();
}
function drawTemplate(c,t,W,k,mini){const p=t.pts;if(!p||p.length<2)return;c.lineCap=c.lineJoin="round";
  c.strokeStyle="rgba(58,134,255,.16)";c.lineWidth=Math.max(2,t.tol*2*W);c.beginPath();c.moveTo(p[0][0]*W,p[0][1]*W);p.forEach(q=>c.lineTo(q[0]*W,q[1]*W));c.stroke();
  c.strokeStyle="rgba(58,134,255,.75)";c.lineWidth=Math.max(1,2*k);if(!mini)c.setLineDash([7*k,6*k]);c.beginPath();c.moveTo(p[0][0]*W,p[0][1]*W);p.forEach(q=>c.lineTo(q[0]*W,q[1]*W));c.stroke();c.setLineDash([]);
  if(mini)return;
  c.fillStyle="#14946C";c.beginPath();c.arc(p[0][0]*W,p[0][1]*W,9*k,0,7);c.fill();
  const e=p[p.length-1];c.strokeStyle="#FF5A36";c.lineWidth=3*k;c.beginPath();c.arc(e[0]*W,e[1]*W,9*k,0,7);c.stroke();
  const i=Math.min(p.length-1,Math.max(1,Math.floor(p.length*.15))),a=Math.atan2(p[i][1]-p[i-1][1],p[i][0]-p[i-1][0]),x=p[i][0]*W,y=p[i][1]*W;
  c.fillStyle="rgba(58,134,255,.9)";c.beginPath();c.moveTo(x+Math.cos(a)*10*k,y+Math.sin(a)*10*k);c.lineTo(x+Math.cos(a+2.5)*8*k,y+Math.sin(a+2.5)*8*k);c.lineTo(x+Math.cos(a-2.5)*8*k,y+Math.sin(a-2.5)*8*k);c.fill()}
function addPoint(x,y){const s=D.cur;if(!s)return;const l=s.pts[s.pts.length-1];if(!l||Math.hypot(l[0]-x,l[1]-y)>.0025)s.pts.push([x,y])}
function penDown(x,y){if(D.state!=="run")return;D.pen=true;D.cur={c:D.color==="eraser"?"#FFFFFF":D.color,w:D.color==="eraser"?D.size*2.2:D.size,pts:[]};D.strokes.push(D.cur);addPoint(x,y);$("#pen").classList.add("on");$("#pen").textContent=S.lock?"DRAWING · TAP TO LIFT":"DRAWING…"}
function penUp(){if(D.cur&&!D.cur.pts.length)D.strokes.pop();else smoothStroke(D.cur);D.pen=false;D.cur=null;$("#pen").classList.remove("on");$("#pen").textContent=S.lock?"TAP TO DRAW":"HOLD TO DRAW"}
function loop(now){
  if(S.input==="gyro"&&ori.b!=null){
    if(D.state==="count")calibrate(D.pos.x,D.pos.y);
    else{D.tgt=gyroTarget(now);D.pos.x+=(D.tgt.x-D.pos.x)*.6;D.pos.y+=(D.tgt.y-D.pos.y)*.6;if(D.pen)addPoint(D.pos.x,D.pos.y)}}
  if(D.state==="run"){const r=S.input==="gyro"&&cal.raw?cal.raw:{x:D.pos.x*degPerSheet(),y:D.pos.y*degPerSheet()};D.samples.push({t:now,ax:r.x,ay:r.y,x:D.pos.x,y:D.pos.y,pen:D.pen?1:0})}
  if(D.state==="run"){const left=Math.max(0,D.dur-(now-D.t0)/1000);$("#dClock").textContent=Math.ceil(left);$("#dClock").classList.toggle("low",left<=3);
    const bar=$("#dBar");bar.style.transform=`scaleX(${left/D.dur})`;bar.style.background=left<=3?"var(--accent)":"var(--go)";if(left<=0)endTurn()}
  render();D.raf=requestAnimationFrame(loop)}
function fit(){const st=$("#stage").getBoundingClientRect();const w=Math.max(120,st.width),h=Math.max(120,st.height);cv.width=Math.round(w*devicePixelRatio);cv.height=Math.round(h*devicePixelRatio);D.sheet=arMode()?w*degPerSheet()/FOV_W:ZOOM*Math.min(w,h)}
new ResizeObserver(()=>{if(!$("#s-draw").hidden)fit()}).observe($("#stage"));

$("#swatches").innerHTML=COLORS.map((c,i)=>`<button class="sw" style="background:${c}" data-c="${c}" aria-label="Color ${i+1}" aria-pressed="${i===0}"></button>`).join("")+`<button class="sw eraser" data-c="eraser" aria-label="Eraser" aria-pressed="false"></button>`;
$("#sizes").innerHTML=SIZES.map((s,i)=>`<button class="sz" data-s="${i}" aria-label="Pen size ${i+1}" aria-pressed="${i===1}"><i style="width:${6+i*6}px;height:${6+i*6}px"></i></button>`).join("");
$("#swatches").onclick=e=>{const c=e.target.dataset.c;if(!c)return;D.color=c;document.querySelectorAll(".sw").forEach(b=>b.setAttribute("aria-pressed",b===e.target));if(D.cur){const w=D.pen;penUp();if(w)penDown(D.pos.x,D.pos.y)}};
$("#sizes").onclick=e=>{const b=e.target.closest(".sz");if(!b)return;D.size=SIZES[+b.dataset.s];document.querySelectorAll(".sz").forEach(x=>x.setAttribute("aria-pressed",x===b))};
$("#undo").onclick=()=>{if(D.strokes&&D.strokes.length>D.base){if(D.cur)penUp();D.strokes.pop()}};
$("#recal").onclick=()=>{if(S.input==="gyro")calibrate(D.pos.x,D.pos.y)};
$("#finish").onclick=()=>{if(D.state==="run")endTurn()};
const pen=$("#pen");
pen.addEventListener("pointerdown",e=>{e.preventDefault();if(S.lock){D.pen?penUp():penDown(D.pos.x,D.pos.y)}else{pen.setPointerCapture(e.pointerId);penDown(D.pos.x,D.pos.y)}});
["pointerup","pointercancel"].forEach(t=>pen.addEventListener(t,()=>{if(!S.lock&&D.pen)penUp()}));
pen.addEventListener("contextmenu",e=>e.preventDefault());
let drag=null;
cv.addEventListener("pointerdown",e=>{if(S.input!=="finger")return;cv.setPointerCapture(e.pointerId);drag=[e.clientX,e.clientY];penDown(D.pos.x,D.pos.y)});
cv.addEventListener("pointermove",e=>{if(S.input!=="finger"||!drag)return;D.pos.x=Math.min(1,Math.max(0,D.pos.x+(e.clientX-drag[0])/D.sheet));D.pos.y=Math.min(1,Math.max(0,D.pos.y+(e.clientY-drag[1])/D.sheet));drag=[e.clientX,e.clientY];if(D.pen)addPoint(D.pos.x,D.pos.y)});
["pointerup","pointercancel"].forEach(t=>cv.addEventListener(t,()=>{if(S.input==="finger"){drag=null;if(D.pen)penUp()}}));

let wake=null;async function keepAwake(){try{wake=await navigator.wakeLock.request("screen")}catch(_){}}

function startDraw({who,word,strokes,dur,mark,onEnd,template=null,steady=false}){
  D.strokes=strokes;D.base=strokes.length;D.dur=dur;D.mark=mark||null;D.onEnd=onEnd;D.cur=null;D.pen=false;D.samples=[];D.template=template;D.steady=steady;
  $("#swatchRow").hidden=!!template;
  $("#dWho").textContent=who;$("#dWord").textContent=up(word);$("#dClock").textContent=dur;$("#dClock").classList.remove("low");$("#dBar").style.transform="scaleX(1)";
  const g=S.input==="gyro";pen.hidden=!g;$("#recal").hidden=!g;penUp();
  const cv2=$("#camv"),useCam=S.cam&&camStream&&camStream.active;cv2.hidden=!useCam;if(useCam){cv2.srcObject=camStream;cv2.play().catch(()=>{})}
  show("s-draw");fit();
  const a=mark||[.5,.5];D.pos={x:a[0],y:a[1]};calibrate(a[0],a[1]);
  D.state="count";cancelAnimationFrame(D.raf);D.raf=requestAnimationFrame(loop);
  let n=3;const over=$("#dOver");
  const tick=()=>{if(n>0){over.innerHTML=`<span>${n}</span>`;say(String(n));n--;setTimeout(tick,700)}else{over.innerHTML="";say("Go");D.state="run";D.t0=performance.now()}};tick();
}
function endTurn(){if(D.state!=="run")return;penUp();D.state="done";$("#dOver").innerHTML="<small>Time's up!</small>";say("Time's up");
  const last=[...D.strokes].reverse().find(s=>s.pts.length&&s.c!=="#FFFFFF");const lp=last?last.pts[last.pts.length-1]:(D.mark||null);
  setTimeout(()=>{$("#dOver").innerHTML="";cancelAnimationFrame(D.raf);D.state="idle";try{$("#camv").pause()}catch(_){}D.onEnd&&D.onEnd(lp)},900)}
function abortDraw(){clearInterval(autoGo);if(D.state==="idle")return;penUp();cancelAnimationFrame(D.raf);D.state="idle";$("#dOver").innerHTML="";try{$("#camv").pause()}catch(_){}}

function snapshot(strokes,n=512,type="dataURL"){const c=document.createElement("canvas");c.width=c.height=n;const x=c.getContext("2d");paintPaper(x,n,false);strokes.forEach(s=>drawStroke(x,s,n));
  return type==="blob"?new Promise(r=>c.toBlob(r,"image/png")):c.toDataURL("image/png")}
function thumbWithMark(strokes,mark){const n=320,c=document.createElement("canvas");c.width=c.height=n;const x=c.getContext("2d");paintPaper(x,n,true);strokes.forEach(s=>drawStroke(x,s,n));
  if(mark){x.strokeStyle="#FF5A36";x.lineWidth=3;x.beginPath();x.arc(mark[0]*n,mark[1]*n,12,0,7);x.stroke()}return c.toDataURL()}

/* ---------- Handoff ---------- */
function handoff({who,info="",hint="",word=null,thumb=null,label="Pass the phone to",go="I'm ready",onGo}){
  $("#hPass").textContent=label;$("#hWho").textContent=who;$("#hInfo").textContent=info;$("#hHint").textContent=hint;
  $("#hThumb").hidden=!thumb;if(thumb)$("#hThumb").src=thumb;
  const rv=$("#hReveal");rv.hidden=!word;$("#hWord").textContent="";
  const btn=$("#hGo");btn.textContent=go;btn.disabled=!!word;
  if(word){let seen=false;const showW=e=>{e.preventDefault();$("#hWord").textContent=up(word);seen=true;btn.disabled=false};const hide=()=>{$("#hWord").textContent=seen?"• • •":""};
    rv.onpointerdown=showW;rv.onpointerup=rv.onpointerleave=rv.onpointercancel=hide}
  btn.onclick=()=>{rv.onpointerdown=null;onGo()};
  show("s-hand");
}

