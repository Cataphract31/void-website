import { useState, useEffect, useRef } from "react";

/* ============================================================
   CRITICAL MASS — crowd-coupled hazard crash (playable demo)
   Core rule: meltdown probability per tick scales with the
   crowd's live exposure (load). Exits cool the core. Dead
   money redistributes to ejectors weighted by stake*(m-1).
   ============================================================ */

// ---------- tuning knobs ----------
const TICK_MS = 300;          // one "slot"
const LOBBY_MS = 9000;
const RESULT_MS = 11000;
const G0 = 0.008;             // base growth per tick
const GA = 0.00016;           // growth acceleration per tick
const H0 = 0.0032;            // base hazard per tick at load 1
const H_ALPHA = 1.75;         // hazard exponent on load
const H_TIME = 0.00006;       // slow time creep
const RAKE = 0.04;            // rake on dead pool only
const START_BAL = 10;

const BOT_NAMES = [
  "latency_god","glass_hands","kerem.sol","panic_wojak","curve_priest",
  "dead_inside","fomo_kaan","perma_bull","kimchi_prem","0x_serpent",
  "wagmi_ratio","sniper_ay","rug_survivor","one_more_trade","exit_liq",
  "brainlet_cap","dip_buyer","cold_rod","median_enjoyer","tick_merchant",
];

// ---------- small helpers ----------
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const fmt = (x, d = 2) => (Math.round(x * 10 ** d) / 10 ** d).toFixed(d);
const randn = () => {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};
const expRand = (mean) => -mean * Math.log(Math.max(1e-9, Math.random()));
const seedHex = () =>
  Array.from({ length: 8 }, () => "0123456789abcdef"[(Math.random() * 16) | 0]).join("");

const C = {
  bg: "#101418",
  panel: "#1a1f24",
  panel2: "#161b20",
  edge: "#2a3138",
  amber: "#ffb347",
  amberHot: "#ff9f1c",
  red: "#ff4b3e",
  green: "#6fcf8f",
  cyan: "#79d2e6",
  text: "#e8e2d4",
  dim: "#6b7480",
  grid: "#26333a",
};

export default function CriticalMass() {
  const S = useRef(null);
  if (!S.current) {
    S.current = {
      phase: "LOBBY",
      phaseEnds: performance.now() + LOBBY_MS,
      round: 401 + ((Math.random() * 80) | 0),
      seed: seedHex(),
      tick: 0,
      m: 1,
      points: [{ t: 0, m: 1 }],
      players: [],
      botPlan: [],
      pot: 0,
      load: 1,
      hazard: H0,
      feed: [{ k: "info", msg: "reactor online — bets open" }],
      history: [],
      resolution: null,
      lastTickAt: performance.now(),
      recentExits: [], // ticks of recent exits (for cascade lamp / bot herding)
      shake: false,
    };
    seedLobbyBots(S.current);
  }

  const [, setV] = useState(0);
  const bump = () => setV((v) => v + 1);
  const [balance, setBalance] = useState(START_BAL);
  const [pnl, setPnl] = useState(0);
  const [betStr, setBetStr] = useState("0.50");
  const [autoStr, setAutoStr] = useState("");
  const [soundOn, setSoundOn] = useState(true);
  const balRef = useRef(balance);
  balRef.current = balance;
  const soundRef = useRef(soundOn);
  soundRef.current = soundOn;

  // ---------- audio ----------
  const audioRef = useRef({ ctx: null });
  const ctx = () => {
    const A = audioRef.current;
    if (!A.ctx) {
      try { A.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
    }
    if (A.ctx && A.ctx.state === "suspended") A.ctx.resume();
    return A.ctx;
  };
  const geiger = () => {
    if (!soundRef.current) return;
    const c = audioRef.current.ctx; if (!c) return;
    const o = c.createOscillator(), g = c.createGain();
    o.type = "square"; o.frequency.value = 1600 + Math.random() * 1200;
    g.gain.setValueAtTime(0.028, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.03);
    o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime + 0.035);
  };
  const blip = () => {
    if (!soundRef.current) return;
    const c = ctx(); if (!c) return;
    const o = c.createOscillator(), g = c.createGain();
    o.type = "sine"; o.frequency.setValueAtTime(680, c.currentTime);
    o.frequency.exponentialRampToValueAtTime(1250, c.currentTime + 0.09);
    g.gain.setValueAtTime(0.06, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.12);
    o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime + 0.13);
  };
  const boom = () => {
    if (!soundRef.current) return;
    const c = audioRef.current.ctx; if (!c) return;
    const n = c.createBufferSource();
    const buf = c.createBuffer(1, c.sampleRate * 0.5, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    n.buffer = buf;
    const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 380;
    const g1 = c.createGain(); g1.gain.value = 0.28;
    n.connect(lp); lp.connect(g1); g1.connect(c.destination); n.start();
    const o = c.createOscillator(), g2 = c.createGain();
    o.type = "sine"; o.frequency.setValueAtTime(130, c.currentTime);
    o.frequency.exponentialRampToValueAtTime(36, c.currentTime + 0.7);
    g2.gain.setValueAtTime(0.22, c.currentTime);
    g2.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.8);
    o.connect(g2); g2.connect(c.destination); o.start(); o.stop(c.currentTime + 0.85);
  };

  // ---------- bots ----------
  function seedLobbyBots(s) {
    const n = 11 + ((Math.random() * 7) | 0);
    const names = [...BOT_NAMES].sort(() => Math.random() - 0.5).slice(0, n);
    const now = performance.now();
    s.botPlan = names.map((name, i) => {
      let stake = clamp(Math.exp(-1.05 + 1.2 * randn()), 0.05, 9);
      let target = 1.1 + expRand(0.85);
      let nerve = Math.pow(Math.random(), 1.2);
      if (i === 0 && Math.random() < 0.22) { // whale
        stake = 5 + Math.random() * 12;
        target = 1.9 + expRand(1.2);
        nerve = 0.1;
      }
      if (Math.random() < 0.12) target *= 2.2; // diamond hands
      return {
        joinAt: now + 400 + Math.random() * (LOBBY_MS - 2200),
        p: {
          id: "b" + i, name, stake: +stake.toFixed(2), isYou: false,
          alive: true, queued: false, pending: false,
          exitM: null, exitTick: null, payout: 0,
          targetM: target, nerve,
        },
      };
    });
  }

  const pushFeed = (k, msg) => {
    const s = S.current;
    s.feed.unshift({ k, msg });
    if (s.feed.length > 42) s.feed.pop();
  };

  // ---------- phase transitions ----------
  function startLobby() {
    const s = S.current;
    s.phase = "LOBBY";
    s.phaseEnds = performance.now() + LOBBY_MS;
    s.round += 1;
    s.seed = seedHex();
    s.tick = 0; s.m = 1;
    s.points = [{ t: 0, m: 1 }];
    s.players = []; s.pot = 0; s.load = 1; s.hazard = H0;
    s.resolution = null; s.recentExits = [];
    pushFeed("info", `round ${s.round} — bets open`);
    seedLobbyBots(s);
  }

  function startRun() {
    const s = S.current;
    s.phase = "RUN";
    s.tick = 0; s.m = 1;
    s.points = [{ t: 0, m: 1 }];
    s.pot = s.players.reduce((a, p) => a + p.stake, 0);
    s.lastTickAt = performance.now();
    pushFeed("warn", `reaction started — pot ${fmt(s.pot)} ◎`);
  }

  function resolveMeltdown() {
    const s = S.current;
    const exiters = s.players.filter((p) => p.exitM != null);
    const busters = s.players.filter((p) => p.alive);
    const dead = busters.reduce((a, p) => a + p.stake, 0);
    const prize = dead * (1 - RAKE);
    const W = exiters.reduce((a, p) => a + p.stake * (p.exitM - 1), 0);
    exiters.forEach((p) => {
      const share = W > 0 ? (prize * p.stake * (p.exitM - 1)) / W : 0;
      p.payout = p.stake + share;
    });
    busters.forEach((p) => { p.alive = false; p.busted = true; p.payout = 0; });
    const you = s.players.find((p) => p.isYou);
    let yourNet = null;
    if (you) {
      yourNet = (you.payout || 0) - you.stake;
      if (you.payout > 0) setBalance((b) => +(b + you.payout).toFixed(4));
      setPnl((x) => +(x + yourNet).toFixed(4));
    }
    s.resolution = { type: "melt", m: s.m, dead, prize, rakeAmt: dead * RAKE, yourNet };
    s.history.unshift({ m: s.m, cold: false, yourNet });
    if (s.history.length > 14) s.history.pop();
    s.phase = "RESULT";
    s.phaseEnds = performance.now() + RESULT_MS;
    s.shake = true;
    setTimeout(() => { S.current.shake = false; bump(); }, 700);
    pushFeed("melt", `MELTDOWN @ ${fmt(s.m)}× — ${busters.length} vaporized, ${fmt(prize)} ◎ redistributed`);
    boom();
  }

  function resolveColdShutdown() {
    const s = S.current;
    s.players.forEach((p) => { p.payout = p.stake; });
    const you = s.players.find((p) => p.isYou);
    let yourNet = null;
    if (you) { yourNet = 0; setBalance((b) => +(b + you.stake).toFixed(4)); }
    s.resolution = { type: "cold", m: s.m, dead: 0, prize: 0, rakeAmt: 0, yourNet };
    s.history.unshift({ m: s.m, cold: true, yourNet });
    if (s.history.length > 14) s.history.pop();
    s.phase = "RESULT";
    s.phaseEnds = performance.now() + RESULT_MS;
    pushFeed("info", "cold shutdown — everyone ejected, stakes returned, dead pool 0");
  }

  // ---------- game tick ----------
  function gameTick() {
    const s = S.current;
    s.tick += 1;
    s.lastTickAt = performance.now();
    const g = G0 + GA * s.tick;
    s.m = s.m * (1 + g);
    s.points.push({ t: s.tick, m: s.m });

    // 1) process exits queued in the previous window + auto-eject commits
    let exitedNow = 0;
    s.players.forEach((p) => {
      if (!p.alive) return;
      const auto = p.autoM != null && s.m >= p.autoM;
      if (p.queued || p.pending || auto) {
        p.alive = false;
        p.exitM = s.m;
        p.exitTick = s.tick;
        exitedNow += 1;
        if (p.isYou) {
          pushFeed("you", `YOU ejected @ ${fmt(s.m)}×${auto && !p.queued ? " (commit)" : ""}`);
          blip();
        } else {
          pushFeed("exit", `${p.name} ejected @ ${fmt(s.m)}×`);
        }
      }
    });
    if (exitedNow > 0) s.recentExits.push({ t: s.tick, n: exitedNow });
    s.recentExits = s.recentExits.filter((e) => s.tick - e.t <= 2);

    const alive = s.players.filter((p) => p.alive);

    // 2) cold shutdown — everyone out before the core popped
    if (s.players.length > 0 && alive.length === 0) {
      resolveColdShutdown();
      return;
    }

    // 3) load + hazard (the whole game lives here)
    const E = alive.reduce((a, p) => a + p.stake * s.m, 0);
    s.load = s.pot > 0 ? E / s.pot : 1;
    s.hazard = clamp(H0 * Math.pow(s.load, H_ALPHA) + s.tick * H_TIME, 0.0004, 0.3);

    // 4) bot decisions for the NEXT tick (batched like everyone else)
    const cascadeN = s.recentExits.reduce((a, e) => a + e.n, 0);
    const cascade = alive.length > 0 && (cascadeN >= 3 || cascadeN / (alive.length + cascadeN) > 0.3);
    alive.forEach((p) => {
      if (p.isYou || p.pending) return;
      if (s.m >= p.targetM) { p.pending = true; return; }
      if (s.hazard > 0.012 && s.m > 1.12) {
        const panicP = p.nerve * (cascade ? 0.3 : 0.1);
        if (Math.random() < panicP) p.pending = true;
      }
    });

    // 5) geiger clicks scale with hazard
    if (soundRef.current && audioRef.current.ctx) {
      let n = s.hazard * 45;
      let count = Math.floor(n) + (Math.random() < n % 1 ? 1 : 0);
      for (let i = 0; i < count; i++) setTimeout(geiger, Math.random() * TICK_MS);
    }

    // 6) the roll (deployed: u_t from pre-committed hash-chain tape vs h(t))
    if (Math.random() < s.hazard) {
      resolveMeltdown();
    }
  }

  // ---------- master interval ----------
  useEffect(() => {
    const iv = setInterval(() => {
      const s = S.current;
      const now = performance.now();
      if (s.phase === "LOBBY") {
        s.botPlan = s.botPlan.filter((b) => {
          if (b.joinAt <= now) {
            s.players.push(b.p);
            s.pot += b.p.stake;
            pushFeed("bet", `${b.p.name} armed ${fmt(b.p.stake)} ◎`);
            if (b.p.stake >= 5) pushFeed("warn", `heavy stake in the core: ${b.p.name}`);
            return false;
          }
          return true;
        });
        if (now >= s.phaseEnds) startRun();
      } else if (s.phase === "RUN") {
        gameTick();
      } else if (s.phase === "RESULT") {
        if (now >= s.phaseEnds) startLobby();
      }
      bump();
    }, TICK_MS);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- canvas ----------
  const cvRef = useRef(null);
  const wrapRef = useRef(null);
  useEffect(() => {
    let raf;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const cv = cvRef.current, wrap = wrapRef.current;
      if (!cv || !wrap) return;
      const dpr = window.devicePixelRatio || 1;
      const W = wrap.clientWidth, H = wrap.clientHeight;
      if (cv.width !== W * dpr || cv.height !== H * dpr) {
        cv.width = W * dpr; cv.height = H * dpr;
        cv.style.width = W + "px"; cv.style.height = H + "px";
      }
      const x = cv.getContext("2d");
      x.setTransform(dpr, 0, 0, dpr, 0, 0);
      x.clearRect(0, 0, W, H);

      const s = S.current;
      const pad = { l: 44, r: 14, t: 18, b: 22 };
      const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;

      // live interpolated multiplier for smooth phosphor motion
      let mLive = s.m;
      if (s.phase === "RUN") {
        const frac = clamp((performance.now() - s.lastTickAt) / TICK_MS, 0, 1);
        mLive = s.m * Math.pow(1 + G0 + GA * (s.tick + 1), frac);
      }
      const mMax = Math.max(2, Math.max(mLive, ...s.points.map((p) => p.m)) * 1.18);
      const tMax = Math.max(24, s.tick + 3);
      const X = (t) => pad.l + (t / tMax) * iw;
      const Y = (m) => pad.t + ih - (Math.log(m) / Math.log(mMax)) * ih;

      // graticule
      x.strokeStyle = C.grid; x.lineWidth = 1; x.fillStyle = C.dim;
      x.font = "10px 'IBM Plex Mono', ui-monospace, monospace";
      [1, 1.2, 1.5, 2, 3, 4, 5, 7, 10, 15, 20, 30, 50].forEach((gm) => {
        if (gm > mMax) return;
        const y = Y(gm);
        x.globalAlpha = gm === 1 ? 0.9 : 0.5;
        x.beginPath(); x.moveTo(pad.l, y); x.lineTo(W - pad.r, y); x.stroke();
        x.globalAlpha = 1;
        x.fillText(gm + "×", 8, y + 3);
      });
      for (let t = 0; t <= tMax; t += Math.ceil(tMax / 8)) {
        x.globalAlpha = 0.25;
        x.beginPath(); x.moveTo(X(t), pad.t); x.lineTo(X(t), H - pad.b); x.stroke();
        x.globalAlpha = 1;
      }

      if (s.phase === "LOBBY" && s.points.length <= 1) return;

      // curve
      const pts = [...s.points];
      if (s.phase === "RUN") pts.push({ t: s.tick + clamp((performance.now() - s.lastTickAt) / TICK_MS, 0, 1), m: mLive });
      const melted = s.resolution && s.resolution.type === "melt";
      const col = melted ? C.red : C.amberHot;

      // area fill
      const grad = x.createLinearGradient(0, pad.t, 0, H - pad.b);
      grad.addColorStop(0, melted ? "rgba(255,75,62,0.20)" : "rgba(255,159,28,0.18)");
      grad.addColorStop(1, "rgba(0,0,0,0)");
      x.beginPath();
      x.moveTo(X(pts[0].t), Y(pts[0].m));
      pts.forEach((p) => x.lineTo(X(p.t), Y(p.m)));
      x.lineTo(X(pts[pts.length - 1].t), H - pad.b);
      x.lineTo(X(pts[0].t), H - pad.b);
      x.closePath(); x.fillStyle = grad; x.fill();

      // glow stroke
      x.beginPath();
      x.moveTo(X(pts[0].t), Y(pts[0].m));
      pts.forEach((p) => x.lineTo(X(p.t), Y(p.m)));
      x.strokeStyle = col; x.lineWidth = 2.4;
      x.shadowColor = col; x.shadowBlur = 14;
      x.stroke(); x.shadowBlur = 0;

      // exit markers
      s.players.forEach((p) => {
        if (p.exitM == null) return;
        const px = X(p.exitTick), py = Y(p.exitM);
        x.beginPath(); x.arc(px, py, p.isYou ? 4.5 : 3, 0, Math.PI * 2);
        x.fillStyle = p.isYou ? C.cyan : C.green;
        x.shadowColor = x.fillStyle; x.shadowBlur = 8; x.fill(); x.shadowBlur = 0;
      });

      // meltdown burst
      if (melted) {
        const last = pts[pts.length - 1];
        const px = X(last.t), py = Y(last.m);
        x.strokeStyle = C.red; x.lineWidth = 1.5; x.setLineDash([4, 4]);
        x.beginPath(); x.moveTo(px, pad.t); x.lineTo(px, H - pad.b); x.stroke();
        x.setLineDash([]);
        x.beginPath(); x.arc(px, py, 7, 0, Math.PI * 2);
        x.fillStyle = C.red; x.shadowColor = C.red; x.shadowBlur = 20; x.fill();
        x.shadowBlur = 0;
      }
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  // ---------- user actions ----------
  const s = S.current;
  const you = s.players.find((p) => p.isYou);
  const armed = !!you;
  const bet = parseFloat(betStr);
  const betOk = !isNaN(bet) && bet >= 0.05 && bet <= balance;

  const armStake = () => {
    ctx();
    if (s.phase !== "LOBBY" || armed || !betOk) return;
    const auto = parseFloat(autoStr);
    const autoM = !isNaN(auto) && auto > 1.01 ? auto : null;
    setBalance((b) => +(b - bet).toFixed(4));
    s.players.push({
      id: "you", name: "YOU", stake: +bet.toFixed(2), isYou: true,
      alive: true, queued: false, pending: false,
      exitM: null, exitTick: null, payout: 0, autoM,
    });
    s.pot += +bet.toFixed(2);
    pushFeed("you", `YOU armed ${fmt(bet)} ◎${autoM ? ` — sealed commit @ ${fmt(autoM)}×` : ""}`);
    blip();
    bump();
  };

  const eject = () => {
    ctx();
    if (s.phase !== "RUN" || !you || !you.alive || you.queued) return;
    you.queued = true;
    pushFeed("you", "EJECT queued — clears next tick");
    blip();
    bump();
  };

  const toggleSound = () => { ctx(); setSoundOn((v) => !v); };

  // ---------- derived UI ----------
  const now = performance.now();
  const secsLeft = Math.max(0, Math.ceil((s.phaseEnds - now) / 1000));
  const aliveList = s.players.filter((p) => p.alive);
  const cascadeN = s.recentExits.reduce((a, e) => a + e.n, 0);
  const whaleIn = s.pot > 0 && aliveList.some((p) => p.stake > 0.25 * s.pot);
  const lamps = [
    { label: "BETS OPEN", on: s.phase === "LOBBY", col: C.green },
    { label: "REACTION", on: s.phase === "RUN", col: C.amber },
    { label: "LOAD > 1.0", on: s.phase === "RUN" && s.load > 1, col: C.amber },
    { label: "HIGH HAZARD", on: s.phase === "RUN" && s.hazard > 0.015, col: C.red },
    { label: "CASCADE", on: s.phase === "RUN" && cascadeN >= 3, col: C.red },
    { label: "WHALE IN CORE", on: s.phase !== "RESULT" && whaleIn, col: C.cyan },
    { label: "COLD SHUTDOWN", on: s.resolution?.type === "cold", col: C.cyan },
    { label: "MELTDOWN", on: s.resolution?.type === "melt", col: C.red },
  ];

  const statusOf = (p) => {
    if (p.exitM != null)
      return { txt: `EJ @ ${fmt(p.exitM)}×`, col: p.isYou ? C.cyan : C.green };
    if (p.busted) return { txt: "VAPORIZED", col: C.red };
    if (p.queued) return { txt: "EJECT QUEUED", col: C.cyan };
    return { txt: "LIVE", col: C.amber };
  };

  const feedCol = { bet: C.dim, exit: C.green, you: C.cyan, warn: C.amber, melt: C.red, info: C.dim };

  const sortedPlayers = [...s.players].sort((a, b) => {
    if (a.isYou) return -1;
    if (b.isYou) return 1;
    const rank = (p) => (p.alive ? 0 : p.exitM != null ? 1 : 2);
    return rank(a) - rank(b) || b.stake - a.stake;
  });

  const loadPct = clamp(s.load / 2.5, 0, 1);
  const loadCol = s.load < 0.9 ? C.green : s.load < 1.4 ? C.amber : C.red;

  const btnBase = {
    fontFamily: "'Oswald', sans-serif",
    letterSpacing: "0.12em",
    border: `1px solid ${C.edge}`,
    background: C.panel2,
    color: C.text,
    padding: "10px 16px",
    cursor: "pointer",
    fontSize: 14,
    textTransform: "uppercase",
  };

  return (
    <div
      className={s.shake ? "cm-shake" : ""}
      style={{
        minHeight: "100vh",
        background: `radial-gradient(1200px 700px at 50% -10%, #17202a 0%, ${C.bg} 55%)`,
        color: C.text,
        fontFamily: "'IBM Plex Mono', ui-monospace, Menlo, monospace",
        padding: 14,
        boxSizing: "border-box",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=Oswald:wght@400;500;600&display=swap');
        @keyframes cmShake { 0%,100%{transform:translate(0,0)} 20%{transform:translate(-6px,3px)} 40%{transform:translate(5px,-4px)} 60%{transform:translate(-4px,-2px)} 80%{transform:translate(3px,4px)} }
        .cm-shake { animation: cmShake 0.45s linear 1; }
        @keyframes cmPulse { 0%,100%{opacity:1} 50%{opacity:0.45} }
        .cm-pulse { animation: cmPulse 1.1s ease-in-out infinite; }
        @keyframes cmLamp { 0%,100%{filter:brightness(1)} 50%{filter:brightness(1.35)} }
        .cm-lamp-on { animation: cmLamp 1.4s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .cm-shake, .cm-pulse, .cm-lamp-on { animation: none !important; }
        }
        input.cm { background:${C.panel2}; border:1px solid ${C.edge}; color:${C.text};
          font-family:'IBM Plex Mono',monospace; font-size:14px; padding:9px 10px; width:110px; box-sizing:border-box; }
        input.cm:focus { outline:2px solid ${C.amber}; outline-offset:-1px; }
        button:focus-visible { outline:2px solid ${C.amber}; outline-offset:2px; }
        ::-webkit-scrollbar{width:8px;height:8px} ::-webkit-scrollbar-thumb{background:${C.edge}}
      `}</style>

      {/* ---------- header ---------- */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 16, flexWrap: "wrap", marginBottom: 10 }}>
        <div style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 600, fontSize: 22, letterSpacing: "0.22em" }}>
          CRITICAL<span style={{ color: C.amberHot }}> MASS</span>
        </div>
        <div style={{ color: C.dim, fontSize: 12 }}>
          ROUND {String(s.round).padStart(4, "0")} · tape {s.seed}… · tick {TICK_MS}ms · rake {RAKE * 100}% dead pool only
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 14, alignItems: "center", fontSize: 13 }}>
          <span>
            BAL <span style={{ color: C.amber }}>{fmt(balance)} ◎</span>
          </span>
          <span style={{ color: pnl >= 0 ? C.green : C.red }}>
            {pnl >= 0 ? "+" : ""}{fmt(pnl)} ◎ session
          </span>
          <button style={{ ...btnBase, padding: "5px 10px", fontSize: 11 }} onClick={toggleSound}>
            {soundOn ? "SOUND ON" : "SOUND OFF"}
          </button>
        </div>
      </div>

      {/* ---------- annunciator grid ---------- */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 6, marginBottom: 12 }}>
        {lamps.map((l) => (
          <div
            key={l.label}
            className={l.on ? "cm-lamp-on" : ""}
            style={{
              fontFamily: "'Oswald', sans-serif",
              letterSpacing: "0.1em",
              fontSize: 11,
              textAlign: "center",
              padding: "8px 4px",
              border: `1px solid ${l.on ? l.col : C.edge}`,
              background: l.on ? l.col + "22" : C.panel2,
              color: l.on ? l.col : "#3a434b",
              boxShadow: l.on ? `0 0 14px ${l.col}44, inset 0 0 8px ${l.col}22` : "inset 0 2px 6px #00000066",
            }}
          >
            {l.label}
          </div>
        ))}
      </div>

      {/* ---------- main grid ---------- */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "stretch" }}>
        {/* scope + controls */}
        <div style={{ flex: "1 1 560px", minWidth: 320, display: "flex", flexDirection: "column", gap: 12 }}>
          <div
            ref={wrapRef}
            style={{
              position: "relative", height: 340, background: C.panel,
              border: `1px solid ${C.edge}`, boxShadow: "inset 0 0 40px #00000088",
            }}
          >
            <canvas ref={cvRef} style={{ position: "absolute", inset: 0 }} />
            {/* big readout */}
            <div style={{ position: "absolute", top: 14, left: 0, right: 0, textAlign: "center", pointerEvents: "none" }}>
              {s.phase === "LOBBY" && (
                <div>
                  <div style={{ fontSize: 13, color: C.dim, letterSpacing: "0.2em" }}>BETS OPEN</div>
                  <div style={{ fontSize: 44, fontWeight: 700, color: C.green }}>{secsLeft}s</div>
                  <div style={{ fontSize: 12, color: C.dim }}>pot forming: {fmt(s.pot)} ◎ · {s.players.length} in</div>
                </div>
              )}
              {s.phase === "RUN" && (
                <div>
                  <div
                    className={s.hazard > 0.02 ? "cm-pulse" : ""}
                    style={{ fontSize: 52, fontWeight: 700, color: s.hazard > 0.02 ? C.red : C.amberHot, textShadow: `0 0 24px ${s.hazard > 0.02 ? C.red : C.amberHot}66` }}
                  >
                    {fmt(s.m)}×
                  </div>
                  <div style={{ fontSize: 12, color: C.dim }}>
                    {aliveList.length} live · {fmt(aliveList.reduce((a, p) => a + p.stake * s.m, 0))} ◎ exposed
                  </div>
                </div>
              )}
              {s.phase === "RESULT" && s.resolution && (
                <div>
                  <div style={{ fontSize: 13, letterSpacing: "0.2em", color: s.resolution.type === "melt" ? C.red : C.cyan }}>
                    {s.resolution.type === "melt" ? "MELTDOWN" : "COLD SHUTDOWN"}
                  </div>
                  <div style={{ fontSize: 46, fontWeight: 700, color: s.resolution.type === "melt" ? C.red : C.cyan }}>
                    {fmt(s.resolution.m)}×
                  </div>
                </div>
              )}
            </div>

            {/* resolution card */}
            {s.phase === "RESULT" && s.resolution && (
              <div
                style={{
                  position: "absolute", left: 10, right: 10, bottom: 10, maxHeight: 200, overflowY: "auto",
                  background: "#10151acc", border: `1px solid ${C.edge}`, backdropFilter: "blur(3px)",
                  padding: 10, fontSize: 12,
                }}
              >
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 6, color: C.dim }}>
                  <span>dead pool <b style={{ color: C.red }}>{fmt(s.resolution.dead)} ◎</b></span>
                  <span>redistributed <b style={{ color: C.green }}>{fmt(s.resolution.prize)} ◎</b></span>
                  <span>rake <b style={{ color: C.amber }}>{fmt(s.resolution.rakeAmt)} ◎</b></span>
                  {s.resolution.yourNet != null && (
                    <span style={{ marginLeft: "auto" }}>
                      YOUR NET{" "}
                      <b style={{ color: s.resolution.yourNet > 0 ? C.green : s.resolution.yourNet < 0 ? C.red : C.cyan }}>
                        {s.resolution.yourNet >= 0 ? "+" : ""}{fmt(s.resolution.yourNet)} ◎
                      </b>
                    </span>
                  )}
                  <span style={{ color: C.dim }}>next round in {secsLeft}s</span>
                </div>
                {sortedPlayers.map((p) => (
                  <div key={p.id} style={{ display: "flex", gap: 8, padding: "2px 0", borderTop: `1px solid ${C.edge}55`, color: p.isYou ? C.cyan : C.text }}>
                    <span style={{ width: 130, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                    <span style={{ width: 70, color: C.dim }}>{fmt(p.stake)} ◎</span>
                    <span style={{ width: 90, color: p.exitM != null ? C.green : C.red }}>
                      {p.exitM != null ? `@ ${fmt(p.exitM)}×` : "☠ busted"}
                    </span>
                    <span style={{ marginLeft: "auto", color: p.payout - p.stake > 0.0001 ? C.green : p.payout === 0 ? C.red : C.dim }}>
                      {p.payout === 0 ? `-${fmt(p.stake)}` : `${p.payout - p.stake >= 0 ? "+" : ""}${fmt(p.payout - p.stake)}`} ◎
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* controls */}
          <div style={{ background: C.panel, border: `1px solid ${C.edge}`, padding: 12, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
            {s.phase === "LOBBY" && !armed && (
              <>
                <div>
                  <div style={{ fontSize: 10, color: C.dim, letterSpacing: "0.15em", marginBottom: 4 }}>STAKE ◎</div>
                  <input className="cm" value={betStr} onChange={(e) => setBetStr(e.target.value)} inputMode="decimal" />
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  {[0.1, 0.5, 1, 2].map((v) => (
                    <button key={v} style={{ ...btnBase, padding: "8px 10px", fontSize: 11 }} onClick={() => setBetStr(String(v))}>
                      {v}
                    </button>
                  ))}
                </div>
                <div>
                  <div style={{ fontSize: 10, color: C.dim, letterSpacing: "0.15em", marginBottom: 4 }}>
                    SEALED COMMIT ×<span style={{ color: C.dim }}> (optional auto-eject)</span>
                  </div>
                  <input className="cm" value={autoStr} onChange={(e) => setAutoStr(e.target.value)} placeholder="e.g. 2.00" inputMode="decimal" />
                </div>
                <button
                  style={{ ...btnBase, background: betOk ? C.amberHot : C.panel2, color: betOk ? "#151009" : "#3a434b", border: `1px solid ${betOk ? C.amberHot : C.edge}`, fontWeight: 600, padding: "12px 24px" }}
                  onClick={armStake}
                  disabled={!betOk}
                >
                  ARM STAKE
                </button>
                {!betOk && <span style={{ fontSize: 11, color: C.dim }}>min 0.05 ◎, max your balance</span>}
              </>
            )}
            {s.phase === "LOBBY" && armed && (
              <div style={{ fontSize: 13, color: C.green }}>
                ARMED {fmt(you.stake)} ◎{you.autoM ? ` · sealed commit @ ${fmt(you.autoM)}× (hidden from table)` : " · no commit — manual eject only"}
              </div>
            )}
            {s.phase === "RUN" && you && you.alive && (
              <button
                style={{
                  ...btnBase, fontSize: 20, fontWeight: 600, padding: "16px 42px",
                  background: you.queued ? C.panel2 : C.green, color: you.queued ? C.cyan : "#0d1512",
                  border: `1px solid ${you.queued ? C.cyan : C.green}`,
                  boxShadow: you.queued ? "none" : `0 0 22px ${C.green}55`,
                }}
                onClick={eject}
                disabled={you.queued}
              >
                {you.queued ? "EJECT QUEUED — NEXT TICK" : "EJECT"}
              </button>
            )}
            {s.phase === "RUN" && you && !you.alive && you.exitM != null && (
              <div style={{ fontSize: 14, color: C.cyan }}>
                Out @ {fmt(you.exitM)}× — your weight grows if others bust. Watch the core.
              </div>
            )}
            {s.phase === "RUN" && you && !you.alive && you.exitM == null && (
              <div style={{ fontSize: 14, color: C.red }}>Vaporized.</div>
            )}
            {s.phase === "RUN" && !you && <div style={{ fontSize: 13, color: C.dim }}>SPECTATING — arm a stake next lobby</div>}
            {s.phase === "RESULT" && <div style={{ fontSize: 13, color: C.dim }}>Round settled. Bets reopen shortly.</div>}
          </div>

          {/* history */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 10, color: C.dim, letterSpacing: "0.15em" }}>LAST ROUNDS</span>
            {s.history.map((h, i) => (
              <span
                key={i}
                style={{
                  fontSize: 11, padding: "3px 8px", border: `1px solid ${C.edge}`,
                  color: h.cold ? C.cyan : h.m < 1.5 ? C.red : h.m < 3 ? C.amber : C.green,
                  background: C.panel2,
                }}
              >
                {h.cold ? "CS" : fmt(h.m) + "×"}
              </span>
            ))}
            {s.history.length === 0 && <span style={{ fontSize: 11, color: C.dim }}>—</span>}
          </div>
        </div>

        {/* right column */}
        <div style={{ flex: "1 1 300px", minWidth: 280, display: "flex", flexDirection: "column", gap: 12 }}>
          {/* core load */}
          <div style={{ background: C.panel, border: `1px solid ${C.edge}`, padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, letterSpacing: "0.15em", color: C.dim, marginBottom: 6 }}>
              <span>CORE LOAD</span>
              <span>HAZARD / TICK</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
              <span style={{ fontSize: 26, fontWeight: 700, color: loadCol }}>{fmt(s.load)}</span>
              <span style={{ fontSize: 26, fontWeight: 700, color: s.hazard > 0.015 ? C.red : C.amber }}>
                {fmt(s.hazard * 100)}%
              </span>
            </div>
            <div style={{ position: "relative", height: 14, background: C.panel2, border: `1px solid ${C.edge}` }}>
              <div style={{ position: "absolute", inset: 1, width: `${loadPct * 100}%`, background: `linear-gradient(90deg, ${C.green}, ${C.amber} 55%, ${C.red})`, transition: "width 0.25s linear" }} />
              {/* load = 1.0 marker */}
              <div style={{ position: "absolute", left: `${(1 / 2.5) * 100}%`, top: -3, bottom: -3, width: 1, background: C.text, opacity: 0.6 }} />
            </div>
            <div style={{ fontSize: 10, color: C.dim, marginTop: 6 }}>
              load = live stakes × {fmt(s.m)}× ÷ pot · hazard = {H0}·load^{H_ALPHA} — ejects cool the core
            </div>
          </div>

          {/* table */}
          <div style={{ background: C.panel, border: `1px solid ${C.edge}`, padding: 12, maxHeight: 240, overflowY: "auto" }}>
            <div style={{ fontSize: 10, letterSpacing: "0.15em", color: C.dim, marginBottom: 6 }}>
              THE TABLE · pot {fmt(s.pot)} ◎
            </div>
            {sortedPlayers.length === 0 && <div style={{ fontSize: 12, color: C.dim }}>empty core</div>}
            {sortedPlayers.map((p) => {
              const st = statusOf(p);
              return (
                <div key={p.id} style={{ display: "flex", gap: 8, fontSize: 12, padding: "3px 0", borderTop: `1px solid ${C.edge}44`, color: p.isYou ? C.cyan : C.text }}>
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {p.name}
                    {s.pot > 0 && p.stake > 0.25 * s.pot ? " 🐋" : ""}
                  </span>
                  <span style={{ width: 64, textAlign: "right", color: C.dim }}>{fmt(p.stake)} ◎</span>
                  <span className={st.txt === "LIVE" ? "cm-pulse" : ""} style={{ width: 104, textAlign: "right", color: st.col }}>
                    {st.txt}
                  </span>
                </div>
              );
            })}
          </div>

          {/* log */}
          <div style={{ background: C.panel, border: `1px solid ${C.edge}`, padding: 12, flex: 1, minHeight: 140, maxHeight: 220, overflowY: "auto" }}>
            <div style={{ fontSize: 10, letterSpacing: "0.15em", color: C.dim, marginBottom: 6 }}>EVENT LOG</div>
            {s.feed.map((f, i) => (
              <div key={i} style={{ fontSize: 11, color: feedCol[f.k] || C.text, padding: "1px 0", opacity: i === 0 ? 1 : 0.85 }}>
                {f.msg}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* footer */}
      <div style={{ marginTop: 12, fontSize: 10, color: C.dim, lineHeight: 1.6 }}>
        Ejectors always get principal back. Busters' stakes form the dead pool, split among ejectors ∝ stake×(m−1) — later exits earn heavier weight. Rake {RAKE * 100}% on dead pool only; the house never touches principal. All exits clear at tick boundaries, so everyone in a slot gets the same multiplier. Deployed: per-tick randomness from a pre-committed hash-chain tape checked against the endogenous hazard — auditable after every round.
      </div>
    </div>
  );
}
