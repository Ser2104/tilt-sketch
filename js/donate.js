/* ---------- Drawing donations: opt-in data to retrain the AI on real gyroscope drawings ---------- */
const Donate=(()=>{
  const MAX_PTS=2500;
  let pending=null;
  const choice=()=>store.get("ts-donate",null);
  const usable=()=>Rank.on()&&S.input==="gyro";
  function pack(strokes){
    const ink=strokes.filter(s=>s.c!=="#FFFFFF"&&s.pts.length>1).slice(0,80);
    const total=ink.reduce((n,s)=>n+s.pts.length,0),k=Math.max(1,Math.ceil(total/MAX_PTS));
    return ink.map(s=>{const p=s.pts.filter((_,i)=>i%k===0||i===s.pts.length-1);return[p.map(q=>Math.round(q[0]*1000)),p.map(q=>Math.round(q[1]*1000))]})}
  async function send(word,strokes,r){
    if(choice()!==true||!usable()||!TARGETS[word])return false;
    const s=pack(strokes);if(!s.length)return false;
    const res=await Rank.rpc("donate_drawing",{p_device:Rank.device,p_word:word,p_strokes:s,p_ctrl:S.ctrl,p_guess:String(r&&r.guess||"").slice(0,40),p_score:Math.round(r&&r.acc||0)});
    if(res.ok)store.set("ts-donated",store.get("ts-donated",0)+1);
    return res.ok}
  function offer(word,strokes,r){
    pending=null;$("#crDonate").hidden=true;
    if(choice()===true)return send(word,strokes,r);
    if(choice()===null&&usable()&&pack(strokes).length){pending={word,strokes,r};$("#crDonate").hidden=false}}
  async function decide(yes){
    store.set("ts-donate",yes);$("#crDonate").hidden=true;render();
    if(yes&&pending){const ok=await send(pending.word,pending.strokes,pending.r);$("#crInfo").textContent+=ok?" Thanks, your drawing will help train the AI.":""}
    pending=null}
  async function render(){
    const c=choice();
    $("#donOn").setAttribute("aria-pressed",c===true);$("#donOff").setAttribute("aria-pressed",c!==true);
    const mine=store.get("ts-donated",0);
    $("#donDel").hidden=!mine;
    if(!Rank.on()){$("#donStats").textContent="Not available: the shared database is not connected.";return}
    const r=await Rank.rpc("donation_stats",{});
    const total=r.ok&&r.data?r.data.drawings:null;
    $("#donStats").textContent=[total!=null?`${total.toLocaleString()} drawing${total===1?"":"s"} shared by players so far.`:"",mine?`You shared ${mine}.`:""].filter(Boolean).join(" ")}
  $("#donOn").onclick=()=>decide(true);
  $("#donOff").onclick=()=>decide(false);
  $("#crDonYes").onclick=()=>decide(true);
  $("#crDonNo").onclick=()=>decide(false);
  $("#donDel").onclick=async()=>{const b=$("#donDel");
    if(b.dataset.confirm!=="1"){b.dataset.confirm="1";b.textContent="Tap again to delete every drawing you shared";setTimeout(()=>{b.dataset.confirm="";b.textContent="Delete the drawings I shared"},4000);return}
    b.dataset.confirm="";b.textContent="Delete the drawings I shared";
    const r=await Rank.rpc("delete_my_drawings",{p_device:Rank.device});
    if(r.ok){store.set("ts-donated",0);store.set("ts-donate",false)}
    await render();$("#donStats").textContent=(r.ok?`Deleted ${r.data||0} drawing${r.data===1?"":"s"}. Sharing is off. `:"Could not reach the database. Try again later. ")+$("#donStats").textContent};
  render();
  return{send,offer,pack,render}
})();
