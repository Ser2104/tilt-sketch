/* ---------- Progress and reports ---------- */
const CHARTS=[
  {key:"score",title:"Session score",unit:"",better:"higher",color:"--accent"},
  {key:"steady",title:"Steadiness",unit:"",better:"higher",color:"--go"},
  {key:"smooth",title:"Smoothness",unit:"",better:"higher",color:"--chart3"},
  {key:"rom",title:"Range used",unit:"°",better:"higher",color:"--chart4"}
];
function sessionValue(s,key){
  if(key==="steady")return s.avg.tremorAmp==null?null:steadiness(s.avg.tremorAmp);
  if(key==="rom")return s.avg.romX==null?null:(s.avg.romX+s.avg.romY)/2;
  return s.avg[key]}
function cssVar(n){return getComputedStyle(document.documentElement).getPropertyValue(n).trim()||"#888"}
function lineChart(canvas,vals,{color,unit}){
  const k=devicePixelRatio,w=canvas.clientWidth*k,h=canvas.clientHeight*k;canvas.width=w;canvas.height=h;
  const g=canvas.getContext("2d"),pts=vals.map((v,i)=>[i,v]).filter(p=>p[1]!=null);
  g.clearRect(0,0,w,h);const pad={l:34*k,r:10*k,t:10*k,b:20*k},ink=cssVar("--muted"),line=cssVar("--line"),c=cssVar(color);
  g.font=`${11*k}px ${getComputedStyle(document.body).fontFamily}`;g.fillStyle=ink;
  if(!pts.length){g.fillText("No sessions yet",pad.l,h/2);return}
  let lo=Math.min(...pts.map(p=>p[1])),hi=Math.max(...pts.map(p=>p[1]));if(hi-lo<10){const m=(hi+lo)/2;hi=m+5;lo=m-5}lo=Math.max(0,lo-(hi-lo)*.15);hi+= (hi-lo)*.15;
  const X=i=>pad.l+(vals.length<2?.5:i/(vals.length-1))*(w-pad.l-pad.r),Y=v=>h-pad.b-(v-lo)/(hi-lo)*(h-pad.t-pad.b);
  g.strokeStyle=line;g.lineWidth=k;for(let i=0;i<=3;i++){const v=lo+(hi-lo)*i/3,y=Y(v);g.beginPath();g.moveTo(pad.l,y);g.lineTo(w-pad.r,y);g.stroke();g.fillText(Math.round(v)+unit,2*k,y+4*k)}
  g.fillText("1",X(0)-3*k,h-4*k);if(vals.length>1)g.fillText(String(vals.length),X(vals.length-1)-6*k,h-4*k);
  g.beginPath();pts.forEach(([i,v],j)=>j?g.lineTo(X(i),Y(v)):g.moveTo(X(i),Y(v)));g.lineTo(X(pts[pts.length-1][0]),h-pad.b);g.lineTo(X(pts[0][0]),h-pad.b);g.closePath();
  g.globalAlpha=.12;g.fillStyle=c;g.fill();g.globalAlpha=1;
  g.strokeStyle=c;g.lineWidth=2.5*k;g.beginPath();pts.forEach(([i,v],j)=>j?g.lineTo(X(i),Y(v)):g.moveTo(X(i),Y(v)));g.stroke();
  const[li,lv]=pts[pts.length-1];g.fillStyle=c;g.beginPath();g.arc(X(li),Y(lv),4*k,0,7);g.fill();
}
function trendText(vals){const v=vals.filter(x=>x!=null);if(v.length<2)return"";const a=v.slice(0,Math.ceil(v.length/2)),b=v.slice(Math.floor(v.length/2));
  const m=x=>x.reduce((s,y)=>s+y,0)/x.length,d=m(b)-m(a);return Math.abs(d)<1?"Stable":d>0?`Up ${Math.round(d)}`:`Down ${Math.round(-d)}`}
let PV=null,PBACK=null;
function openProgress(p=Profiles.cur(),back=openPractice){
  if(!p)return openPractice();PV=p;PBACK=back;$("#prBack").textContent=back===openPractice?"Back to practice":"Back to patients";
  $("#prName").textContent=p.name;
  const ss=p.sessions;
  $("#prKpis").innerHTML=[[ss.length,"Sessions"],[p.level,"Current level"],[ss.length?Math.round(Math.max(...ss.map(s=>s.avg.score||0))):"–","Best score"],[p.rom?`${fmt(p.rom.x)}° × ${fmt(p.rom.y)}°`:"Not set","Comfortable range"]].map(([a,b])=>`<div class="kpi"><b>${a}</b><span>${b}</span></div>`).join("");
  $("#prCharts").innerHTML=CHARTS.map(c=>`<figure class="chart"><figcaption><span>${c.title}</span><em id="tr-${c.key}"></em></figcaption><canvas id="ch-${c.key}" aria-label="${c.title} by session"></canvas></figure>`).join("");
  show("s-prog");
  CHARTS.forEach(c=>{const vals=ss.map(s=>sessionValue(s,c.key));lineChart($("#ch-"+c.key),vals,c);$("#tr-"+c.key).textContent=trendText(vals)});
  $("#prTable").innerHTML=ss.length?`<table><thead><tr><th>Date</th><th>Score</th><th>Level</th><th>Steadiness</th><th>Smoothness</th><th>Range</th></tr></thead><tbody>${ss.slice().reverse().slice(0,20).map(s=>`<tr><td>${new Date(s.date).toLocaleDateString()}</td><td>${fmt(s.avg.score)}</td><td>${s.level0}→${s.level1}</td><td>${fmt(sessionValue(s,"steady"))}</td><td>${fmt(s.avg.smooth)}</td><td>${fmt(sessionValue(s,"rom"))}°</td></tr>`).join("")}</tbody></table>`:`<p class="hint">Complete a practice session to see your progress here.</p>`;
}
function toCSV(p){
  const cols=["date","exercise","level","score","path_covered_pct","accuracy_pct","tremor_rms_deg","tremor_peak_hz","smoothness","ldlj","angular_speed_deg_s","range_x_deg","range_y_deg","active_s"];
  const rows=[cols.join(",")];
  p.sessions.forEach(s=>s.exercises.forEach(e=>rows.push([s.date,`"${e.label}"`,e.level,e.score,e.coverage,e.accuracy,e.tremorAmp,e.tremorHz,e.smooth??"",e.ldlj??"",e.speed,e.romX,e.romY,e.active].join(","))));
  return rows.join("\n")}
function download(name,text,type){const b=new Blob([text],{type}),a=document.createElement("a");a.href=URL.createObjectURL(b);a.download=name;document.body.append(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000)}
$("#prCsv").onclick=()=>{const p=PV;if(p)download(`tilt-sketch-${p.name.replace(/\W+/g,"-")}.csv`,toCSV(p),"text/csv")};
$("#prShare").onclick=async()=>{const p=PV;if(!p)return;const f=new File([toCSV(p)],`tilt-sketch-${p.name.replace(/\W+/g,"-")}.csv`,{type:"text/csv"});
  try{if(navigator.canShare&&navigator.canShare({files:[f]}))await navigator.share({files:[f],title:"Tilt Sketch progress"});else $("#prCsv").click()}catch(_){}};
$("#prReport").onclick=()=>openReport();
$("#prBack").onclick=()=>(PBACK||openPractice)();
function openReport(){
  const p=PV;if(!p)return;const ss=p.sessions;
  const first=ss[0],last=ss[ss.length-1];
  $("#rpMeta").textContent=`${p.name} · ${ss.length} session${ss.length===1?"":"s"}${first?` · ${new Date(first.date).toLocaleDateString()} to ${new Date(last.date).toLocaleDateString()}`:""} · generated ${new Date().toLocaleDateString()}`;
  const rows=CHARTS.map(c=>{const v=ss.map(s=>sessionValue(s,c.key)).filter(x=>x!=null);return`<tr><td>${c.title}</td><td>${v.length?fmt(v[0]):"–"}${c.unit}</td><td>${v.length?fmt(v[v.length-1]):"–"}${c.unit}</td><td>${trendText(ss.map(s=>sessionValue(s,c.key)))||"–"}</td></tr>`}).join("");
  $("#rpSummary").innerHTML=`<table><thead><tr><th>Measure</th><th>First session</th><th>Latest session</th><th>Trend</th></tr></thead><tbody>${rows}</tbody></table>`;
  $("#rpCharts").innerHTML=CHARTS.map(c=>`<figure class="chart"><figcaption><span>${c.title}</span></figcaption><canvas id="rc-${c.key}"></canvas></figure>`).join("");
  $("#rpRange").textContent=p.rom?`Comfortable range at calibration (${new Date(p.rom.date).toLocaleDateString()}): ${fmt(p.rom.x)}° side to side, ${fmt(p.rom.y)}° up and down.`:"Range not calibrated.";
  show("s-report");
  CHARTS.forEach(c=>lineChart($("#rc-"+c.key),ss.map(s=>sessionValue(s,c.key)),c));
}
$("#rpPrint").onclick=()=>window.print();
$("#rpBack").onclick=()=>openProgress(PV,PBACK);
