import { useRef, useEffect, useState, useCallback } from "react";

// ─── CONFIG — paste your values here before deploying ────────────────────────
const SHEET_ID  = "1f23ZJlW1waX-7ON2iQveyghZx-yxbjNB0UqrIzasVcU";
const API_KEY   = "AIzaSyD-qMeKXarXTsP37UNjXSoSIx0KlTfOsBM"; // paste your new Google Cloud API key here
const BASE_URL  = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}`;

// ─── Google Sheets helpers ────────────────────────────────────────────────────
const sheetsRead = async (range) => {
  const res = await fetch(`${BASE_URL}/values/${range}?key=${API_KEY}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.values || [];
};

const sheetsWrite = async (range, values) => {
  await fetch(`${BASE_URL}/values/${range}?valueInputOption=RAW&key=${API_KEY}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ values }),
  });
};

const sheetsAppend = async (range, values) => {
  await fetch(`${BASE_URL}/values/${range}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS&key=${API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ values }),
  });
};

const sheetsClear = async (range) => {
  await fetch(`${BASE_URL}/values/${range}:clear?key=${API_KEY}`, { method: "POST" });
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const usd = (n) => new Intl.NumberFormat("en-US", { style:"currency", currency:"USD", maximumFractionDigits:0 }).format(Math.round(Number(n)||0));
const pct = (a,b) => b>0?Math.round((a/b)*100):0;
const uid = () => Date.now()+"_"+Math.random().toString(36).slice(2,7);

const CAT_EMOJI = { Housing:"🏠",Transport:"🚗",Utilities:"💡",Insurance:"🛡️",Subscriptions:"📱",Debt:"💳",Groceries:"🛒",Dining:"🍕",Gas:"⛽",Health:"💊",Shopping:"🛍️",Entertainment:"🎬",Kids:"👶","Personal Care":"💅",Travel:"✈️",Other:"📦" };
const BILL_CATS = ["Housing","Transport","Utilities","Insurance","Subscriptions","Debt","Other"];
const EXP_CATS  = ["Groceries","Dining","Gas","Health","Shopping","Entertainment","Kids","Personal Care","Travel","Other"];

const autocat = (name) => {
  const n = name.toLowerCase();
  if (/grocery|whole foods|trader|safeway|kroger|shoprite|aldi|costco/.test(n)) return "Groceries";
  if (/restaurant|mcdonald|burger|pizza|dunkin|starbucks|chipotle|doordash|ubereats|grubhub|panera|taco|subway|chick/.test(n)) return "Dining";
  if (/shell|exxon|bp|chevron|mobil|sunoco|citgo|speedway|wawa|gas/.test(n)) return "Gas";
  if (/cvs|walgreen|rite.aid|pharmacy|health|doctor|medical|hospital/.test(n)) return "Health";
  if (/amazon|target|walmart|best.buy|home.depot|lowes|tj.maxx|macy|nordstrom/.test(n)) return "Shopping";
  if (/netflix|hulu|spotify|disney|hbo|apple|youtube|prime/.test(n)) return "Subscriptions";
  if (/uber|lyft|parking|transit|metro|bus|train|toll/.test(n)) return "Transport";
  if (/daycare|school|tuition|toys|child/.test(n)) return "Kids";
  if (/spa|salon|haircut|beauty|nail/.test(n)) return "Personal Care";
  if (/hotel|airbnb|flight|airline|delta|united|american|southwest/.test(n)) return "Travel";
  return "Other";
};

// ─── Uncontrolled input (prevents keyboard dismiss on mobile) ─────────────────
function F({ lbl, ph, type="text", def="", save, pre, full, style:sx }) {
  const ref = useRef();
  useEffect(() => { if (ref.current) ref.current.value = def!==undefined?String(def):""; }, []);
  return (
    <div style={{ marginBottom: full?12:0 }}>
      {lbl && <div style={LS.lbl}>{lbl}</div>}
      <div style={{ position:"relative" }}>
        {pre && <span style={{ position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",color:"#8fa3be",fontSize:15,pointerEvents:"none" }}>$</span>}
        <input ref={ref} type={type} inputMode={type==="number"?"decimal":"text"} placeholder={ph}
          defaultValue={def}
          onBlur={e => save&&save(e.target.value)}
          style={{ ...LS.inp, ...(pre?{paddingLeft:26}:{}), ...(sx||{}) }} />
      </div>
    </div>
  );
}

const LS = {
  lbl: { fontSize:11,color:"#8fa3be",textTransform:"uppercase",letterSpacing:0.6,marginBottom:5,display:"block" },
  inp: { width:"100%",background:"#1e2f45",border:"1px solid rgba(255,255,255,0.09)",borderRadius:10,padding:"11px 13px",fontSize:15,color:"#e8edf4",fontFamily:"inherit",outline:"none",boxSizing:"border-box",WebkitAppearance:"none" },
};

const Chips = ({ opts, val, set }) => (
  <div style={{ display:"flex",flexWrap:"wrap",gap:5,marginTop:4 }}>
    {opts.map(o => (
      <span key={o} onClick={()=>set(o)} style={{ padding:"5px 11px",borderRadius:20,fontSize:12,fontWeight:500,cursor:"pointer",border:`1px solid ${val===o?"#00c9a7":"rgba(255,255,255,0.08)"}`,background:val===o?"rgba(0,201,167,.15)":"#1e2f45",color:val===o?"#00c9a7":"#8fa3be",userSelect:"none" }}>
        {CAT_EMOJI[o]||""} {o}
      </span>
    ))}
  </div>
);

const Seg = ({ opts, val, set }) => (
  <div style={{ display:"flex",background:"#162236",borderRadius:10,padding:3,gap:3,marginBottom:14 }}>
    {opts.map(([id,lbl]) => (
      <button key={id} onClick={()=>set(id)} style={{ flex:1,padding:"7px 4px",border:"none",borderRadius:8,fontSize:12,fontWeight:600,cursor:"pointer",background:val===id?"#263852":"transparent",color:val===id?"#e8edf4":"#8fa3be",fontFamily:"inherit" }}>{lbl}</button>
    ))}
  </div>
);

const Card = ({ children, sx }) => <div style={{ background:"#162236",borderRadius:18,padding:"14px 16px",marginBottom:12,border:"1px solid rgba(255,255,255,0.07)",...(sx||{}) }}>{children}</div>;
const Barz = ({ p, col }) => <div style={{ height:7,background:"#1e2f45",borderRadius:4,overflow:"hidden",marginTop:5 }}><div style={{ height:"100%",width:`${Math.min(100,p)}%`,background:col,borderRadius:4,transition:"width .5s" }}/></div>;
const X = ({ go }) => <button onClick={go} style={{ background:"none",border:"none",color:"#4a6080",fontSize:20,cursor:"pointer",padding:"0 4px",lineHeight:1 }}>×</button>;

const ACard = ({ type, text }) => {
  const m = { tip:["rgba(0,201,167,.1)","rgba(0,201,167,.3)","#00c9a7","✦ Tip"], warning:["rgba(245,166,35,.1)","rgba(245,166,35,.3)","#f5a623","⚠ Watch"], alert:["rgba(231,76,60,.1)","rgba(231,76,60,.3)","#e74c3c","⚡ Action"] };
  const [bg,bd,ac,bj] = m[type]||m.tip;
  return <div style={{ background:bg,border:`1px solid ${bd}`,borderRadius:14,padding:14,marginBottom:10 }}><div style={{ display:"inline-block",fontSize:10,fontWeight:700,padding:"3px 9px",borderRadius:10,marginBottom:7,background:bd,color:ac,textTransform:"uppercase",letterSpacing:0.5 }}>{bj}</div><div style={{ fontSize:13,color:"#e8edf4",lineHeight:1.55 }}>{text}</div></div>;
};

const TABS = [
  {id:"dash", icon:"📊",lbl:"Overview"},
  {id:"inc",  icon:"💰",lbl:"Income"},
  {id:"bills",icon:"📋",lbl:"Bills"},
  {id:"exp",  icon:"🛒",lbl:"Spend"},
  {id:"cc",   icon:"💳",lbl:"Credit"},
  {id:"inv",  icon:"📈",lbl:"Invest"},
  {id:"goals",icon:"🎯",lbl:"Goals"},
];

const TITLES = {
  dash: ["Financial Overview", new Date().toLocaleString("default",{month:"long",year:"numeric"})],
  inc:  ["Income","Household earnings"],
  bills:["Bills","Fixed obligations"],
  exp:  ["Expenses","Variable spending"],
  cc:   ["Credit Cards","Track balances & limits"],
  inv:  ["Investments","401k · 457b · 529 · UTMA"],
  goals:["Goals & Savings","Funds, scores & fun money"],
};

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab]         = useState("dash");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [syncErr, setSyncErr] = useState(false);

  // State
  const [takehome, setTakehome] = useState(0);
  const [otherInc, setOtherInc] = useState([]);
  const [bills,    setBills]    = useState([]);
  const [billFreq, setBillFreq] = useState("monthly");
  const [billCat,  setBillCat]  = useState("Housing");
  const [expenses, setExpenses] = useState([]);
  const [expCat,   setExpCat]   = useState("Groceries");
  const [csvMsg,   setCsvMsg]   = useState("");
  const [cards,    setCards]    = useState([]);
  const [inv,      setInv]      = useState({ my401k:0,sp401k:0,my457b:0,sp457b:0,myC:0,spC:0,match:50,roth:0,s529:0,utma:0 });
  const [retire,   setRetire]   = useState({ myAge:0,retireAt:65,rate:7 });
  const [hysa,     setHysa]     = useState({ efBal:0,efC:0,vacBal:0,vacGoal:0,vacC:0 });
  const [myFun,    setMyFun]    = useState({ bal:0,mo:0 });
  const [spFun,    setSpFun]    = useState({ bal:0,mo:0 });
  const [scores,   setScores]   = useState({ me:0,sp:0 });
  const [fw,       setFw]       = useState({ n:50,w:30,s:20 });

  // ── Derived ────────────────────────────────────────────────────────────────
  const bil     = bills.reduce((s,b)=>s+(b.freq==="monthly"?b.amt:b.freq==="quarterly"?b.amt/3:b.amt/12),0);
  const exp     = expenses.reduce((s,e)=>s+e.amt,0);
  const invM    = inv.myC+inv.spC+inv.roth+inv.s529+inv.utma;
  const inc     = takehome+otherInc.reduce((s,o)=>s+o.amt,0);
  const surplus = inc-bil-exp-invM;
  const cardBal = cards.reduce((s,c)=>s+c.bal,0);
  const cardMin = cards.reduce((s,c)=>s+c.min,0);
  const health  = inc>0?Math.max(0,Math.min(100,Math.round(100-pct(bil+exp,inc)+(surplus>0?5:-5)))):0;

  // ── Load from Google Sheets on mount ──────────────────────────────────────
  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true); setSyncErr(false);
    try {
      // Settings sheet: A1=takehome, B1=fw.n, C1=fw.w, D1=fw.s
      // E1=retire.myAge, F1=retire.retireAt, G1=retire.rate
      // H1=inv.my401k, I1=inv.sp401k, J1=inv.my457b, K1=inv.sp457b
      // L1=inv.myC, M1=inv.spC, N1=inv.match, O1=inv.roth, P1=inv.s529, Q1=inv.utma
      // R1=hysa.efBal, S1=hysa.efC, T1=hysa.vacBal, U1=hysa.vacGoal, V1=hysa.vacC
      // W1=myFun.bal, X1=myFun.mo, Y1=spFun.bal, Z1=spFun.mo
      // AA1=scores.me, AB1=scores.sp
      const settings = await sheetsRead("Settings!A1:AB1");
      if (settings.length && settings[0].length) {
        const r = settings[0];
        const g = (i,d=0) => parseFloat(r[i])||d;
        setTakehome(g(0));
        setFw({ n:g(1,50),w:g(2,30),s:g(3,20) });
        setRetire({ myAge:g(4),retireAt:g(5,65),rate:g(6,7) });
        setInv({ my401k:g(7),sp401k:g(8),my457b:g(9),sp457b:g(10),myC:g(11),spC:g(12),match:g(13,50),roth:g(14),s529:g(15),utma:g(16) });
        setHysa({ efBal:g(17),efC:g(18),vacBal:g(19),vacGoal:g(20),vacC:g(21) });
        setMyFun({ bal:g(22),mo:g(23) });
        setSpFun({ bal:g(24),mo:g(25) });
        setScores({ me:g(26),sp:g(27) });
      }

      // Bills: id,name,amt,cat,freq
      const billRows = await sheetsRead("Bills!A2:E200");
      setBills(billRows.map(r=>({ id:r[0],name:r[1],amt:parseFloat(r[2])||0,cat:r[3],freq:r[4] })));

      // Expenses: id,name,amt,cat
      const expRows = await sheetsRead("Expenses!A2:D500");
      setExpenses(expRows.map(r=>({ id:r[0],name:r[1],amt:parseFloat(r[2])||0,cat:r[3] })));

      // Other Income: id,name,amt,freq
      const incRows = await sheetsRead("OtherIncome!A2:D50");
      setOtherInc(incRows.map(r=>({ id:r[0],name:r[1],amt:parseFloat(r[2])||0,freq:r[3] })));

      // Cards: id,name,limit,bal,apr,due,min
      const cardRows = await sheetsRead("Cards!A2:G50");
      setCards(cardRows.map(r=>({ id:r[0],name:r[1],limit:parseFloat(r[2])||0,bal:parseFloat(r[3])||0,apr:parseFloat(r[4])||20,due:r[5]||"",min:parseFloat(r[6])||0 })));

      setLastSync(new Date());
    } catch(e) {
      setSyncErr(true);
    }
    setLoading(false);
  };

  // ── Save helpers ───────────────────────────────────────────────────────────
  const saveSettings = useCallback(async (overrides={}) => {
    setSyncing(true);
    const s = { takehome,fw,retire,inv,hysa,myFun,spFun,scores,...overrides };
    await sheetsWrite("Settings!A1:AB1", [[
      s.takehome, s.fw.n, s.fw.w, s.fw.s,
      s.retire.myAge, s.retire.retireAt, s.retire.rate,
      s.inv.my401k, s.inv.sp401k, s.inv.my457b, s.inv.sp457b,
      s.inv.myC, s.inv.spC, s.inv.match, s.inv.roth, s.inv.s529, s.inv.utma,
      s.hysa.efBal, s.hysa.efC, s.hysa.vacBal, s.hysa.vacGoal, s.hysa.vacC,
      s.myFun.bal, s.myFun.mo, s.spFun.bal, s.spFun.mo,
      s.scores.me, s.scores.sp,
    ]]);
    setLastSync(new Date());
    setSyncing(false);
  }, [takehome,fw,retire,inv,hysa,myFun,spFun,scores]);

  const saveBills = useCallback(async (newBills) => {
    setSyncing(true);
    await sheetsClear("Bills!A2:E200");
    if (newBills.length) await sheetsAppend("Bills!A2:E200", newBills.map(b=>[b.id,b.name,b.amt,b.cat,b.freq]));
    setLastSync(new Date()); setSyncing(false);
  }, []);

  const saveExpenses = useCallback(async (newExp) => {
    setSyncing(true);
    await sheetsClear("Expenses!A2:D500");
    if (newExp.length) await sheetsAppend("Expenses!A2:D500", newExp.map(e=>[e.id,e.name,e.amt,e.cat]));
    setLastSync(new Date()); setSyncing(false);
  }, []);

  const saveOtherInc = useCallback(async (newInc) => {
    setSyncing(true);
    await sheetsClear("OtherIncome!A2:D50");
    if (newInc.length) await sheetsAppend("OtherIncome!A2:D50", newInc.map(o=>[o.id,o.name,o.amt,o.freq]));
    setLastSync(new Date()); setSyncing(false);
  }, []);

  const saveCards = useCallback(async (newCards) => {
    setSyncing(true);
    await sheetsClear("Cards!A2:G50");
    if (newCards.length) await sheetsAppend("Cards!A2:G50", newCards.map(c=>[c.id,c.name,c.limit,c.bal,c.apr,c.due,c.min]));
    setLastSync(new Date()); setSyncing(false);
  }, []);

  // ── Style constants ────────────────────────────────────────────────────────
  const scr = { padding:"0 16px 110px" };
  const R2  = { display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12 };
  const R3  = { display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:12 };
  const ST  = { fontSize:15,fontWeight:700,color:"#e8edf4",marginBottom:10,marginTop:6 };
  const ML  = { fontSize:10,color:"#8fa3be",textTransform:"uppercase",letterSpacing:0.5 };
  const MV  = (c) => ({ fontSize:22,fontWeight:800,color:c||"#e8edf4",marginTop:4 });
  const ER  = { display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:"1px solid rgba(255,255,255,0.06)" };
  const EI  = (bg) => ({ width:36,height:36,borderRadius:10,background:bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,flexShrink:0 });
  const MC  = { background:"#162236",borderRadius:16,padding:"14px 13px",border:"1px solid rgba(255,255,255,0.07)" };
  const BTN = { width:"100%",padding:13,background:"#00c9a7",color:"#0b1624",border:"none",borderRadius:12,fontSize:15,fontWeight:700,fontFamily:"inherit",cursor:"pointer" };
  const sc  = { color:h=>h>=740?"#2ecc71":h>=670?"#f5a623":"#e74c3c", lbl:h=>h>=740?"Excellent":h>=670?"Good":h>=580?"Fair":"Needs Work" };

  // ── Dashboard ──────────────────────────────────────────────────────────────
  const Dash = () => {
    const r=54,circ=2*Math.PI*r,col=health>=70?"#00c9a7":health>=40?"#f5a623":"#e74c3c";
    const savPct=Math.min(100,pct(Math.max(0,surplus+invM),inc*fw.s/100));
    const ads=[];
    if(!inc){ads.push({t:"tip",x:"Start by entering your combined take-home pay in the Income tab."});}
    else{
      const bp=pct(bil,inc),sp2=pct(Math.max(0,surplus+invM),inc);
      if(bp>50)ads.push({t:"alert",x:`Bills are ${bp}% of income — above the 50% threshold. Review and cut where possible.`});
      else ads.push({t:"tip",x:`Bills at ${bp}% — healthy! The 50/30/20 rule targets needs ≤50%.`});
      if(sp2<10)ads.push({t:"alert",x:`Saving ${sp2}% — aim for 20%+. Automate a transfer to your HYSA first.`});
      else if(sp2<20)ads.push({t:"warning",x:`Saving ${sp2}%. Push to 20% by trimming dining or subscriptions.`});
      else ads.push({t:"tip",x:`${sp2}% savings + investing rate — excellent! Consider maxing 401(k) at $23,500/yr each.`});
      const oc=cards.filter(c=>pct(c.bal,c.limit)>30);
      if(oc.length)ads.push({t:"warning",x:`${oc.length} card(s) above 30% utilization. Pay down to protect your credit score.`});
      const dueCards=cards.filter(c=>c.due);
      if(dueCards.length)ads.push({t:"tip",x:`Payment reminders: ${dueCards.map(c=>`${c.name} due day ${c.due}`).join(" · ")}. Goal: pay every card to $0 each month.`});
    }
    const bars=[
      {lbl:"Needs / Bills",used:bil,target:inc*fw.n/100},
      {lbl:"Wants / Spending",used:exp,target:inc*fw.w/100},
      {lbl:"Savings & Investing",used:Math.max(0,surplus+invM),target:inc*fw.s/100,flip:true},
    ];
    return(
      <div style={scr}>
        <div style={{display:"flex",justifyContent:"center",margin:"8px 0 16px",position:"relative"}}>
          <svg width="140" height="140" viewBox="0 0 140 140">
            <circle cx="70" cy="70" r={r} fill="none" stroke="#1e2f45" strokeWidth="12"/>
            <circle cx="70" cy="70" r={r} fill="none" stroke={col} strokeWidth="12" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ*(1-health/100)} transform="rotate(-90 70 70)"/>
            <circle cx="70" cy="70" r="40" fill="none" stroke="#263852" strokeWidth="9"/>
            <circle cx="70" cy="70" r="40" fill="none" stroke="#a78bfa" strokeWidth="9" strokeLinecap="round" strokeDasharray={2*Math.PI*40} strokeDashoffset={2*Math.PI*40*(1-savPct/100)} transform="rotate(-90 70 70)"/>
          </svg>
          <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",textAlign:"center"}}>
            <div style={{fontSize:28,fontWeight:800,color:col}}>{health}%</div>
            <div style={{fontSize:10,color:"#8fa3be"}}>Health Score</div>
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
          {[["Joint Income",usd(inc),"#2ecc71","/month"],["Bills",usd(bil),"#e74c3c",pct(bil,inc)+"% of income"],["Discretionary",usd(exp),"#f5a623",pct(exp,inc)+"% of income"],["Net Surplus",usd(surplus),surplus>=0?"#00c9a7":"#e74c3c",surplus>=0?"available":"over budget"]].map(([l,v,c,s])=>(
            <div key={l} style={MC}><div style={ML}>{l}</div><div style={MV(c)}>{v}</div><div style={{fontSize:11,color:"#8fa3be",marginTop:3}}>{s}</div></div>
          ))}
        </div>
        {cardBal>0&&<Card sx={{marginBottom:12}}><div style={{display:"flex",justifyContent:"space-between"}}><div><div style={ML}>Total Card Debt</div><div style={MV("#e74c3c")}>{usd(cardBal)}</div></div><div style={{textAlign:"right"}}><div style={ML}>Min. Payments</div><div style={MV("#f5a623")}>{usd(cardMin)}</div></div></div></Card>}
        {inc>0&&<><div style={ST}>Budget Breakdown</div>{bars.map(b=>{const p2=pct(b.used,b.target),over=!b.flip&&p2>100,warn=!b.flip&&p2>80&&p2<=100,low=b.flip&&p2<50;const c2=over?"#e74c3c":warn||low?"#f5a623":"#00c9a7";const st=b.flip?(p2>=100?"✓ On Track":p2>=50?"⚠ Below Goal":"↑ Boost"):(over?"✗ Over Budget":warn?"⚠ Near Limit":"✓ On Track");return(<div key={b.lbl} style={{marginBottom:16}}><div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontSize:13}}>{b.lbl}</span><span style={{fontSize:11,fontWeight:700,color:c2}}>{st}</span></div><div style={{display:"flex",justifyContent:"space-between",marginTop:2}}><span style={{fontSize:11,color:"#8fa3be"}}>{usd(b.used)} of {usd(b.target)}</span><span style={{fontSize:11,color:"#8fa3be"}}>{p2}%</span></div><Barz p={p2} col={c2}/></div>);})}</>}
        <div style={ST}>Insights & Reminders</div>
        {ads.map((a,i)=><ACard key={i} type={a.t} text={a.x}/>)}
        <div style={{textAlign:"center",marginTop:16}}>
          <button onClick={loadAll} style={{background:"transparent",border:"1px solid rgba(0,201,167,.3)",color:"#00c9a7",borderRadius:10,padding:"8px 20px",fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>🔄 Refresh from Sheets</button>
          {lastSync&&<div style={{fontSize:10,color:"#4a6080",marginTop:6}}>Last synced: {lastSync.toLocaleTimeString()}</div>}
        </div>
      </div>
    );
  };

  // ── Income ─────────────────────────────────────────────────────────────────
  const Inc = () => {
    const nr=useRef(""),ar=useRef("");
    return(
      <div style={scr}>
        <Card>
          <div style={{fontSize:13,color:"#8fa3be",marginBottom:10}}>💑 Joint checking account — combined household income</div>
          <F lbl="Combined Monthly Take-Home (after tax)" ph="10,500" type="number" pre
            def={takehome||""} save={async v=>{const val=parseFloat(v)||0;setTakehome(val);await saveSettings({takehome:val});}} full/>
          <div style={{fontSize:11,color:"#4a6080",marginTop:4}}>Your actual net bank deposit — both salaries after 401(k) deductions.</div>
        </Card>
        <div style={ST}>Additional Income Sources</div>
        {otherInc.map(o=>(
          <div key={o.id} style={ER}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <div style={EI("rgba(46,204,113,.12)")}>💵</div>
              <div><div style={{fontSize:14}}>{o.name}</div><div style={{fontSize:11,color:"#8fa3be"}}>{o.freq} · {usd(o.amt)}/mo</div></div>
            </div>
            <X go={async()=>{const n=otherInc.filter(x=>x.id!==o.id);setOtherInc(n);await saveOtherInc(n);}}/>
          </div>
        ))}
        <Card>
          <div style={R2}>
            <F lbl="Description" ph="Freelance, bonus…" save={v=>{nr.current=v}}/>
            <F lbl="Monthly $" type="number" pre ph="500" save={v=>{ar.current=v}}/>
          </div>
          <button style={BTN} onClick={async()=>{
            if(!nr.current||!ar.current)return;
            const n=[...otherInc,{id:uid(),name:nr.current,amt:parseFloat(ar.current)||0,freq:"monthly"}];
            setOtherInc(n);await saveOtherInc(n);nr.current="";ar.current="";
          }}>+ Add Income Source</button>
        </Card>
        <Card sx={{textAlign:"center"}}>
          <div style={{fontSize:11,color:"#8fa3be",marginBottom:4}}>Total Monthly Household Income</div>
          <div style={{fontSize:38,fontWeight:800,color:"#2ecc71"}}>{usd(inc)}</div>
        </Card>
      </div>
    );
  };

  // ── Bills ──────────────────────────────────────────────────────────────────
  const Bills2 = () => {
    const nr=useRef(""),ar=useRef("");
    return(
      <div style={scr}>
        <Seg opts={[["monthly","Monthly"],["quarterly","Quarterly"],["yearly","Yearly"]]} val={billFreq} set={setBillFreq}/>
        <Card>
          <div style={R2}>
            <F lbl="Bill Name" ph="Mortgage, Netflix…" save={v=>{nr.current=v}}/>
            <F lbl="Amount" type="number" pre ph="1,800" save={v=>{ar.current=v}}/>
          </div>
          <div style={{marginBottom:12}}><div style={LS.lbl}>Category</div><Chips opts={BILL_CATS} val={billCat} set={setBillCat}/></div>
          <button style={BTN} onClick={async()=>{
            if(!nr.current||!ar.current)return;
            const n=[...bills,{id:uid(),name:nr.current,amt:parseFloat(ar.current)||0,cat:billCat,freq:billFreq}];
            setBills(n);await saveBills(n);nr.current="";ar.current="";
          }}>+ Add Bill</button>
        </Card>
        {bills.length===0&&<div style={{color:"#4a6080",textAlign:"center",padding:20,fontSize:13}}>No bills added yet</div>}
        {bills.map(b=>(
          <div key={b.id} style={ER}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <div style={EI("rgba(231,76,60,.12)")}>{CAT_EMOJI[b.cat]}</div>
              <div><div style={{fontSize:14,fontWeight:500}}>{b.name}</div><div style={{fontSize:11,color:"#8fa3be"}}>{b.cat} · {b.freq}</div></div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:14,fontWeight:700,color:"#e74c3c"}}>{usd(b.amt)}</div>
                <div style={{fontSize:10,color:"#8fa3be"}}>{b.freq==="monthly"?"/mo":b.freq==="quarterly"?"= "+usd(b.amt/3)+"/mo":"= "+usd(b.amt/12)+"/mo"}</div>
              </div>
              <X go={async()=>{const n=bills.filter(x=>x.id!==b.id);setBills(n);await saveBills(n);}}/>
            </div>
          </div>
        ))}
        {bills.length>0&&<Card sx={{marginTop:10,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div><div style={ML}>Monthly Equivalent</div><div style={MV("#e74c3c")}>{usd(bil)}</div></div>
          <div style={{textAlign:"right"}}><div style={ML}>% of Income</div><div style={MV(pct(bil,inc)>50?"#e74c3c":"#e8edf4")}>{pct(bil,inc)}%</div></div>
        </Card>}
      </div>
    );
  };

  // ── Expenses ───────────────────────────────────────────────────────────────
  const Exp = () => {
    const nr=useRef(""),ar=useRef("");
    const bycat=EXP_CATS.map(c=>({cat:c,total:expenses.filter(e=>e.cat===c).reduce((s,e)=>s+e.amt,0)})).filter(x=>x.total>0);
    const handleCSV=(e)=>{
      const f=e.target.files[0];if(!f)return;
      const r=new FileReader();
      r.onload=async(ev)=>{
        const lines=ev.target.result.split("\n").filter(l=>l.trim());
        let count=0;const ne=[];
        lines.slice(1).forEach(line=>{
          const cols=line.split(",").map(c=>c.replace(/"/g,"").trim());
          let desc="",amount=0;
          for(let i=0;i<cols.length;i++){const v=parseFloat(cols[i].replace(/[$,\s]/g,""));if(!isNaN(v)&&v>0&&v<50000&&amount===0)amount=v;if(isNaN(parseFloat(cols[i]))&&cols[i].length>2&&!desc)desc=cols[i];}
          if(desc&&amount>0){ne.push({id:uid(),name:desc.slice(0,28),amt:amount,cat:autocat(desc)});count++;}
        });
        const n=[...expenses,...ne];setExpenses(n);await saveExpenses(n);
        setCsvMsg(`✓ Imported ${count} transactions, auto-categorized`);setTimeout(()=>setCsvMsg(""),4000);
      };
      r.readAsText(f);e.target.value="";
    };
    return(
      <div style={scr}>
        <div onClick={()=>document.getElementById("csvIn").click()} style={{border:"2px dashed rgba(0,201,167,.35)",borderRadius:16,padding:"20px 16px",textAlign:"center",marginBottom:14,cursor:"pointer",position:"relative"}}>
          <input type="file" accept=".csv" id="csvIn" style={{position:"absolute",inset:0,opacity:0,cursor:"pointer"}} onChange={handleCSV}/>
          <div style={{fontSize:28,marginBottom:6}}>📂</div>
          <div style={{fontSize:14,fontWeight:600,marginBottom:3}}>Import Bank / Card CSV</div>
          <div style={{fontSize:12,color:"#8fa3be"}}>Chase · BofA · Citi · Wells Fargo · Amex</div>
        </div>
        {csvMsg&&<div style={{padding:"10px 14px",background:"rgba(0,201,167,.1)",border:"1px solid rgba(0,201,167,.3)",borderRadius:10,fontSize:12,color:"#00c9a7",marginBottom:12}}>{csvMsg}</div>}
        <Card>
          <div style={R2}>
            <F lbl="Description" ph="Groceries, dining…" save={v=>{nr.current=v}}/>
            <F lbl="Amount" type="number" pre ph="120" save={v=>{ar.current=v}}/>
          </div>
          <div style={{marginBottom:12}}><div style={LS.lbl}>Category</div><Chips opts={EXP_CATS} val={expCat} set={setExpCat}/></div>
          <button style={BTN} onClick={async()=>{
            if(!nr.current||!ar.current)return;
            const n=[...expenses,{id:uid(),name:nr.current,amt:parseFloat(ar.current)||0,cat:expCat}];
            setExpenses(n);await saveExpenses(n);nr.current="";ar.current="";
          }}>+ Add Expense</button>
        </Card>
        {bycat.length>0&&<><div style={ST}>By Category</div>{bycat.map(({cat,total})=><div key={cat} style={{marginBottom:14}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}><span style={{fontSize:13}}>{CAT_EMOJI[cat]} {cat}</span><span style={{fontSize:13,fontWeight:700,color:"#f5a623"}}>{usd(total)}</span></div><Barz p={inc>0?pct(total,inc*fw.w/100):50} col="#f5a623"/></div>)}</>}
        {expenses.length>0&&<><div style={ST}>All Transactions</div>{expenses.map(e=>(
          <div key={e.id} style={ER}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <div style={EI("rgba(245,166,35,.12)")}>{CAT_EMOJI[e.cat]||"📦"}</div>
              <div><div style={{fontSize:14,fontWeight:500}}>{e.name}</div><div style={{fontSize:11,color:"#8fa3be"}}>{e.cat}</div></div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:14,fontWeight:700,color:"#f5a623"}}>{usd(e.amt)}</span>
              <X go={async()=>{const n=expenses.filter(x=>x.id!==e.id);setExpenses(n);await saveExpenses(n);}}/>
            </div>
          </div>
        ))}</>}
        {expenses.length>0&&<Card sx={{marginTop:10,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div><div style={ML}>Total Expenses</div><div style={MV("#f5a623")}>{usd(exp)}</div></div>
          <div style={{textAlign:"right"}}><div style={ML}>% of Income</div><div style={MV(pct(exp,inc)>fw.w?"#e74c3c":"#e8edf4")}>{pct(exp,inc)}%</div></div>
        </Card>}
      </div>
    );
  };

  // ── Credit Cards ───────────────────────────────────────────────────────────
  const CC = () => {
    const nr=useRef(""),lr=useRef(""),br=useRef(""),ar=useRef(""),dr=useRef("");
    return(
      <div style={scr}>
        <Card><div style={{fontSize:13,color:"#8fa3be",lineHeight:1.55}}>🎯 <strong style={{color:"#e8edf4"}}>Goal:</strong> Pay every card to $0 each month to maximize cash-back and avoid interest. Keep utilization under 30% to protect your credit score.</div></Card>
        <Card>
          <div style={R2}>
            <F lbl="Card Name" ph="Chase Sapphire…" save={v=>{nr.current=v}}/>
            <F lbl="Credit Limit" type="number" pre ph="10,000" save={v=>{lr.current=v}}/>
          </div>
          <div style={R2}>
            <F lbl="Current Balance" type="number" pre ph="0" save={v=>{br.current=v}}/>
            <F lbl="APR %" type="number" ph="20.99" save={v=>{ar.current=v}}/>
          </div>
          <F lbl="Payment Due (day of month)" type="number" ph="25" save={v=>{dr.current=v}} full/>
          <button style={BTN} onClick={async()=>{
            if(!nr.current||!lr.current)return;
            const lim=parseFloat(lr.current)||0,bal=parseFloat(br.current)||0;
            const min=Math.max(25,bal*0.02);
            const n=[...cards,{id:uid(),name:nr.current,limit:lim,bal,apr:parseFloat(ar.current)||20,due:dr.current,min}];
            setCards(n);await saveCards(n);
            nr.current="";lr.current="";br.current="";ar.current="";dr.current="";
          }}>+ Add Card</button>
        </Card>
        {cards.map(c=>{
          const util=pct(c.bal,c.limit),col=util>50?"#e74c3c":util>30?"#f5a623":"#2ecc71",avail=c.limit-c.bal;
          const payM=c.bal>0&&c.apr>0?Math.ceil(-Math.log(1-(c.bal*(c.apr/100/12))/Math.max(c.min,c.bal*0.02+1))/Math.log(1+c.apr/100/12)):0;
          return(
            <Card key={c.id}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
                <div><div style={{fontSize:16,fontWeight:700}}>{c.name}</div>{c.due&&<div style={{fontSize:11,color:"#8fa3be",marginTop:2}}>📅 Pay by day {c.due} each month</div>}</div>
                <X go={async()=>{const n=cards.filter(x=>x.id!==c.id);setCards(n);await saveCards(n);}}/>
              </div>
              <div style={R3}>
                {[["Balance",usd(c.bal),col],["Available",usd(avail),"#2ecc71"],["Limit",usd(c.limit),"#8fa3be"]].map(([l,v,cl])=>(
                  <div key={l} style={{background:"#1e2f45",borderRadius:10,padding:"10px 8px",textAlign:"center"}}>
                    <div style={{fontSize:14,fontWeight:700,color:cl}}>{v}</div>
                    <div style={{fontSize:10,color:"#8fa3be",marginTop:2}}>{l}</div>
                  </div>
                ))}
              </div>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                <span style={{fontSize:12,color:"#8fa3be"}}>Utilization</span>
                <span style={{fontSize:12,fontWeight:700,color:col}}>{util}%</span>
              </div>
              <Barz p={util} col={col}/>
              {c.bal>0&&<div style={{marginTop:10,padding:"8px 10px",background:"rgba(0,201,167,.08)",borderRadius:8,fontSize:12,color:"#8fa3be"}}>
                Min. payment: <strong style={{color:"#e8edf4"}}>{usd(c.min)}</strong>
                {c.apr>0&&payM>1&&<span> · At min. rate: ~{payM} months to pay off</span>}
                <div style={{marginTop:4,color:"#00c9a7",fontWeight:600}}>✓ Pay full {usd(c.bal)} by month-end → saves {usd(c.bal*c.apr/100/12)} in interest</div>
              </div>}
              {util>30&&<div style={{marginTop:8,padding:"7px 10px",background:"rgba(231,76,60,.08)",borderRadius:8,fontSize:12,color:"#e74c3c"}}>⚠ Above 30% utilization — pay down to {usd(c.limit*0.3)} for score boost</div>}
            </Card>
          );
        })}
        {cards.length>0&&<Card sx={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div><div style={ML}>Total Card Debt</div><div style={MV("#e74c3c")}>{usd(cardBal)}</div></div>
          <div style={{textAlign:"right"}}><div style={ML}>Min. Due</div><div style={MV("#f5a623")}>{usd(cardMin)}</div></div>
        </Card>}
      </div>
    );
  };

  // ── Investments ────────────────────────────────────────────────────────────
  const Inv = () => {
    const totalBal=inv.my401k+inv.sp401k+inv.my457b+inv.sp457b;
    const years=Math.max(0,retire.retireAt-retire.myAge);
    const r=retire.rate/100,ann=(inv.myC+inv.spC)*12;
    const nest=totalBal*Math.pow(1+r,years)+(r>0?ann*(Math.pow(1+r,years)-1)/r:ann*years);
    const upd=async(field,val)=>{const ni={...inv,[field]:parseFloat(val)||0};setInv(ni);await saveSettings({inv:ni});};
    const upR=async(field,val)=>{const nr={...retire,[field]:parseFloat(val)||0};setRetire(nr);await saveSettings({retire:nr});};
    return(
      <div style={scr}>
        <div style={ST}>🏦 Retirement Accounts</div>
        <div style={{fontSize:12,color:"#8fa3be",marginBottom:10}}>2025 limits: 401(k) $23,500 · 457(b) $23,500 · Roth IRA $7,000/person</div>
        <Card>
          <div style={R2}>
            <F lbl="Your 401(k) Balance" type="number" pre ph="50,000" def={inv.my401k||""} save={v=>upd("my401k",v)}/>
            <F lbl="Your Monthly Contrib." type="number" pre ph="800" def={inv.myC||""} save={v=>upd("myC",v)}/>
          </div>
          <div style={R2}>
            <F lbl="Spouse 401(k) Balance" type="number" pre ph="40,000" def={inv.sp401k||""} save={v=>upd("sp401k",v)}/>
            <F lbl="Spouse Monthly Contrib." type="number" pre ph="600" def={inv.spC||""} save={v=>upd("spC",v)}/>
          </div>
          <div style={R2}>
            <F lbl="Your 457(b) Balance" type="number" pre ph="0" def={inv.my457b||""} save={v=>upd("my457b",v)}/>
            <F lbl="Spouse 457(b) Balance" type="number" pre ph="0" def={inv.sp457b||""} save={v=>upd("sp457b",v)}/>
          </div>
          <F lbl="Employer Match %" type="number" ph="50" def={inv.match||""} save={v=>upd("match",v)} full/>
        </Card>
        <Card>
          <div style={{fontSize:14,fontWeight:700,marginBottom:10}}>Roth IRA</div>
          <F lbl="Combined Monthly Contribution" type="number" pre ph="583" def={inv.roth||""} save={v=>upd("roth",v)} full/>
          <div style={{fontSize:11,color:"#4a6080"}}>Max $7,000/yr each = $1,167/mo combined</div>
        </Card>
        <div style={ST}>👶 Son's Accounts</div>
        <Card>
          <div style={R2}>
            <F lbl="529 Monthly Contribution" type="number" pre ph="200" def={inv.s529||""} save={v=>upd("s529",v)}/>
            <F lbl="UTMA Monthly Contribution" type="number" pre ph="100" def={inv.utma||""} save={v=>upd("utma",v)}/>
          </div>
          <div style={{fontSize:11,color:"#4a6080"}}>529: tax-free college savings · UTMA: custodial investing (transfers at 18–21)</div>
        </Card>
        <div style={ST}>📊 Retirement Projection</div>
        <Card>
          <div style={R2}>
            <F lbl="Your Age" type="number" ph="35" def={retire.myAge||""} save={v=>upR("myAge",v)}/>
            <F lbl="Retire At Age" type="number" ph="65" def={retire.retireAt} save={v=>upR("retireAt",v)}/>
          </div>
          <F lbl="Expected Annual Return %" type="number" ph="7" def={retire.rate} save={v=>upR("rate",v)} full/>
        </Card>
        {totalBal>0&&<Card sx={{textAlign:"center"}}>
          <div style={{fontSize:11,color:"#8fa3be",marginBottom:4}}>PROJECTED NEST EGG</div>
          <div style={{fontSize:40,fontWeight:800,color:"#00c9a7"}}>{nest>1000000?"$"+(nest/1000000).toFixed(1)+"M":usd(nest)}</div>
          <div style={{fontSize:12,color:"#8fa3be",marginTop:4}}>{retire.rate}% return over {years} yrs</div>
          <div style={{fontSize:13,color:"#2ecc71",marginTop:8}}>~{usd(nest*0.04/12)}/mo at 4% withdrawal</div>
        </Card>}
        <Card sx={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div><div style={ML}>Monthly to Investments</div><div style={MV("#a78bfa")}>{usd(invM)}</div></div>
          <div style={{textAlign:"right"}}><div style={ML}>% of Income</div><div style={MV("#a78bfa")}>{pct(invM,inc)}%</div></div>
        </Card>
      </div>
    );
  };

  // ── Goals ──────────────────────────────────────────────────────────────────
  const Goals = () => {
    const efGoal=(bil+exp)*6,efPct=efGoal>0?pct(hysa.efBal,efGoal):0;
    const vacPct=hysa.vacGoal>0?pct(hysa.vacBal,hysa.vacGoal):0;
    const updH=async(field,val)=>{const nh={...hysa,[field]:parseFloat(val)||0};setHysa(nh);await saveSettings({hysa:nh});};
    const updMF=async(field,val)=>{const n={...myFun,[field]:parseFloat(val)||0};setMyFun(n);await saveSettings({myFun:n});};
    const updSF=async(field,val)=>{const n={...spFun,[field]:parseFloat(val)||0};setSpFun(n);await saveSettings({spFun:n});};
    const updSc=async(field,val)=>{const n={...scores,[field]:parseFloat(val)||0};setScores(n);await saveSettings({scores:n});};
    return(
      <div style={scr}>
        <div style={ST}>🏦 High-Yield Savings Account</div>
        <div style={{fontSize:12,color:"#8fa3be",marginBottom:10}}>Emergency fund + vacation fund live here — separate from joint checking.</div>
        <Card>
          <div style={{fontSize:14,fontWeight:700,marginBottom:10}}>🛡️ Emergency Fund <span style={{fontSize:11,color:"#8fa3be",fontWeight:400}}>— 6-month target</span></div>
          <div style={{fontSize:28,fontWeight:800,color:"#00c9a7",marginBottom:4}}>{usd(hysa.efBal)}</div>
          <div style={{fontSize:12,color:"#8fa3be",marginBottom:6}}>Goal: {usd(efGoal)} · {efPct}% funded</div>
          <Barz p={efPct} col={efPct>=100?"#2ecc71":efPct>=50?"#f5a623":"#e74c3c"}/>
          <div style={{...R2,marginTop:12}}>
            <F lbl="Current Balance" type="number" pre ph="0" def={hysa.efBal||""} save={v=>updH("efBal",v)}/>
            <F lbl="Monthly Contribution" type="number" pre ph="200" def={hysa.efC||""} save={v=>updH("efC",v)}/>
          </div>
          {efPct<100&&efGoal>0&&<div style={{fontSize:12,color:"#00c9a7"}}>Need {usd(efGoal-hysa.efBal)} more · ~{hysa.efC>0?Math.ceil((efGoal-hysa.efBal)/hysa.efC):"?"} months at current rate</div>}
        </Card>
        <Card>
          <div style={{fontSize:14,fontWeight:700,marginBottom:10}}>✈️ Vacation Fund</div>
          <div style={{fontSize:28,fontWeight:800,color:"#a78bfa",marginBottom:4}}>{usd(hysa.vacBal)}</div>
          <div style={{fontSize:12,color:"#8fa3be",marginBottom:6}}>{hysa.vacGoal>0?`Goal: ${usd(hysa.vacGoal)} · ${vacPct}% funded`:"Set a goal below"}</div>
          {hysa.vacGoal>0&&<Barz p={vacPct} col="#a78bfa"/>}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginTop:12}}>
            <F lbl="Balance" type="number" pre ph="0" def={hysa.vacBal||""} save={v=>updH("vacBal",v)}/>
            <F lbl="Goal" type="number" pre ph="5,000" def={hysa.vacGoal||""} save={v=>updH("vacGoal",v)}/>
            <F lbl="Monthly" type="number" pre ph="200" def={hysa.vacC||""} save={v=>updH("vacC",v)}/>
          </div>
        </Card>
        <div style={ST}>💸 Personal Fun Money</div>
        <div style={{fontSize:12,color:"#8fa3be",marginBottom:10}}>Individual spending accounts — no questions asked money for each of you.</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
          {[[myFun,updMF,"Your Account"],[spFun,updSF,"Spouse Account"]].map(([state,upd2,lbl])=>(
            <Card key={lbl} sx={{margin:0}}>
              <div style={{fontSize:13,fontWeight:700,marginBottom:8}}>👤 {lbl}</div>
              <div style={{fontSize:22,fontWeight:800,color:"#2ecc71",marginBottom:8}}>{usd(state.bal)}</div>
              <F lbl="Balance" type="number" pre ph="0" def={state.bal||""} save={v=>upd2("bal",v)}/>
              <div style={{marginTop:8}}><F lbl="Monthly" type="number" pre ph="150" def={state.mo||""} save={v=>upd2("mo",v)}/></div>
            </Card>
          ))}
        </div>
        {(myFun.mo+spFun.mo)>0&&<ACard type="tip" text={`Combined fun money: ${usd(myFun.mo+spFun.mo)}/mo — smart way to maintain independence within a joint budget.`}/>}
        <div style={ST}>💯 Credit Scores</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
          {[["me","Your Score"],[" sp","Spouse Score"]].map(([key,lbl])=>{
            const k=key.trim(),val=scores[k]||0;
            return(
              <Card key={lbl} sx={{margin:0,border:`2px solid ${val?sc.color(val):"#263852"}`,textAlign:"center"}}>
                <div style={{fontSize:10,color:"#8fa3be",marginBottom:8}}>{lbl.toUpperCase()}</div>
                <div style={{fontSize:36,fontWeight:800,color:val?sc.color(val):"#4a6080"}}>{val||"—"}</div>
                {val>0&&<div style={{fontSize:12,fontWeight:600,color:sc.color(val),marginTop:4}}>{sc.lbl(val)}</div>}
                <div style={{marginTop:10}}><F type="number" ph="720" def={val||""} save={v=>updSc(k,v)}/></div>
              </Card>
            );
          })}
        </div>
        {(scores.me>0||scores.sp>0)&&<>
          <ACard type="tip" text="800+ Exceptional · 740–799 Very Good · 670–739 Good · 580–669 Fair · <580 Poor. Keep utilization under 10% for max score impact."/>
          {((scores.me>0&&scores.me<740)||(scores.sp>0&&scores.sp<740))&&<ACard type="warning" text="Score below 740: pay all cards to $0 monthly, keep utilization under 10%, avoid opening new accounts unnecessarily."/>}
        </>}
      </div>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────
  const views = { dash:<Dash/>,inc:<Inc/>,bills:<Bills2/>,exp:<Exp/>,cc:<CC/>,inv:<Inv/>,goals:<Goals/> };
  const [pt,ps] = TITLES[tab];

  if (loading) return (
    <div style={{fontFamily:"'SF Pro Display',-apple-system,sans-serif",background:"#0b1624",color:"#e8edf4",minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16}}>
      <div style={{fontSize:40}}>📊</div>
      <div style={{fontSize:18,fontWeight:700}}>Loading your budget…</div>
      <div style={{fontSize:13,color:"#8fa3be"}}>Fetching from Google Sheets</div>
      {syncErr&&<div style={{fontSize:13,color:"#e74c3c",marginTop:8,textAlign:"center",padding:"0 32px"}}>⚠ Could not connect to Google Sheets.<br/>Check your API key and Sheet ID.</div>}
    </div>
  );

  return(
    <div style={{fontFamily:"'SF Pro Display',-apple-system,BlinkMacSystemFont,sans-serif",background:"#0b1624",color:"#e8edf4",minHeight:"100vh",maxWidth:430,margin:"0 auto",position:"relative"}}>
      <div style={{padding:"48px 18px 0",marginBottom:2,display:"flex",justifyContent:"space-between",alignItems:"flex-end"}}>
        <div>
          <div style={{fontSize:26,fontWeight:800,color:"#e8edf4",letterSpacing:-0.5}}>{pt}</div>
          <div style={{fontSize:13,color:"#8fa3be",marginBottom:14}}>{ps}</div>
        </div>
        {syncing&&<div style={{fontSize:11,color:"#00c9a7",marginBottom:14}}>⏳ Saving…</div>}
      </div>
      {views[tab]}
      <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:430,background:"rgba(8,16,28,.97)",borderTop:"1px solid rgba(255,255,255,0.08)",display:"flex",padding:"8px 2px 22px",zIndex:100}}>
        {TABS.map(({id,icon,lbl})=>(
          <button key={id} onClick={()=>setTab(id)} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2,cursor:"pointer",padding:"5px 2px",border:"none",background:"transparent",color:tab===id?"#00c9a7":"#4a6080",fontFamily:"inherit"}}>
            <span style={{fontSize:21}}>{icon}</span>
            <span style={{fontSize:9,fontWeight:600,letterSpacing:0.2}}>{lbl}</span>
          </button>
        ))}
      </div>
    </div>
  );
}