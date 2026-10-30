/* ---------- Installable app and offline support ---------- */
let installEvt=null;
if(!IS_APP&&"serviceWorker" in navigator&&location.protocol!=="file:")addEventListener("load",()=>navigator.serviceWorker.register("sw.js").catch(()=>{}));
addEventListener("beforeinstallprompt",e=>{e.preventDefault();if(IS_APP)return;installEvt=e;$("#cInstall").hidden=false});
addEventListener("appinstalled",()=>{installEvt=null;$("#cInstall").hidden=true;$("#installMsg").hidden=true});
const standalone=matchMedia("(display-mode: standalone)").matches||navigator.standalone;
if(!IS_APP&&!standalone&&/iphone|ipad|ipod/i.test(navigator.userAgent))$("#cInstall").hidden=false;
$("#cInstall").onclick=async()=>{
  if(installEvt){installEvt.prompt();try{await installEvt.userChoice}catch(_){}installEvt=null;$("#cInstall").hidden=true;return}
  $("#installMsg").textContent="On iPhone: tap the Share button in Safari, then “Add to Home Screen”. Practice and games on one phone then work without internet.";$("#installMsg").hidden=false};
function netNote(){if(navigator.onLine)return;$("#installMsg").hidden=false;$("#installMsg").textContent="You are offline. Practice, guided drawings and one-phone games still work; rankings and sharing sync when you are back online."}
addEventListener("offline",netNote);addEventListener("online",()=>{$("#installMsg").hidden=true});netNote();
I18N.start();
