/* ---------- Solo and Teams ---------- */
function newMatch(){
  const names=[];S.players.forEach((p,i)=>{const b=(p.trim()&&nameOk(p)?p.trim():"Player "+(i+1)).slice(0,14);let n=b,k=2;while(names.includes(n))n=b.slice(0,12)+" "+k++;names.push(n)});
  if(S.mode==="impostor")return newImpostor(names);
  const units=S.mode==="solo"?names.map((n,i)=>({name:n,members:[i],total:0,hist:[]})):teamsOf(names).map((t,i)=>({name:"Team "+(i+1),members:t,total:0,hist:[]}));
  G={mode:S.mode,names,units,round:0,words:shuffle(gameWords()).slice(0,S.rounds),items:[],queue:[]};
  keepAwake();startRound();
}
function startRound(){
  const w=G.words[G.round];G.items=G.units.map(u=>({u,strokes:[],last:null}));G.queue=[];
  G.items.forEach(it=>it.u.members.forEach((m,k)=>G.queue.push({it,m,k})));
  nextTurn();
}
function nextTurn(){
  const t=G.queue.shift();if(!t)return judge();
  const w=G.words[G.round],who=G.names[t.m],team=G.mode==="teams";
  const rl=`Round ${G.round+1} of ${G.words.length}`;
  const cont=team&&t.k>0;const prev=cont?G.names[t.it.u.members[t.k-1]]:"";
  handoff({who,ref:refFor(w),
    info:cont?`You continue ${prev}'s drawing. The orange circle marks where they stopped, and your brush starts there.`:(team?`${t.it.u.name} · ${rl}. You start the drawing.`:rl),
    hint:cont?S.ctrl==="look"?"Hold the phone up like a camera before tapping. Where you aim becomes the spot where they stopped.":"Hold the phone comfortably before tapping. That tilt becomes the spot where they stopped.":(S.input==="gyro"?S.ctrl==="look"?"Hold the phone up like a camera. Where you aim during the 3-2-1 countdown becomes the center of the sheet.":"During the 3-2-1 countdown, hold the phone comfortably. That position becomes the center.":"Mouse test mode: drag on the sheet to draw. The brush stays in the center."),
    thumb:cont?thumbWithMark(t.it.strokes,t.it.last):null,
    onGo:()=>startDraw({who:`${who}${team?" · "+t.it.u.name:""} · ${rl}`,word:w,ref:refFor(w)?.emoji,live:true,strokes:t.it.strokes,dur:team?Math.round(S.time.teams*2/Math.max(2,t.it.u.members.length)):S.time[G.mode],mark:cont?t.it.last:null,
      onEnd:lp=>{t.it.last=lp;nextTurn()}})});
}
async function judge(){
  const w=G.words[G.round];
  show("s-judge");$("#jErr").hidden=$("#jActions").hidden=true;$("#jAnim").hidden=false;
  $("#jTitle").textContent="The AI is looking at the drawings";$("#jMsg").textContent=`Which one looks most like "${w}"?`;
  while(AI.state==="wait")await new Promise(r=>setTimeout(r,200));
  if(AI.state!=="ok")return humanJudge();
  try{const[r]=await Promise.all([aiJudge(w,G.items),new Promise(r=>setTimeout(r,1200))]);G.items.forEach((it,i)=>{it.guess=r[i].guess;it.acc=r[i].acc;it.why=explainShort(r[i]);if(G.mode==="solo"&&typeof Donate!=="undefined")Donate.send(w,it.strokes,r[i])});showRound()}
  catch(e){
    $("#jAnim").hidden=true;$("#jTitle").textContent="The AI could not analyze the drawings";
    $("#jErr").textContent="Try again, or score them yourselves.";$("#jErr").hidden=$("#jActions").hidden=false;
  }
}
$("#jRetry").onclick=()=>judge();$("#jHuman").onclick=()=>humanJudge();
function humanJudge(){
  const w=G.words[G.round];
  $("#rLabel").textContent=`Round ${G.round+1} · score together how much each looks like`;$("#rTitle").textContent=up(w);
  $("#rCards").innerHTML=G.items.map((it,i)=>`<div class="card"><img alt="${esc(it.u.name)}'s drawing" src="${snapshot(it.strokes,256)}"><div style="min-width:0"><div class="nm">${esc(it.u.name)}</div><input type="range" id="hj${i}" min="0" max="100" step="5" value="50" aria-label="Score for ${esc(it.u.name)}"></div><div class="pc" id="hv${i}">50%</div></div>`).join("");
  G.items.forEach((_,i)=>$("#hj"+i).oninput=e=>$("#hv"+i).textContent=e.target.value+"%");
  $("#rTotals").hidden=true;$("#rNext").textContent="Confirm scores";
  $("#rNext").onclick=()=>{G.items.forEach((it,i)=>{it.acc=+$("#hj"+i).value;it.guess=null;it.why=null});showRound()};
  show("s-res");
}
function showRound(){
  const w=G.words[G.round];G.items.forEach(it=>{it.u.total+=it.acc;it.u.hist.push(it.acc)});
  const sorted=[...G.items].sort((a,b)=>b.acc-a.acc),top=sorted[0]&&sorted[0].acc>0&&(!sorted[1]||sorted[0].acc>sorted[1].acc);
  $("#rLabel").textContent=`Round ${G.round+1} of ${G.words.length} · object`;$("#rTitle").textContent=up(w);
  $("#rCards").innerHTML=sorted.map((it,i)=>`<div class="card${i===0&&top?" win":""}"><img alt="${esc(it.u.name)}'s drawing" src="${snapshot(it.strokes,256)}"><div style="min-width:0"><div class="nm">${esc(it.u.name)}${i===0&&top?" · wins the round":""}</div>${it.guess?`<div class="gs">The AI sees: ${esc(it.guess)}</div>`:""}${it.why?`<div class="gs why">${esc(it.why)}</div>`:""}<div class="meter"><i style="width:${it.acc}%"></i></div></div><div class="pc">${it.acc}%</div></div>`).join("");
  const tot=[...G.units].sort((a,b)=>b.total-a.total);
  $("#rTotals").hidden=false;$("#rTotals").innerHTML=`<span class="label">Running average</span>`+tot.map(u=>`<div class="setting"><span>${esc(u.name)}</span><span class="clock" style="font-size:18px">${Math.round(u.total/u.hist.length)}%</span></div>`).join("");
  const last=G.round>=G.words.length-1;$("#rNext").textContent=last?"See final results":"Next round";
  $("#rNext").onclick=()=>{if(last)return finalScreen();G.round++;startRound()};
  show("s-res");
}
function finalScreen(){
  const tot=[...G.units].map(u=>({...u,avg:Math.round(u.total/u.hist.length)})).sort((a,b)=>b.avg-a.avg);
  const tie=tot.length>1&&tot[0].avg===tot[1].avg;
  $("#fWin").textContent=tie?"It's a tie!":tot[0].name;
  $("#fInfo").textContent=tie?`Tied at ${tot[0].avg}% average accuracy.`:`${tot[0].avg}% average accuracy over ${G.words.length} round${G.words.length===1?"":"s"}.`;
  $("#fCards").innerHTML=tot.map((u,i)=>`<div class="card${i===0?" win":""}" style="grid-template-columns:1fr auto"><div style="min-width:0"><div class="nm">${i+1}. ${esc(u.name)}</div><div class="gs">Rounds: ${u.hist.map(h=>h+"%").join(" · ")}${G.mode==="teams"?" · "+u.members.map(m=>esc(G.names[m])).join(" & "):""}</div><div class="meter"><i style="width:${u.avg}%"></i></div></div><div class="pc">${u.avg}%</div></div>`).join("");
  show("s-final");
}
$("#fAgain").onclick=()=>newMatch();$("#fHome").onclick=()=>show("s-play");

/* ---------- Impostor ---------- */
function newImpostor(names){
  const pair=shuffle(PAIRS[Math.random()*PAIRS.length|0]);
  G={mode:"impostor",names,main:pair[0],decoy:pair[1],imp:Math.random()*names.length|0,draws:names.map(()=>[]),order:shuffle(names.map((_,i)=>i)),step:0,votes:[]};
  keepAwake();impTurn();
}
function impTurn(){
  if(G.step>=G.order.length)return gallery();
  const p=G.order[G.step],w=p===G.imp?G.decoy:G.main;
  handoff({who:G.names[p],info:`Turn ${G.step+1} of ${G.order.length}. Nobody else should look at the screen.`,word:w,hint:"Tap \"I'm ready\" after you see your object.",
    onGo:()=>startDraw({who:`${G.names[p]} · turn ${G.step+1}`,word:w,ref:refFor(w)?.emoji,strokes:G.draws[p],dur:S.time.impostor,onEnd:()=>{G.step++;impTurn()}})});
}
let galTimer=0;
function gallery(){
  $("#gGrid").innerHTML=G.order.map(p=>`<figure><img alt="${esc(G.names[p])}'s drawing" src="${snapshot(G.draws[p],300)}"><figcaption>${esc(G.names[p])}</figcaption></figure>`).join("");
  const t0=performance.now(),btn=$("#gVote");btn.disabled=true;
  clearInterval(galTimer);galTimer=setInterval(()=>{const s=Math.floor((performance.now()-t0)/1000);$("#gClock").textContent=`${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`;
    if(s<S.disc){btn.disabled=true;btn.textContent=`Voting in ${S.disc-s} s`}else{btn.disabled=false;btn.textContent="Start voting"}},250);
  btn.onclick=()=>{clearInterval(galTimer);G.votes=[];voteTurn(0)};
  show("s-gal");
}
function voteTurn(i){
  if(i>=G.names.length)return reveal();
  handoff({who:G.names[i],label:"Secret vote · pass the phone to",info:"Nobody else should see your vote.",go:"Vote",onGo:()=>{
    $("#vWho").textContent=G.names[i];
    $("#vList").innerHTML=G.names.map((n,j)=>j===i?"":`<button class="btn" data-v="${j}">${esc(n)}</button>`).join("");
    $("#vList").onclick=e=>{const v=e.target.dataset.v;if(v==null)return;G.votes[i]=+v;voteTurn(i+1)};
    show("s-vote")}});
}
function reveal(){
  const count=G.names.map((_,j)=>G.votes.filter(v=>v===j).length);const max=Math.max(...count);const top=count.map((c,j)=>c===max?j:-1).filter(j=>j>=0);
  const caught=top.length===1&&top[0]===G.imp;const out=top.length===1?G.names[top[0]]:null;
  $("#vvLabel").textContent=out?`Eliminated: ${out}`:"The vote is tied";
  $("#vvTitle").textContent=caught?"You caught the impostor!":"The impostor wins";
  $("#vvInfo").textContent=`The impostor was ${G.names[G.imp]}. The object was "${G.main}" and the impostor drew "${G.decoy}".`;
  $("#vvCards").innerHTML=G.order.map(p=>`<div class="card${p===G.imp?" win":""}"><img alt="${esc(G.names[p])}'s drawing" src="${snapshot(G.draws[p],256)}"><div style="min-width:0"><div class="nm">${esc(G.names[p])}${p===G.imp?" · impostor":""}</div><div class="gs">Drew: ${esc(p===G.imp?G.decoy:G.main)}</div></div><div class="pc">${count[p]}<span class="gs"> vote${count[p]===1?"":"s"}</span></div></div>`).join("");
  show("s-rev");
}
$("#vvAgain").onclick=()=>newMatch();$("#vvHome").onclick=()=>show("s-play");

