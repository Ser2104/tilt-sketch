/* ---------- Daily challenge and Levels ---------- */
const WORLDS=[
  {name:"First lines",time:25,pass:35,items:["sun","moon","star","cloud","tree","house","rainbow","lightning"]},
  {name:"Around the house",time:22,pass:40,items:["cup","key","clock","umbrella","hat","shoe","light bulb","candle"]},
  {name:"Animals",time:20,pass:45,items:["fish","snail","cat","owl","whale","spider","rabbit","frog"]},
  {name:"Heroes and legends",time:20,pass:50,items:["crown","sword","helmet","diamond","skull","dragon","angel","mermaid"]},
  {name:"Masters",time:18,pass:55,items:["bicycle","guitar","helicopter","elephant","giraffe","lighthouse","Eiffel Tower","castle"]}
];
const LEVEL_LIST=WORLDS.flatMap((w,wi)=>w.items.map((word,i)=>({word,world:wi,index:i,time:w.time,pass:w.pass})));
let DAILY_TIME=25;
const store={get(k,d){try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch(_){return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(_){}}};
function todayUTC(){return new Date().toISOString().slice(0,10)}
function dailyWord(date=todayUTC()){let h=2166136261;for(const c of"tilt-"+date)h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;return WORDS[h%WORDS.length]}
function starsFor(score,pass){return score>=Math.min(95,pass+35)?3:score>=pass+20?2:score>=pass?1:0}
function levelState(){return store.get("ts-levels",{unlocked:0,best:{}})}
function totalStars(st){return LEVEL_LIST.reduce((s,l,i)=>s+starsFor(st.best[i]||0,l.pass),0)}
function playerName(){const n=($("#myName")&&$("#myName").value.trim())||Profiles.cur()?.name||store.get("ts-rank-name","");return n}
function stars(n){return"★".repeat(n)+"☆".repeat(3-n)}

function renderChallengeCards(){
  const d=store.get("ts-daily-"+todayUTC(),null),st=levelState(),lv=Math.min(st.unlocked,LEVEL_LIST.length-1),L=LEVEL_LIST[lv];
  $("#cDaily").innerHTML=`<b>Daily challenge</b><span>${d?`Today: ${d.score}% on ${esc(d.word)}`:`Today's object is the same for everyone. One try.`}</span>`;
  const gs=store.get("ts-guided",{unlocked:0,best:{}});
  $("#cGuided").innerHTML=`<b>Guided drawings</b><span>Trace heroes, rockets, animals… No time limit · ${GUIDED.reduce((s,_,i)=>s+gStars(gs.best[i]||0),0)} ★</span>`;
  $("#cLevels").innerHTML=`<b>Levels</b><span>${st.unlocked>=LEVEL_LIST.length?"All levels complete":`${esc(WORLDS[L.world].name)} · level ${L.world*8+L.index+1} of ${LEVEL_LIST.length}`} · ${totalStars(st)} ★</span>`;
}
async function judgeOne(word,strokes){
  while(AI.state==="wait")await new Promise(r=>setTimeout(r,200));
  if(AI.state!=="ok")return{acc:0,guess:"AI unavailable"};
  const[r]=await aiJudge(word,[{strokes}]);return r}
function playChallenge({word,time,label,onScore}){
  handoff({label,who:up(word),ref:refFor(word),info:`You have ${time} seconds. Draw it so the AI can recognize it. Scribbles score zero.`,hint:S.ctrl==="look"?"Hold the phone up like a camera before you tap.":"Hold the phone comfortably before you tap.",go:"Start drawing",
    onGo:()=>startDraw({who:label,word,strokes:[],dur:time,ref:refFor(word)?.emoji,onEnd:async()=>{const strokes=D.strokes.slice();showWait({title:"The AI is looking at your drawing",sub:"",chips:[]});
      const r=await judgeOne(word,strokes);CR_OFFER={word,strokes,r};CR_TOP=r;onScore(r,snapshot(strokes,240))},onError:()=>show("s-home")})});
}
let CR_OFFER=null,CR_TOP=null;
function showChallengeResult({label,title,score,img,info,starsN,actions}){
  $("#crLabel").textContent=label;$("#crTitle").textContent=title;$("#crScore").textContent=score+"%";$("#crImg").src=img;$("#crInfo").textContent=info;
  $("#crStars").textContent=starsN==null?"":stars(starsN);$("#crStars").hidden=starsN==null;
  const f=$("#crActions");f.innerHTML="";actions.forEach((a,i)=>{const b=document.createElement("button");b.className="btn"+(i===0?" primary big":"");b.textContent=a.text;b.onclick=a.fn;f.append(b)});
  $("#crTop").innerHTML=CR_TOP?explainHTML(CR_TOP):"";CR_TOP=null;
  const o=CR_OFFER;CR_OFFER=null;$("#crDonate").hidden=true;if(o&&typeof Donate!=="undefined")Donate.offer(o.word,o.strokes,o.r);
  show("s-cres");say(`${score} percent`)}

async function startDaily(){
  if(!(await readyToDraw()))return;
  const date=todayUTC(),word=dailyWord(date),prev=store.get("ts-daily-"+date,null);
  playChallenge({word,time:DAILY_TIME,label:prev?"Daily challenge · practice try":"Daily challenge · official try",onScore:async(r,img)=>{
    let info;
    if(!prev){store.set("ts-daily-"+date,{word,score:r.acc,date});const n=playerName();
      if(Rank.on()&&n){const ok=await Rank.submit("daily-"+date,n,r.acc);info=ok?"Your score is on today's ranking.":"Could not reach the ranking. Your score is saved on this phone."}
      else info=Rank.on()?"Add your name in the ranking screen to appear on it.":"Saved on this phone. Shared ranking is not connected yet.";}
    else info=`Practice only. Your official score today is ${prev.score}%.`;
    showChallengeResult({label:"Daily challenge · "+date,title:`The AI sees: ${r.guess}`,score:r.acc,img,info,starsN:null,actions:[
      {text:"See today's ranking",fn:()=>openRanking("daily")},{text:"Share result",fn:()=>shareText(`Tilt Sketch daily ${date}: I drew "${word}" and scored ${prev?prev.score:r.acc}%. Can you beat it? ${location.origin+location.pathname}`)},{text:"Back to home",fn:()=>{renderChallengeCards();show("s-home")}}]})}});
}
async function shareText(t){t=I18N.t(t);try{if(navigator.share){await navigator.share({text:t});return}}catch(_){return}try{await navigator.clipboard.writeText(t);alertMsg("Copied to clipboard")}catch(_){alertMsg(t)}}
function alertMsg(t){$("#crInfo").textContent=t}

function openLevels(){
  const st=levelState();
  $("#lvStars").textContent=`${totalStars(st)} of ${LEVEL_LIST.length*3} ★ · level ${Math.min(st.unlocked+1,LEVEL_LIST.length)} of ${LEVEL_LIST.length}`;
  $("#lvWorlds").innerHTML=WORLDS.map((w,wi)=>`<section class="world"><div class="setting"><span class="label">World ${wi+1} · ${esc(w.name)}</span><span class="tag">${w.time} s · pass ${w.pass}%</span></div><div class="lvgrid">${w.items.map((word,i)=>{const k=wi*8+i,open=k<=st.unlocked,b=st.best[k];
    return`<button class="lv${open?"":" locked"}" data-k="${k}" ${open?"":"disabled"} aria-label="Level ${k+1}: ${open?esc(word):"locked"}"><b>${k+1}</b><span>${open?esc(word):"🔒"}</span><i>${b!=null?stars(starsFor(b,w.pass)):""}</i></button>`}).join("")}</div></section>`).join("");
  show("s-levels");
}
$("#lvWorlds").onclick=async e=>{const b=e.target.closest(".lv");if(!b||b.disabled)return;if(!(await readyToDraw()))return;playLevel(+b.dataset.k)};
function playLevel(k){
  const L=LEVEL_LIST[k];
  playChallenge({word:L.word,time:L.time,label:`Level ${k+1} · ${WORLDS[L.world].name}`,onScore:async(r,img)=>{
    const st=levelState(),prevBest=st.best[k]||0;st.best[k]=Math.max(prevBest,r.acc);
    const passed=r.acc>=L.pass;if(passed&&st.unlocked===k)st.unlocked=Math.min(LEVEL_LIST.length,k+1);store.set("ts-levels",st);
    const n=playerName();let sync="";
    if(passed&&Rank.on()&&n)sync=(await Rank.submit("levels",n,0,st.unlocked,totalStars(st)))?" Ranking updated.":"";
    const s=starsFor(r.acc,L.pass);
    const actions=[];if(passed&&k+1<LEVEL_LIST.length)actions.push({text:`Next level: ${LEVEL_LIST[k+1].word}`,fn:()=>playLevel(k+1)});
    actions.push({text:passed?"Try for more stars":"Try again",fn:()=>playLevel(k)},{text:"All levels",fn:openLevels},{text:"Levels ranking",fn:()=>openRanking("levels")});
    showChallengeResult({label:`Level ${k+1} · ${L.word}`,title:passed?(k+1===LEVEL_LIST.length?"You finished every level!":"Level passed"):`Need ${L.pass}% to pass`,score:r.acc,img,
      info:`The AI sees: ${r.guess}.${passed?"":" Draw the outline clearly and keep it simple."}${sync}`,starsN:s,actions})}});
}

let rankTab="daily";
async function openRanking(tab=rankTab){
  rankTab=tab;document.querySelectorAll("#rkTabs button").forEach(b=>b.setAttribute("aria-pressed",b.dataset.tab===tab));
  $("#rkName").value=playerName();show("s-rank");
  const list=$("#rkList"),me=playerName();
  const local=tab==="daily"?(()=>{const d=store.get("ts-daily-"+todayUTC(),null);return d?[{player:me||"You",score:d.score}]:[]})():tab==="guided"?(()=>{const st=guidedState();return st.unlocked||Object.keys(st.best).length?[{player:me||"You",level:st.unlocked,stars:guidedStars(st)}]:[]})():(()=>{const st=levelState();return st.unlocked||Object.keys(st.best).length?[{player:me||"You",level:st.unlocked,stars:totalStars(st)}]:[]})();
  $("#rkTitle").textContent=tab==="daily"?`Today · ${dailyWord()} · ${todayUTC()}`:tab==="guided"?"Most figures traced":"Highest level reached";
  if(!Rank.on()){$("#rkStatus").textContent="Shared ranking is not connected yet, so this shows only your own result on this phone.";render(local);return}
  $("#rkStatus").textContent="Loading…";list.innerHTML="";
  const rows=await Rank.top(tab==="daily"?"daily-"+todayUTC():tab);
  if(!rows){$("#rkStatus").textContent="Could not reach the ranking. Showing your result on this phone.";render(local);return}
  $("#rkStatus").textContent=rows.length?"":"No one is on the board yet. Be the first!";render(rows);
  function render(rows){list.innerHTML=rows.map((r,i)=>`<li class="${r.player===me?"me":""}"><span class="pos">${i+1}</span><span class="who">${esc(r.player)}</span><span class="val">${tab==="daily"?r.score+"%":tab==="guided"?`${r.level} figures · ${r.stars} ★`:`Level ${r.level} · ${r.stars} ★`}</span></li>`).join("")}
}
$("#rkTabs").onclick=e=>{const t=e.target.dataset.tab;if(t)openRanking(t)};
$("#rkSave").onclick=async()=>{const n=$("#rkName").value.trim().slice(0,24);if(!n){$("#rkName").focus();return}store.set("ts-rank-name",n);if($("#myName")&&!$("#myName").value)$("#myName").value=n;
  const d=store.get("ts-daily-"+todayUTC(),null),st=levelState();
  const gst=guidedState();
  if(Rank.on()){if(d)await Rank.submit("daily-"+todayUTC(),n,d.score);if(st.unlocked)await Rank.submit("levels",n,0,st.unlocked,totalStars(st));if(gst.unlocked)await Rank.submit("guided",n,0,gst.unlocked,guidedStars(gst))}
  openRanking()};
$("#rkBack").onclick=()=>{renderChallengeCards();show("s-home")};
$("#cDaily").onclick=()=>startDaily();
$("#cLevels").onclick=()=>openLevels();
$("#cRank").onclick=()=>openRanking("daily");
$("#lvBack").onclick=()=>{renderChallengeCards();show("s-home")};
$("#lvRank").onclick=()=>openRanking("levels");
