/* ---------- Room relay over Supabase Realtime: works on any network (campus Wi-Fi, mobile data) where direct phone-to-phone links fail ---------- */
const Relay=(()=>{
  let sb=null;
  const usable=()=>typeof supabase!=="undefined"&&!!(TS_CONFIG.supabaseUrl&&TS_CONFIG.supabaseKey)&&!new URLSearchParams(location.search).get("peerhost");
  const client=()=>sb||(sb=supabase.createClient(TS_CONFIG.supabaseUrl,TS_CONFIG.supabaseKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},realtime:{params:{eventsPerSecond:40}}}));
  function conn(ch,me,peer){const h={},c={peer,open:true,
    send:d=>{if(c.open)ch.send({type:"broadcast",event:"m",payload:{from:me,to:peer,d}})},
    on:(e,f)=>{(h[e]=h[e]||[]).push(f)},emit:(e,x)=>(h[e]||[]).forEach(f=>{try{f(x)}catch(err){console.error(err)}}),
    close(){if(!c.open)return;c.open=false;c.emit("close")}};return c}
  function channel(code,key){return client().channel("tiltsketch-room-"+code,{config:{broadcast:{self:false,ack:false},presence:{key}}})}
  function end(ch){try{ch.untrack()}catch(_){}try{client().removeChannel(ch)}catch(_){}}
  function host(code,{onOpen,onConnection,onError}){
    const ch=channel(code,"host"),conns=new Map(),gone=new Map();let opened=false;
    ch.on("broadcast",{event:"m"},({payload:p})=>{if(!p||p.to!=="host")return;let c=conns.get(p.from);
      if(!c||!c.open){c=conn(ch,"host",p.from);conns.set(p.from,c);onConnection(c)}
      if(gone.has(p.from)){clearTimeout(gone.get(p.from));gone.delete(p.from)}c.emit("data",p.d)});
    ch.on("presence",{event:"leave"},({key})=>{const c=conns.get(key);if(!c||gone.has(key))return;
      gone.set(key,setTimeout(()=>{gone.delete(key);conns.delete(key);c.close()},12000))});
    ch.on("presence",{event:"join"},({key})=>{if(gone.has(key)){clearTimeout(gone.get(key));gone.delete(key)}});
    ch.subscribe(async s=>{if(s==="SUBSCRIBED"){try{await ch.track({role:"host"})}catch(_){}if(!opened){opened=true;onOpen()}}
      else if((s==="CHANNEL_ERROR"||s==="TIMED_OUT")&&!opened)onError(s)});
    return{destroyed:false,destroy(){this.destroyed=true;conns.forEach(c=>c.open=false);end(ch)}}}
  function guest(code,{onOpen,onNotFound,onError}){
    const me="g"+Math.random().toString(36).slice(2,10),ch=channel(code,me),hc=conn(ch,me,"host");let found=false,lostT=0,subscribed=false;
    ch.on("broadcast",{event:"m"},({payload:p})=>{if(p&&p.from==="host"&&(p.to===me||p.to==="*"))hc.emit("data",p.d)});
    ch.on("presence",{event:"sync"},()=>{const host=!!ch.presenceState().host;
      if(host){clearTimeout(lostT);lostT=0;if(!found){found=true;onOpen(hc)}}
      else if(found&&!lostT)lostT=setTimeout(()=>hc.close(),12000)});
    ch.subscribe(async s=>{if(s==="SUBSCRIBED"){try{await ch.track({role:"guest"})}catch(_){}
        if(!subscribed){subscribed=true;setTimeout(()=>{if(!found)onNotFound()},7000)}}
      else if((s==="CHANNEL_ERROR"||s==="TIMED_OUT")&&!found)onError(s)});
    return{id:me,destroyed:false,destroy(){this.destroyed=true;clearTimeout(lostT);hc.open=false;end(ch)}}}
  return{usable,host,guest}
})();
