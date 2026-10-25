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
const esc=t=>String(t).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
function show(id){document.querySelectorAll(".screen").forEach(s=>s.hidden=s.id!==id);const s=$("#"+id);if(s)s.scrollTop=0}

