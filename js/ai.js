/* ---------- AI ---------- */
const AI={model:null,state:"wait",kind:null,spec:null};
function aiMsg(cls,txt){$("#aiStatus").innerHTML=`<span class="dot ${cls}"></span><span>${txt}</span>`}
async function loadCustomModel(){
  const r=await fetch("models/tiltsketch/spec.json",{cache:"no-cache"});if(!r.ok)throw new Error("no custom model");
  const spec=await r.json(),buf=new Float32Array(await (await fetch("models/tiltsketch/weights.bin",{cache:"no-cache"})).arrayBuffer());
  const n=spec.input.size,m=tf.sequential();let first=true;
  const opt=()=>first?(first=false,{inputShape:[n,n,1]}):{};
  for(const L of spec.arch){
    if(L.type==="conv")m.add(tf.layers.conv2d({...opt(),filters:L.filters,kernelSize:3,padding:"same",useBias:false}));
    else if(L.type==="bn")m.add(tf.layers.batchNormalization({...opt(),epsilon:1e-3}));
    else if(L.type==="relu")m.add(tf.layers.reLU(opt()));
    else if(L.type==="pool")m.add(tf.layers.maxPooling2d({...opt(),poolSize:2}));
    else if(L.type==="gap")m.add(tf.layers.globalAveragePooling2d(opt()));
    else if(L.type==="dropout")m.add(tf.layers.dropout({...opt(),rate:L.rate}));
    else if(L.type==="dense")m.add(tf.layers.dense({...opt(),units:L.units}))}
  let off=0,i=0;
  for(const layer of m.layers){const k=layer.getWeights().length;if(!k)continue;const ws=[];
    for(let j=0;j<k;j++){const sh=spec.weights[i++].shape,sz=sh.reduce((a,b)=>a*b,1);ws.push(tf.tensor(buf.subarray(off,off+sz),sh));off+=sz}
    layer.setWeights(ws)}
  if(off!==buf.length)throw new Error("weights do not match the model spec");
  AI.spec=spec;return m}
(async()=>{
  try{
    try{AI.model=await loadCustomModel();AI.kind="custom"}
    catch(_){DOODLE_CLASSES=await (await fetch("models/doodlenet/classes.json")).json();AI.model=await tf.loadLayersModel("models/doodlenet/model.json");buildGameIndex();AI.kind="doodlenet"}
    const n=AI.kind==="custom"?AI.spec.input.size:28;tf.tidy(()=>AI.model.predict(tf.zeros([1,n,n,1])));
    AI.state="ok";aiMsg("ok",AI.kind==="custom"?"Tilt Sketch AI ready, trained for this game's objects. It runs on the phone.":"AI ready. It runs on the phone, with no internet or account needed.");
  }catch(e){AI.state="off";aiMsg("bad","The AI could not load. Players will score each drawing.")}
})();
function customInput(strokes){
  const {size:n,pad,line}=AI.spec.input,SS=4,N=n*SS;
  const pts=strokes.filter(s=>s.c!=="#FFFFFF").flatMap(s=>s.pts);if(!pts.length)return null;
  let x0=1,x1=0,y0=1,y1=0;for(const[x,y]of pts){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y)}
  const side=Math.max(x1-x0,y1-y0,1e-6),cx=(x0+x1)/2,cy=(y0+y1)/2,sc=(N-2*pad*SS)/side;
  const c=document.createElement("canvas");c.width=c.height=N;const g=c.getContext("2d");g.fillStyle="#fff";g.fillRect(0,0,N,N);g.lineCap=g.lineJoin="round";
  for(const s of strokes){if(!s.pts.length)continue;const er=s.c==="#FFFFFF";g.strokeStyle=er?"#fff":"#000";g.lineWidth=er?Math.max(line*SS,s.w*sc*1.2):Math.max(1,Math.round(line*SS));g.beginPath();
    s.pts.forEach(([x,y],i)=>{const X=N/2+(x-cx)*sc,Y=N/2+(y-cy)*sc;i?g.lineTo(X,Y):g.moveTo(X,Y)});if(s.pts.length===1)g.lineTo(N/2+(s.pts[0][0]-cx)*sc+.1,N/2+(s.pts[0][1]-cy)*sc);g.stroke()}
  const d=g.getImageData(0,0,N,N).data,out=new Float32Array(n*n);
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){let v=0;for(let dy=0;dy<SS;dy++)for(let dx=0;dx<SS;dx++)v+=d[((y*SS+dy)*N+x*SS+dx)*4];out[y*n+x]=1-Math.round(v/(SS*SS))/255}
  return tf.tensor4d(out,[1,n,n,1])}
async function customProbs(strokes){const t=customInput(strokes);if(!t)return null;const z=tf.tidy(()=>tf.softmax(tf.div(AI.model.predict(t),AI.spec.temperature)));const p=await z.data();t.dispose();z.dispose();return p}
function inkTensor(strokes,pad){
  const pts=strokes.filter(s=>s.c!=="#FFFFFF").flatMap(s=>s.pts);if(!pts.length)return null;
  let x0=1,x1=0,y0=1,y1=0;for(const[x,y]of pts){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y)}
  const N=56,side=Math.max(x1-x0,y1-y0,.05),cx=(x0+x1)/2,cy=(y0+y1)/2,sc=(N-2*pad)/side;
  const c=document.createElement("canvas");c.width=c.height=N;const g=c.getContext("2d");g.fillStyle="#fff";g.fillRect(0,0,N,N);g.lineCap=g.lineJoin="round";g.lineWidth=2.6;
  for(const s of strokes){if(!s.pts.length)continue;g.strokeStyle=s.c==="#FFFFFF"?"#fff":"#000";g.lineWidth=s.c==="#FFFFFF"?Math.max(2.6,s.w*sc*1.2):2.6;g.beginPath();
    s.pts.forEach(([x,y],i)=>{const X=N/2+(x-cx)*sc,Y=N/2+(y-cy)*sc;i?g.lineTo(X,Y):g.moveTo(X,Y)});if(s.pts.length===1)g.lineTo(N/2+(s.pts[0][0]-cx)*sc+.1,N/2+(s.pts[0][1]-cy)*sc);g.stroke()}
  const d=g.getImageData(0,0,N,N).data,out=new Float32Array(784);
  for(let y=0;y<28;y++)for(let x=0;x<28;x++){let v=0;for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++)v+=1-d[((y*2+dy)*N+x*2+dx)*4]/255;out[y*28+x]=v/4>.2?1:0}
  return tf.tensor4d(out,[1,28,28,1]);
}
let DOODLE_CLASSES=[],GAME_IDX={},IN_GAME=new Set();
function buildGameIndex(){GAME_IDX=Object.fromEntries(Object.entries(TARGETS).map(([w,cls])=>[w,cls.map(c=>DOODLE_CLASSES.indexOf(c)).filter(k=>k>=0)]));IN_GAME=new Set(Object.values(GAME_IDX).flat())}
const NOISE=new Set(["squiggle","line","zigzag","circle","square","triangle","hexagon","octagon","camouflage"]);
function scribblePenalty(strokes){
  const ink=strokes.filter(s=>s.c!=="#FFFFFF"&&s.pts.length),pts=ink.flatMap(s=>s.pts);if(pts.length<2)return 1;
  let x0=1,x1=0,y0=1,y1=0,L=0;for(const[x,y]of pts){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y)}
  for(const s of ink)for(let i=1;i<s.pts.length;i++)L+=Math.hypot(s.pts[i][0]-s.pts[i-1][0],s.pts[i][1]-s.pts[i-1][1]);
  const density=L/Math.max(.02,Math.max(x1-x0,y1-y0));return density<=14?1:Math.max(.05,(14/density)**1.5)}
async function aiJudge(word,items){
  if(AI.kind==="custom")return Promise.all(items.map(async it=>{
    const p=await customProbs(it.strokes);if(!p)return{guess:"nothing (blank sheet)",acc:0};
    const cls=AI.spec.classes;let best=0;p.forEach((v,i)=>{if(v>p[best])best=i});
    const k=cls.indexOf(word),pen=scribblePenalty(it.strokes);return{guess:pen<.8?"a scribble":cls[best]==="other"?"something else":cls[best],acc:k<0?0:Math.round(100*p[k]*pen)}}));
  return Promise.all(items.map(async it=>{
    const probs=new Float32Array(DOODLE_CLASSES.length);let n=0;
    for(const pad of[3,4,6]){const t=inkTensor(it.strokes,pad);if(!t)break;const p=await tf.tidy(()=>AI.model.predict(t)).data();t.dispose();p.forEach((v,i)=>probs[i]+=v/3);n++}
    if(!n)return{guess:"nothing (blank sheet)",acc:0};
    let other=0,noise=0,otherBest=-1;probs.forEach((v,i)=>{if(!IN_GAME.has(i)){if(NOISE.has(DOODLE_CLASSES[i]))noise+=v;else other+=v;if(otherBest<0||v>probs[otherBest])otherBest=i}});
    const score={};for(const[w,ix]of Object.entries(GAME_IDX))score[w]=ix.reduce((a,k)=>a+probs[k],0);
    const z=Object.values(score).reduce((a,b)=>a+b,0)+.1*other+noise,pen=scribblePenalty(it.strokes);
    const best=Object.keys(score).reduce((a,b)=>score[b]>score[a]?b:a);
    const acc=Math.round(100*pen*(score[word]||0)/Math.max(z,1e-6));
    const guess=pen<.8||NOISE.has(DOODLE_CLASSES[otherBest])&&probs[otherBest]>score[best]?"a scribble":score[best]>=probs[otherBest]*.35?best:DOODLE_CLASSES[otherBest].replace(/_/g," ");
    return{guess,acc:Math.min(100,acc)};
  }));
}

