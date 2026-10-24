/* ---------- Home ---------- */
function teamsOf(list){const t=[];for(let i=0;i+1<list.length;i+=2)t.push([i,i+1]);if(list.length%2&&t.length)t[t.length-1].push(list.length-1);return t}
function renderPlayers(){
  const tm=S.mode==="teams"?teamsOf(S.players):null;
  $("#players").innerHTML=S.players.map((p,i)=>{
    const ti=tm?tm.findIndex(t=>t.includes(i)):-1;
    return `<div class="player"><input id="pl${i}" value="${esc(p)}" maxlength="14" aria-label="Player ${i+1}">${ti>=0?`<span class="tag">Team ${ti+1}</span>`:""}<button class="x" data-rm="${i}" aria-label="Remove">×</button></div>`}).join("");
  const ok=S.players.length>=MIN[S.mode];
  $("#minmsg").textContent=ok?(S.mode==="teams"?"Teams are formed in pairs, following the list order.":""):`This mode needs at least ${MIN[S.mode]} players.`;
  refreshStart();
}
$("#players").addEventListener("input",e=>{const i=+e.target.id.slice(2);S.players[i]=e.target.value});
$("#players").addEventListener("click",e=>{const i=e.target.dataset.rm;if(i!=null&&S.players.length>2){S.players.splice(+i,1);renderPlayers()}});
$("#add").onclick=()=>{if(S.players.length<12){S.players.push("Player "+(S.players.length+1));renderPlayers()}};
$("#shuffle").onclick=()=>{S.players=shuffle(S.players);renderPlayers()};
$("#modes").onclick=e=>{const b=e.target.closest(".mode");if(!b)return;S.mode=b.dataset.mode;document.querySelectorAll(".mode").forEach(m=>m.setAttribute("aria-pressed",m===b));syncSettings();renderPlayers()};
function syncSettings(){$("#time").value=S.time[S.mode]+" s";$("#rounds").value=S.rounds;$("#roundsRow").hidden=S.mode==="impostor";
  $("#discRow").hidden=$("#voteRow").hidden=S.mode!=="impostor";$("#disc").value=S.disc+" s";$("#vote").value=S.vote+" s";
  document.querySelectorAll("#reachSeg button").forEach(b=>b.setAttribute("aria-pressed",+b.dataset.r===S.sens));
  $("#camOn").setAttribute("aria-pressed",S.cam);$("#camOff").setAttribute("aria-pressed",!S.cam);$("#lockOn").setAttribute("aria-pressed",S.lock);$("#lockOff").setAttribute("aria-pressed",!S.lock);
  document.querySelectorAll("#ctrlSeg button").forEach(b=>b.setAttribute("aria-pressed",b.dataset.ctrl===S.ctrl));
  $("#ctrlHint").textContent=S.ctrl==="look"?"Like a laser pointer: hold the phone up like a camera and point it. Where you point is where the brush goes. Best for precise drawing.":"Like a joystick or a rolling marble: tilt the phone and the brush keeps moving that way; hold it level to stop. Easier on the wrist, less precise."}
$("#ctrlSeg").onclick=e=>{const c=e.target.dataset.ctrl;if(!c)return;S.ctrl=c;syncSettings()};
$("#reachSeg").onclick=e=>{const r=+e.target.dataset.r;if(!r)return;S.sens=r;syncSettings()};
function settingsChanged(){syncSettings();if(typeof NET!=="undefined"&&NET.isHost&&NET.code&&!H)hostLobby()}
$("#discStep").onclick=e=>{const d=+e.target.dataset.d;if(!d)return;S.disc=Math.min(180,Math.max(0,S.disc+d));settingsChanged()};
$("#voteStep").onclick=e=>{const d=+e.target.dataset.d;if(!d)return;S.vote=Math.min(120,Math.max(10,S.vote+d));settingsChanged()};
$("#timeStep").onclick=e=>{const d=+e.target.dataset.d;if(!d)return;S.time[S.mode]=Math.min(120,Math.max(5,S.time[S.mode]+d));settingsChanged()};
$("#roundStep").onclick=e=>{const d=+e.target.dataset.d;if(!d)return;S.rounds=Math.min(10,Math.max(1,S.rounds+d));settingsChanged()};
$("#lockOn").onclick=()=>{S.lock=true;syncSettings()};$("#lockOff").onclick=()=>{S.lock=false;syncSettings()};
$("#testGyro").onclick=()=>testGyro();
let camStream=null;
function camMsg(t){$("#camMsg").hidden=!t;$("#camMsg").textContent=t}
async function startCam(){
  if(camStream&&camStream.active)return true;
  try{camStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"},width:{ideal:1280},height:{ideal:720}},audio:false});$("#camv").srcObject=camStream;return true}
  catch(e){camStream=null;camMsg(e&&e.name==="NotAllowedError"?"Camera access was denied. Allow it in your browser settings to use this option.":"The camera is not available on this device or browser.");return false}
}
$("#camOn").onclick=async()=>{if(await startCam()){S.cam=true;camMsg("Camera on. You will draw over what your camera sees; the sheet stays fixed in the room as you aim.")}else S.cam=false;syncSettings()};
$("#camOff").onclick=()=>{S.cam=false;camMsg("");if(camStream){camStream.getTracks().forEach(t=>t.stop());camStream=null}syncSettings()};
$("#devMode").onclick=()=>{S.input=S.input==="finger"?"gyro":"finger";$("#devMode").textContent=S.input==="finger"?"Mouse test mode on · switch back to gyroscope":"Test on a computer without a gyroscope (mouse)";refreshStart()};
function refreshStart(){const ok=S.players.length>=MIN[S.mode];$("#start").disabled=!ok;$("#start").textContent=S.input==="gyro"&&S.gyro!=="ok"?"Enable gyroscope and start":"Start"}

