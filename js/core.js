const $=s=>document.querySelector(s);
const TARGETS={"cat":["cat"],"dog":["dog"],"house":["house"],"tree":["tree"],"bicycle":["bicycle"],"airplane":["airplane"],"guitar":["guitar"],"umbrella":["umbrella"],"cup":["cup","coffee_cup","mug"],"flower":["flower"],"key":["key"],"clock":["clock","alarm_clock","wristwatch"],"shoe":["shoe"],"mountain":["mountain"],"sailboat":["sailboat"],"ice cream":["ice_cream"],"scissors":["scissors"],"eyeglasses":["eyeglasses"],"fish":["fish"],"hat":["hat"],"snail":["snail"],"light bulb":["light_bulb"],"sea turtle":["sea_turtle"],"ladder":["ladder","stairs"],"cloud":["cloud"],"hammer":["hammer"],"hamburger":["hamburger"],"crown":["crown"],"pizza":["pizza"],"sun":["sun"],"moon":["moon"],"star":["star"],"butterfly":["butterfly"],"spider":["spider"],"castle":["castle"],"train":["train"],"car":["car"],"pineapple":["pineapple"],"strawberry":["strawberry"],"mushroom":["mushroom"],"cactus":["cactus"],"penguin":["penguin"],"giraffe":["giraffe"],"elephant":["elephant"],"snake":["snake"],"fork":["fork"],"lighthouse":["lighthouse"],"tent":["tent"],"rainbow":["rainbow"],"snowman":["snowman"],"television":["television"],"pencil":["pencil"],"candle":["candle"],"smiley face":["smiley_face"],"hot air balloon":["hot_air_balloon"],"watermelon":["watermelon"],"octopus":["octopus"],"whale":["whale"],"owl":["owl"],"shark":["shark"],"helicopter":["helicopter"],"hourglass":["hourglass"],"skull":["skull"],"lightning":["lightning"],"snowflake":["snowflake"],"sword":["sword"],"helmet":["helmet"],"dragon":["dragon"],"flying saucer":["flying_saucer"],"mermaid":["mermaid"],"angel":["angel"],"diamond":["diamond"],"bee":["bee"],"rabbit":["rabbit"],"frog":["frog"],"camera":["camera"],"headphones":["headphones"],"Eiffel Tower":["The_Eiffel_Tower"]};
/* The AI knows every object in TARGETS, but players are only asked to draw ones with a shape nothing else shares. */
const AMBIGUOUS=new Set(["moon","cloud","lightning","snake","pencil","candle","diamond","hourglass","mountain","tent","television","hat","shoe","helmet","fork","frog","key","ladder",
  "sun","star","tree","flower","cup","light bulb","sword","angel","mermaid","dragon","watermelon","hammer","dog"]);
const WORDS=Object.keys(TARGETS).filter(w=>!AMBIGUOUS.has(w));
const PAIRS=[["cat","dog"],["apple","pear"],["sun","star"],["guitar","violin"],["mug","wine glass"],["bicycle","motorbike"],["airplane","bird"],["house","castle"],["ice cream","cake"],["shoe","sock"],["moon","banana"],["tree","palm tree"],["rocket","airplane"],["clock","compass"],["fish","whale"],["hat","helmet"],["key","lock"],["sailboat","submarine"],["snake","worm"],["umbrella","beach umbrella"]];
const COLORS=["#13213C","#E63946","#F4A261","#2A9D8F","#3A86FF","#8338EC","#6B4226"];
const SIZES=[.004,.008,.015];
const MIN={solo:2,teams:4,impostor:4};
const DEF_T={solo:15,teams:10,impostor:10};
const FOV_W=50;

const S={mode:"solo",players:["Alex","Sam","Maya","Leo"],time:{...DEF_T},rounds:3,input:"gyro",gyro:"untested",lock:false,sens:22,ctrl:"look",disc:30,vote:30,cam:false};
const ZOOM=2.4;
let G=null;

const shuffle=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.random()*(i+1)|0;[a[i],a[j]]=[a[j],a[i]]}return a};
const up=w=>w.toUpperCase();
const esc=t=>String(t).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const imgOk=u=>typeof u==="string"&&/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(u)?u:"";
const pct=v=>Math.max(0,Math.min(100,Math.round(+v)||0));
function show(id){document.querySelectorAll(".screen").forEach(s=>s.hidden=s.id!==id);const s=$("#"+id);if(s)s.scrollTop=0}

const BAD_NAME=/(n+i+g{2,}|n+[iy]+g+r|n+[iy]+g+[ea]+r+[sz]*$|n+[iy]+g+u+h|f+a+g+|k+i+k+e|c+h+i+n+k|r+e+t+a+r+d|n+a+z+i|h+i+t+l+e+r|w+h+o+r+e|s+l+u+t|c+u+n+t|r+a+p+i+s+t|p+u+t+[ao]|m+a+r+i+c+[ao]|m+a+r+i+c+o+n|z+o+r+r+a|v+e+r+g+a|c+u+l+e+r+o|p+e+n+d+e+j|c+o+n+c+h+a+t+u|c+h+u+p+a+m)/;
const HOMO={"а":"a","е":"e","і":"i","ј":"j","о":"o","р":"p","с":"c","у":"y","х":"x","к":"k","м":"m","т":"t","в":"b","н":"h"};
function nameOk(n){n=String(n||"");if(/[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/.test(n))return false;
  const t=n.replace(/[а-яіј]/gi,c=>HOMO[c.toLowerCase()]||c).normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[0134@$!|5]/g,c=>({"0":"o","1":"i","3":"e","4":"a","@":"a","$":"s","!":"i","|":"i","5":"s"})[c]).replace(/[^a-z]/g,"");return!BAD_NAME.test(t)}

/* ---------- Android app: links point to the public site ---------- */
const IS_APP=!!(window.Capacitor&&Capacitor.isNativePlatform&&Capacitor.isNativePlatform());
const PUBLIC_URL=IS_APP?"https://ser2104.github.io/tilt-sketch/index.html":location.origin+location.pathname;
const REHAB=(()=>{try{const q=new URLSearchParams(location.search);if(q.has("rehab")||q.has("clinic"))localStorage.setItem("ts-rehab","1");return localStorage.getItem("ts-rehab")==="1"}catch(_){return false}})();
document.documentElement.classList.toggle("no-rehab",!REHAB);
