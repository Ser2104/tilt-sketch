/* ---------- One visible profile: the name used for rankings and rooms, plus the active practice profile ---------- */
function myProfileName(){return store.get("ts-rank-name","")||(()=>{try{return localStorage.getItem("ts-name")||""}catch(_){return""}})()}
function setProfileName(n){n=String(n||"").trim().slice(0,14);store.set("ts-rank-name",n);try{localStorage.setItem("ts-name",n)}catch(_){}if($("#myName"))$("#myName").value=n;if($("#rkName"))$("#rkName").value=n;renderProfile()}
function renderProfile(){
  const n=myProfileName(),p=Profiles.cur();
  $("#profName").textContent=n||(typeof I18N!=="undefined"?I18N.t("Add name"):"Add name");
  $("#profAvatar").textContent=n?n[0].toUpperCase():"?";
  $("#profInput").value=n;
  $("#profPractice").innerHTML=Profiles.data.list.length?Profiles.data.list.map(x=>`<option value="${esc(x.id)}"${x.id===Profiles.data.current?" selected":""}>${esc(x.name)}</option>`).join(""):`<option value="">${esc(I18N.t("None yet"))}</option>`;
  $("#profPractice").disabled=!Profiles.data.list.length;
}
$("#profChip").onclick=()=>{openSettings();$("#profPanel").scrollIntoView({block:"start"});if(!myProfileName())$("#profInput").focus()};
$("#profSave").onclick=()=>{const n=$("#profInput").value.trim();if(!n){$("#profInput").focus();return}if(!nameOk(n)){$("#profMsg").textContent=I18N.t("Please choose another name.");return}setProfileName(n);$("#profMsg").textContent=I18N.t("Saved. Your rankings use this name.");
  if(Rank.on()){const d=store.get("ts-daily-"+todayUTC(),null),st=levelState(),g=guidedState();if(d)Rank.submit("daily-"+todayUTC(),n,d.score);if(st.unlocked)Rank.submit("levels",n,0,st.unlocked,totalStars(st));if(g.unlocked)Rank.submit("guided",n,0,g.unlocked,guidedStars(g))}};
$("#profInput").onkeydown=e=>{if(e.key==="Enter")$("#profSave").click()};
$("#profPractice").onchange=e=>{if(e.target.value){Profiles.select(e.target.value);renderProfile()}};
$("#profManage").onclick=()=>openPractice();
const _showProf=show;show=function(id){_showProf(id);if(id==="s-home"||id==="s-settings")renderProfile()};
if(!myProfileName()&&Profiles.cur())setProfileName(Profiles.cur().name);
renderProfile();
$("#profDelScores").onclick=async()=>{const b=$("#profDelScores"),m=$("#profDelMsg");
  if(b.dataset.confirm!=="1"){b.dataset.confirm="1";b.textContent=I18N.t("Tap again to delete your names and scores from all rankings");setTimeout(()=>{b.dataset.confirm="";b.textContent=I18N.t("Delete my rankings")},5000);return}
  b.dataset.confirm="";b.textContent=I18N.t("Delete my rankings");m.hidden=false;
  if(!Rank.on()){m.textContent=I18N.t("Rankings are not connected.");return}
  const r=await Rank.rpc("delete_my_scores",{p_device:Rank.device});
  m.textContent=I18N.t(r.ok?"Your scores were deleted from the rankings.":"Could not delete them now. Check your connection and try again.")};
