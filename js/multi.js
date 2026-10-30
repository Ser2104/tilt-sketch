/* ---------- Multiple phones ---------- */
const PFX="tiltsketch-v1-";
const NET={peer:null,isHost:false,code:"",me:null,name:"",conns:new Map(),hostConn:null,players:[],busy:false};
let H=null,mgTimer=0;
function peerOpts(){const q=new URLSearchParams(location.search),h=q.get("peerhost");
  return h?{host:h,port:+(q.get("peerport")||9000),path:q.get("peerpath")||"/",secure:q.get("peersecure")==="1",debug:0}:{debug:0}}
function newCode(){const A="ABCDEFGHJKLMNPQRSTUVWXYZ";return Array.from({length:4},()=>A[Math.random()*A.length|0]).join("")}
function netMsg(t){$("#netMsg").textContent=t}
function inviteLink(){const u=new URL(PUBLIC_URL);const q=new URLSearchParams(location.search);["peerhost","peerport","peerpath","peersecure"].forEach(k=>q.get(k)&&u.searchParams.set(k,q.get(k)));u.searchParams.set("room",NET.code);return u.toString()}
function setPlay(p){S.play=p;document.querySelectorAll("#playSeg button").forEach(b=>b.setAttribute("aria-pressed",b.dataset.play===p));
  $("#multiBox").hidden=p!=="multi";$("#playersPanel").hidden=p==="multi";$("#oneFoot").hidden=p==="multi"}
$("#playSeg").onclick=e=>{const p=e.target.dataset.play;if(p==="practice")return openPractice();if(p)setPlay(p)};
function showGyroHelp(){openSettings();$("#gyroStatus").scrollIntoView({behavior:"smooth",block:"center"})}
async function readyToDraw(){if(S.input==="gyro"&&S.gyro!=="ok"&&!(await testGyro())){showGyroHelp();return false}return true}
function myName(){const n=$("#myName").value.trim();if(!n){netMsg("Enter your name first.");$("#myName").focus();return null}if(!nameOk(n)){netMsg("Please choose another name.");$("#myName").focus();return null}try{localStorage.setItem("ts-name",n)}catch(_){}return n}
try{$("#myName").value=localStorage.getItem("ts-name")||""}catch(_){}

$("#createRoom").onclick=async()=>{
  const name=myName();if(!name||!(await readyToDraw()))return;
  if(typeof Peer==="undefined"){netMsg("Multiplayer could not load. Check your connection and reload.");return}
  netMsg("Creating room…");NET.isHost=true;NET.name=name;
  if(Relay.usable()){const tryCode=(left=4)=>{NET.code=newCode();const r=Relay.host(NET.code,{
      onOpen:()=>{if(NET.peer!==r)return;NET.me="host";NET.players=[{id:"host",name}];netMsg("");keepAwake();showLobby();hostLobby()},
      onConnection:c=>{c.on("data",d=>hostRecv(c.peer,d,c));c.on("close",()=>dropPlayer(c.peer))},
      onError:e=>{if(NET.peer!==r)return;if(e==="TAKEN"&&left>0)return tryCode(left-1);NET.peer=null;NET.code="";netMsg("Could not create the room ("+e+"). Check your connection and try again.")}});
    NET.peer=r};tryCode();return}
  const open=()=>{NET.code=newCode();const p=new Peer(PFX+NET.code,peerOpts());NET.peer=p;
    p.on("open",()=>{NET.me="host";NET.players=[{id:"host",name}];netMsg("");keepAwake();showLobby();hostLobby()});
    p.on("connection",c=>{c.on("data",d=>hostRecv(c.peer,d,c));c.on("close",()=>dropPlayer(c.peer));c.on("error",()=>dropPlayer(c.peer))});
    p.on("disconnected",()=>{if(!p.destroyed&&(p._rc=(p._rc||0)+1)<=5)setTimeout(()=>{try{p.reconnect()}catch(_){}},1500)});
    p.on("error",e=>{if(e.type==="unavailable-id"){p.destroy();open()}else if(!NET.code||!$("#s-play").hidden)netMsg("Could not create the room ("+e.type+"). Check your connection and try again.")})};
  open();
};
$("#joinRoom").onclick=async()=>{
  const name=myName();const code=$("#joinCode").value.trim().toUpperCase();
  if(!name)return;if(!/^[A-Z]{4}$/.test(code)){netMsg("Enter the 4-letter room code.");return}
  if(!(await readyToDraw()))return;
  if(typeof Peer==="undefined"){netMsg("Multiplayer could not load. Check your connection and reload.");return}
  netMsg("Joining room "+code+"…");NET.isHost=false;NET.name=name;NET.code=code;
  if(Relay.usable()){const r=Relay.guest(code,{
      onOpen:hc=>{if(NET.peer!==r)return;NET.hostConn=hc;hc.on("data",clientRecv);hc.on("close",()=>{if(NET.peer===r)leaveRoom("The host left the room.")});hc.send({t:"hello",name});keepAwake()},
      onNotFound:()=>{if(NET.peer===r){r.destroy();NET.peer=null;NET.code="";netMsg("Room "+code+" was not found. Check the code and that the host has the room open.")}},
      onError:e=>{if(NET.peer===r){r.destroy();NET.peer=null;NET.code="";netMsg("Could not join ("+e+"). Check your connection and try again.")}}});
    NET.peer=r;return}
  const p=new Peer(peerOpts());NET.peer=p;
  const fail=setTimeout(()=>{if(!NET.hostConn||!NET.hostConn.open){netMsg("Could not reach room "+code+". Check the code and that the host has the lobby open.");p.destroy()}},12000);
  p.on("open",()=>{const c=p.connect(PFX+code,{reliable:true});NET.hostConn=c;
    c.on("open",()=>{clearTimeout(fail);c.send({t:"hello",name});keepAwake()});
    c.on("data",clientRecv);
    c.on("close",()=>{if(NET.peer===p)leaveRoom("The host left the room.")})});
  p.on("error",e=>{clearTimeout(fail);netMsg(e.type==="peer-unavailable"?"Room "+code+" was not found. Check the code.":"Could not join ("+e.type+"). Try again.")});
};
function setInvite(code){
  const on=!!code;$("#s-play").classList.toggle("invite",on);if(on)show("s-play");$("#inviteTitle").hidden=!on;
  if(on){setPlay("multi");$("#joinCode").value=code;$("#inviteTitle").textContent="Join room "+code;$("#joinCode").hidden=true;$("#joinRoom").textContent="Join room "+code;$("#joinRoom").className="btn go big";$("#joinRoom").style.cssText="flex:1";
    netMsg("Enter your name and tap Join. If your phone asks for motion access, tap Allow.");$("#cancelInvite").hidden=false}
  else{$("#joinCode").hidden=false;$("#joinRoom").textContent="Join";$("#joinRoom").className="btn go";$("#joinRoom").style.cssText="padding:14px 22px";$("#cancelInvite").hidden=true;netMsg("")}
}
const qp=(new URLSearchParams(location.search).get("room")||"").toUpperCase().replace(/[^A-Z]/g,"").slice(0,4);

function leaveRoom(msg){
  if(typeof D!=="undefined"&&D.state!=="idle")abortDraw();
  const p=NET.peer;NET.peer=null;H=null;clearInterval(mgTimer);
  try{if(NET.isHost)broadcast({t:"closed"})}catch(_){}
  setTimeout(()=>{try{p&&p.destroy()}catch(_){}},200);
  NET.conns.clear();NET.hostConn=null;NET.players=[];NET.code="";
  const tp=$("#timePanel");if(tp.parentNode===$("#lSettings"))$("#s-play").insertBefore(tp,$("#multiBox"));
  show("s-play");setInvite("");setPlay("multi");netMsg(msg||"");
}
$("#lLeave").onclick=()=>leaveRoom("");
$("#lCopy").onclick=async e=>{const t=inviteLink();try{await navigator.clipboard.writeText(t);e.target.textContent="Link copied"}catch(_){e.target.textContent=t}setTimeout(()=>e.target.textContent="Copy invite link",2500)};

function packStrokes(st){return(st||[]).map(s=>({c:s.c,w:+(+s.w).toFixed(4),pts:s.pts.map(p=>[+p[0].toFixed(4),+p[1].toFixed(4)])}))}
function safeStrokes(st){if(!Array.isArray(st))return[];const n=v=>Number.isFinite(+v)?Math.max(-1,Math.min(2,+v)):0;
  return st.slice(0,400).filter(s=>s&&Array.isArray(s.pts)).map(s=>({c:/^#[0-9A-Fa-f]{6}$/.test(s.c)?s.c:"#13213C",w:Math.max(.001,Math.min(.05,+s.w||.008)),pts:s.pts.slice(0,4000).filter(p=>Array.isArray(p)).map(p=>[n(p[0]),n(p[1])])}))}
function sendTo(id,msg){if(id==="host")setTimeout(()=>clientRecv(msg),0);else{const c=NET.conns.get(id);if(c&&c.open)c.send(msg)}}
function broadcast(msg){NET.players.forEach(p=>sendTo(p.id,msg))}
function toHost(msg){if(NET.isHost)setTimeout(()=>hostRecv("host",msg),0);else if(NET.hostConn&&NET.hostConn.open)NET.hostConn.send(msg)}

function hostRecv(id,d,c){
  if(!NET.isHost||!d)return;
  if(d.t==="hello"){
    if(!c)return;if(H){c.send({t:"busy",over:H.phase==="done"||!!H.over});return}
    if(NET.players.length>=12&&!NET.players.some(p=>p.id===id)){c.send({t:"full"});return}
    NET.conns.set(id,c);if(NET.players.some(p=>p.id===id)){hostLobby();return}
    const base=nameOk(d.name)&&String(d.name||"").trim()?String(d.name).trim().slice(0,14):"Player";let name=base,n=2;while(NET.players.some(p=>p.name===name))name=base.slice(0,12)+" "+n++;
    NET.players.push({id,name});hostLobby();return}
  if(!H)return;
  if(d.t==="done")H.done&&H.done(id,d);
  if(d.t==="vote")H.vote&&H.vote(id,d);
}
function dropPlayer(id){
  if(!NET.isHost)return;const i=NET.players.findIndex(p=>p.id===id);if(i<0)return;
  NET.players.splice(i,1);NET.conns.delete(id);
  if(!H)hostLobby();else H.left&&H.left(id);
}
function modeName(m){return{solo:"Solo",teams:"Teams",impostor:"Impostor"}[m]}
function hostLobby(){
  const teams=S.mode==="teams"?teamsOf(NET.players):null;
  const rules=S.mode==="impostor"?`${S.time.impostor} s to draw · ${S.disc} s discussion · ${S.vote} s to vote`:`${S.time[S.mode]} s per turn · ${S.rounds} round${S.rounds===1?"":"s"}`;
  broadcast({t:"lobby",code:NET.code,mode:S.mode,rules,players:NET.players.map((p,i)=>({id:p.id,name:p.name,team:teams?teams.findIndex(t=>t.includes(i))+1:0}))});
}
function clientRecv(d){
  if(!d)return;
  switch(d.t){
    case"lobby":NET.view=d;showLobby();break;
    case"draw":remoteDraw(d);break;
    case"wait":showWait(d);break;
    case"board":showBoard(d);break;
    case"gallery":showGalleryM(d);break;
    case"abort":abortDraw();showWait({title:"Time's up",sub:d.sub||"The game moved on.",chips:[]});break;
    case"busy":leaveRoom(d.over?"That game just ended. Ask the host to go back to the lobby, then join again.":"That room is in the middle of a game. Wait for it to end and join again.");break;
    case"full":leaveRoom("That room is full (12 players).");break;
    case"closed":if(!NET.isHost)leaveRoom("The host closed the room.");break;
  }
}
function showLobby(){
  const v=NET.view||{code:NET.code,mode:S.mode,players:NET.players};
  $("#lCode").textContent=v.code||NET.code;
  if(NET.isHost&&$("#lQr").dataset.code!==NET.code&&typeof qrcode!=="undefined"){const q=qrcode(0,"M");q.addData(inviteLink());q.make();$("#lQr").innerHTML=q.createSvgTag({cellSize:6,margin:0,scalable:true});$("#lQr").dataset.code=NET.code}
  $("#lQr").hidden=!NET.isHost;$("#lScan").hidden=!NET.isHost;$("#lCopy").hidden=!NET.isHost;$("#lHow").textContent=NET.isHost?"Friends scan the QR, or open the game, choose Multiple phones and enter this code.":"You're in. Keep this screen open.";
  $("#lRules").textContent=v.rules||"";
  const tp=$("#timePanel");if(NET.isHost){if(tp.parentNode!==$("#lSettings")){$("#lSettings").append(tp);tp.open=true}}else if(tp.parentNode===$("#lSettings"))$("#s-play").insertBefore(tp,$("#multiBox"));
  $("#lMode").textContent=modeName(v.mode);$("#lMode").hidden=NET.isHost;$("#lModes").hidden=!NET.isHost;
  document.querySelectorAll("#lModes button").forEach(b=>b.setAttribute("aria-pressed",b.dataset.m===v.mode));
  $("#lCount").textContent=`Players · ${v.players.length}`;
  $("#lPlayers").innerHTML=v.players.map(p=>`<div class="prow"><span>${esc(p.name)}${p.id===(NET.isHost?"host":NET.peer&&NET.peer.id)?" (you)":""}${p.id==="host"?" · host":""}</span>${p.team?`<span class="tag">Team ${p.team}</span>`:""}</div>`).join("");
  const ok=v.players.length>=MIN[v.mode];
  $("#lMin").textContent=ok?(v.mode==="teams"?"Teams are pairs in joining order.":""):`${modeName(v.mode)} needs at least ${MIN[v.mode]} players.`;
  $("#lStart").hidden=!NET.isHost;$("#lStart").disabled=!ok;$("#lWait").hidden=NET.isHost;
  show("s-lobby");
}
$("#lStart").onclick=()=>{if(NET.isHost)hostStart()};
$("#lModes").onclick=e=>{const m=e.target.dataset.m;if(!m||!NET.isHost||H)return;S.mode=m;document.querySelectorAll(".mode").forEach(b=>b.setAttribute("aria-pressed",b.dataset.mode===m));syncSettings();renderPlayers();hostLobby()};
function showWait(d){$("#wTitle").textContent=d.title||"Waiting for the others";$("#wSub").textContent=d.sub||"";
  $("#wChips").innerHTML=(d.chips||[]).map(c=>`<span class="chip${c.done?" done":""}">${esc(c.name)}${c.done?" ✓":""}</span>`).join("");show("s-wait")}
let autoGo=0;
function remoteDraw(d){
  clearInterval(autoGo);
  handoff({label:d.label||"Your object",who:up(d.word),ref:refFor(d.word),info:d.info||"",hint:d.hint||"",thumb:d.strokes&&d.strokes.length?thumbWithMark(safeStrokes(d.strokes),d.mark):null,go:"Start drawing",
    onGo:()=>startDraw({who:d.who,word:d.word,ref:refFor(d.word)?.emoji,live:true,strokes:safeStrokes(d.strokes),dur:Math.max(3,Math.min(180,+d.dur||15)),mark:Array.isArray(d.mark)?d.mark.slice(0,2).map(Number):null,
      onEnd:lp=>{if(!NET.code)return;toHost({t:"done",turn:d.turn,strokes:packStrokes(D.strokes),last:lp});showWait({title:"Nice! Waiting for the others",sub:"",chips:[]})}})});
  let left=d.prep||10;const btn=$("#hGo"),tick=()=>{if($("#s-hand").hidden){clearInterval(autoGo);return}if(left<=0){clearInterval(autoGo);btn.click();return}btn.textContent=`Start drawing · auto in ${left}`;left--};
  tick();autoGo=setInterval(tick,1000);
}
function cardHTML(c){const img=imgOk(c.img);return`<div class="card${c.win?" win":""}"${img?"":' style="grid-template-columns:1fr auto"'}>${img?`<img alt="${esc(c.name)}'s drawing" src="${img}">`:""}<div style="min-width:0"><div class="nm">${esc(c.name)}</div>${c.sub?`<div class="gs">${esc(c.sub)}</div>`:""}${c.meter!=null?`<div class="meter"><i style="width:${pct(c.meter)}%"></i></div>`:""}</div><div class="pc">${esc(c.pc)}</div></div>`}
function showBoard(d){
  clearInterval(mgTimer);
  $("#bLabel").textContent=d.label||"";$("#bTitle").textContent=d.title||"";$("#bInfo").textContent=d.info||"";$("#bInfo").hidden=!d.info;
  $("#bBanner").style.borderColor=d.banner?"var(--accent)":"var(--line)";
  $("#bCards").innerHTML=(d.cards||[]).map(cardHTML).join("");
  const t=$("#bTotals");t.hidden=!d.totals;if(d.totals)t.innerHTML=`<span class="label">Running average</span>`+d.totals.map(u=>`<div class="setting"><span>${esc(u.name)}</span><span class="clock" style="font-size:18px">${pct(u.avg)}%</span></div>`).join("");
  const f=$("#bFoot");f.innerHTML="";
  if(NET.isHost)(d.actions||[]).forEach((a,i)=>{const b=document.createElement("button");b.className="btn"+(i===0?" primary big":"");b.textContent=a.text;b.onclick=()=>H&&H.action&&H.action(a.id);f.append(b)});
  else{const p=document.createElement("p");p.className="hint";p.textContent=d.waitText||"Waiting for the host…";f.append(p)}
  show("s-board");
}

function hostStart(){
  const players=NET.players.map(p=>({...p}));
  if(players.length<MIN[S.mode])return;
  if(S.mode==="impostor")return impStartM(players);
  const units=S.mode==="solo"?players.map(p=>({name:p.name,members:[p.id],total:0,hist:[]})):teamsOf(players).map((t,i)=>({name:"Team "+(i+1),members:t.map(k=>players[k].id),total:0,hist:[]}));
  H={mode:S.mode,players,units,words:shuffle(gameWords()).slice(0,S.rounds),round:0,stage:0,items:[],pending:new Map(),turn:0};
  H.done=(id,d)=>{const it=H.pending.get(id);if(!it||d.turn!==H.turn)return;it.strokes=Array.isArray(d.strokes)?safeStrokes(d.strokes):it.strokes;it.last=d.last||it.last;H.pending.delete(id);stageStatus();if(!H.pending.size)nextStage()};
  H.left=id=>{H.players=H.players.filter(p=>p.id!==id);if(H.pending.has(id)){H.pending.delete(id);stageStatus();if(!H.pending.size)nextStage()}};
  H.action=a=>{if(a==="next"){H.round++;startRoundM()}else if(a==="final")finalM();else if(a==="again")hostStart();else if(a==="lobby"){H=null;hostLobby()}};
  startRoundM();
}
const nameOf=id=>{const p=(H&&H.players.find(x=>x.id===id))||NET.players.find(x=>x.id===id);return p?p.name:"Someone"};
function startRoundM(){H.items=H.units.map(u=>({u,strokes:[],last:null}));H.stage=0;runStage()}
const PREP=10;
function armDeadline(extra){clearTimeout(H.timer);const turn=H.turn;H.timer=setTimeout(()=>{if(!H||H.turn!==turn||!H.pending.size)return;
  for(const id of[...H.pending.keys()])sendTo(id,{t:"abort",sub:"Your drawing time ran out, so the game continued."});
  H.pending.clear();nextStage()},(extra+PREP+6)*1000)}
function runStage(){
  const k=H.stage,w=H.words[H.round],team=H.mode==="teams",rl=`Round ${H.round+1} of ${H.words.length}`;
  H.turn++;H.pending=new Map();
  for(const it of H.items){const id=it.u.members[k];if(!id||!H.players.some(p=>p.id===id))continue;H.pending.set(id,it)}
  if(!H.pending.size){if(k===0||!H.items.some(it=>it.u.members.length>k))return judgeM();H.stage++;return runStage()}
  for(const[id,it]of H.pending){const cont=team&&k>0,prev=cont?nameOf(it.u.members[k-1]):"";
    sendTo(id,{t:"draw",turn:H.turn,word:w,dur:team?Math.round(S.time.teams*2/Math.max(2,it.u.members.length)):S.time[H.mode],strokes:cont?packStrokes(it.strokes):[],mark:cont?it.last:null,
      who:`${nameOf(id)}${team?" · "+it.u.name:""} · ${rl}`,label:cont?`You continue ${prev}'s drawing of`:team?`${it.u.name} · you start drawing`:rl+" · draw",
      info:cont?`The orange circle marks where ${prev} stopped. Your brush starts there.`:team?"When your time is up, the drawing jumps to your teammate's phone.":"Everyone draws at the same time. The AI judges after the timer.",
      hint:S.ctrl==="look"?"Hold the phone up like a camera before you tap.":"Hold the phone comfortably before you tap.",prep:PREP})}
  armDeadline(S.time[H.mode]);stageStatus();
}
function stageStatus(){
  if(!H||!H.pending)return;
  const chips=H.mode==="impostor"?H.players.map(p=>({name:p.name,done:!H.pending.has(p.id)})):[...H.items].flatMap(it=>it.u.members.map((id,k)=>({id,k}))).filter(x=>x.k===H.stage&&H.players.some(p=>p.id===x.id)).map(x=>({name:nameOf(x.id),done:!H.pending.has(x.id)}));
  const drawing=[...H.pending.keys()].map(nameOf);
  H.players.forEach(p=>{if(!H.pending.has(p.id))sendTo(p.id,{t:"wait",title:drawing.length?"Waiting for the others":"Everyone is done",sub:drawing.length?`Still drawing: ${drawing.join(", ")}`:"",chips})});
}
function nextStage(){clearTimeout(H.timer);if(H.mode==="impostor")return galleryM();H.stage++;if(H.items.some(it=>it.u.members.length>H.stage))runStage();else judgeM()}
async function judgeM(){
  const w=H.words[H.round];
  broadcast({t:"wait",title:"The AI is looking at the drawings",sub:`Which one looks most like "${w}"?`,chips:[]});
  while(AI.state==="wait")await new Promise(r=>setTimeout(r,200));
  let r;try{r=AI.state==="ok"?await aiJudge(w,H.items):null}catch(_){r=null}
  H.items.forEach((it,i)=>{it.acc=r?r[i].acc:0;it.guess=r?r[i].guess:"AI unavailable";it.why=r?explainShort(r[i]):"";it.u.total+=it.acc;it.u.hist.push(it.acc)});
  const sorted=[...H.items].sort((a,b)=>b.acc-a.acc),last=H.round>=H.words.length-1,top=sorted[0].acc>0&&(!sorted[1]||sorted[0].acc>sorted[1].acc);
  broadcast({t:"board",label:`Round ${H.round+1} of ${H.words.length} · object`,title:up(w),
    cards:sorted.map((it,i)=>({img:snapshot(it.strokes,200,"jpeg",true),name:it.u.name+(i===0&&top?" · wins the round":""),sub:`The AI sees: ${it.guess}`+(it.why?` (${it.why})`:"")+(H.mode==="teams"?" · "+it.u.members.map(nameOf).join(" & "):""),meter:it.acc,pc:it.acc+"%",win:i===0&&top})),
    totals:[...H.units].sort((a,b)=>b.total/b.hist.length-a.total/a.hist.length).map(u=>({name:u.name,avg:Math.round(u.total/u.hist.length)})),
    actions:[last?{id:"final",text:"See final results"}:{id:"next",text:"Next round"}],waitText:"Waiting for the host to continue…"});
}
function finalM(){
  H.over=true;
  const tot=H.units.map(u=>({...u,avg:Math.round(u.total/Math.max(1,u.hist.length))})).sort((a,b)=>b.avg-a.avg);
  const tie=tot.length>1&&tot[0].avg===tot[1].avg;
  broadcast({t:"board",banner:true,label:"Winner",title:tie?"It's a tie!":tot[0].name,info:tie?`Tied at ${tot[0].avg}% average accuracy.`:`${tot[0].avg}% average accuracy over ${H.words.length} round${H.words.length===1?"":"s"}.`,
    cards:tot.map((u,i)=>({name:`${i+1}. ${u.name}`,sub:"Rounds: "+u.hist.map(h=>h+"%").join(" · ")+(H.mode==="teams"?" · "+u.members.map(nameOf).join(" & "):""),meter:u.avg,pc:u.avg+"%",win:i===0})),
    actions:[{id:"again",text:"Play again"},{id:"lobby",text:"Back to lobby"}],waitText:"Waiting for the host…"});
}

function impStartM(players){
  const pair=shuffle(PAIRS[Math.random()*PAIRS.length|0]);
  H={mode:"impostor",players,main:pair[0],decoy:pair[1],imp:players[Math.random()*players.length|0].id,draws:{},pending:new Map(),turn:1,votes:{}};
  H.impName=(players.find(p=>p.id===H.imp)||{}).name||"Someone";
  H.done=(id,d)=>{if(!H.pending.has(id)||d.turn!==H.turn)return;H.draws[id]=safeStrokes(d.strokes);H.pending.delete(id);stageStatus();if(!H.pending.size)galleryM()};
  H.vote=(id,d)=>{if(H.phase!=="vote"||H.votes[id]!=null||!H.players.some(p=>p.id===d.v))return;H.votes[id]=d.v;voteStatus()};
  H.left=id=>{if(id===H.imp&&H.phase!=="done"){H.phase="done";clearTimeout(H.timer);clearTimeout(H.voteTimer);
      broadcast({t:"board",banner:true,label:"Round over",title:"The impostor left",info:`${H.impName} was the impostor and left the game, so nobody wins this round.`,cards:[],
        actions:[{id:"again",text:"Play again"},{id:"lobby",text:"Back to lobby"}],waitText:"Waiting for the host…"});return}
    H.players=H.players.filter(p=>p.id!==id);if(H.pending.has(id)){H.pending.delete(id);if(!H.pending.size)galleryM()}else if(H.phase==="vote")voteStatus()};
  H.action=a=>{if(a==="again")impStartM(NET.players.map(p=>({...p})));else if(a==="lobby"){H=null;hostLobby()}};
  players.forEach(p=>H.pending.set(p.id,true));
  players.forEach(p=>{const w=p.id===H.imp?H.decoy:H.main;
    sendTo(p.id,{t:"draw",turn:1,word:w,dur:S.time.impostor,strokes:[],mark:null,who:`${p.name} · Impostor`,label:"Your secret object",
      info:"Don't say it out loud. One player got a slightly different object.",hint:S.ctrl==="look"?"Hold the phone up like a camera before you tap.":"Hold the phone comfortably before you tap.",prep:PREP})});
  armDeadline(S.time.impostor);stageStatus();
}
function galleryM(){
  if(H.phase)return;clearTimeout(H.timer);H.phase="vote";H.votes={};
  broadcast({t:"gallery",disc:S.disc,vote:S.vote,items:H.players.map(p=>({id:p.id,name:p.name,img:snapshot(H.draws[p.id]||[],240,"jpeg",true)}))});
  H.voteTimer=setTimeout(()=>{if(H&&H.phase==="vote")voteStatus(true)},(S.disc+S.vote+3)*1000);
}
function voteStatus(force){
  const left=H.players.filter(p=>H.votes[p.id]==null);
  if(left.length&&!force)return H.players.forEach(p=>{if(H.votes[p.id]!=null)sendTo(p.id,{t:"wait",title:"Vote sent",sub:`Waiting for: ${left.map(x=>x.name).join(", ")}`,chips:H.players.map(x=>({name:x.name,done:H.votes[x.id]!=null}))})});
  const count={};Object.values(H.votes).forEach(v=>count[v]=(count[v]||0)+1);
  clearTimeout(H.voteTimer);
  const max=Math.max(0,...Object.values(count)),top=max?Object.keys(count).filter(k=>count[k]===max):[];
  const caught=top.length===1&&top[0]===H.imp,out=top.length===1?nameOf(top[0]):null;
  H.phase="done";
  broadcast({t:"board",banner:true,label:out?`Eliminated: ${out}`:max?"The vote is tied":"Nobody voted in time",title:caught?"You caught the impostor!":"The impostor wins",
    info:`The impostor was ${H.impName}. The object was "${H.main}" and the impostor drew "${H.decoy}".`,
    cards:H.players.map(p=>({img:snapshot(H.draws[p.id]||[],200,"jpeg",true),name:p.name+(p.id===H.imp?" · impostor":""),sub:"Drew: "+(p.id===H.imp?H.decoy:H.main),pc:`${count[p.id]||0} vote${count[p.id]===1?"":"s"}`,win:p.id===H.imp})),
    actions:[{id:"again",text:"Play again"},{id:"lobby",text:"Back to lobby"}],waitText:"Waiting for the host…"});
}
function showGalleryM(d){
  const myId=NET.isHost?"host":NET.peer&&NET.peer.id;
  $("#mgGrid").innerHTML=d.items.map(it=>`<figure><img alt="${esc(it.name)}'s drawing" src="${imgOk(it.img)}"><figcaption>${esc(it.name)}</figcaption></figure>`).join("");
  const others=d.items.filter(it=>it.id!==myId);
  $("#mgVotes").innerHTML=others.map(it=>`<button class="btn" data-v="${esc(it.id)}" disabled>${esc(it.name)}</button>`).join("");
  $("#mgVotes").onclick=e=>{const v=e.target.dataset.v;if(!v||e.target.disabled)return;toHost({t:"vote",v});showWait({title:"Vote sent",sub:"Waiting for the others…",chips:[]})};
  const t0=performance.now(),disc=d.disc??30,vt=d.vote??30;clearInterval(mgTimer);
  mgTimer=setInterval(()=>{const s=Math.floor((performance.now()-t0)/1000);
    const open=s>=disc,closeIn=disc+vt-s;clockDown("#mgClock",open?closeIn:disc-s);$("#mgVoteLabel").textContent=!open?`Voting opens in ${disc-s} s`:closeIn>0?`Vote: who is the impostor? Closes in ${closeIn} s`:"Voting closed";
    document.querySelectorAll("#mgVotes button").forEach(b=>b.disabled=!open||closeIn<=0)},250);
  show("s-mgal");
}
$("#modes").addEventListener("click",()=>{if(NET.isHost&&NET.code&&!H)hostLobby()});
