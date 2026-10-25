/* ---------- Motion metrics ---------- */
const Motor=(()=>{
  const HZ=60;
  function resample(samples,keys){
    if(samples.length<2)return null;
    const t0=samples[0].t,t1=samples[samples.length-1].t,n=Math.floor((t1-t0)/1000*HZ);
    if(n<4)return null;
    const out=keys.map(()=>new Float64Array(n)),pen=new Uint8Array(n);let j=0;
    for(let i=0;i<n;i++){
      const t=t0+i*1000/HZ;while(j<samples.length-2&&samples[j+1].t<t)j++;
      const a=samples[j],b=samples[j+1],u=Math.min(1,Math.max(0,(t-a.t)/Math.max(1,b.t-a.t)));
      keys.forEach((k,m)=>{let d=b[k]-a[k];if(k==="ax")d=wrap(d);out[m][i]=a[k]+d*u});
      pen[i]=u<.5?a.pen:b.pen}
    if(keys.includes("ax")){const x=out[keys.indexOf("ax")];for(let i=1;i<n;i++)x[i]=x[i-1]+wrap(x[i]-x[i-1])}
    return{n,cols:out,pen}}
  function movAvg(a,w){const n=a.length,o=new Float64Array(n),h=w>>1;let s=0,c=0;
    for(let i=0;i<n+h;i++){if(i<n){s+=a[i];c++}if(i-w>=0){s-=a[i-w];c--}const k=i-h;if(k>=0&&k<n)o[k]=s/c}return o}
  function percentile(a,p){const s=Array.from(a).sort((x,y)=>x-y);return s.length?s[Math.min(s.length-1,Math.max(0,Math.round(p*(s.length-1))))]:0}
  function goertzel(x,f){const w=2*Math.PI*f/HZ,c=2*Math.cos(w);let s1=0,s2=0;for(let i=0;i<x.length;i++){const s=x[i]+c*s1-s2;s2=s1;s1=s}return(s1*s1+s2*s2-c*s1*s2)/x.length}
  function tremor(ax,ay){
    const mx=movAvg(ax,9),my=movAvg(ay,9),rx=ax.map((v,i)=>v-mx[i]),ry=ay.map((v,i)=>v-my[i]);
    let ss=0;for(let i=0;i<rx.length;i++)ss+=rx[i]*rx[i]+ry[i]*ry[i];
    const amp=Math.sqrt(ss/Math.max(1,rx.length));
    let bestF=0,bestP=0,band=0,all=0;
    for(let f=1;f<=15;f+=.5){const p=goertzel(rx,f)+goertzel(ry,f);all+=p;if(f>=4&&f<=12){band+=p;if(p>bestP){bestP=p;bestF=f}}}
    return{amp,freq:bestF,ratio:all?band/all:0}}
  function ldlj(px,py){
    const n=px.length;if(n<8)return null;
    const sx=movAvg(px,5),sy=movAvg(py,5),dt=1/HZ,T=n*dt;
    const vx=[],vy=[];for(let i=1;i<n;i++){vx.push((sx[i]-sx[i-1])/dt);vy.push((sy[i]-sy[i-1])/dt)}
    const vp=Math.max(...vx.map((v,i)=>Math.hypot(v,vy[i])));if(vp<1e-3)return null;
    let J=0;for(let i=3;i<n;i++){const jx=(sx[i]-3*sx[i-1]+3*sx[i-2]-sx[i-3])/dt**3,jy=(sy[i]-3*sy[i-1]+3*sy[i-2]-sy[i-3])/dt**3;J+=(jx*jx+jy*jy)*dt}
    return-Math.log(T**3/(vp*vp)*J)}
  function metrics(samples){
    const r=resample(samples,["ax","ay","x","y"]);
    if(!r)return{active:0,speed:0,romX:0,romY:0,tremorAmp:0,tremorHz:0,tremorRatio:0,ldlj:null,smooth:null};
    const[ax,ay,px,py]=r.cols;
    const romX=percentile(ax,.95)-percentile(ax,.05),romY=percentile(ay,.95)-percentile(ay,.05);
    let active=0,dist=0;const segs=[];let cur=null;
    for(let i=0;i<r.n;i++){if(r.pen[i]){active++;if(i)dist+=Math.hypot(wrap(ax[i]-ax[i-1]),ay[i]-ay[i-1]);(cur||(cur=[[],[]]))[0].push(px[i]);cur[1].push(py[i])}else if(cur){segs.push(cur);cur=null}}
    if(cur)segs.push(cur);
    const tr=tremor(ax,ay);
    const vals=segs.filter(s=>s[0].length>=12).map(s=>ldlj(s[0],s[1])).filter(v=>v!=null&&isFinite(v));
    const L=vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:null;
    return{active:active/HZ,speed:active?dist/(active/HZ):0,romX,romY,tremorAmp:tr.amp,tremorHz:tr.freq,tremorRatio:tr.ratio,ldlj:L,smooth:L==null?null:Math.round(Math.min(100,Math.max(0,(L+14)/10*100)))}}
  function densify(pts,step=.005){if(!pts||!pts.length)return[];if(pts.length===1)return[pts[0]];const out=[];for(let i=0;i<pts.length-1;i++){const[a,b]=[pts[i],pts[i+1]],d=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.max(1,Math.ceil(d/step));for(let k=0;k<n;k++)out.push([a[0]+(b[0]-a[0])*k/n,a[1]+(b[1]-a[1])*k/n])}out.push(pts[pts.length-1]);return out}
  const pathLen=p=>{let L=0;for(let i=1;i<p.length;i++)L+=Math.hypot(p[i][0]-p[i-1][0],p[i][1]-p[i-1][1]);return L};
  const tStrokes=t=>t.strokes||[t.pts];
  function grid(P,cell){const g=new Map();for(const p of P){const k=Math.floor(p[0]/cell)+","+Math.floor(p[1]/cell);(g.get(k)||g.set(k,[]).get(k)).push(p)}
    return q=>{const cx=Math.floor(q[0]/cell),cy=Math.floor(q[1]/cell);let m=1e9;for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++){const b=g.get((cx+i)+","+(cy+j));if(b)for(const p of b){const d=(p[0]-q[0])**2+(p[1]-q[1])**2;if(d<m)m=d}}return Math.sqrt(m)}}
  function strokeCoverage(drawn,template){
    const P=drawn.filter(s=>s.c!=="#FFFFFF"&&s.pts.length).flatMap(s=>densify(s.pts,.006));if(!P.length)return tStrokes(template).map(()=>0);
    const near=grid(P,template.tol);return tStrokes(template).map(s=>{const T=densify(s,.01);return T.filter(q=>near(q)<=template.tol).length/T.length})}
  function trace(strokes,template){
    const T=tStrokes(template).flatMap(s=>densify(s)),tol=template.tol;
    const ink=strokes.filter(s=>s.c!=="#FFFFFF"&&s.pts.length);
    const P=ink.flatMap(s=>densify(s.pts,.004));
    if(!P.length||!T.length)return{coverage:0,accuracy:0,score:0,meanDev:1,lengthRatio:0};
    const nT=grid(T,tol*1.25),nP=grid(P,tol);
    const meanDev=P.reduce((s,p)=>s+Math.min(nT(p),tol*3),0)/P.length;
    const coverage=T.filter(q=>nP(q)<=tol).length/T.length;
    const onPath=P.filter(p=>nT(p)<=tol*1.25).length/P.length;
    const ratio=ink.reduce((s,k)=>s+pathLen(k.pts),0)/Math.max(1e-6,tStrokes(template).reduce((s,k)=>s+pathLen(k),0));
    const f1=coverage+onPath?2*coverage*onPath/(coverage+onPath):0;
    const lengthFactor=ratio<=1.6?1:Math.max(0,1.6/ratio)**1.5;
    return{coverage:Math.round(coverage*100),accuracy:Math.round(onPath*100),score:Math.round(100*f1*lengthFactor),meanDev,lengthRatio:+ratio.toFixed(2)}}
  return{metrics,trace,densify,strokeCoverage,tStrokes,HZ}
})();
