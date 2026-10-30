/* ---------- Navigation between home, play and settings ---------- */
let settingsFrom="s-home";
function openSettings(){const cur=document.querySelector(".screen:not([hidden])");if(cur&&cur.id!=="s-settings")settingsFrom=cur.id;show("s-settings")}
$("#openSettings").onclick=openSettings;$("#openSettings2").onclick=openSettings;$("#openSettings3").onclick=openSettings;
$("#settingsBack").onclick=()=>show(settingsFrom);
$("#tPlay").onclick=()=>{if(S.play!=="multi")setPlay("one");show("s-play")};
$("#tPractice").onclick=()=>openPractice();
$("#playBack").onclick=()=>{renderChallengeCards();show("s-home")};

/* Browser back button: each main screen is a history entry; back from a game or exercise leaves it cleanly */
const NAV_SCREENS={"s-home":()=>{renderChallengeCards();showScreen("s-home")},"s-play":()=>showScreen("s-play"),"s-settings":()=>showScreen("s-settings"),
  "s-practice":()=>openPractice(),"s-levels":()=>openLevels(),"s-guided":()=>openGuided(),"s-rank":()=>openRanking(typeof rankTab!=="undefined"?rankTab:"daily"),
  "s-clinic":()=>openClinic(),"s-fb":()=>showScreen("s-fb"),"s-trophies":()=>openTrophies(),"s-prog":()=>PV?openProgress(PV,PBACK||openPractice):openPractice(),"s-report":()=>PV?openReport():openPractice()};
const showScreen=show;
let navPopping=false;
show=function(id){
  showScreen(id);
  if(navPopping)return;
  try{const st=history.state||{};
    if(!NAV_SCREENS[id]){if(st.s&&!st.flow)history.pushState({s:st.s,flow:true},"");return}
    if(st.s!==id||st.flow)history.pushState({s:id},"")}catch(_){}
};
try{history.replaceState({s:"s-home"},"")}catch(_){}
addEventListener("popstate",e=>{
  const target=(e.state&&e.state.s)||"s-home",cur=document.querySelector(".screen:not([hidden])");
  navPopping=true;
  try{
    if(typeof D!=="undefined"&&D.state&&D.state!=="idle")abortDraw();
    if(cur&&!NAV_SCREENS[cur.id]&&typeof NET!=="undefined"&&NET.code)leaveRoom("");
    (NAV_SCREENS[target]||NAV_SCREENS["s-home"])();
  }finally{navPopping=false}
});

/* Enter a room code from the home screen */
const codeBoxes=[...document.querySelectorAll("#cCode .codebox")];
function joinFromHome(code){
  codeBoxes.forEach(b=>b.value="");
  setPlay("multi");show("s-play");$("#joinCode").value=code;
  const n=$("#myName").value.trim()||(typeof myProfileName==="function"?myProfileName():"");
  if(n){$("#myName").value=n;$("#joinRoom").click()}else{netMsg("Enter your name and tap Join. If your phone asks for motion access, tap Allow.");$("#myName").focus()}}
codeBoxes.forEach((b,i)=>{
  b.addEventListener("input",()=>{const v=b.value.toUpperCase().replace(/[^A-Z]/g,"");
    if(v.length>1){v.slice(0,4).split("").forEach((c,j)=>{if(codeBoxes[j])codeBoxes[j].value=c})}else b.value=v;
    const code=codeBoxes.map(x=>x.value).join("");
    if(code.length===4){codeBoxes.forEach(x=>x.blur());joinFromHome(code);return}
    if(b.value&&codeBoxes[i+1])codeBoxes[i+1].focus()});
  b.addEventListener("keydown",e=>{if(e.key==="Backspace"&&!b.value&&codeBoxes[i-1]){codeBoxes[i-1].value="";codeBoxes[i-1].focus()}});
});
