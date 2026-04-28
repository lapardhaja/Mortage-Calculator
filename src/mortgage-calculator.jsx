import { useState, useMemo, useCallback, useRef, useEffect } from "react";

function useMediaQuery(query) {
  const [matches, setMatches] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(query).matches : false
  );
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    mql.addEventListener("change", onChange);
    setMatches(mql.matches);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

// ─── Formatting ─────────────────────────────────────────────────────────────
const fmt  = (n) => "$" + Math.round(n).toLocaleString("en-US");
const fmtK = (n) => {
  if (Math.abs(n) >= 1_000_000) return "$" + (n/1_000_000).toFixed(2) + "M";
  if (Math.abs(n) >= 1_000)     return "$" + (n/1_000).toFixed(1) + "K";
  return "$" + Math.round(n).toLocaleString("en-US");
};
const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function monthYearLabel(absMonth, startYear, startMonth) {
  const totalM = startMonth - 1 + absMonth - 1;
  return `${MONTHS_SHORT[totalM % 12]} ${startYear + Math.floor(totalM / 12)}`;
}
function absMonthToDate(absMonth, startYear, startMonth) {
  const totalM = startMonth - 1 + absMonth - 1;
  return { year: startYear + Math.floor(totalM / 12), month: totalM % 12 };
}
function dateToAbsMonth(year, month, startYear, startMonth) {
  return (year - startYear) * 12 + (month - startMonth + 1);
}

/** e.g. 107 → "8 years 11 months" */
function formatYearsMonths(totalMonths) {
  const y = Math.floor(totalMonths / 12);
  const m = totalMonths % 12;
  const parts = [];
  if (y > 0) parts.push(`${y} year${y === 1 ? "" : "s"}`);
  if (m > 0) parts.push(`${m} month${m === 1 ? "" : "s"}`);
  if (parts.length === 0) return "0 months";
  return parts.join(" ");
}

// ─── Amortization Engine ─────────────────────────────────────────────────────
/** @typedef {'monthly'|'biweekly'} PaymentMode */
/**
 * Biweekly (accelerated): half the contractual monthly P&I every 2 weeks.
 * Modeled on monthly accrual as paying 13/12 of the monthly P&I each month
 * (≈ 26 half-payments per year vs 24) — common lender/calculator simplification.
 */
function computeAmortization(principal, annualRate, termYears, periods = [], paymentMode = "monthly") {
  const r   = annualRate / 100 / 12;
  const n   = termYears * 12;
  const pmt = (principal * r * Math.pow(1+r,n)) / (Math.pow(1+r,n) - 1);
  const scheduledMonthlyPI = paymentMode === "biweekly" ? pmt * (13 / 12) : pmt;
  let bal = principal, totalInt = 0, month = 0;
  const schedule = [];
  while (bal > 0.01 && month < n) {
    month++;
    const interest = bal * r;
    const extra    = periods.reduce((s,p) => month>=p.from && month<=p.to ? s+p.amount : s, 0);
    let   prin     = scheduledMonthlyPI - interest + extra;
    if (prin > bal) prin = bal;
    bal      -= prin;
    totalInt += interest;
    schedule.push({
      month, year: Math.ceil(month/12),
      interest: Math.round(interest),
      principal: Math.round(prin - extra),
      extra: Math.round(Math.min(extra, prin + extra - (scheduledMonthlyPI - interest))),
      balance: Math.max(0, Math.round(bal)),
      totalInterest: Math.round(totalInt),
      scheduledPI: Math.round(scheduledMonthlyPI),
    });
  }
  return {
    schedule,
    totalInterest: totalInt,
    months: month,
    pmt,
    paymentMode,
    scheduledMonthlyPI,
    biweeklyHalfPayment: paymentMode === "biweekly" ? pmt / 2 : null,
  };
}

function totalScheduledCashOut(amort) {
  return amort.scheduledMonthlyPI * amort.months;
}

const PERIOD_COLORS = [
  { bg:"#10b981", glow:"rgba(16,185,129,0.18)",  border:"rgba(16,185,129,0.35)"  },
  { bg:"#f59e0b", glow:"rgba(245,158,11,0.18)",  border:"rgba(245,158,11,0.35)"  },
  { bg:"#818cf8", glow:"rgba(129,140,248,0.18)", border:"rgba(129,140,248,0.35)" },
  { bg:"#f472b6", glow:"rgba(244,114,182,0.18)", border:"rgba(244,114,182,0.35)" },
  { bg:"#38bdf8", glow:"rgba(56,189,248,0.18)",  border:"rgba(56,189,248,0.35)"  },
];

const THEME_STORAGE_KEY = "mc-theme";
const THEME_VARS = {
  dark: {
    "--mc-bg": "#080d17",
    "--mc-text": "#e2e8f0",
    "--mc-text-muted": "#64748b",
    "--mc-text-dim": "#475569",
    "--mc-text-arrow": "#334155",
    "--mc-text-secondary": "#94a3b8",
    "--mc-heading": "#f8fafc",
    "--mc-surface": "#0f172a",
    "--mc-well": "#080d17",
    "--mc-elevated": "#1e293b",
    "--mc-border": "#1e293b",
    "--mc-input-well": "#1e293b",
    "--mc-input-text": "#f1f5f9",
    "--mc-step-bg": "#1e293b",
    "--mc-step-fg": "#94a3b8",
    "--mc-pill-bg": "#1e293b",
    "--mc-pill-active-fg": "#0f172a",
    "--mc-pill-inactive-fg": "#64748b",
    "--mc-range-track": "#1e293b",
    "--mc-header-bg": "linear-gradient(160deg,#0d1b2e,#080d17)",
    "--mc-header-border": "#1e293b",
    "--mc-select-bg": "#0f172a",
    "--mc-hero-bg": "linear-gradient(135deg,#0c1f2e,#091a0e)",
    "--mc-hero-border": "#1e293b",
    "--mc-compare-surface": "#0f172a",
    "--mc-chart-detail-bg": "#080d17",
    "--mc-chart-detail-border": "#1e293b",
    "--mc-schedule-outer": "#0f172a",
    "--mc-schedule-head": "#080d17",
    "--mc-footer": "#334155",
    "--mc-slider-thumb": "#f8fafc",
    "--mc-thumb-outline": "rgba(15,23,42,.9)",
    "--mc-thumb-glow": "rgba(0,0,0,.45)",
    "--mc-timeline-track": "#1e293b",
    "--mc-networth-body": "#94a3b8",
    "--mc-pdf-bg": "linear-gradient(135deg,#0f2820,#0d1526)",
    "--mc-pdf-border": "rgba(16,185,129,0.27)",
    "--mc-pdf-msg-ok": "#0a1f0f",
    "--mc-pdf-msg-err": "#1f0a0a",
  },
  light: {
    "--mc-bg": "#e8eef4",
    "--mc-text": "#0f172a",
    "--mc-text-muted": "#64748b",
    "--mc-text-dim": "#475569",
    "--mc-text-arrow": "#64748b",
    "--mc-text-secondary": "#64748b",
    "--mc-heading": "#0f172a",
    "--mc-surface": "#ffffff",
    "--mc-well": "#f1f5f9",
    "--mc-elevated": "#e2e8f0",
    "--mc-border": "#cbd5e1",
    "--mc-input-well": "#e2e8f0",
    "--mc-input-text": "#0f172a",
    "--mc-step-bg": "#e2e8f0",
    "--mc-step-fg": "#475569",
    "--mc-pill-bg": "#e2e8f0",
    "--mc-pill-active-fg": "#0f172a",
    "--mc-pill-inactive-fg": "#64748b",
    "--mc-range-track": "#cbd5e1",
    "--mc-header-bg": "linear-gradient(160deg,#e0f2fe,#f8fafc)",
    "--mc-header-border": "#cbd5e1",
    "--mc-select-bg": "#ffffff",
    "--mc-hero-bg": "linear-gradient(135deg,#ecfdf5,#e0f2fe)",
    "--mc-hero-border": "#cbd5e1",
    "--mc-compare-surface": "#ffffff",
    "--mc-chart-detail-bg": "#f8fafc",
    "--mc-chart-detail-border": "#cbd5e1",
    "--mc-schedule-outer": "#ffffff",
    "--mc-schedule-head": "#f1f5f9",
    "--mc-footer": "#94a3b8",
    "--mc-slider-thumb": "#ffffff",
    "--mc-thumb-outline": "rgba(15,23,42,.18)",
    "--mc-thumb-glow": "rgba(15,23,42,.12)",
    "--mc-timeline-track": "#cbd5e1",
    "--mc-networth-body": "#475569",
    "--mc-pdf-bg": "linear-gradient(135deg,#ecfdf5,#d1fae5)",
    "--mc-pdf-border": "rgba(5,150,105,0.35)",
    "--mc-pdf-msg-ok": "#ecfdf5",
    "--mc-pdf-msg-err": "#fef2f2",
  },
};
let _id = 10;

// ─── NumInput — stepper + slider + typeable field ───────────────────────────
function NumInput({ label, value, onDec, onInc, onChange, min, max, step, sliderColor="#38bdf8", prefix="$", suffix="", decimals=0, note="", comfortable=false }) {
  const [editing, setEditing] = useState(false);
  const [raw,     setRaw]     = useState("");
  const inputRef = useRef(null);
  const fs = comfortable ? { lab:13, note:11, val:20, pre:16, rowGap:7 } : { lab:10, note:10, val:17, pre:14, rowGap:5 };
  const sb = comfortable
    ? { ...stepBtnBase, width:52, height:52, borderRadius:12, fontSize:26 }
    : { ...stepBtnBase, width:44, height:44, borderRadius:11, fontSize:22 };

  const display = decimals > 0
    ? value.toFixed(decimals) + suffix
    : Math.round(value).toLocaleString("en-US") + suffix;

  const startEdit = () => {
    setRaw(decimals > 0 ? value.toFixed(decimals) : String(Math.round(value)));
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 30);
  };
  const commitEdit = () => {
    const parsed = parseFloat(raw.replace(/[^0-9.]/g,""));
    if (!isNaN(parsed)) onChange(Math.min(max, Math.max(min, parsed)));
    setEditing(false);
  };
  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:fs.rowGap }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline" }}>
        <span style={{ fontSize:fs.lab, letterSpacing:"0.15em", color:"var(--mc-text-muted)", textTransform:"uppercase" }}>{label}</span>
        {note && <span style={{ fontSize:fs.note, color:"var(--mc-text-dim)" }}>{note}</span>}
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:comfortable?6:5 }}>
        <button onClick={onDec} style={sb}>−</button>

        {editing ? (
          <div style={{ flex:1, display:"flex", alignItems:"center", background:"var(--mc-input-well)", borderRadius:8, overflow:"hidden", border:`1px solid ${sliderColor}` }}>
            {prefix && <span style={{ padding:"0 6px", color:"var(--mc-text-muted)", fontSize:fs.pre }}>{prefix}</span>}
            <input
              ref={inputRef}
              value={raw}
              onChange={e => setRaw(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={e => { if (e.key==="Enter") commitEdit(); if (e.key==="Escape") setEditing(false); }}
              style={{ flex:1, background:"transparent", border:"none", outline:"none", color:"var(--mc-input-text)", fontSize:fs.val, fontWeight:700, fontFamily:"'DM Mono', monospace", padding:comfortable?"12px 8px":"9px 5px", width:0, minWidth:0 }}
              inputMode="decimal"
            />
          </div>
        ) : (
          <div onClick={startEdit} title="Tap to type a value"
            style={{ flex:1, textAlign:"center", fontSize:fs.val, fontWeight:700, color:"var(--mc-input-text)", fontVariantNumeric:"tabular-nums", letterSpacing:"-0.02em", cursor:"text", padding:comfortable?"12px 8px":"9px 5px", borderRadius:8, border:"1px solid transparent", transition:"border-color 0.15s" }}
            onMouseEnter={e=>{ e.currentTarget.style.borderColor = "var(--mc-border)"; }}
            onMouseLeave={e=>{ e.currentTarget.style.borderColor = "transparent"; }}>
            {prefix && <span style={{ color:"var(--mc-text-muted)", fontSize:comfortable?15:13 }}>{prefix}</span>}{display}
          </div>
        )}

        <button onClick={onInc} style={sb}>+</button>
      </div>
      <input
        type="range"
        className="num-range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{
          ["--slider-color"]: sliderColor,
          background: `linear-gradient(to right,${sliderColor} ${pct}%,var(--mc-range-track) 0%)`,
        }}
      />
    </div>
  );
}

// ─── MonthYearPicker ─────────────────────────────────────────────────────────
function MonthYearPicker({ label, year, month, onChange, minYear, maxYear, color="#38bdf8", comfortable=false }) {
  const years = [];
  for (let y = minYear; y <= maxYear; y++) years.push(y);
  const lab = comfortable ? 12 : 10;
  const sel = comfortable ? 15 : 13;
  const pad = comfortable ? "10px 8px" : "7px 5px";
  return (
    <div style={{ flex:1 }}>
      <div style={{ fontSize:lab, letterSpacing:"0.15em", color:"var(--mc-text-muted)", textTransform:"uppercase", marginBottom:5 }}>{label}</div>
      <div style={{ display:"flex", gap:4 }}>
        <select value={month} onChange={e=>onChange(year, parseInt(e.target.value))}
          style={{ flex:1, background:"var(--mc-select-bg)", border:`1px solid ${color}44`, borderRadius:7, color, fontSize:sel, padding:pad, fontFamily:"'DM Mono', monospace", outline:"none", cursor:"pointer" }}>
          {MONTHS_SHORT.map((m,i) => <option key={i} value={i}>{m}</option>)}
        </select>
        <select value={year} onChange={e=>onChange(parseInt(e.target.value), month)}
          style={{ flex:1.2, background:"var(--mc-select-bg)", border:`1px solid ${color}44`, borderRadius:7, color, fontSize:sel, padding:pad, fontFamily:"'DM Mono', monospace", outline:"none", cursor:"pointer" }}>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>
    </div>
  );
}

// ─── Shared Styles ────────────────────────────────────────────────────────────
const stepBtnBase = {
  width:38, height:38, borderRadius:10, border:"none",
  background:"var(--mc-step-bg)", color:"var(--mc-step-fg)", fontSize:20, fontWeight:300,
  cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
  flexShrink:0, touchAction:"manipulation", transition:"background 0.15s", fontFamily:"inherit",
};

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const now = new Date();
  const [startYear,  setStartYear]  = useState(now.getFullYear());
  const [startMonth, setStartMonth] = useState(now.getMonth());

  // Purchase + down payment (pct and dollar stay in sync when either is edited)
  const [purchasePrice, setPurchasePrice] = useState(500000);
  const [downMode,      setDownMode]      = useState("pct");
  const [downPct,       setDownPct]       = useState(20);
  const [downDollar,    setDownDollar]    = useState(100000);

  const syncDownFromPct = useCallback((pct) => {
    const p = Math.max(0, Math.min(99, Math.round(pct)));
    setDownPct(p);
    setDownDollar(Math.round((purchasePrice * p) / 100));
  }, [purchasePrice]);

  const syncDownFromDollar = useCallback((d) => {
    const max = purchasePrice;
    const dd = Math.max(0, Math.min(max, d));
    setDownDollar(dd);
    if (max <= 0) {
      setDownPct(0);
      return;
    }
    setDownPct(parseFloat(((dd / max) * 100).toFixed(1)));
  }, [purchasePrice]);

  const downPctRef = useRef(downPct);
  downPctRef.current = downPct;
  const downDollarRef = useRef(downDollar);
  downDollarRef.current = downDollar;
  const downModeRef = useRef(downMode);
  downModeRef.current = downMode;
  useEffect(() => {
    if (downModeRef.current === "dollar") {
      const max = purchasePrice;
      const dd = Math.max(0, Math.min(max, downDollarRef.current));
      setDownDollar(dd);
      if (max <= 0) setDownPct(0);
      else setDownPct(parseFloat(((dd / max) * 100).toFixed(1)));
      return;
    }
    setDownDollar(Math.round((purchasePrice * downPctRef.current) / 100));
  }, [purchasePrice]);

  const downAmount =
    downMode === "dollar"
      ? Math.round(downDollar)
      : Math.round((purchasePrice * downPct) / 100);
  const downPercent = purchasePrice > 0 ? parseFloat(((downDollar / purchasePrice) * 100).toFixed(1)) : 0;
  const principal   = Math.max(0, purchasePrice - downAmount);

  const [rate,      setRate]      = useState(5.5);
  const [term,      setTerm]      = useState(30);
  const [paymentMode, setPaymentMode] = useState("monthly"); // "monthly" | "biweekly"
  const [view,      setView]      = useState("summary");
  const [chartYear, setChartYear] = useState(null);

  // PDF state
  const [pdfStatus, setPdfStatus] = useState("idle"); // idle | generating | done | error
  const [pdfMsg,    setPdfMsg]    = useState("");

  const [colorMode, setColorMode] = useState(() => {
    if (typeof window === "undefined") return "light";
    return localStorage.getItem(THEME_STORAGE_KEY) === "dark" ? "dark" : "light";
  });
  useEffect(() => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, colorMode);
    } catch {
      /* ignore */
    }
  }, [colorMode]);
  const isLight = colorMode === "light";

  const totalMonths = term * 12;

  const [periods, setPeriods] = useState([{ id:1, fromAbs:1, toAbs:360, amount:3000 }]);
  const addPeriod  = () => setPeriods(p=>[...p,{id:_id++,fromAbs:1,toAbs:totalMonths,amount:500}]);
  const delPeriod  = id => setPeriods(p=>p.filter(x=>x.id!==id));
  const updPeriod  = (id,field,val) => setPeriods(p=>p.map(x=>x.id===id?{...x,[field]:val}:x));

  const clampedPeriods = useMemo(()=>periods.map(p=>({
    from: Math.max(1,Math.min(p.fromAbs,totalMonths)),
    to:   Math.max(p.fromAbs,Math.min(p.toAbs,totalMonths)),
    amount:p.amount,
  })),[periods,totalMonths]);

  const base      = useMemo(()=>computeAmortization(principal,rate,term,[],paymentMode),            [principal,rate,term,paymentMode]);
  const withExtra = useMemo(()=>computeAmortization(principal,rate,term,clampedPeriods,paymentMode),[principal,rate,term,clampedPeriods,paymentMode]);

  const savedInt   = Math.round(base.totalInterest - withExtra.totalInterest);
  const savedMo    = base.months - withExtra.months;
  const savedY     = Math.floor(savedMo/12);
  const savedMoR   = savedMo%12;
  const totalExtra = withExtra.schedule.reduce((s,r)=>s+r.extra,0);
  const payoffDate = absMonthToDate(withExtra.months, startYear, startMonth+1);
  const payoffDurationLabel = formatYearsMonths(withExtra.months);

  const rollup = sched => {
    const y={};
    sched.forEach(r=>{
      if(!y[r.year])y[r.year]={int:0,bal:0,extra:0};
      y[r.year].int+=r.interest; y[r.year].bal=r.balance; y[r.year].extra+=r.extra;
    });
    return y;
  };
  const yBase  = useMemo(()=>rollup(base.schedule),      [base]);
  const yExtra = useMemo(()=>rollup(withExtra.schedule),  [withExtra]);
  const years  = Array.from({length:term},(_,i)=>i+1);
  const totalWithExtra = totalScheduledCashOut(withExtra) + totalExtra;

  const activeYears = useMemo(()=>{
    const s=new Set();
    clampedPeriods.forEach(p=>{ for(let m=p.from;m<=p.to;m++) s.add(Math.ceil(m/12)); });
    return s;
  },[clampedPeriods]);

  const mo2label = useCallback(abs=>monthYearLabel(abs,startYear,startMonth+1),[startYear,startMonth]);
  const periodFromDate = p => absMonthToDate(p.fromAbs, startYear, startMonth+1);
  const periodToDate   = p => absMonthToDate(p.toAbs,   startYear, startMonth+1);
  const setFromDate = (id,y,m) => updPeriod(id,"fromAbs",Math.max(1,dateToAbsMonth(y,m,startYear,startMonth)));
  const setToDate   = (id,y,m) => {
    const abs = dateToAbsMonth(y,m,startYear,startMonth);
    updPeriod(id,"toAbs",Math.max(periods.find(x=>x.id===id)?.fromAbs||1,Math.min(abs,totalMonths)));
  };
  const endYear  = startYear + Math.floor((startMonth+totalMonths)/12);

  const isWideLayout = useMediaQuery("(min-width: 640px)");
  const isComfortable = useMediaQuery("(min-width: 820px)");
  const shellMax = isComfortable ? 1080 : 800;
  const padX = isWideLayout ? 12 : "max(12px, env(safe-area-inset-left))";
  const padXR = isWideLayout ? 12 : "max(12px, env(safe-area-inset-right))";

  const cardStyle = (ex = {}) => ({
    background: "var(--mc-surface)",
    border: "1px solid var(--mc-border)",
    borderRadius: isComfortable ? 18 : 16,
    padding: isComfortable ? "22px 20px" : "18px 16px",
    ...ex,
  });
  const pillStyle = (active, color = "#38bdf8") => ({
    padding: "8px 18px",
    borderRadius: 99,
    border: "none",
    cursor: "pointer",
    fontSize: 11,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    background: active ? color : "var(--mc-pill-bg)",
    color: active ? "var(--mc-pill-active-fg)" : "var(--mc-pill-inactive-fg)",
    fontWeight: active ? 700 : 400,
    transition: "all 0.2s",
    flexShrink: 0,
    touchAction: "manipulation",
    fontFamily: "inherit",
  });
  const chartSkin = useMemo(
    () =>
      isLight
        ? {
            grid: "#e2e8f0",
            tick: "#64748b",
            endStroke: "#ffffff",
            circleStroke: "#ffffff",
            bandFill: "rgba(16,185,129,0.08)",
            bandStroke: "rgba(16,185,129,0.35)",
          }
        : {
            grid: "#1e293b",
            tick: "#94a3b8",
            endStroke: "#080d17",
            circleStroke: "#080d17",
            bandFill: "#10b98110",
            bandStroke: "#10b98122",
          },
    [isLight]
  );

  // ─── PDF download (real .pdf via jsPDF; lazy-loaded on first use) ──────────
  const handleExportPDF = async () => {
    setPdfStatus("generating");
    setPdfMsg("Loading PDF engine…");
    try {
      const { downloadMortgagePdf } = await import("./buildMortgagePdf.js");
      setPdfMsg("Creating PDF…");
      downloadMortgagePdf({
        purchasePrice,
        downAmount,
        downPercent,
        principal,
        rate,
        term,
        paymentMode,
        startYear,
        startMonth,
        payoffDate,
        periods,
        base,
        withExtra,
        savedInt,
        savedY,
        savedMoR,
        totalExtra,
      });
      setPdfStatus("done");
      setPdfMsg("PDF saved — check your Downloads folder.");
      setTimeout(() => {
        setPdfStatus("idle");
        setPdfMsg("");
      }, 5000);
    } catch (e) {
      setPdfStatus("error");
      setPdfMsg("Error: " + e.message);
      setTimeout(() => {
        setPdfStatus("idle");
        setPdfMsg("");
      }, 5000);
    }
  };

  return (
    <div
      data-theme={colorMode}
      style={{
        ...THEME_VARS[colorMode],
        minHeight: "100dvh",
        background: "var(--mc-bg)",
        fontFamily: "'DM Sans',Georgia,sans-serif",
        color: "var(--mc-text)",
        overflowX: "hidden",
        paddingLeft: "max(0px, env(safe-area-inset-left))",
        paddingRight: "max(0px, env(safe-area-inset-right))",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
        body { margin:0; }
        select option { background:var(--mc-select-bg); color:var(--mc-text); }
        input.num-range[type=range] {
          -webkit-appearance:none; appearance:none; width:100%; height:24px;
          border-radius:999px; outline:none; cursor:pointer; margin:0;
          background:transparent;
        }
        input.num-range[type=range]::-webkit-slider-runnable-track {
          height:10px; border-radius:999px; background:transparent;
        }
        input.num-range[type=range]::-webkit-slider-thumb {
          -webkit-appearance:none; width:24px; height:24px; margin-top:-7px; border-radius:50%;
          cursor:pointer; cursor:grab;
          background:var(--mc-slider-thumb);
          border:3px solid var(--slider-color,#38bdf8);
          box-shadow:0 2px 10px var(--mc-thumb-glow), 0 0 0 1px var(--mc-thumb-outline);
        }
        input.num-range[type=range]:active::-webkit-slider-thumb { cursor:grabbing; transform:scale(1.06); }
        input.num-range[type=range]::-moz-range-track {
          height:10px; border-radius:999px; background:var(--mc-range-track);
        }
        input.num-range[type=range]::-moz-range-progress {
          height:10px; border-radius:999px; background:var(--slider-color,#38bdf8);
        }
        input.num-range[type=range]::-moz-range-thumb {
          width:22px; height:22px; border:none; border-radius:50%; cursor:pointer;
          background:var(--mc-slider-thumb);
          box-shadow:0 0 0 3px var(--slider-color,#38bdf8), 0 2px 10px var(--mc-thumb-glow);
        }
        button:active { transform:scale(0.94); }
        .scrollx { overflow-x:auto; -webkit-overflow-scrolling:touch; scrollbar-width:none; }
        .scrollx::-webkit-scrollbar { display:none; }
        .fade-in { animation:fadeUp 0.35s ease both; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }
        [data-theme="dark"] .row-extra { background:#0a1f0f !important; }
        [data-theme="light"] .row-extra { background:#d1fae5 !important; }
        [data-theme="dark"] .row-year { background:#0c1829 !important; border-top:1px solid #1e3a5f !important; }
        [data-theme="light"] .row-year { background:#e0f2fe !important; border-top:1px solid #7dd3fc !important; }
      `}</style>

      {/* HEADER */}
      <div style={{ background:"var(--mc-header-bg)", borderBottom:"1px solid var(--mc-header-border)", padding:isWideLayout?"20px 16px 16px":`20px ${padXR} 16px ${padX}`, position:"relative", overflow:"hidden" }}>
        <div style={{ position:"absolute",top:-60,right:-60,width:200,height:200,background:"radial-gradient(circle,rgba(56,189,248,0.12) 0%,transparent 65%)",borderRadius:"50%",pointerEvents:"none" }}/>
        <div style={{ maxWidth:shellMax, margin:"0 auto" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:isWideLayout?"flex-start":"stretch", gap:10, flexDirection:isWideLayout?"row":"column" }}>
            <div style={{ display:"flex", alignItems:"center", gap:isComfortable?14:10 }}>
              <div style={{ width:isComfortable?44:36,height:isComfortable?44:36,borderRadius:9,background:"linear-gradient(135deg,#0ea5e9,#10b981)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:isComfortable?20:16,flexShrink:0 }}>🏠</div>
              <div>
                <div style={{ fontSize:isComfortable?12:10,letterSpacing:"0.2em",color:"#38bdf8",textTransform:"uppercase" }}>Mortgage Intelligence</div>
                <h1 style={{ margin:0,fontSize:isComfortable?32:isWideLayout?28:22,fontWeight:700,color:"var(--mc-heading)",letterSpacing:"-0.03em",lineHeight:1.2 }}>Payoff Calculator</h1>
              </div>
            </div>
            <div style={{ display:"flex", flexDirection:isWideLayout?"row":"column", gap:8, flexShrink:0, width:isWideLayout?"auto":"100%" }}>
              <button
                type="button"
                onClick={() => setColorMode((m) => (m === "dark" ? "light" : "dark"))}
                aria-label={isLight ? "Switch to dark mode" : "Switch to light mode"}
                title={isLight ? "Dark mode" : "Light mode"}
                style={{
                  padding: isComfortable ? "11px 16px" : "9px 14px",
                  borderRadius: 11,
                  border: "1px solid var(--mc-border)",
                  background: "var(--mc-surface)",
                  color: "var(--mc-text)",
                  fontSize: isComfortable ? 18 : 16,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: isWideLayout ? 48 : undefined,
                  touchAction: "manipulation",
                }}
              >
                {isLight ? "🌙" : "☀️"}
              </button>
              <button onClick={handleExportPDF} disabled={pdfStatus==="generating"}
                style={{ flexShrink:0,padding:isComfortable?"11px 18px":"9px 14px",borderRadius:11,border:"1px solid var(--mc-pdf-border)",background: pdfStatus==="generating"?(isLight?"#d1fae5":"#0f2820"):"var(--mc-pdf-bg)", color: pdfStatus==="done"?"#10b981":pdfStatus==="error"?"#ef4444":(isLight?"#059669":"#10b981"),fontSize:isComfortable?14:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:6,transition:"all 0.2s",touchAction:"manipulation",width:isWideLayout?"auto":"100%" }}>
                {pdfStatus==="generating" ? "⏳ Creating PDF…" : pdfStatus==="done" ? "✓ Downloaded" : pdfStatus==="error" ? "✗ Error" : "📄 Download PDF report"}
              </button>
            </div>
          </div>
          {pdfMsg && <div style={{ marginTop:8,fontSize:12,color:pdfStatus==="error"?"#ef4444":"#10b981",padding:"6px 10px",background:pdfStatus==="error"?"var(--mc-pdf-msg-err)":"var(--mc-pdf-msg-ok)",borderRadius:8 }}>{pdfMsg}</div>}
          <p style={{ margin:"8px 0 0",fontSize:isComfortable?15:13,color:"var(--mc-text-dim)" }}>Model extra payment windows · See your real payoff date · Tap values to type</p>
        </div>
      </div>

      <div style={{ maxWidth:shellMax, margin:"0 auto", padding:isWideLayout?"14px 12px 40px":`14px ${padXR} 40px ${padX}` }}>

        {/* LOAN START DATE */}
        <div style={{ ...cardStyle(), marginBottom:8 }}>
          <div style={{ fontSize:isComfortable?11:10,letterSpacing:"0.15em",color:"var(--mc-text-muted)",textTransform:"uppercase",marginBottom:10 }}>Loan Start Date</div>
          <div style={{ display:"flex", flexDirection:isWideLayout?"row":"column", gap:8 }}>
            <MonthYearPicker label="Month" year={startYear} month={startMonth}
              onChange={(y,m)=>{setStartYear(y);setStartMonth(m);}} minYear={now.getFullYear()-50} maxYear={now.getFullYear()+40} color="#38bdf8" comfortable={isComfortable}/>
            {isWideLayout ? (
              <div style={{ display:"flex",flexDirection:"column",justifyContent:"flex-end",padding:"0 4px" }}>
                <div style={{ fontSize:10,color:"var(--mc-text-arrow)",marginBottom:8 }}>→</div>
              </div>
            ) : (
              <div style={{ fontSize:10,color:"var(--mc-text-arrow)",textAlign:"center",padding:"2px 0" }}>↓</div>
            )}
            <div style={{ flex:isWideLayout?1:"none",display:"flex",flexDirection:"column" }}>
              <div style={{ fontSize:isComfortable?10:9,letterSpacing:"0.15em",color:"var(--mc-text-muted)",textTransform:"uppercase",marginBottom:5 }}>Payoff Date</div>
              <div style={{ background:"var(--mc-well)",border:"1px solid #10b98133",borderRadius:7,padding:isComfortable?"11px 14px":"8px 11px" }}>
                <div style={{ fontSize:isComfortable?17:14,fontWeight:700,color:"#10b981",fontFamily:"'DM Mono',monospace" }}>
                  {MONTHS_SHORT[payoffDate.month]} {payoffDate.year}
                </div>
                <div style={{ marginTop:4,fontSize:isComfortable?13:11,fontWeight:500,color:"var(--mc-text-dim)",fontFamily:"inherit" }}>
                  {payoffDurationLabel}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* PURCHASE DETAILS */}
        <div style={{ ...cardStyle(), marginBottom:8 }}>
          <div style={{ fontSize:isComfortable?11:10,letterSpacing:"0.15em",color:"var(--mc-text-muted)",textTransform:"uppercase",marginBottom:12 }}>Purchase Details</div>

          <div style={{ marginBottom:14 }}>
            <NumInput
              label="Purchase Price" value={purchasePrice} prefix="$" min={50000} max={5000000} step={10000}
              sliderColor="#38bdf8" comfortable={isComfortable}
              onDec={()=>setPurchasePrice(v=>Math.max(50000,v-10000))}
              onInc={()=>setPurchasePrice(v=>Math.min(5000000,v+10000))}
              onChange={v=>setPurchasePrice(Math.round(v/1000)*1000)}/>
          </div>

          {/* Down Payment */}
          <div>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8 }}>
              <span style={{ fontSize:isComfortable?10:9,letterSpacing:"0.15em",color:"var(--mc-text-muted)",textTransform:"uppercase" }}>Down Payment</span>
              <div style={{ display:"flex",background:"var(--mc-well)",borderRadius:8,padding:2,gap:2 }}>
                {[["pct","%"],["dollar","$"]].map(([mode,lbl])=>(
                  <button key={mode} onClick={()=>{
                    if (mode==="pct") syncDownFromPct(Math.round(downPct));
                    else syncDownFromDollar(Math.round((purchasePrice * downPct) / 100));
                    setDownMode(mode);
                  }} style={{ padding:isComfortable?"6px 14px":"4px 12px",borderRadius:6,border:"none",cursor:"pointer",fontSize:isComfortable?12:11,fontWeight:600,fontFamily:"inherit",touchAction:"manipulation",background:downMode===mode?"#38bdf8":"transparent",color:downMode===mode?"var(--mc-pill-active-fg)":"var(--mc-text-dim)",transition:"all 0.2s" }}>{lbl}</button>
                ))}
              </div>
            </div>

            {downMode==="pct" ? (
              <NumInput
                label={`${downPct}% = ${fmt(downAmount)}`} value={downPct} prefix="" suffix="%" decimals={0}
                min={0} max={99} step={1} sliderColor="#10b981" comfortable={isComfortable}
                onDec={()=>syncDownFromPct(downPct-1)}
                onInc={()=>syncDownFromPct(downPct+1)}
                onChange={v=>syncDownFromPct(v)}/>
            ) : (
              <NumInput
                label={`${fmt(downDollar)} = ${downPercent}%`} value={downDollar} prefix="$" min={0} max={purchasePrice} step={5000}
                sliderColor="#10b981" comfortable={isComfortable}
                onDec={()=>syncDownFromDollar(downDollar-5000)}
                onInc={()=>syncDownFromDollar(downDollar+5000)}
                onChange={v=>syncDownFromDollar(Math.round(v/1000)*1000)}/>
            )}
          </div>

          {/* Loan Amount result */}
          <div style={{ marginTop:12,padding:isComfortable?"12px 14px":"10px 12px",background:"var(--mc-well)",borderRadius:10,border:"1px solid #38bdf833",display:"flex",justifyContent:"space-between",alignItems:"center" }}>
            <span style={{ fontSize:isComfortable?14:11,color:"var(--mc-text-muted)",letterSpacing:"0.1em",textTransform:"uppercase" }}>Loan Amount</span>
            <span style={{ fontSize:isComfortable?24:19,fontWeight:700,color:"#38bdf8",fontFamily:"'DM Mono',monospace" }}>{fmt(principal)}</span>
          </div>
        </div>

        {/* RATE + TERM */}
        <div style={{ display:"grid",gridTemplateColumns:isWideLayout?"1fr 1fr":"1fr",gap:8,marginBottom:8 }}>
          <div style={cardStyle()}>
            <NumInput
              label="Interest Rate" value={rate} prefix="" suffix="%" decimals={2}
              min={0.5} max={20} step={0.05} sliderColor="#38bdf8" comfortable={isComfortable}
              onDec={()=>setRate(v=>parseFloat(Math.max(0.5,v-0.05).toFixed(2)))}
              onInc={()=>setRate(v=>parseFloat(Math.min(20,v+0.05).toFixed(2)))}
              onChange={v=>setRate(parseFloat(v.toFixed(2)))}/>
          </div>
          <div style={cardStyle()}>
            <NumInput
              label="Loan Term" value={term} prefix="" suffix=" yrs" decimals={0}
              min={5} max={30} step={5} sliderColor="#38bdf8" comfortable={isComfortable}
              onDec={()=>setTerm(v=>Math.max(5,v-5))}
              onInc={()=>setTerm(v=>Math.min(30,v+5))}
              onChange={v=>setTerm(Math.round(v/5)*5)}/>
          </div>
        </div>

        {/* PAYMENT FREQUENCY */}
        <div style={{ ...cardStyle(), marginBottom:8 }}>
          <div style={{ fontSize:isComfortable?11:10,letterSpacing:"0.15em",color:"var(--mc-text-muted)",textTransform:"uppercase",marginBottom:10 }}>Payment Schedule</div>
          <div style={{ display:"flex",flexWrap:"wrap",gap:8 }}>
            {[
              { id:"monthly", label:"Monthly", sub:"Once per month" },
              { id:"biweekly", label:"Biweekly (accel.)", sub:"Half P&I every 2 wks ≈ 13th mo/yr" },
            ].map(({id,label,sub})=>(
              <button
                key={id}
                type="button"
                onClick={()=>setPaymentMode(id)}
                style={{
                  ...pillStyle(paymentMode===id,"#10b981"),
                  flex: isWideLayout ? "0 1 auto" : "1 1 45%",
                  minWidth: isWideLayout ? 160 : 140,
                  textAlign:"left",
                  display:"flex",
                  flexDirection:"column",
                  alignItems:"flex-start",
                  gap:4,
                  padding:isComfortable?"12px 18px":"10px 14px",
                }}
              >
                <span>{label}</span>
                <span style={{ fontSize:isComfortable?11:10,letterSpacing:"normal",textTransform:"none",fontWeight:400,opacity:0.85,lineHeight:1.25,color:paymentMode===id?"var(--mc-pill-active-fg)":"var(--mc-text-dim)" }}>{sub}</span>
              </button>
            ))}
          </div>
          {paymentMode==="biweekly" && (
            <div style={{ marginTop:12,padding:isComfortable?"11px 13px":"9px 11px",background:"var(--mc-well)",borderRadius:10,border:"1px solid #10b98133",fontSize:isComfortable?13:12,color:"var(--mc-text-secondary)",lineHeight:1.45 }}>
              Contractual P&amp;I stays <strong style={{color:"#38bdf8",fontFamily:"'DM Mono',monospace" }}>{fmt(base.pmt)}/mo</strong>; biweekly plan pays <strong style={{color:"#10b981",fontFamily:"'DM Mono',monospace" }}>{fmt(base.biweeklyHalfPayment)}</strong> every two weeks (modeled as <strong style={{fontFamily:"'DM Mono',monospace" }}>{fmt(base.scheduledMonthlyPI)}</strong>/mo cash to principal &amp; interest).
            </div>
          )}
        </div>

        {/* EXTRA PAYMENT PERIODS */}
        <div style={{ ...cardStyle(), marginBottom:8 }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:isWideLayout?"center":"stretch",marginBottom:12,flexDirection:isWideLayout?"row":"column",gap:isWideLayout?0:10 }}>
            <div>
              <div style={{ fontSize:isComfortable?11:10,letterSpacing:"0.15em",color:"var(--mc-text-muted)",textTransform:"uppercase" }}>Extra Payment Periods</div>
              <div style={{ fontSize:isComfortable?12:11,color:"var(--mc-text-arrow)",marginTop:2 }}>{periods.length} period{periods.length!==1?"s":""} · {fmt(totalExtra)} total extra</div>
            </div>
            <button onClick={addPeriod} style={{ background:"linear-gradient(135deg,#0ea5e9,#10b981)",border:"none",color:"#fff",padding:isComfortable?"10px 16px":"8px 14px",borderRadius:10,fontSize:isComfortable?13:12,fontWeight:600,cursor:"pointer",touchAction:"manipulation",fontFamily:"inherit",whiteSpace:"nowrap",width:isWideLayout?"auto":"100%" }}>+ Add</button>
          </div>

          {periods.length===0 && <div style={{ textAlign:"center",padding:"16px 0",color:"var(--mc-text-arrow)",fontSize:isComfortable?14:13 }}>No extra payments — tap <strong style={{color:"#38bdf8"}}>+ Add</strong> to start saving.</div>}

          <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
            {periods.map((p,idx)=>{
              const col      = PERIOD_COLORS[idx%PERIOD_COLORS.length];
              const capFrom  = Math.min(p.fromAbs, withExtra.months);
              const capTo    = Math.min(p.toAbs,   withExtra.months);
              const dur      = Math.max(0, capTo-capFrom+1);
              const fd       = periodFromDate(p);
              const td       = periodToDate(p);
              const minFromY = startYear;
              const maxToY   = endYear+1;
              return (
                <div key={p.id} className="fade-in" style={{ borderRadius:13,border:`1px solid ${col.border}`,background:`linear-gradient(135deg,${col.glow} 0%,transparent 60%)`,padding:14 }}>
                  <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12 }}>
                    <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                      <div style={{ width:8,height:8,borderRadius:"50%",background:col.bg }}/>
                      <span style={{ fontSize:12,fontWeight:600,color:col.bg }}>Period {idx+1}</span>
                      <span style={{ fontSize:isComfortable?12:11,color:"var(--mc-text-dim)" }}>{dur} mo · {fmt(dur*p.amount)}</span>
                    </div>
                    <button onClick={()=>delPeriod(p.id)} style={{ background:"rgba(239,68,68,0.12)",border:"1px solid rgba(239,68,68,0.25)",color:"#ef4444",width:28,height:28,borderRadius:7,cursor:"pointer",fontSize:15,display:"flex",alignItems:"center",justifyContent:"center",touchAction:"manipulation" }}>×</button>
                  </div>

                  {/* Extra amount with type input */}
                  <div style={{ marginBottom:12 }}>
                    <NumInput
                      label="Extra per month" value={p.amount} prefix="$" min={0} max={50000} step={100}
                      sliderColor={col.bg} comfortable={isComfortable}
                      onDec={()=>updPeriod(p.id,"amount",Math.max(0,p.amount-100))}
                      onInc={()=>updPeriod(p.id,"amount",Math.min(50000,p.amount+100))}
                      onChange={v=>updPeriod(p.id,"amount",Math.round(v/100)*100)}/>
                  </div>

                  {/* Date pickers */}
                  <div style={{ display:"flex",gap:8,alignItems:isWideLayout?"flex-end":"stretch",flexDirection:isWideLayout?"row":"column" }}>
                    <MonthYearPicker label="From" year={fd.year} month={fd.month}
                      onChange={(y,m)=>setFromDate(p.id,y,m)} minYear={minFromY} maxYear={maxToY} color={col.bg} comfortable={isComfortable}/>
                    <div style={{ paddingBottom:isWideLayout?8:0,color:"var(--mc-text-arrow)",fontSize:isComfortable?13:12,textAlign:"center" }}>{isWideLayout?"→":"↓"}</div>
                    <MonthYearPicker label="To" year={td.year} month={td.month}
                      onChange={(y,m)=>setToDate(p.id,y,m)} minYear={minFromY} maxYear={maxToY} color={col.bg} comfortable={isComfortable}/>
                  </div>

                  {/* Timeline strip */}
                  <div style={{ marginTop:10,height:5,background:"var(--mc-timeline-track)",borderRadius:99,overflow:"hidden" }}>
                    <div style={{ height:"100%",borderRadius:99,background:col.bg,marginLeft:`${((p.fromAbs-1)/totalMonths)*100}%`,width:`${(dur/totalMonths)*100}%`,transition:"all 0.3s ease" }}/>
                  </div>
                  <div style={{ display:"flex",justifyContent:"space-between",marginTop:3,fontSize:isComfortable?10:9,color:"var(--mc-text-arrow)" }}>
                    <span>{mo2label(1)}</span><span>{mo2label(totalMonths)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* HERO SAVINGS */}
        <div style={{ background:"var(--mc-hero-bg)",border:"1px solid var(--mc-hero-border)",borderRadius:18,padding:isComfortable?"24px 22px":"20px 18px",marginBottom:8,position:"relative",overflow:"hidden" }}>
          <div style={{ position:"absolute",top:-20,right:-20,width:120,height:120,background:"radial-gradient(circle,rgba(16,185,129,0.15) 0%,transparent 70%)",pointerEvents:"none" }}/>
          <div style={{ fontSize:isComfortable?11:10,letterSpacing:"0.18em",color:"#10b981",textTransform:"uppercase",marginBottom:14 }}>
            {periods.length===0?"No periods configured":`Savings across ${periods.length} period${periods.length>1?"s":""}`}
          </div>
          <div style={{ display:"grid",gridTemplateColumns:isWideLayout?"1fr 1fr 1fr":"1fr",gap:8 }}>
            {[
              {label:"Interest Saved",val:fmt(savedInt),                                   color:"#10b981"},
              {label:"Time Saved",    val:`${savedY}y ${savedMoR}m`,                       color:"#f59e0b"},
              {label:"Payoff Date",   val:`${MONTHS_SHORT[payoffDate.month]} ${payoffDate.year} · ${payoffDurationLabel}`, color:"#38bdf8"},
            ].map(({label,val,color})=>(
              <div key={label}>
                <div style={{ fontSize:isComfortable?12:9,color:"var(--mc-text-muted)",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:4 }}>{label}</div>
                <div style={{ fontSize:isComfortable?24:19,fontWeight:700,color,letterSpacing:"-0.03em",lineHeight:1,fontFamily:"'DM Mono',monospace" }}>{val}</div>
              </div>
            ))}
          </div>
        </div>

        {/* COMPARE */}
        <div style={{ display:"grid",gridTemplateColumns:isWideLayout?"1fr 1fr":"1fr",gap:8,marginBottom:8 }}>
          {[
            {
              label:"Without Extra",
              color:"#ef4444",
              rows: paymentMode==="biweekly"
                ? [["Cash to loan (equiv./mo)",fmt(base.scheduledMonthlyPI)],["Contract P&I (ref.)",fmt(base.pmt)],["Total Interest",fmt(base.totalInterest)],["Total Paid",fmt(totalScheduledCashOut(base))],["Payoff",`${term} yrs`]]
                : [["Monthly",fmt(base.pmt)],["Total Interest",fmt(base.totalInterest)],["Total Paid",fmt(totalScheduledCashOut(base))],["Payoff",`${term} yrs`]],
            },
            {
              label:"With Periods",
              color:"#10b981",
              rows: paymentMode==="biweekly"
                ? [["Cash to loan (equiv./mo)",fmt(withExtra.scheduledMonthlyPI)],["Contract P&I (ref.)",fmt(withExtra.pmt)],["Total Interest",fmt(withExtra.totalInterest)],["Total Paid",fmt(totalWithExtra)],["Payoff",`${MONTHS_SHORT[payoffDate.month]} ${payoffDate.year} · ${payoffDurationLabel}`]]
                : [["Base Pmt",fmt(withExtra.pmt)],["Total Interest",fmt(withExtra.totalInterest)],["Total Paid",fmt(totalWithExtra)],["Payoff",`${MONTHS_SHORT[payoffDate.month]} ${payoffDate.year} · ${payoffDurationLabel}`]],
            },
          ].map(({label,color,rows})=>(
            <div key={label} style={{ background:"var(--mc-compare-surface)",border:`1px solid ${color}28`,borderTop:`3px solid ${color}`,borderRadius:13,padding:isComfortable?"18px 16px":"14px 12px" }}>
              <div style={{ fontSize:isComfortable?12:9,letterSpacing:"0.15em",color,textTransform:"uppercase",marginBottom:10,fontWeight:600 }}>{label}</div>
              {rows.map(([k,v])=>(
                <div key={k} style={{ display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:7 }}>
                  <span style={{ fontSize:isComfortable?13:11,color:"var(--mc-text-dim)" }}>{k}</span>
                  <span style={{ fontSize:isComfortable?15:12,color:"var(--mc-text)",fontWeight:600,fontFamily:"'DM Mono',monospace" }}>{v}</span>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* TABS */}
        <div className="scrollx" style={{ display:"flex",gap:6,marginBottom:10,paddingBottom:2 }}>
          {["Summary","Chart","Schedule"].map(v=>(
            <button key={v} onClick={()=>setView(v.toLowerCase())} style={{ ...pillStyle(view===v.toLowerCase()), ...(isComfortable?{ fontSize:13, padding:"11px 24px" }:{}) , ...(!isWideLayout?{ padding:"10px 20px" }:{}) }}>{v}</button>
          ))}
        </div>

        {/* ── SUMMARY ── */}
        {view==="summary" && (
          <div className="fade-in" style={cardStyle()}>
            <div style={{ fontSize:isComfortable?11:10,letterSpacing:"0.15em",color:"var(--mc-text-muted)",textTransform:"uppercase",marginBottom:14 }}>Equity Milestones</div>
            {[25,50,75,100].map(pct=>{
              const tBal = principal*(1-pct/100);
              const mHit = withExtra.schedule.find(r=>r.balance<=tBal);
              const bHit = base.schedule.find(r=>r.balance<=tBal);
              if(!mHit) return null;
              const hitDate = absMonthToDate(mHit.month,startYear,startMonth+1);
              const saved   = (bHit?Math.floor(bHit.month/12):term)-Math.floor(mHit.month/12);
              return (
                <div key={pct} style={{ marginBottom:14 }}>
                  <div style={{ display:"flex",justifyContent:"space-between",alignItems:isWideLayout?"baseline":"flex-start",marginBottom:5,gap:6,flexDirection:isWideLayout?"row":"column" }}>
                    <span style={{ fontSize:isComfortable?14:12,color:"var(--mc-text)" }}>{pct===100?"🎉 Fully paid off":`${pct}% equity — ${fmt(principal*pct/100)}`}</span>
                    <span style={{ fontSize:11,color:"#10b981",whiteSpace:isWideLayout?"nowrap":"normal",fontFamily:"'DM Mono',monospace" }}>{MONTHS_SHORT[hitDate.month]} {hitDate.year}{saved>0?` (${saved}y early)`:""}</span>
                  </div>
                  <div style={{ height:6,background:"var(--mc-timeline-track)",borderRadius:99,overflow:"hidden" }}>
                    <div style={{ height:"100%",width:`${pct}%`,borderRadius:99,background:pct===100?"#10b981":"linear-gradient(90deg,#38bdf8,#10b981)",transition:"width 0.6s ease" }}/>
                  </div>
                </div>
              );
            })}

            {periods.length>0&&(
              <div style={{ marginTop:18 }}>
                <div style={{ fontSize:isComfortable?11:10,letterSpacing:"0.15em",color:"var(--mc-text-muted)",textTransform:"uppercase",marginBottom:10 }}>Period Breakdown</div>
                {periods.map((p,idx)=>{
                  const col      = PERIOD_COLORS[idx%PERIOD_COLORS.length];
                  const actualFrom = Math.min(p.fromAbs, withExtra.months);
                  const actualTo   = Math.min(p.toAbs,   withExtra.months);
                  const dur        = Math.max(0, actualTo-actualFrom+1);
                  const fd  = absMonthToDate(actualFrom,startYear,startMonth+1);
                  const td  = absMonthToDate(actualTo,  startYear,startMonth+1);
                  return (
                    <div key={p.id} style={{ display:"flex",justifyContent:"space-between",alignItems:isWideLayout?"center":"flex-start",padding:"8px 10px",borderRadius:9,borderLeft:`3px solid ${col.bg}`,background:col.glow,marginBottom:6,gap:8,flexDirection:isWideLayout?"row":"column" }}>
                      <span style={{ fontSize:11,color:col.bg,flexShrink:0 }}>{MONTHS_SHORT[fd.month]} {fd.year} → {MONTHS_SHORT[td.month]} {td.year}</span>
                      <span style={{ fontSize:isComfortable?12:11,color:"var(--mc-text-secondary)",fontFamily:"'DM Mono',monospace",textAlign:isWideLayout?"right":"left" }}>{fmt(p.amount)}/mo × {dur} = {fmt(dur*p.amount)}</span>
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{ marginTop:16,padding:isComfortable?"15px 16px":"13px 14px",background:"var(--mc-well)",borderRadius:11,borderLeft:"3px solid #f59e0b" }}>
              <div style={{ fontSize:isComfortable?10:9,color:"#f59e0b",letterSpacing:"0.15em",textTransform:"uppercase",marginBottom:6 }}>Net Worth Impact</div>
              <div style={{ fontSize:isComfortable?14:12,color:"var(--mc-networth-body)",lineHeight:1.8 }}>
                Extra payments save <strong style={{color:"#10b981"}}>{fmt(savedInt)}</strong> in interest and cut <strong style={{color:"#f59e0b"}}>{savedY}y {savedMoR}m</strong> off your mortgage.
                {totalExtra>0&&savedInt>0&&<> Return on extra dollars paid: <strong style={{color:"#f59e0b"}}>{((savedInt/totalExtra)*100).toFixed(0)}%</strong>.</>}
              </div>
            </div>
          </div>
        )}

        {/* ── CHART ── */}
        {view==="chart" && (
          <div className="fade-in" style={cardStyle()}>
            <div style={{ fontSize:isComfortable?13:11,letterSpacing:"0.15em",color:"var(--mc-text-muted)",textTransform:"uppercase",marginBottom:2 }}>Balance Over Time</div>
            <div style={{ fontSize:isComfortable?14:12,color:"var(--mc-text-arrow)",marginBottom:12 }}>Tap any point · shaded bands = active extra payment periods</div>
            {(()=>{
              const W=isComfortable?720:600,H=isComfortable?300:260,PAD={t:14,r:14,b:isComfortable?40:36,l:isComfortable?78:68};
              const iW=W-PAD.l-PAD.r, iH=H-PAD.t-PAD.b;
              const basePoints  = [{y:0,v:principal},...years.map(y=>({y,v:yBase[y]?.bal??0}))];
              const extraPoints = [{y:0,v:principal},...years.map(y=>({y,v:yExtra[y]?.bal??0}))];
              const xScale = y => PAD.l+(y/term)*iW;
              const yScale = v => PAD.t+(1-v/principal)*iH;
              const toPath = pts => pts.map((p,i)=>`${i===0?"M":"L"}${xScale(p.y).toFixed(1)},${yScale(p.v).toFixed(1)}`).join(" ");
              const toArea = pts => { const bl=(PAD.t+iH).toFixed(1); return toPath(pts)+` L${xScale(pts[pts.length-1].y).toFixed(1)},${bl} L${xScale(pts[0].y).toFixed(1)},${bl} Z`; };
              const yTicks = [0,0.25,0.5,0.75,1].map(f=>({f,v:principal*(1-f)}));
              const xTicks = years.filter(y=>y%5===0);
              const extraBands = clampedPeriods.map(p=>({x1:xScale(Math.max(0,(p.from-1)/12)),x2:xScale(Math.min(term,p.to/12))}));
              return (
                <div style={{ position:"relative",width:"100%" }}>
                  <svg viewBox={`0 0 ${W} ${H}`} style={{ width:"100%",display:"block",overflow:"visible" }}>
                    <defs>
                      <linearGradient id="gB" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ef4444" stopOpacity="0.18"/><stop offset="100%" stopColor="#ef4444" stopOpacity="0.02"/></linearGradient>
                      <linearGradient id="gE" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10b981" stopOpacity="0.22"/><stop offset="100%" stopColor="#10b981" stopOpacity="0.02"/></linearGradient>
                    </defs>
                    {extraBands.map((b,i)=><rect key={i} x={b.x1} y={PAD.t} width={Math.max(0,b.x2-b.x1)} height={iH} fill={chartSkin.bandFill} stroke={chartSkin.bandStroke} strokeWidth="0.5"/>)}
                    {yTicks.map(({f,v})=>(
                      <g key={f}>
                        <line x1={PAD.l} x2={PAD.l+iW} y1={yScale(v)} y2={yScale(v)} stroke={chartSkin.grid} strokeWidth="1" strokeDasharray={f===0||f===1?"":"4,4"}/>
                        <text x={PAD.l-8} y={yScale(v)+4} textAnchor="end" fontSize={isComfortable?16:14} fill={chartSkin.tick} fontFamily="DM Mono,monospace">{f===0?fmt(principal):f===1?"$0":fmtK(v)}</text>
                      </g>
                    ))}
                    {xTicks.map(y=><text key={y} x={xScale(y)} y={H-8} textAnchor="middle" fontSize={isComfortable?16:14} fill={chartSkin.tick} fontFamily="DM Mono,monospace">Yr {y}</text>)}
                    <path d={toArea(basePoints)}  fill="url(#gB)"/>
                    <path d={toArea(extraPoints)} fill="url(#gE)"/>
                    <path d={toPath(basePoints)}  fill="none" stroke="#ef4444" strokeWidth="1.8" strokeLinejoin="round"/>
                    <path d={toPath(extraPoints)} fill="none" stroke="#10b981" strokeWidth="2"   strokeLinejoin="round"/>
                    {(()=>{ const lE=extraPoints[extraPoints.length-1]; if(lE.v<=0||lE.y<term){ const px=xScale(withExtra.months/12),py=yScale(0); return <circle cx={px} cy={py} r="5" fill="#10b981" stroke={chartSkin.circleStroke} strokeWidth="2"/>; } return null; })()}
                    {years.map(y=>{ const bv=yBase[y]?.bal??0,ev=yExtra[y]?.bal??0,cx=xScale(y),act=chartYear===y; return (
                      <g key={y} onClick={()=>setChartYear(act?null:y)} style={{cursor:"pointer"}}>
                        <rect x={cx-iW/term/2} y={PAD.t} width={iW/term} height={iH} fill="transparent"/>
                        {act&&<line x1={cx} x2={cx} y1={PAD.t} y2={PAD.t+iH} stroke="#38bdf8" strokeWidth="1" strokeDasharray="3,3"/>}
                        {act&&<circle cx={cx} cy={yScale(bv)} r="4" fill="#ef4444" stroke={chartSkin.circleStroke} strokeWidth="2"/>}
                        {act&&ev>=0&&<circle cx={cx} cy={yScale(ev)} r="4" fill="#10b981" stroke={chartSkin.circleStroke} strokeWidth="2"/>}
                      </g>
                    ); })}
                  </svg>
                </div>
              );
            })()}
            <div style={{ display:"flex",gap:14,flexWrap:"wrap",margin:"10px 0 10px" }}>
              {[["#ef4444","No extra payments"],["#10b981","With extra periods"],["#10b98118","Active period window"]].map(([bg,txt])=>(
                <div key={txt} style={{display:"flex",alignItems:"center",gap:5}}>
                  <div style={{width:20,height:3,borderRadius:2,background:bg,border:bg.includes("18")?"1px solid #10b98144":"none"}}/>
                  <span style={{fontSize:isComfortable?14:12,color:"var(--mc-text-muted)"}}>{txt}</span>
                </div>
              ))}
            </div>
            {chartYear&&(
              <div style={{ background:"var(--mc-chart-detail-bg)",borderRadius:11,padding:isComfortable?18:14,border:"1px solid var(--mc-chart-detail-border)" }}>
                <div style={{ fontSize:isComfortable?14:12,color:"#38bdf8",marginBottom:10,fontFamily:"'DM Mono',monospace" }}>
                  YEAR {chartYear} · {mo2label((chartYear-1)*12+1)} → {mo2label(Math.min(chartYear*12,totalMonths))}{activeYears.has(chartYear)?" · 🟢 Extra active":""}
                </div>
                <div style={{ display:"grid",gridTemplateColumns:isWideLayout?"1fr 1fr":"1fr",gap:10 }}>
                  {[
                    {label:"Balance (no extra)",   val:yBase[chartYear]?.bal,    color:"#ef4444"},
                    {label:"Balance (w/ periods)", val:yExtra[chartYear]?.bal??0, color:"#10b981"},
                    {label:"Interest (no extra)",  val:yBase[chartYear]?.int,    color:"#ef4444"},
                    {label:"Interest (w/ periods)",val:yExtra[chartYear]?.int??0, color:"#10b981"},
                  ].map(({label,val,color})=>(
                    <div key={label}>
                      <div style={{fontSize:isComfortable?12:9,color:"var(--mc-text-dim)",marginBottom:2,textTransform:"uppercase",letterSpacing:"0.1em"}}>{label}</div>
                      <div style={{fontSize:isComfortable?20:17,fontWeight:700,color,fontFamily:"'DM Mono',monospace"}}>{val!==undefined?fmt(val):"Paid off"}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── SCHEDULE ── */}
        {view==="schedule" && (
          <div className="fade-in" style={{ background:"var(--mc-schedule-outer)",border:"1px solid var(--mc-border)",borderRadius:16,overflow:"hidden" }}>
            <div style={{ padding:isComfortable?"15px 16px":"13px 14px",borderBottom:"1px solid var(--mc-border)" }}>
              <div style={{ fontSize:isComfortable?11:10,letterSpacing:"0.15em",color:"var(--mc-text-muted)",textTransform:"uppercase" }}>Full Payment Schedule</div>
              <div style={{ fontSize:isComfortable?12:11,color:"var(--mc-text-arrow)",marginTop:2 }}>🟢 Green = extra payment month · 🔵 Blue = year-end</div>
            </div>
            <div style={{ maxHeight:420,overflowY:"auto",overflowX:"auto",WebkitOverflowScrolling:"touch" }}>
              <table style={{ width:"100%",borderCollapse:"collapse",fontSize:isComfortable?14:12,minWidth:340,fontFamily:"'DM Mono',monospace" }}>
                <thead>
                  <tr style={{ background:"var(--mc-schedule-head)",position:"sticky",top:0 }}>
                    {["Date","Base","Principal","Interest","Extra","Balance"].map(h=>(
                      <th key={h} style={{ padding:"9px 9px",textAlign:"right",color:"var(--mc-text-dim)",fontWeight:400,fontSize:isComfortable?11:9,letterSpacing:"0.12em",textTransform:"uppercase",fontFamily:"'DM Sans',sans-serif" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {withExtra.schedule.map((row,i)=>{
                    const isYE=row.month%12===0, hasE=row.extra>0;
                    const rowDate=absMonthToDate(row.month,startYear,startMonth+1);
                    const zebraBg = isLight ? (i % 2 === 0 ? "#ffffff" : "#f8fafc") : i % 2 === 0 ? "#0f172a" : "#0a1020";
                    return (
                      <tr key={row.month} className={isYE?"row-year":hasE?"row-extra":""}
                        style={isYE || hasE ? {} : { background: zebraBg }}>
                        <td style={{ padding:isComfortable?"8px 10px":"7px 9px",textAlign:"right",color:isYE?"#38bdf8":hasE?"#10b981":"var(--mc-text-dim)",fontSize:isComfortable?11:10 }}>{MONTHS_SHORT[rowDate.month]} {rowDate.year}{isYE?" ★":""}</td>
                        <td style={{ padding:isComfortable?"8px 10px":"7px 9px",textAlign:"right",color:"var(--mc-text-secondary)" }}>{fmt(row.scheduledPI ?? base.pmt)}</td>
                        <td style={{ padding:isComfortable?"8px 10px":"7px 9px",textAlign:"right",color:"#38bdf8" }}>{fmt(row.principal)}</td>
                        <td style={{ padding:isComfortable?"8px 10px":"7px 9px",textAlign:"right",color:"#ef4444" }}>{fmt(row.interest)}</td>
                        <td style={{ padding:isComfortable?"8px 10px":"7px 9px",textAlign:"right",color:hasE?"#10b981":"var(--mc-text-arrow)",fontWeight:hasE?700:400 }}>{hasE?fmt(row.extra):"—"}</td>
                        <td style={{ padding:isComfortable?"8px 10px":"7px 9px",textAlign:"right",color:"var(--mc-text)",fontWeight:row.balance===0?700:400 }}>{row.balance===0?"🎉 $0":fmt(row.balance)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div style={{ textAlign:"center",marginTop:16,fontSize:isComfortable?11:10,color:"var(--mc-footer)" }}>
          Estimates only · Results vary by lender terms and payment timing
        </div>
      </div>
    </div>
  );
}

