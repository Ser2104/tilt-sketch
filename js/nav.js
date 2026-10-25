/* ---------- Navigation between home, play and settings ---------- */
let settingsFrom="s-home";
function openSettings(){const cur=document.querySelector(".screen:not([hidden])");if(cur&&cur.id!=="s-settings")settingsFrom=cur.id;show("s-settings")}
$("#openSettings").onclick=openSettings;$("#openSettings2").onclick=openSettings;
$("#settingsBack").onclick=()=>show(settingsFrom);
$("#tPlay").onclick=()=>{if(S.play!=="multi")setPlay("one");show("s-play")};
$("#tPractice").onclick=()=>openPractice();
$("#playBack").onclick=()=>{renderChallengeCards();show("s-home")};
