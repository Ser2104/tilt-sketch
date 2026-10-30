/* ---------- Guided drawings: trace line-art figures, no time limit ---------- */
const GUIDED=FIG.WORLDS.flatMap((w,wi)=>w.items.map((key,i)=>({key,world:wi,index:i,tol:w.tol})));
const GSTARS=[62,80,92];
function gStars(score){return GSTARS.filter(t=>score>=t).length}
function guidedState(){const s=store.get("ts-guided",null);return{unlocked:Math.max(0,+(s&&s.unlocked)||0),best:s&&typeof s.best==="object"&&s.best?s.best:{}}}
function guidedStars(st){return GUIDED.reduce((s,_,i)=>s+gStars(st.best[i]||0),0)}
function openGuided(){
  const st=guidedState();
  $("#gdStars").textContent=`${guidedStars(st)} of ${GUIDED.length*3} ★ · figure ${Math.min(st.unlocked+1,GUIDED.length)} of ${GUIDED.length}`;
  $("#gdWorlds").innerHTML=FIG.WORLDS.map((w,wi)=>`<section class="world"><div class="setting"><span class="label">World ${wi+1} · ${esc(w.name)}</span><span class="tag">no time limit</span></div><div class="lvgrid gd">${w.items.map((key,i)=>{const k=wi*6+i,open=k<=st.unlocked,b=st.best[k];
    return`<button class="lv${open?"":" locked"}${k===st.unlocked?" cur":""}" data-k="${k}" ${open?"":"disabled"} aria-label="Figure ${k+1}: ${open?esc(FIG.F[key].name):"locked"}"><img src="${FIG.preview(key,96)}" alt=""><span>${open?esc(FIG.F[key].name):`🔒 ${k+1}`}</span><i>${b!=null?stars(gStars(b)):""}</i></button>`}).join("")}</div></section>`).join("");
  show("s-guided");
}
$("#gdWorlds").onclick=async e=>{const b=e.target.closest(".lv");if(!b||b.disabled)return;if(!(await readyToDraw()))return;playGuided(+b.dataset.k)};
function playGuided(k){
  const G_=GUIDED[k],f=FIG.F[G_.key],tpl={strokes:f.s,tol:G_.tol},n=f.s.length;
  handoff({label:`Guided ${k+1} of ${GUIDED.length} · ${FIG.WORLDS[G_.world].name}`,who:f.name,ref:{img:FIG.preview(G_.key,240),tip:"Trace each line from its green dot to its orange ring. No time limit."},
    info:`${n} line${n===1?"":"s"}. Lift the pen between lines, aim at the next green dot, then press again. Tap Done when you finish.`,
    hint:S.ctrl==="look"?"Hold the phone up like a camera. Slow and steady wins stars.":"Tilt gently. Slow and steady wins stars.",go:"Start tracing",
    onGo:()=>startDraw({who:`Guided ${k+1}`,word:f.name,strokes:[],dur:0,mark:f.s[0][0],template:tpl,steady:true,zoom:1.25,hud:`Guided ${k+1}`,autoFinish:true,
      onEnd:()=>finishGuided(k,tpl),onError:()=>openGuided()})});
}
async function finishGuided(k,tpl){
  const tr=Motor.trace(D.strokes,tpl);
  /* Missing lines cost points: below 85% coverage the score drops fast, so half a figure earns no star */
  tr.score=Math.round(tr.score*Math.min(1,(tr.coverage/85)**1.5));
  const st=guidedState(),s=gStars(tr.score),img=snapshotWithTemplate(D.strokes,tpl);
  st.best[k]=Math.max(st.best[k]||0,tr.score);if(s>=1&&st.unlocked===k)st.unlocked=Math.min(GUIDED.length,k+1);store.set("ts-guided",st);
  const n=playerName();let sync="";if(s>=1&&Rank.on()&&n)sync=(await Rank.submit("guided",n,0,st.unlocked,guidedStars(st)))?" Ranking updated.":"";
  const actions=[];if(s>=1&&k+1<GUIDED.length)actions.push({text:`Next: ${FIG.F[GUIDED[k+1].key].name}`,fn:()=>playGuided(k+1)});
  actions.push({text:"All guided drawings",fn:openGuided},{text:s>=3?"Play again":"Try for more stars",fn:()=>playGuided(k)},{text:"Guided ranking",fn:()=>openRanking("guided")});
  if(s<1)actions.unshift(actions.splice(1,1)[0]);
  showChallengeResult({label:`Guided ${k+1} · ${FIG.F[GUIDED[k].key].name}`,title:s>=1?(k+1===GUIDED.length?"You traced every figure!":tr.coverage<85?"Some lines are missing":"Figure complete"):`Need ${GSTARS[0]} for a star`,score:tr.score,img,
    info:(tr.score>=95?"":`Covered ${tr.coverage}% of the lines, ${tr.accuracy}% of your ink on the lines.`+(tr.coverage<85?" Trace every line, from its green dot to its orange ring.":s<1?" Go slower and stay inside the light band.":""))+sync,starsN:s,actions});
}
$("#gdBack").onclick=()=>{renderChallengeCards();show("s-home")};
$("#gdRank").onclick=()=>openRanking("guided");
$("#cGuided").onclick=()=>openGuided();
renderChallengeCards();
