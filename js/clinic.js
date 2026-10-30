/* ---------- Clinician sharing: patients send practice summaries to a clinic; clinicians see them with a private key ---------- */
const uuid=()=>crypto.randomUUID?crypto.randomUUID():"10000000-1000-4000-8000-100000000000".replace(/[018]/g,c=>(c^crypto.getRandomValues(new Uint8Array(1))[0]&15>>c/4).toString(16));
const cleanCode=v=>String(v||"").toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,6);
const joinLink=code=>`${PUBLIC_URL}?clinic=${code}`;
function twoTap(b,label,ask,fn){if(b.dataset.confirm!=="1"){b.dataset.confirm="1";b.textContent=ask;setTimeout(()=>{b.dataset.confirm="";b.textContent=label},4000);return}b.dataset.confirm="";b.textContent=label;fn()}

/* Patient side, inside Practice */
function sessionPayload(p,s){const{shared,...rest}=s;return{...rest,rom:p.rom||null}}
let SYNCING=null;
function syncSessions(p){
  const run=()=>syncNow(p);
  SYNCING=(SYNCING||Promise.resolve(0)).then(run,run);
  return SYNCING}
async function syncNow(p){
  if(!p||!p.clinic)return 0;let n=0;
  for(const s of p.sessions.filter(s=>!s.shared).slice(-60)){
    const r=await Rank.rpc("share_session",{p_code:p.clinic.code,p_device:p.uid,p_session:sessionPayload(p,s)});
    if(!r.ok){if(/not connected|unknown/.test(r.error||"")){p.clinic.lost=true;Profiles.save()}break}
    s.shared=true;n++}
  if(n)Profiles.save();return n}
function renderClinicPatient(){
  const p=Profiles.cur(),c=p&&p.clinic;
  $("#clPanel").hidden=!p;if(!p)return;
  $("#clOn").hidden=!c;$("#clOff").hidden=!!c;
  if(c){const waiting=p.sessions.filter(s=>!s.shared).length;
    $("#clOnText").textContent=c.lost?`${c.name} is no longer receiving your results. Stop sharing, then connect again with a new code.`:
      `Sharing with ${c.name} as “${c.alias}”. ${p.sessions.length-waiting} session${p.sessions.length-waiting===1?"":"s"} shared${waiting?`, ${waiting} waiting to send`:""}. New sessions are sent automatically.`;
    if(waiting&&!c.lost)syncSessions(p).then(n=>{if(n)renderClinicPatient()})}
  else if(!$("#clAlias").value)$("#clAlias").value=p.name}
const _renderHub=renderHub;
renderHub=function(){_renderHub();renderClinicPatient()};
const _finishSession=finishSession;
finishSession=function(){const p=P&&P.profile;_finishSession();
  if(p&&p.clinic&&!p.clinic.lost)syncSessions(p).then(()=>{const s=p.sessions[p.sessions.length-1];if(s&&s.shared&&p.clinic&&!$("#s-psum").hidden)$("#psInfo").textContent+=` Shared with ${p.clinic.name}.`})};
$("#clJoin").onclick=async()=>{
  const p=Profiles.cur();if(!p)return;const code=cleanCode($("#clCode").value),alias=$("#clAlias").value.trim();
  if(code.length!==6){$("#clMsg").textContent="Enter the 6-character code from your clinician.";$("#clCode").focus();return}
  if(!alias){$("#clMsg").textContent="Enter the name your clinician will see.";$("#clAlias").focus();return}
  if(!nameOk(alias)){$("#clMsg").textContent="Please choose another name.";return}
  if(!Rank.on()){$("#clMsg").textContent="Sharing is not available: the database is not connected.";return}
  $("#clJoin").disabled=true;$("#clMsg").textContent="Connecting…";
  p.uid=p.uid||uuid();Profiles.save();
  const r=await Rank.rpc("join_clinic",{p_code:code,p_device:p.uid,p_alias:alias});
  $("#clJoin").disabled=false;
  if(!r.ok){$("#clMsg").textContent=/unknown/.test(r.error||"")?"That code was not found. Check it with your clinician.":"Could not connect. Check your internet and try again.";return}
  p.clinic={code,name:String(r.data),alias};p.sessions.forEach(s=>delete s.shared);Profiles.save();
  $("#clMsg").textContent="";$("#clCode").value="";
  await syncSessions(p);renderClinicPatient();const n=p.sessions.filter(s=>s.shared).length;
  say(`Connected to ${p.clinic.name}`);if(n)$("#clOnText").textContent+=` Sent your ${n} earlier session${n===1?"":"s"}.`};
$("#clLeave").onclick=()=>twoTap($("#clLeave"),"Stop sharing and delete shared results","Tap again to stop sharing",async()=>{
  const p=Profiles.cur();if(!p||!p.clinic)return;
  const r=await Rank.rpc("leave_clinic",{p_code:p.clinic.code,p_device:p.uid});
  if(!r.ok&&!p.clinic.lost){$("#clOnText").textContent="Could not reach the database. Try again when you are online.";return}
  delete p.clinic;p.sessions.forEach(s=>delete s.shared);p.uid=uuid();Profiles.save();renderClinicPatient();
  $("#clMsg").textContent="Stopped. Your shared results were deleted from the clinic."});
$("#clCode").oninput=e=>{e.target.value=cleanCode(e.target.value)};

/* Clinician side */
let CK=null;
function patientProfile(pt){const ss=pt.sessions.filter(s=>s&&s.avg),last=ss[ss.length-1];return{name:pt.alias,level:last?last.level1:1,rom:last&&last.rom||null,sessions:ss}}
function openClinic(){CK=store.get("ts-clinic",null);renderClinic();show("s-clinic");if(CK)loadClinic()}
function renderClinic(){
  $("#ckSetup").hidden=!!CK;$("#ckDash").hidden=!CK;$("#ckForget").hidden=!CK;
  $("#ckTitle").textContent=CK?CK.name:"Clinician dashboard";
  if(!CK)return;
  $("#ckJoinCode").textContent=CK.code;$("#ckKeyShow").textContent="•".repeat(12);$("#ckReveal").textContent="Show key";
  if(typeof qrcode!=="undefined"&&$("#ckQr").dataset.code!==CK.code){const q=qrcode(0,"M");q.addData(joinLink(CK.code));q.make();$("#ckQr").innerHTML=q.createSvgTag({cellSize:6,margin:0,scalable:true});$("#ckQr").dataset.code=CK.code}}
async function loadClinic(){
  $("#ckStatus").textContent="Loading patients…";
  const r=await Rank.rpc("clinic_report",{p_code:CK.code,p_key:CK.key});
  if(!r.ok){$("#ckStatus").textContent=/wrong/.test(r.error||"")?"This clinic code and key do not match. Remove the clinic from this device and open it again.":"Could not reach the database. Try Refresh.";return}
  CK.name=r.data.name;store.set("ts-clinic",CK);$("#ckTitle").textContent=CK.name;
  const pts=r.data.patients||[];CK.patients=pts;
  $("#ckStatus").textContent=pts.length?`${pts.length} patient${pts.length===1?"":"s"} sharing with you. Tap a patient to see charts and export a report.`:"No patients yet. Give them your clinic code or let them scan the QR.";
  $("#ckList").innerHTML=pts.map((pt,i)=>{const pp=patientProfile(pt),ss=pp.sessions,last=ss[ss.length-1],tr=trendText(ss.map(s=>s.avg.score));
    return`<li class="patient"><button class="ptopen" data-i="${i}" aria-label="Open ${esc(pt.alias)}"><b>${esc(pt.alias)}</b><span>${ss.length} session${ss.length===1?"":"s"}${last?` · last ${new Date(last.date).toLocaleDateString()} · score ${fmt(last.avg.score)}${tr?` · ${tr}`:""}`:" · nothing shared yet"}</span></button><button class="linkbtn ptdel" data-i="${i}">Remove</button></li>`}).join("")}
$("#ckList").onclick=e=>{
  const o=e.target.closest(".ptopen"),d=e.target.closest(".ptdel");
  if(o){const pt=CK.patients[+o.dataset.i];openProgress(patientProfile(pt),()=>{show("s-clinic");loadClinic()})}
  if(d){const pt=CK.patients[+d.dataset.i];twoTap(d,"Remove",`Tap again to remove ${pt.alias}`,async()=>{await Rank.rpc("clinic_remove_patient",{p_code:CK.code,p_key:CK.key,p_patient:pt.id});loadClinic()})}};
$("#ckCreate").onclick=async()=>{
  const n=$("#ckName").value.trim();if(!n){$("#ckName").focus();return}
  if(!Rank.on()){$("#ckMsg").textContent="Not available: the database is not connected.";return}
  $("#ckCreate").disabled=true;const r=await Rank.rpc("create_clinic",{p_name:n});$("#ckCreate").disabled=false;
  if(!r.ok){$("#ckMsg").textContent="Could not create the clinic. Try again.";return}
  CK={code:r.data.code,key:r.data.key,name:r.data.name};store.set("ts-clinic",CK);$("#ckMsg").textContent="";renderClinic();loadClinic();
  $("#ckKeyShow").textContent=CK.key;$("#ckReveal").textContent="Hide key";$("#ckKeyNote").textContent="Save this key now (copy it or write it down). It cannot be recovered."};
$("#ckOpen").onclick=async()=>{
  const code=cleanCode($("#ckCode").value),key=$("#ckKey").value.trim().toLowerCase();
  if(code.length!==6||!key){$("#ckMsg").textContent="Enter the clinic code and the private key.";return}
  const r=await Rank.rpc("clinic_report",{p_code:code,p_key:key});
  if(!r.ok){$("#ckMsg").textContent=/wrong/.test(r.error||"")?"Code and key do not match.":"Could not reach the database.";return}
  CK={code,key,name:r.data.name};store.set("ts-clinic",CK);$("#ckMsg").textContent="";$("#ckKey").value="";renderClinic();loadClinic()};
$("#ckReveal").onclick=()=>{const hidden=$("#ckKeyShow").textContent!==CK.key;$("#ckKeyShow").textContent=hidden?CK.key:"•".repeat(12);$("#ckReveal").textContent=hidden?"Hide key":"Show key"};
$("#ckCopy").onclick=async()=>{try{await navigator.clipboard.writeText(`Tilt Sketch clinic ${CK.code}, private key ${CK.key}`);$("#ckKeyNote").textContent="Copied. Keep it somewhere private."}catch(_){$("#ckKeyShow").textContent=CK.key}};
$("#ckShareLink").onclick=async()=>{const t=`Join my Tilt Sketch practice group: open ${joinLink(CK.code)} (clinic code ${CK.code}).`;const tt=I18N.t(t);try{if(navigator.share){await navigator.share({text:tt});return}}catch(_){return}try{await navigator.clipboard.writeText(tt);$("#ckStatus").textContent="Join link copied."}catch(_){$("#ckStatus").textContent=tt}};
$("#ckRefresh").onclick=()=>loadClinic();
$("#ckForget").onclick=()=>twoTap($("#ckForget"),"Remove this clinic from this device","Tap again: make sure you saved the key",()=>{store.set("ts-clinic",null);CK=null;renderClinic()});
$("#ckBack").onclick=()=>show("s-home");
$("#cClinic").onclick=()=>openClinic();
$("#pClinic").onclick=()=>openClinic();

const qClinic=cleanCode(new URLSearchParams(location.search).get("clinic"));
if(qClinic.length===6){openPractice();$("#clCode").value=qClinic;$("#clMsg").textContent=Profiles.cur()?"Check the name your clinician will see, then tap Connect.":"Create a profile first, then tap Connect.";
  history.replaceState(null,"",location.pathname)}
