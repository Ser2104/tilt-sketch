/* ---------- Gyroscope ---------- */
const ori={a:null,b:null,g:null,t:0};
addEventListener("deviceorientation",e=>{if(e.beta==null||e.gamma==null)return;ori.a=e.alpha;ori.b=e.beta;ori.g=e.gamma;ori.t=performance.now();
  if(S.gyro!=="ok"){S.gyro="ok";gyroMsg("ok","Gyroscope on. Aim your phone to move the sheet under the brush.");refreshStart()}});
function gyroMsg(cls,txt){$("#gyroStatus").innerHTML=`<span class="dot ${cls}"></span><span>${txt}</span>`}
async function testGyro(){
  let denied=false;
  const ask=typeof DeviceOrientationEvent!=="undefined"&&DeviceOrientationEvent.requestPermission?DeviceOrientationEvent.requestPermission():null;
  gyroMsg("wait","Looking for the gyroscope… move your phone a little");
  try{if(ask&&(await ask)!=="granted")denied=true}catch(_){denied=true}
  const t0=performance.now();
  await new Promise(r=>setTimeout(r,1200));
  if(ori.t>=t0-1500&&ori.b!=null){S.gyro="ok";gyroMsg("ok","Gyroscope on. Aim your phone to move the sheet under the brush.")}
  else{S.gyro="no";gyroMsg("bad",denied?"Motion access was denied. On iPhone, close the tab, reopen the game and tap \"Allow\".":location.protocol!=="https:"&&location.hostname!=="localhost"?"The gyroscope only works when the game is opened from an https address.":window.top!==window?"This view blocks the gyroscope. Open the game from its own link in your phone's browser.":"No gyroscope data is coming in. Use a phone and check that the browser has motion access.")}
  refreshStart();return S.gyro==="ok";
}
const RAD=Math.PI/180,wrap=d=>((d%360)+540)%360-180;
function aim(){
  if(S.ctrl==="look"&&ori.a!=null){
    const A=ori.a*RAD,B=ori.b*RAD,G=ori.g*RAD,sA=Math.sin(A),cA=Math.cos(A),sB=Math.sin(B),cB=Math.cos(B),sG=Math.sin(G),cG=Math.cos(G);
    const fx=-(cG*sA*sB+cA*sG),fy=-(sA*sG-cA*cG*sB),fz=-cB*cG,pitch=Math.asin(Math.max(-1,Math.min(1,fz)))/RAD;
    return{x:Math.atan2(fx,fy)/RAD,y:-pitch,pitch}}
  const a=(screen.orientation&&screen.orientation.angle)||window.orientation||0;
  if(a===90)return{x:ori.b,y:-ori.g};if(a===-90||a===270)return{x:-ori.b,y:ori.g};if(a===180)return{x:-ori.g,y:-ori.b};return{x:ori.g,y:ori.b}}
function OneEuro(minCut=1.2,beta=.03,dCut=1){let x=null,dx=0,t=0;const a=(c,dt)=>1/(1+1/(2*Math.PI*c*dt));
  return{reset(v){x=v;dx=0;t=0},f(v,now,isAngle){if(x==null){x=v;t=now;return v}const dt=Math.max(1e-3,(now-t)/1000);t=now;
    let d=isAngle?wrap(v-x):v-x;const ed=d/dt;dx+=(ed-dx)*a(dCut,dt);const c=minCut+beta*Math.abs(dx);x=x+d*a(c,dt);if(isAngle)x=wrap(x);return x}}}
const fx=OneEuro(),fy=OneEuro(),cal={px:null,py:null};
function arMode(){return S.cam&&S.ctrl==="look"&&camStream}
function degPerSheet(){return arMode()?Math.max(S.sens,36):S.sens}
function calibrate(ax,ay){const t=aim();fx.reset(t.x);fy.reset(t.y);cal.px=t.x;cal.py=t.y;D.pos={x:ax,y:ay};D.tgt={x:ax,y:ay}}
function gyroTarget(now){
  const t=aim();cal.raw=t;const x=fx.f(t.x,now,true),y=fy.f(t.y,now,false);
  if(cal.px==null){cal.px=x;cal.py=y}
  const dx=wrap(x-cal.px),dy=y-cal.py,dt=Math.max(.001,(now-(cal.t||now))/1000);cal.px=x;cal.py=y;cal.t=now;
  const speed=Math.hypot(dx,dy)/dt,u=Math.min(1,Math.max(0,(speed-8)/110)),boost=arMode()||D.steady?1:.6+1.1*u*u*(3-2*u);
  const g=boost/degPerSheet();
  $("#aimHint").hidden=!(S.ctrl==="look"&&t.pitch!=null&&t.pitch<-60);
  return{x:Math.min(1,Math.max(0,D.tgt.x+dx*g)),y:Math.min(1,Math.max(0,D.tgt.y+dy*g))}}
function smoothStroke(s){if(!s||s.pts.length<3)return;let p=s.pts;
  for(let k=0;k<2;k++){const q=[p[0]];for(let i=0;i<p.length-1;i++){const a=p[i],b=p[i+1];q.push([a[0]*.75+b[0]*.25,a[1]*.75+b[1]*.25],[a[0]*.25+b[0]*.75,a[1]*.25+b[1]*.75])}q.push(p[p.length-1]);p=q}
  const out=[p[0]];for(const pt of p){const l=out[out.length-1];if(Math.hypot(pt[0]-l[0],pt[1]-l[1])>.003)out.push(pt)}if(out[out.length-1]!==p[p.length-1])out.push(p[p.length-1]);s.pts=out}

