/* ---------- Live AI while drawing, and real example drawings ---------- */
let EXAMPLES={};
fetch("models/examples.json").then(r=>r.ok?r.json():{}).then(d=>{EXAMPLES=d||{}}).catch(()=>{});
function exampleSVG(d,size=84){
  const xs=d.flatMap(s=>s[0]),ys=d.flatMap(s=>s[1]),x0=Math.min(...xs),y0=Math.min(...ys),side=Math.max(Math.max(...xs)-x0,Math.max(...ys)-y0,1),pad=side*.08;
  const path=d.map(s=>s[0].map((x,i)=>`${i?"L":"M"}${x-x0+pad} ${s[1][i]-y0+pad}`).join("")).join("");
  return`<svg viewBox="0 0 ${side+2*pad} ${side+2*pad}" width="${size}" height="${size}" role="img" aria-label="Example drawing"><rect width="100%" height="100%" fill="#fff"/><path d="${path}" fill="none" stroke="#13213C" stroke-width="${side/28}" stroke-linecap="round" stroke-linejoin="round"/></svg>`}
let liveT=0,liveBusy=false,liveSig="",liveGuess="";
function liveReset(){clearInterval(liveT);liveBusy=false;liveSig="";liveGuess="";aiResetVoice();$("#liveAI").hidden=true;$("#liveAI").textContent="";if(D.live)liveT=setInterval(liveTick,500)}
async function liveTick(){
  if(D.state==="idle"&&!D.live){clearInterval(liveT);return}
  if(D.state!=="run"||D.pen||liveBusy||typeof AI==="undefined"||AI.state!=="ok")return;
  const ink=(D.strokes||[]).filter(s=>s.c!=="#FFFFFF"),n=ink.reduce((a,s)=>a+s.pts.length,0),sig=ink.length+":"+n;
  if(n<6||sig===liveSig)return;liveSig=sig;liveBusy=true;
  try{
    const[r]=await aiJudge(D.word,[{strokes:D.strokes.map(s=>({...s,pts:s.pts.slice()}))}]);
    if(D.state!=="run")return;
    liveGuess=r.scribble?"":r.guess;aiComment(r,D.word);
    const box=$("#liveAI"),hit=r.guess===D.word;box.hidden=false;box.classList.toggle("hit",hit);
    box.textContent=r.scribble?"AI sees: a scribble":r.guess==="something else"?"AI: not sure yet":hit&&r.detail<80?`AI sees: ${r.guess} · add more detail`:`AI sees: ${r.guess} · ${r.acc}%`;
  }catch(_){}finally{liveBusy=false}
}
