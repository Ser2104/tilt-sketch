/* ---------- In-app feedback: a short survey after sessions and results, plus a feedback screen ---------- */
const Feedback=(()=>{
  const SNOOZE={answered:3*864e5,later:864e5};
  const Q={
    ease:{text:"How easy was it to control?",lo:"Very hard",hi:"Very easy"},
    again:{text:"Would you use it again?",lo:"No",hi:"Definitely"},
    helped:{text:"Does it feel like good exercise for your wrist or hand?",lo:"Not at all",hi:"A lot"}
  };
  const lang=()=>typeof I18N!=="undefined"?I18N.lang:"en";
  function form(id,ctx){
    const qs=ctx==="practice"||ctx==="guided"||ctx==="general"?["ease","again","helped"]:["ease","again"];
    return`<div class="panel fb" id="${id}" data-ctx="${ctx}"><span class="label">Quick feedback · 10 seconds</span>
      ${qs.map(k=>`<div class="fbq" data-q="${k}"><span>${Q[k].text}</span><div class="fbscale" role="radiogroup" aria-label="${Q[k].text}">${[1,2,3,4,5].map(v=>`<button type="button" role="radio" aria-checked="false" data-v="${v}" aria-label="${v} of 5">${v}</button>`).join("")}</div><div class="fbends"><em>${Q[k].lo}</em><em>${Q[k].hi}</em></div></div>`).join("")}
      <textarea class="field" maxlength="500" rows="2" placeholder="Anything we should change? (optional)" aria-label="Comment"></textarea>
      <div class="row"><button type="button" class="btn go fbsend">Send</button><button type="button" class="btn fblater">Not now</button></div>
      <p class="hint fbmsg" style="text-align:left;margin:0" aria-live="polite"></p></div>`}
  function due(ctx){const t=store.get("ts-fb-"+ctx,0);return Date.now()>=t}
  function queue(){return store.get("ts-fb-queue",[])}
  async function flush(){
    const q=queue();if(!q.length||!Rank.on())return;const left=[];
    for(const item of q){const r=await Rank.rpc("submit_feedback",item);if(!r.ok&&r.error==="offline")left.push(item)}
    store.set("ts-fb-queue",left)}
  async function submit(el){
    const pick=k=>{const b=el.querySelector(`.fbq[data-q="${k}"] [aria-checked="true"]`);return b?+b.dataset.v:null};
    const item={p_device:Rank.device,p_context:el.dataset.ctx,p_ease:pick("ease"),p_again:pick("again"),p_helped:pick("helped"),p_comment:el.querySelector("textarea").value.trim(),p_lang:lang()};
    if(item.p_ease==null&&item.p_again==null&&item.p_helped==null&&!item.p_comment){el.querySelector(".fbmsg").textContent="Tap a number or write a comment first.";return}
    store.set("ts-fb-queue",[...queue(),item]);store.set("ts-fb-"+item.p_context,Date.now()+SNOOZE.answered);
    el.innerHTML=`<span class="label">Thank you</span><p class="hint" style="text-align:left;margin:0">Your answer helps us improve Tilt Sketch.</p>`;
    await flush()}
  function wire(el){
    el.addEventListener("click",e=>{
      const b=e.target.closest(".fbscale button");
      if(b){b.parentElement.querySelectorAll("button").forEach(x=>x.setAttribute("aria-checked",x===b));return}
      if(e.target.closest(".fbsend"))submit(el);
      if(e.target.closest(".fblater")){store.set("ts-fb-"+el.dataset.ctx,Date.now()+SNOOZE.later);el.remove()}})}
  function ask(screen,ctx){
    document.querySelectorAll(".fb[data-inline]").forEach(x=>x.remove());
    if(!due(ctx))return;
    const s=$("#"+screen),foot=s&&s.querySelector(".foot");if(!foot)return;
    foot.insertAdjacentHTML("beforebegin",form("fb-"+screen,ctx));
    const el=$("#fb-"+screen);el.dataset.inline="1";wire(el)}
  function openGeneral(){
    $("#fbHost").innerHTML=form("fb-general","general");wire($("#fb-general"));
    const send=$("#fb-general .fblater");send.textContent="Back";send.onclick=e=>{e.stopPropagation();show("s-settings")};
    show("s-fb")}
  async function summary(){const r=await Rank.rpc("feedback_summary",{});return r.ok?r.data:null}
  $("#cFeedback").onclick=()=>openGeneral();
  flush();addEventListener("online",flush);
  return{ask,openGeneral,flush,summary}
})();
const _finishSessionFb=finishSession;
finishSession=function(){const had=P&&P.exercises&&P.exercises.length;_finishSessionFb();if(had)Feedback.ask("s-psum","practice")};
const _showChallengeResultFb=showChallengeResult;
showChallengeResult=function(o){_showChallengeResultFb(o);if($("#crDonate").hidden)Feedback.ask("s-cres",/^Guided/.test(o.label||"")?"guided":"challenge")};
const _finalScreenFb=finalScreen;
finalScreen=function(){_finalScreenFb();Feedback.ask("s-final","game")};
