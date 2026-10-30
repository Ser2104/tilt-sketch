/* ---------- Player level, daily streak, achievements, unlockable colors and sharing ---------- */
const Game=(()=>{
  const ACH=[
    ["first","✏️","First drawing","Finish your first drawing",s=>s.draws>=1],
    ["ten","🔥","Warming up","Finish 10 drawings",s=>s.draws>=10],
    ["fifty","🖍️","Sketch machine","Finish 50 drawings",s=>s.draws>=50],
    ["perfect","💯","Picture perfect","Score 95% or more",s=>s.best>=95],
    ["streak3","📅","On a roll","Play the daily challenge 3 days in a row",s=>s.streakBest>=3],
    ["streak7","🗓️","Week warrior","Play the daily challenge 7 days in a row",s=>s.streakBest>=7],
    ["world1","🌍","First world","Finish World 1 of the levels",()=>levelState().unlocked>=8],
    ["stars30","⭐","Star collector","Collect 30 stars in the levels",()=>totalStars(levelState())>=30],
    ["levels","👑","Master artist","Finish all 40 levels",()=>levelState().unlocked>=LEVEL_LIST.length],
    ["guided10","🎯","Steady hand","Trace 10 guided drawings",()=>guidedState().unlocked>=10],
    ["party","🎉","Party starter","Play a game with friends",s=>s.party>=1],
    ["share","📣","Show-off","Share one of your drawings",s=>s.shares>=1],
    ["lv5","🚀","Rising artist","Reach player level 5",s=>levelOf(s.xp).n>=5],
    ["lv10","🏆","Art legend","Reach player level 10",s=>levelOf(s.xp).n>=10]];
  const UNLOCKS=[[3,"#E0A100","Gold"],[5,"#FF4FA3","Pink"],[7,"#16C79A","Mint"],[10,"#00B4D8","Sky blue"]];
  const S0={xp:0,draws:0,best:0,party:0,shares:0,streak:0,streakBest:0,last:"",got:[]};
  const st=()=>Object.assign({},S0,store.get("ts-game",{}));
  const save=s=>store.set("ts-game",s);
  function levelOf(xp){let n=1,base=0,need=100;while(xp>=base+need){base+=need;n++;need=100+(n-1)*50}return{n,into:xp-base,need}}
  const dayDiff=(a,b)=>Math.round((Date.parse(b)-Date.parse(a))/864e5);
  function streakNow(s=st()){return s.last&&dayDiff(s.last,todayUTC())<=1?s.streak:0}
  function markDaily(s){const d=todayUTC();if(s.last===d)return;s.streak=s.last&&dayDiff(s.last,d)===1?s.streak+1:1;s.last=d;s.streakBest=Math.max(s.streakBest,s.streak)}

  function award({score=0,xp=null,daily=false,party=false,share=false}){
    const s=st(),before=levelOf(s.xp).n,today=todayUTC(),repeat=daily&&s.dailyDay===today,gain=xp!=null?xp:repeat?5:10+Math.round(score*.9);
    if(daily)s.dailyDay=today;
    if(party)s.party++;else if(share)s.shares++;else{s.draws++;s.best=Math.max(s.best,score)}
    if(daily)markDaily(s);
    s.xp+=gain;const after=levelOf(s.xp).n;
    const fresh=ACH.filter(a=>!s.got.includes(a[0])&&a[4](s));s.got.push(...fresh.map(a=>a[0]));save(s);
    const parts=[];if(after>before){const u=UNLOCKS.find(x=>x[0]===after);parts.push({i:"⭐",b:`Level ${after}!`,s:u?`New brush color: ${u[2]}`:""});setTimeout(()=>{SFX.win();confetti()},share?250:1900)}
    fresh.forEach(a=>parts.push({i:a[1],b:a[2],s:a[3]}));if(fresh.length)setTimeout(()=>{SFX.badge();buzz([40,60,40])},share?400:1900);
    /* Wait until the result headline (winner, score, impostor) has been seen before the badge slides over it */
    const msg=parts.length===1?`<i>${parts[0].i}</i><b>${parts[0].b}</b>${parts[0].s?`<span>${parts[0].s}</span>`:""}`:
      parts.length?`<i>${parts[0].i}</i><b>${parts[0].b}</b><span>${parts.slice(1).map(p=>p.i+" "+p.b).join(" · ")}</span>`:null;
    if(msg)setTimeout(()=>toast(msg),share?0:1800);
    renderSwatches();renderLevelChip();
    return{gain,after,s}}

  function renderSwatches(){
    const n=levelOf(st().xp).n,cur=D.color;
    $("#swatches").innerHTML=COLORS.map((c,i)=>`<button class="sw" style="background:${c}" data-c="${c}" aria-label="Color ${i+1}" aria-pressed="${c===cur}"></button>`).join("")+
      UNLOCKS.filter(([lv])=>n>=lv).map(([lv,c,name])=>`<button class="sw" style="background:${c}" data-c="${c}" aria-label="${name}" aria-pressed="${c===cur}"></button>`).join("")+
      ((u=>u?`<button class="sw locked" data-lock="${u[0]}" aria-label="${u[2]}: unlocks at level ${u[0]}">🔒</button>`:"")(UNLOCKS.find(([lv])=>n<lv)))+
      `<button class="sw eraser" data-c="eraser" aria-label="Eraser" aria-pressed="${cur==="eraser"}"></button>`}
  $("#swatches").addEventListener("click",e=>{const b=e.target.closest("[data-lock]");if(b)toast(`<i>🔒</i><b>Level ${b.dataset.lock}</b><span>Keep drawing to unlock this color.</span>`)});

  function renderLevelChip(){const b=$("#profLv");b.textContent="Lv "+levelOf(st().xp).n;b.hidden=false}

  function xpHTML(r,daily){
    const L=levelOf(r.s.xp),k=streakNow(r.s);
    return`<div class="xprow"><b>+${r.gain} XP</b><span>Level ${L.n}</span></div><div class="xpbar"><i style="width:${Math.round(L.into/L.need*100)}%"></i></div>`+
      `<p class="hint" style="margin:0">${L.need-L.into} XP to level ${L.n+1}${daily&&k?` · 🔥 ${k}-day streak`:""}</p>`}

  async function shareDrawing({word,score,strokes,img,label}){
    const W=1080,H=1350,c=document.createElement("canvas");c.width=W;c.height=H;const x=c.getContext("2d");
    try{await document.fonts.ready}catch(_){}
    x.fillStyle="#13213C";x.fillRect(0,0,W,H);x.textAlign="center";
    x.fillStyle="#E9F0F4";x.font="88px Bungee, Impact, sans-serif";x.fillText("TILT SKETCH",W/2,140);
    x.fillStyle="#BFD0DE";x.font="600 38px Figtree, Arial, sans-serif";x.fillText(I18N.t(label),W/2,200);
    const P={x:150,y:250,s:780};x.fillStyle="#FFFFFF";x.beginPath();x.roundRect(P.x,P.y,P.s,P.s,36);x.fill();
    const ink=(strokes||[]).filter(s=>s.c!=="#FFFFFF"&&s.pts.length);
    if(ink.length){const xs=ink.flatMap(s=>s.pts.map(p=>p[0])),ys=ink.flatMap(s=>s.pts.map(p=>p[1]));
      const x0=Math.min(...xs),y0=Math.min(...ys),bw=Math.max(...xs)-x0,bh=Math.max(...ys)-y0,f=Math.min(3,.8/Math.max(bw,bh,.05)),u=P.s*f;
      x.save();x.beginPath();x.rect(P.x,P.y,P.s,P.s);x.clip();x.translate(P.x+P.s/2-(x0+bw/2)*u,P.y+P.s/2-(y0+bh/2)*u);x.lineCap=x.lineJoin="round";
      for(const s of strokes){if(!s.pts.length)continue;x.strokeStyle=s.c;x.lineWidth=Math.max(4,s.w*u*.8);x.beginPath();s.pts.forEach((p,i)=>i?x.lineTo(p[0]*u,p[1]*u):x.moveTo(p[0]*u,p[1]*u));x.stroke()}x.restore()}
    else if(img){const im=new Image();im.src=img;await im.decode().catch(()=>{});x.drawImage(im,P.x+40,P.y+40,P.s-80,P.s-80)}
    x.fillStyle="#E9F0F4";x.font="800 52px Figtree, Arial, sans-serif";x.fillText(I18N.t(word).toUpperCase(),W/2,1110);
    x.fillStyle="#FF5A36";x.font="120px Bungee, Impact, sans-serif";x.fillText(score+"%",W/2,1235);
    x.fillStyle="#8FA3BA";x.font="600 32px Figtree, Arial, sans-serif";x.fillText(I18N.t("Can you beat me?")+" ser2104.github.io/tilt-sketch",W/2,1305);
    const blob=await new Promise(r=>c.toBlob(r,"image/png"));
    const text=I18N.t(`I drew "${word}" in Tilt Sketch and scored ${score}%. Can you beat me?`)+" "+PUBLIC_URL;
    const ok=await shareBlob(blob,text);if(ok){const s=st(),d=todayUTC();if(s.shareDay!==d){s.shareDay=d;save(s);award({share:true,xp:15})}}return ok}

  async function shareBlob(blob,text){
    const name="tilt-sketch.png";
    try{
      const P=IS_APP&&window.Capacitor&&Capacitor.Plugins;
      if(P&&P.Share&&P.Filesystem){const b64=await new Promise(r=>{const f=new FileReader();f.onload=()=>r(String(f.result).split(",")[1]);f.readAsDataURL(blob)});
        const w=await P.Filesystem.writeFile({path:name,data:b64,directory:"CACHE"});await P.Share.share({title:"Tilt Sketch",text,files:[w.uri]});return true}
      const file=new File([blob],name,{type:"image/png"});
      if(navigator.canShare&&navigator.canShare({files:[file]})){await navigator.share({files:[file],text});return true}
      const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),4000);alertMsg("Image saved. Post it anywhere!");return true
    }catch(e){return false}}

  function openTrophies(){
    const s=st(),L=levelOf(s.xp),k=streakNow(s);
    $("#tpLevel").innerHTML=`<div class="xprow"><b>Level ${L.n}</b><span>${s.xp} XP</span></div><div class="xpbar"><i style="width:${Math.round(L.into/L.need*100)}%"></i></div><p class="hint" style="margin:0;text-align:left">${L.need-L.into} XP to level ${L.n+1}</p>`;
    $("#tpStats").innerHTML=[[`🔥 ${k}`,"Day streak"],[s.streakBest,"Best streak"],[s.draws,"Drawings"],[s.best+"%","Best score"]].map(([v,l])=>`<div class="kpi"><b>${v}</b><span>${l}</span></div>`).join("");
    $("#tpList").innerHTML=ACH.map(a=>{const got=s.got.includes(a[0]);return`<div class="tp${got?" got":""}"><i>${got?a[1]:"🔒"}</i><b>${a[2]}</b><span>${a[3]}</span></div>`}).join("")+
      UNLOCKS.map(([lv,c,name])=>`<div class="tp${L.n>=lv?" got":""}"><i class="tpcolor" style="background:${L.n>=lv?c:"var(--chip)"}">${L.n>=lv?"":"🔒"}</i><b>${name} brush</b><span>Unlocks at level ${lv}</span></div>`).join("");
    show("s-trophies")}
  $("#cTrophies").onclick=openTrophies;$("#tpBack").onclick=()=>{renderChallengeCards();show("s-home")};

  const _result=showChallengeResult;
  showChallengeResult=function(o){
    const offer=CR_OFFER;_result(o);
    const daily=/^Daily challenge/.test(o.label),passed=o.starsN==null?o.score>=50:o.starsN>=1,r=award({score:o.score,daily});
    const box=$("#crXP");box.innerHTML=xpHTML(r,daily);box.hidden=false;
    if(passed){SFX.win();buzz([30,50,30]);if(o.starsN===3||o.score>=90)confetti()}else SFX.miss();
    const f=$("#crActions");let links=f.querySelector(".homelinks");if(!links){links=document.createElement("div");links.className="row homelinks";f.append(links)}
    const b=document.createElement("button");b.className="linkbtn";b.textContent="Share drawing";
    b.onclick=()=>shareDrawing({word:offer?offer.word:o.label.split(" · ").pop(),score:o.score,strokes:offer&&offer.strokes,img:o.img,label:o.label.replace(/ · [^·]*$/,"")});
    links.prepend(b)};

  const _cards=renderChallengeCards;
  renderChallengeCards=function(){_cards();const k=streakNow(),s=st();if(!k)return;
    const played=s.last===todayUTC();$("#cDaily").insertAdjacentHTML("beforeend",`<span class="streak">🔥 ${k}-day streak${played?"":" · play today to keep it"}</span>`)};

  const _final=finalScreen;finalScreen=function(...a){const r=_final.apply(this,a);award({party:true,xp:40});return r};
  const _reveal=reveal;reveal=function(...a){const r=_reveal.apply(this,a);award({party:true,xp:40});return r};
  let lastBoard="";
  const _board=showBoard;showBoard=function(d){_board(d);const key=(NET.code||"")+"|"+(d&&d.title)+"|"+(d&&d.label);if(d&&d.banner&&key!==lastBoard){lastBoard=key;award({party:true,xp:40})}};

  renderSwatches();renderLevelChip();renderChallengeCards();
  return{award,levelOf,streakNow,state:st,shareDrawing,openTrophies,ACH,UNLOCKS}
})();
const openTrophies=Game.openTrophies;
