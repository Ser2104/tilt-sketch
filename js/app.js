$("#start").onclick=async()=>{if(S.input==="gyro"&&S.gyro!=="ok"&&!(await testGyro())){showGyroHelp();return}
  try{screen.orientation.lock("portrait").catch(()=>{})}catch(_){}newMatch()};
syncSettings();renderPlayers();if(!S.play)setPlay(qp?"multi":"one");if(qp.length===4)setInvite(qp);
$("#cancelInvite").onclick=()=>{setInvite("");history.replaceState(null,"",location.pathname+location.search.replace(/([?&])room=[^&]*&?/,"$1").replace(/[?&]$/,""))};
