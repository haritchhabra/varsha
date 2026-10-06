import { motion, useReducedMotion } from 'motion/react'
import { BookOpen, Check, Database, FlaskConical, Gauge, GitBranch, Radar, Replace, Rocket, ShieldCheck, CircleCheck } from 'lucide-react'
import { useStore } from '../lib/store'
import { METHOD_COLORS, REGIME_COLORS, WARN, dataInk } from '../lib/colors'
import { glow, theme } from '../lib/theme'
import { Panel } from '../components/ui'

const NODE_DEFS = [
  { id: 'nwp', x: 10, y: 150, w: 175, t: 'Raw NWP rainfall', s: 'NCUM · GFS · ECMWF' },
  { id: 'feat', x: 215, y: 150, w: 175, t: 'Feature engine', s: 'cell + synoptic predictors' },
  { id: 'clf', x: 420, y: 60, w: 170, t: 'Regime classifier', s: 'GBM → P(6 regimes)' },
  { id: 'gate', x: 420, y: 240, w: 170, t: 'Soft gate', s: 'weights = P(regime)' },
  { id: 'exp', x: 625, y: 150, w: 175, t: '6 regime experts', s: '+ regime-aware trunk' },
  { id: 'cal', x: 835, y: 60, w: 180, t: 'Frequency calibration', s: 'per-regime quantile map' },
  { id: 'prob', x: 835, y: 240, w: 180, t: 'Exceedance models', s: 'P(≥64.5 · 115.6 · 204.5)' },
  { id: 'dist', x: 1040, y: 150, w: 170, t: 'District product', s: 'IMD colours · API' },
]
/** Node identity colours, read from the active theme during render (hex, so alpha suffixes work). */
function nodeColors(): Record<string, string> {
  const T = theme()
  return {
    nwp: T.ui.raw, feat: T.fx.vivid ? T.ui.fg2 : T.ui.fg3, clf: REGIME_COLORS[2], gate: METHOD_COLORS.MOE,
    exp: REGIME_COLORS[0], cal: T.ui.accent, prob: T.ui.prob, dist: WARN[1].color,
  }
}
const EDGES: [string, string][] = [['nwp', 'feat'], ['feat', 'clf'], ['feat', 'gate'], ['clf', 'gate'], ['gate', 'exp'], ['feat', 'exp'], ['exp', 'cal'], ['exp', 'prob'], ['clf', 'prob'], ['cal', 'dist'], ['prob', 'dist']]
const H = 56

function Pipeline() {
  const still = useReducedMotion()
  const V = theme().fx.vivid
  const NC = nodeColors()
  const NODES = NODE_DEFS.map((n) => ({ ...n, c: NC[n.id] }))
  const byId = Object.fromEntries(NODES.map((n) => [n.id, n]))
  const ends = (a: string, b: string) => {
    const A = byId[a], B = byId[b]
    if (a === 'clf' && b === 'gate') return [A.x + A.w / 2, A.y + H, B.x + B.w / 2, B.y]
    return [A.x + A.w, A.y + H / 2, B.x, B.y + H / 2]
  }
  const path = (a: string, b: string) => {
    const A = byId[a], B = byId[b]
    const x1 = A.x + A.w, y1 = A.y + H / 2, x2 = B.x, y2 = B.y + H / 2
    if (a === 'clf' && b === 'gate') return `M${A.x + A.w / 2},${A.y + H} L${B.x + B.w / 2},${B.y}`
    if (a === 'clf' && b === 'prob') return `M${x1},${y1} C${x1 + 120},${y1} ${x2 - 120},${y2} ${x2},${y2}`
    const mx = (x1 + x2) / 2
    return `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`
  }
  return (
    <svg viewBox="0 36 1220 304" className="w-full overflow-visible">
      <defs>
        <filter id="glow"><feGaussianBlur stdDeviation="3" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        <filter id="edge-blur" x="-10%" y="-50%" width="120%" height="200%"><feGaussianBlur stdDeviation="2.5" /></filter>
        <filter id="node-halo" x="-30%" y="-80%" width="160%" height="260%"><feGaussianBlur stdDeviation="9" /></filter>
        <pattern id="pipe-dots" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="0.8" fill={V ? '#22d3ee' : 'var(--color-fg-3)'} fillOpacity={V ? 0.12 : 0.3} /></pattern>
        {V && (
          <linearGradient id="node-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#12203a" />
            <stop offset="100%" stopColor="#080f1c" />
          </linearGradient>
        )}
        <linearGradient id="loop-g" x1="1" y1="0" x2="0" y2="0">
          <stop offset="0%" stopColor={NC.dist} stopOpacity="0.6" />
          <stop offset="50%" stopColor={NC.cal} stopOpacity="0.8" />
          <stop offset="100%" stopColor={NC.nwp} stopOpacity="0.6" />
        </linearGradient>
        {EDGES.map(([a, b]) => {
          const [x1, y1, x2, y2] = ends(a, b)
          return (
            <linearGradient key={a + b} id={`eg-${a}-${b}`} gradientUnits="userSpaceOnUse" x1={x1} y1={y1} x2={x2 === x1 ? x2 + 0.01 : x2} y2={y2}>
              <stop offset="0%" stopColor={byId[a].c} />
              <stop offset="100%" stopColor={byId[b].c} />
            </linearGradient>
          )
        })}
      </defs>
      <rect x="0" y="0" width="1220" height="340" fill="url(#pipe-dots)" />
      {EDGES.map(([a, b], i) => {
        const d = path(a, b)
        const g = `url(#eg-${a}-${b})`
        return (
          <g key={a + b}>
            {V && <path d={d} fill="none" stroke={g} strokeWidth={5} strokeOpacity={0.35} filter="url(#edge-blur)" />}
            <path d={d} fill="none" stroke={g} strokeOpacity={V ? 0.55 : 0.7} strokeWidth={1.5} />
            <path d={d} fill="none" stroke={g} strokeWidth={1.6} strokeDasharray="3 11" strokeLinecap="round">
              {!still && <animate attributeName="stroke-dashoffset" from="28" to="0" dur="1.1s" repeatCount="indefinite" />}
            </path>
            <circle r={3.5} fill={byId[b].c} filter={V ? 'url(#glow)' : undefined}>
              {!still && <animateMotion dur={`${2.2 + (i % 3) * 0.5}s`} repeatCount="indefinite" path={d} begin={`${i * 0.25}s`} />}
            </circle>
          </g>
        )
      })}
      {V && <path d="M1125,206 C1125,318 97,318 97,206" fill="none" stroke="url(#loop-g)" strokeWidth={4} strokeOpacity={0.35} filter="url(#edge-blur)" />}
      <path d="M1125,206 C1125,318 97,318 97,206" fill="none" stroke="url(#loop-g)" strokeWidth={1.4} strokeDasharray="6 6">
        {!still && <animate attributeName="stroke-dashoffset" from="0" to="24" dur="1.4s" repeatCount="indefinite" />}
      </path>
      <polygon points="97,206 92,215 102,215" fill={NC.nwp} opacity={0.8} />
      <text x={610} y={330} textAnchor="middle" fontSize={11} fill="var(--color-neon-2)" fontFamily="JetBrains Mono" style={{ filter: glow('drop-shadow(0 0 6px #22d3ee88)') }}>verification loop · RMSE · ETS · CSI · POD · FAR · FSS · Brier → retrain / re-weight</text>
      {NODES.map((n, i) => (
        <motion.g key={n.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 * i }}>
          {V && <rect x={n.x + 8} y={n.y + 10} width={n.w - 16} height={H - 12} rx={12} fill={n.c} opacity={0.22} filter="url(#node-halo)" />}
          <rect x={n.x} y={n.y} width={n.w} height={H} rx={12} fill={V ? 'url(#node-fill)' : 'var(--color-ink-1)'} stroke={n.c} strokeOpacity={V ? 0.75 : 0.9} />
          {V && <line x1={n.x + 16} x2={n.x + n.w - 16} y1={n.y + 0.5} y2={n.y + 0.5} stroke="#ffffff" strokeOpacity={0.18} />}
          <rect x={n.x} y={n.y} width={4} height={H} rx={2} fill={n.c} filter={V ? 'url(#glow)' : undefined} />
          <text x={n.x + n.w - 12} y={n.y + 16} textAnchor="end" fontSize={8.5} style={{ fill: V ? dataInk(n.c) : 'var(--color-fg-3)' }} fillOpacity={V ? 0.7 : 1} fontFamily="JetBrains Mono">{String(i + 1).padStart(2, '0')}</text>
          <text x={n.x + 14} y={n.y + 23} fontSize={13} fontWeight={600} fill="var(--color-fg)" fontFamily="Space Grotesk">{n.t}</text>
          <text x={n.x + 14} y={n.y + 41} fontSize={10} fill="var(--color-fg-2)" fontFamily="JetBrains Mono">{n.s}</text>
          <circle cx={n.x} cy={n.y + H / 2} r={2.6} fill={V ? 'var(--color-void)' : 'var(--color-ink-1)'} stroke={n.c} strokeWidth={1.2} />
          <circle cx={n.x + n.w} cy={n.y + H / 2} r={2.6} fill={V ? 'var(--color-void)' : 'var(--color-ink-1)'} stroke={n.c} strokeWidth={1.2} />
        </motion.g>
      ))}
    </svg>
  )
}

const STEPS = ['Identify the regime', 'route to a specialist', 'calibrate', 'warn', 'verify']

export default function About() {
  const { verification: V } = useStore()
  const vivid = theme().fx.vivid
  const NC = nodeColors()
  return (
    <div data-scroll className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[1300px] space-y-5 px-6 py-6">
        <div className="glass hud-corners rounded-2xl px-6 py-6">
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
            <div className="hud-grid absolute inset-0 opacity-70" />
            <div className="absolute -top-20 left-1/4 hidden h-52 w-96 rounded-full bg-neon/10 blur-3xl vivid:block" />
            <div className="absolute -right-10 -bottom-24 hidden h-52 w-80 rounded-full bg-plasma/10 blur-3xl vivid:block" />
          </div>
          <div className="relative">
            <div className="label-xs flex items-center gap-2"><span className="grid h-5 w-5 place-items-center rounded-md border border-neon/40 bg-neon/10 text-neon vivid:shadow-[0_0_12px_-4px_#22d3ee]"><BookOpen size={11} /></span> How VARSHA works</div>
            <h1 className="mt-3 font-display text-3xl leading-snug font-semibold tracking-tight">
              {STEPS.map((s, i) => (
                <span key={s}>
                  {i > 0 && <span className="mx-1.5 text-neon vivid:[text-shadow:0_0_12px_#22d3ee]">→</span>}
                  <span className={i === 0 ? 'text-gradient' : ''}>{s}</span>
                </span>
              ))}.
            </h1>
          </div>
        </div>
        <Panel title="Architecture"><div className="px-4 pt-2 pb-4"><Pipeline /></div></Panel>

        <div className="grid gap-5 md:grid-cols-3">
          {[
            { h: '1 · Regime detection', I: Radar, c: NC.clf, b: 'A gradient-boosted classifier reads what a duty forecaster reads: monsoon-trough position, low-level jet, 850 hPa vorticity, MSLP minimum, offshore trough, WD trough, OLR, plus regional rain signatures in the NWP field. It outputs probabilities for Active, Break, Depression, Coastal-Orographic, Western Disturbance and Normal.' },
            { h: '2 · Regime-specific correction', I: GitBranch, c: NC.exp, b: 'Each regime has an expert trained with soft weights (out-of-fold gate probabilities). Experts see neighbourhood statistics, directional offsets for systematic displacement, terrain and coast distance, and lead time. They are blended with the gate probabilities and a shared regime-aware trunk.' },
            { h: '3 · Heavy-rain probability', I: Gauge, c: NC.prob, b: 'Separate exceedance models for the IMD heavy, very heavy and extremely heavy thresholds, isotonic-calibrated on an independent season. The district colour code comes from the heaviest cell\'s probabilities, following IMD\'s probability-impact logic.' },
          ].map((c, i) => (
            <Panel key={c.h} title={c.h} delay={0.05 * i}>
              <div className="relative px-4 pb-4">
                <span aria-hidden className="pointer-events-none absolute right-3 -bottom-3 font-display text-[72px] leading-none font-bold text-fg/[0.04] vivid:text-white/[0.03]">{i + 1}</span>
                <div className="mb-3 flex items-center gap-3 pt-1">
                  <span className="grid h-10 w-10 place-items-center rounded-xl border" style={vivid
                    ? { borderColor: c.c + '66', background: `radial-gradient(circle at 30% 25%, ${c.c}40, ${c.c}0d 70%)`, color: c.c, boxShadow: `0 0 22px -8px ${c.c}, inset 0 1px 0 #ffffff1a` }
                    : { borderColor: c.c + '66', background: c.c + '1f', color: dataInk(c.c) }}>
                    <c.I size={18} />
                  </span>
                  <span className="h-px flex-1" style={{ background: vivid ? `linear-gradient(90deg, ${c.c}88, transparent)` : 'var(--color-line)' }} />
                </div>
                <p className="text-[13px] leading-relaxed text-fg-2">{c.b}</p>
              </div>
            </Panel>
          ))}
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <Panel title={<span className="flex items-center gap-1.5"><Database size={11} /> Data: what is real, what is simulated</span>}>
            <div className="space-y-2.5 px-4 pb-4 text-[13px] leading-relaxed text-fg-2">
              {[
                { I: CircleCheck, cls: 'text-good', rail: 'var(--color-good)', k: 'Real:', v: <>the 0.25° India grid (IMD gridded-rainfall geometry), ETOPO1 terrain for 9,473 land cells, coastline, 726 districts on India's official boundary, and IMD intensity thresholds and colour codes.</> },
                { I: FlaskConical, cls: 'text-caution', rail: 'var(--color-caution)', k: 'Simulated (digital twin):', v: <>seven JJAS seasons of daily rainfall with a regime sequence (onset/withdrawal isochrones, depressions tracking WNW, offshore troughs, WD interactions). The "NWP" carries the regime-dependent errors reported in the literature: displaced depression tracks, Ghats under-forecast, break-phase false alarms, drizzle bias, damped extremes.</> },
                { I: Replace, cls: 'text-neon-2', rail: 'var(--color-neon-2)', k: 'Swap-in path:', v: <>replace <code className="rounded bg-ink-3 px-1 py-px font-mono text-[12px] text-fg">simulate_year()</code> with IMD 0.25° gridded rainfall (imdlib) plus NCUM/NEPS, IMD-GFS or ECMWF forecasts regridded to 0.25°, accumulated 0830–0830 IST. Features, classifier, experts, verification and dashboard run unchanged.</> },
              ].map((r) => (
                <div key={r.k} className="relative flex gap-3 rounded-xl border border-line/80 bg-ink-2/50 p-3 transition hover:border-line-2 vivid:bg-transparent vivid:bg-gradient-to-r vivid:from-ink-2/70 vivid:to-transparent">
                  <span aria-hidden className="absolute top-3 bottom-3 left-0 w-[2px] rounded-full" style={{ background: r.rail, boxShadow: glow(`0 0 8px ${r.rail}`) }} />
                  <r.I size={16} className={`mt-0.5 shrink-0 ${r.cls}`} />
                  <p><span className={r.cls}>{r.k}</span> {r.v}</p>
                </div>
              ))}
            </div>
          </Panel>
          <Panel title={<span className="flex items-center gap-1.5"><ShieldCheck size={11} /> Scientific hygiene</span>}>
            <ul className="space-y-2 px-4 pb-4 text-[13px] leading-relaxed text-fg-2">
              {[
                <>Strict temporal split: train {V?.training.train_years.join(', ')}; calibrate {V?.training.calib_years.join(', ')}; test {V?.training.test_years.join(', ')}.</>,
                <>Leave-one-season-out regime probabilities feed expert training, so there is no in-sample gating.</>,
                <>Blend weight chosen on the calibration season subject to RMSE &lt; raw NWP.</>,
                <>Physical-plausibility guard on every ML output (≤ 3× NWP neighbourhood max, ≤ 500 mm).</>,
                <>Six baselines, including classical quantile mapping and a regime-blind ML corrector.</>,
                <>Metrics per lead, per regime, at grid and district scale; FSS reported against its 0.5 + f₀/2 useful-skill line.</>,
              ].map((li, i) => (
                <li key={i} className="flex gap-2.5">
                  <span className="mt-[3px] grid h-4 w-4 shrink-0 place-items-center rounded-full border border-neon/40 bg-neon/10 text-neon vivid:shadow-[0_0_10px_-3px_#22d3ee]"><Check size={10} strokeWidth={3} /></span>
                  <span>{li}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        <Panel title={<span className="flex items-center gap-1.5"><Rocket size={11} /> Roadmap</span>}>
          <div className="relative px-4 pt-3 pb-4">
            <div aria-hidden className="absolute top-[26px] right-8 left-8 hidden h-px md:block" style={{ background: vivid ? 'linear-gradient(90deg, #22d3ee, #a78bfa 60%, #26395a)' : 'var(--color-line-2)' }} />
            <div aria-hidden className="absolute top-[24px] right-8 left-8 hidden h-[5px] opacity-50 blur-[3px] vivid:md:block" style={{ background: 'linear-gradient(90deg, #22d3ee, #a78bfa 45%, transparent)' }} />
            <div className="grid gap-3 md:grid-cols-4">
              {[
                { t: 'Hackathon (now)', b: 'Digital twin, regime classifier, experts, probabilities, district bulletin, verification lab, EN/हिं.' },
                { t: 'Pilot (4–6 weeks)', b: 'IMD gridded rainfall and NCMRWF NCUM/NEPS hindcasts, 2015–2024 JJAS; a real regime catalogue from IMD daily weather reports and RSMC tracks.' },
                { t: 'Model v2', b: 'U-Net / diffusion spatial corrector per regime, NEPS ensemble dressing, radar and satellite nowcast blending for Day-0.' },
                { t: 'Operations', b: 'Daily 0830 IST run, CAP alerts to SDMAs, API and WhatsApp/SMS district bulletins, automatic drift monitoring and retraining.' },
              ].map((r, i) => (
                <motion.div key={r.t} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }} className="relative">
                  <div className="mb-3 flex justify-center">
                    <span className={`relative grid h-[22px] w-[22px] place-items-center rounded-full border ${i === 0 ? 'border-neon bg-neon/20 calm:bg-ink-1 vivid:shadow-[0_0_16px_#22d3ee]' : 'border-line-2 bg-ink-1'}`}>
                      {i === 0 ? <span className="dot-live text-neon" /> : <span className="h-1.5 w-1.5 rounded-full" style={{ background: i === 1 ? 'var(--color-plasma)' : 'var(--color-fg-3)' }} />}
                    </span>
                  </div>
                  <div className={`group h-[calc(100%-34px)] rounded-xl border p-3 transition duration-300 hover:-translate-y-0.5 ${i === 0 ? 'border-neon/40 bg-neon/[0.06] vivid:bg-transparent vivid:bg-gradient-to-b vivid:from-neon/10 vivid:to-ink-1/60 vivid:shadow-[0_14px_34px_-22px_#22d3ee]' : 'border-line bg-ink-2/60 hover:border-line-2 vivid:bg-transparent vivid:bg-gradient-to-b vivid:from-ink-2/80 vivid:to-ink-1/60'}`}>
                    <div className="font-mono text-[10px] text-neon">0{i + 1}</div>
                    <div className="mt-0.5 font-display text-sm font-semibold">{r.t}</div>
                    <p className="mt-1 text-[12px] text-fg-2">{r.b}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </Panel>
      </div>
    </div>
  )
}
