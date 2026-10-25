/* Offline support: network first, cached copy when offline or slow. Cross-origin requests (database, signaling) are not touched. */
const CACHE="tilt-sketch-v1";
const SHELL=["./","index.html","css/app.css","manifest.webmanifest","icons/icon-192.png","icons/icon-512.png",
  "models/doodlenet/model.json","models/doodlenet/group1-shard1of1.bin","models/doodlenet/classes.json",
  "models/tiltsketch/spec.json","models/tiltsketch/weights.bin","models/examples.json","vendor/tf.min.js","vendor/peerjs.min.js","vendor/qrcode.js","js/core.js","js/i18n.js","js/figures.js","js/home.js","js/gyro.js","js/motor.js","js/draw.js","js/ai.js","js/live.js","js/a11y.js","js/practice.js","js/progress.js","js/config.js","js/rank.js","vendor/supabase.js","js/relay.js","js/challenges.js","js/guided.js","js/local-game.js","js/multi.js","js/app.js","js/nav.js","js/profile.js","js/donate.js","js/clinic.js","js/feedback.js","js/pwa.js"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE).then(c=>Promise.all(SHELL.map(u=>c.add(u).catch(()=>null)))).then(()=>self.skipWaiting()))});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener("fetch",e=>{
  const req=e.request,url=new URL(req.url);
  if(req.method!=="GET"||url.origin!==location.origin)return;
  e.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    const net=fetch(req).then(r=>{if(r.ok)cache.put(req,r.clone());return r});net.catch(()=>{});
    const slow=new Promise(res=>setTimeout(res,4000));
    try{const r=await Promise.race([net,slow.then(()=>null)]);if(r)return r}catch(_){}
    const hit=await cache.match(req,{ignoreSearch:req.mode==="navigate"});
    if(hit)return hit;
    return net.catch(()=>req.mode==="navigate"?cache.match("index.html"):Response.error());
  })());
});
