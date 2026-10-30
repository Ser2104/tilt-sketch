/* ---------- First-time tutorial: a free drawing with tips that react to what the player does ---------- */
const TUT_STEPS=[
  ["Hold your phone up like a camera","Move it a little: the cross follows where you point."],
  ["Hold the big button and move the phone","Draw a circle. Let go to lift the pen."],
  ["Now add a few rays around it","Make it a sun. Listen to what the AI guesses!"],
  ["The AI got it!","Tap Done to finish the tutorial."],
  ["Nice drawing!","Tap Done to finish the tutorial."]];
var tutActive=null;
function tutorialNeeded(){return S.input==="gyro"&&!store.get("ts-tut",false)&&!navigator.webdriver}
function runTutorial(){
  if(tutActive)tutActive.cancel();
  return new Promise(done=>{
    let step=-1,poll=0,t0=0,p0=null,wait=0;
    const set=i=>{if(i===step)return;step=i;$("#coachT").textContent=TUT_STEPS[i][0];$("#coachS").textContent=TUT_STEPS[i][1];$("#coach").hidden=false;if(i)SFX.guess();say(TUT_STEPS[i][0])};
    const stop=()=>{clearInterval(poll);$("#coach").hidden=true;$("#coachSkip").onclick=null;store.set("ts-tut",true);tutActive=null};
    tutActive={cancel:()=>{stop();done(false)}};
    const ready=()=>handoff({label:"Tutorial complete",who:"You're ready!",info:"Every game works the same way: aim, hold the button, draw. Have fun!",go:"Let's play",onGo:()=>done(true)});
    $("#coachSkip").onclick=()=>{stop();abortDraw();done(true)};
    startDraw({tutorial:true,who:"Tutorial",word:"sun",strokes:[],dur:0,live:true,onEnd:()=>{stop();ready()},onError:()=>{stop();done(true)}});
    set(0);
    poll=setInterval(()=>{
      if(D.state!=="run")return;
      const ink=D.strokes.filter(s=>s.c!=="#FFFFFF"&&s.pts.length),pts=ink.reduce((a,s)=>a+s.pts.length,0);
      if(step===0){if(!p0){p0={...D.pos};t0=Date.now()}if(Math.hypot(D.pos.x-p0.x,D.pos.y-p0.y)>.08||Date.now()-t0>7000||D.pen)set(1)}
      else if(step===1&&ink.length&&pts>20&&!D.pen)set(2);
      else if(step===2&&!D.pen){if(liveGuess===D.word)set(3);else if(ink.length>=6){wait=wait||Date.now();if(Date.now()-wait>3000)set(4)}}},250);
  })}
const _readyToDraw=readyToDraw;
readyToDraw=async function(){if(!(await _readyToDraw()))return false;return tutorialNeeded()?await runTutorial():true};
$("#cTutorial").onclick=async()=>{if(!(await _readyToDraw()))return;await runTutorial();renderChallengeCards();show("s-home")};
