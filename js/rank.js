/* ---------- Shared rankings ---------- */
const Rank=(()=>{
  const on=()=>!!(TS_CONFIG.supabaseUrl&&TS_CONFIG.supabaseKey);
  let device=null;try{device=localStorage.getItem("ts-device")}catch(_){}
  if(!device){device=crypto.randomUUID?crypto.randomUUID():"10000000-1000-4000-8000-100000000000".replace(/[018]/g,c=>(c^crypto.getRandomValues(new Uint8Array(1))[0]&15>>c/4).toString(16));try{localStorage.setItem("ts-device",device)}catch(_){}}
  const headers=()=>({apikey:TS_CONFIG.supabaseKey,Authorization:"Bearer "+TS_CONFIG.supabaseKey,"Content-Type":"application/json"});
  async function submit(board,player,score,level=0,stars=0){
    if(!on())return false;
    try{const r=await fetch(TS_CONFIG.supabaseUrl.replace(/\/$/,"")+"/rest/v1/rpc/submit_score",{method:"POST",headers:headers(),
      body:JSON.stringify({p_board:board,p_device:device,p_player:player.slice(0,24),p_score:Math.round(score),p_level:level,p_stars:stars})});return r.ok}catch(_){return false}}
  async function top(board,limit=25){
    if(!on())return null;
    const order=board==="levels"?"level.desc,stars.desc,updated_at.asc":"score.desc,updated_at.asc";
    try{const r=await fetch(`${TS_CONFIG.supabaseUrl.replace(/\/$/,"")}/rest/v1/leaderboard?board=eq.${encodeURIComponent(board)}&order=${order}&limit=${limit}&select=player,score,level,stars`,{headers:headers()});
      return r.ok?await r.json():null}catch(_){return null}}
  return{on,submit,top,device}
})();
