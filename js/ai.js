/* ---------- AI ---------- */
const AI={model:null,state:"wait"};
function aiMsg(cls,txt){$("#aiStatus").innerHTML=`<span class="dot ${cls}"></span><span>${txt}</span>`}
(async()=>{
  try{
    DOODLE_CLASSES=await (await fetch("models/doodlenet/classes.json")).json();
    AI.model=await tf.loadLayersModel("models/doodlenet/model.json");buildGameIndex();
    tf.tidy(()=>AI.model.predict(tf.zeros([1,28,28,1])));
    AI.state="ok";aiMsg("ok","AI ready. It runs on the phone, with no internet or account needed.");
  }catch(e){AI.state="off";aiMsg("bad","The AI could not load. Players will score each drawing.")}
})();
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
async function aiJudge(word,items){
  return Promise.all(items.map(async it=>{
    const probs=new Float32Array(DOODLE_CLASSES.length);let n=0;
    for(const pad of[3,4,6]){const t=inkTensor(it.strokes,pad);if(!t)break;const p=await tf.tidy(()=>AI.model.predict(t)).data();t.dispose();p.forEach((v,i)=>probs[i]+=v/3);n++}
    if(!n)return{guess:"nothing (blank sheet)",acc:0};
    let other=0,otherBest=-1;probs.forEach((v,i)=>{if(!IN_GAME.has(i)){other+=v;if(otherBest<0||v>probs[otherBest])otherBest=i}});
    const score={};for(const[w,ix]of Object.entries(GAME_IDX))score[w]=ix.reduce((a,k)=>a+probs[k],0);
    const z=Object.values(score).reduce((a,b)=>a+b,0)+.1*other;
    const best=Object.keys(score).reduce((a,b)=>score[b]>score[a]?b:a);
    const acc=Math.round(100*(score[word]||0)/Math.max(z,1e-6));
    const guess=score[best]>=probs[otherBest]*.35?best:DOODLE_CLASSES[otherBest].replace(/_/g," ");
    return{guess,acc:Math.min(100,acc)};
  }));
}

