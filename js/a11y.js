/* ---------- Accessibility ---------- */
const A11Y={bigText:false,contrast:false,voice:false,bigPen:false};
try{Object.assign(A11Y,JSON.parse(localStorage.getItem("ts-a11y")||"{}"))}catch(_){}
function applyA11y(){
  const r=document.documentElement;
  r.classList.toggle("big-text",A11Y.bigText);r.classList.toggle("high-contrast",A11Y.contrast);r.classList.toggle("big-pen",A11Y.bigPen);
  document.querySelectorAll("[data-a11y]").forEach(b=>b.setAttribute("aria-pressed",!!A11Y[b.dataset.a11y]));
  try{localStorage.setItem("ts-a11y",JSON.stringify(A11Y))}catch(_){}
}
function say(text){
  if(!A11Y.voice||!("speechSynthesis" in window))return;
  try{speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang="en-US";u.rate=1.05;speechSynthesis.speak(u)}catch(_){}
}
document.addEventListener("click",e=>{const b=e.target.closest("[data-a11y]");if(!b)return;const k=b.dataset.a11y;A11Y[k]=!A11Y[k];applyA11y();if(k==="voice"&&A11Y.voice)say("Voice guidance on")});
applyA11y();
