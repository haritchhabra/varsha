import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { AnimatePresence, animate, motion } from 'motion/react'
import { Activity, BookOpen, Check, FlaskConical, Map as MapIcon, Palette, Table2 } from 'lucide-react'
import { useStore } from './lib/store'
import { THEMES, THEME_ORDER, glow, theme } from './lib/theme'
import { loadMeta, loadTimeline, loadVerification } from './lib/data'
import { useT } from './lib/i18n'
import type { Tab } from './lib/types'
import Console from './pages/Console'

const Districts = lazy(() => import('./pages/Districts'))
const RegimeLab = lazy(() => import('./pages/RegimeLab'))
const Verification = lazy(() => import('./pages/Verification'))
const About = lazy(() => import('./pages/About'))

const BOOT_LINES = [
  'mounting 0.25° India grid · 4,643 land cells · 726 districts',
  'loading NWP rainfall · lead 24–120 h',
  'regime classifier online · 6 synoptic regimes',
  'routing to regime experts · soft gating',
  'calibrating exceedance probabilities · IMD thresholds',
  'verification engine armed · RMSE ETS CSI POD FAR FSS',
]

const HEX_BG = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='56' height='97' viewBox='0 0 56 97'%3E%3Cpath d='M28 0L56 16.2V48.5L28 64.7L0 48.5V16.2Z M28 64.7V97' fill='none' stroke='%2322d3ee' stroke-opacity='0.07' stroke-width='1'/%3E%3C/svg%3E\")"

function LogoMark({ size = 32, spin = true }: { size?: number; spin?: boolean }) {
  const id = 'lm' + size
  const vivid = theme().fx.vivid
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className="overflow-visible">
      <defs>
        <linearGradient id={`${id}-drop`} x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor={vivid ? '#a5f3fc' : 'var(--color-neon)'} />
          <stop offset="55%" stopColor={vivid ? '#22d3ee' : 'var(--color-neon)'} />
          <stop offset="100%" stopColor={vivid ? '#a78bfa' : 'var(--color-neon-2)'} />
        </linearGradient>
        <linearGradient id={`${id}-orbit`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={vivid ? '#22d3ee' : 'var(--color-fg-3)'} stopOpacity="0" />
          <stop offset="50%" stopColor={vivid ? '#67e8f9' : 'var(--color-fg-3)'} stopOpacity="0.9" />
          <stop offset="100%" stopColor={vivid ? '#a78bfa' : 'var(--color-fg-3)'} stopOpacity="0.2" />
        </linearGradient>
      </defs>
      <g className={spin && vivid ? 'origin-center motion-safe:animate-spin-slow' : ''} style={{ transformBox: 'fill-box' }}>
        <ellipse cx="16" cy="17" rx="15" ry="6.2" fill="none" stroke={`url(#${id}-orbit)`} strokeWidth="1.1" transform="rotate(-24 16 17)" />
      </g>
      <path d="M16 4.5C16 4.5 8.5 13.6 8.5 18.6a7.5 7.5 0 0 0 15 0C23.5 13.6 16 4.5 16 4.5z" fill={`url(#${id}-drop)`} style={{ filter: glow('drop-shadow(0 0 5px #22d3eeaa)') }} />
      <path d="M12.6 18.4a3.6 3.6 0 0 0 3 3.5" fill="none" stroke="#ffffff" strokeOpacity="0.75" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="29" cy="11.5" r="1.3" fill={vivid ? '#e0fbff' : 'var(--color-fg-3)'} style={{ filter: glow('drop-shadow(0 0 3px #67e8f9)') }} />
    </svg>
  )
}

function BootPercent() {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const c = animate(0, 100, { duration: 2.4, ease: 'easeInOut', onUpdate: (v) => { if (ref.current) ref.current.textContent = String(Math.round(v)).padStart(3, '0') } })
    return () => c.stop()
  }, [])
  return <span ref={ref} className="tabnum">000</span>
}

function Boot({ onDone }: { onDone: () => void }) {
  const [n, setN] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setN((k) => k + 1), 280)
    const done = setTimeout(onDone, 2600)
    return () => { clearInterval(id); clearTimeout(done) }
  }, [onDone])
  return (
    <motion.div className="fixed inset-0 z-[100] grid cursor-pointer place-items-center overflow-hidden space-bg" exit={{ opacity: 0, filter: 'blur(12px)', scale: 1.04 }} transition={{ duration: 0.6 }} onClick={onDone}>
      <div className="aurora" />
      <div className="absolute inset-0 hud-grid" />
      <div className="absolute inset-0 hidden [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)] vivid:block" style={{ backgroundImage: HEX_BG, backgroundSize: '56px 97px' }} />
      <div className="noise" />

      {/* radar */}
      <div className="pointer-events-none absolute top-1/2 left-1/2 hidden h-[640px] w-[640px] -translate-x-1/2 -translate-y-[62%] vivid:block">
        {[1, 0.78, 0.56, 0.34].map((k) => (
          <div key={k} className="absolute rounded-full border border-neon/10" style={{ inset: `${(1 - k) * 50}%` }} />
        ))}
        <div className="absolute top-0 bottom-0 left-1/2 w-px bg-gradient-to-b from-transparent via-neon/15 to-transparent" />
        <div className="absolute top-1/2 right-0 left-0 h-px bg-gradient-to-r from-transparent via-neon/15 to-transparent" />
        <div className="absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,transparent_0deg,transparent_260deg,#22d3ee0a_300deg,#22d3ee50_359deg,transparent_360deg)] [mask-image:radial-gradient(circle,black_30%,transparent_70%)] motion-safe:animate-radar" />
        {[[0.3, 0.38], [0.68, 0.3], [0.6, 0.7], [0.24, 0.64]].map(([x, y], i) => (
          <motion.span key={i} className="absolute h-1.5 w-1.5 rounded-full bg-neon-2 shadow-[0_0_10px_#22d3ee]" style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
            initial={{ opacity: 0, scale: 0 }} animate={{ opacity: [0, 1, 0.35], scale: [0, 1.6, 1] }} transition={{ delay: 0.4 + i * 0.45, duration: 0.9 }} />
        ))}
      </div>

      {/* screen HUD corners */}
      <div className="pointer-events-none absolute inset-6 font-mono text-[10px] tracking-[0.2em] text-fg-3">
        <span className="absolute top-0 left-0 hidden h-6 w-6 border-t border-l border-neon/50 vivid:block" />
        <span className="absolute top-0 right-0 hidden h-6 w-6 border-t border-r border-neon/50 vivid:block" />
        <span className="absolute bottom-0 left-0 hidden h-6 w-6 border-b border-l border-neon/50 vivid:block" />
        <span className="absolute right-0 bottom-0 hidden h-6 w-6 border-r border-b border-neon/50 vivid:block" />
        <span className="absolute top-2 left-9">6.5°N – 37.5°N · 66.5°E – 100°E</span>
        <span className="absolute top-2 right-9">SIH26080 · MoES / NCMRWF</span>
        <span className="absolute bottom-2 left-9">JJAS MONSOON · 0.25° GRID</span>
        <span className="absolute right-9 bottom-2 text-fg-2">CLICK ANYWHERE TO SKIP<span className="ml-1 inline-block motion-safe:animate-blink">_</span></span>
      </div>

      <div className="relative flex flex-col items-center">
        <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }} className="relative mb-6">
          <div className="absolute inset-0 hidden animate-pulse-ring rounded-full border border-neon/60 vivid:block" />
          <div className="absolute inset-0 hidden animate-pulse-ring rounded-full border border-plasma/50 [animation-delay:0.7s] vivid:block" />
          <div className="absolute -inset-3 hidden rounded-full border border-dashed border-neon/25 motion-safe:animate-spin-slow vivid:block" />
          <div className="relative grid h-24 w-24 place-items-center rounded-full border border-line-2 bg-ink-1 vivid:border-neon/40 vivid:bg-[radial-gradient(circle_at_35%_30%,#13233d,#070c16)] vivid:shadow-[0_0_60px_-10px_#22d3ee,inset_0_1px_0_#ffffff1a]">
            <LogoMark size={52} />
          </div>
        </motion.div>
        <div className="relative">
          <motion.h1 initial={{ letterSpacing: '0.8em', opacity: 0 }} animate={{ letterSpacing: '0.35em', opacity: 1 }} transition={{ duration: 1 }}
            className="font-display text-6xl font-bold shimmer-text">VARSHA</motion.h1>
          <motion.span aria-hidden className="pointer-events-none absolute inset-0 hidden font-display text-6xl font-bold tracking-[0.35em] text-neon mix-blend-screen vivid:block"
            initial={{ opacity: 0 }} animate={{ opacity: [0, 0.8, 0, 0.6, 0], x: [0, -6, 4, -2, 0], clipPath: ['inset(0 0 60% 0)', 'inset(20% 0 40% 0)', 'inset(60% 0 10% 0)', 'inset(40% 0 30% 0)', 'inset(0 0 100% 0)'] }}
            transition={{ delay: 0.75, duration: 0.45, ease: 'linear' }}>VARSHA</motion.span>
          <motion.span aria-hidden className="pointer-events-none absolute inset-0 hidden font-display text-6xl font-bold tracking-[0.35em] text-[#f0abfc] mix-blend-screen vivid:block"
            initial={{ opacity: 0 }} animate={{ opacity: [0, 0.7, 0, 0.5, 0], x: [0, 5, -4, 3, 0], clipPath: ['inset(50% 0 20% 0)', 'inset(10% 0 70% 0)', 'inset(70% 0 5% 0)', 'inset(30% 0 50% 0)', 'inset(0 0 100% 0)'] }}
            transition={{ delay: 0.8, duration: 0.45, ease: 'linear' }}>VARSHA</motion.span>
        </div>
        <p className="mt-2 font-mono text-xs tracking-[0.3em] text-fg-3">REGIME-AWARE MONSOON RAINFALL INTELLIGENCE</p>
        <div className="glass mt-8 w-[560px] max-w-[90vw] rounded-xl px-4 py-3">
          <div className="mb-2 flex items-center justify-between font-mono text-[9.5px] tracking-[0.2em] text-fg-3">
            <span className="flex items-center gap-2"><span className="dot-live text-neon" />SYSTEM BOOT</span>
            <span>v0.1 · DIGITAL TWIN</span>
          </div>
          <div className="h-36 font-mono text-[11.5px]">
            {BOOT_LINES.slice(0, n).map((l, i) => (
              <motion.div key={l} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} className="flex gap-2 py-[1px] text-fg-2">
                <span className="text-neon">[{String(i + 1).padStart(2, '0')}]</span>{l}<span className="ml-auto text-good vivid:[text-shadow:0_0_8px_#34d39988]">OK</span>
              </motion.div>
            ))}
            {n < BOOT_LINES.length && <span className="inline-block h-3 w-1.5 translate-y-0.5 bg-neon/80 motion-safe:animate-blink" />}
          </div>
          <div className="mt-2 flex items-center gap-3">
            <div className="relative h-1 flex-1 overflow-hidden rounded-full bg-line vivid:shadow-[inset_0_1px_2px_#000]">
              <motion.div className="relative h-full rounded-full bg-neon vivid:bg-gradient-to-r vivid:from-neon vivid:to-plasma vivid:shadow-[0_0_12px_#22d3ee]" initial={{ width: 0 }} animate={{ width: '100%' }} transition={{ duration: 2.4, ease: 'easeInOut' }}>
                <span className="absolute top-1/2 right-0 hidden h-2.5 w-2.5 -translate-y-1/2 translate-x-1/2 rounded-full bg-white shadow-[0_0_12px_#67e8f9] vivid:block" />
              </motion.div>
            </div>
            <span className="w-12 text-right font-mono text-[11px] text-neon-2 glow-text"><BootPercent />%</span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

const TABS: { id: Tab; label: string; icon: typeof MapIcon }[] = [
  { id: 'console', label: 'Console', icon: MapIcon },
  { id: 'districts', label: 'District Bulletin', icon: Table2 },
  { id: 'regimes', label: 'Regime Lab', icon: Activity },
  { id: 'verify', label: 'Verification', icon: FlaskConical },
  { id: 'about', label: 'How it works', icon: BookOpen },
]

function Clock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(id) }, [])
  return <span className="tabnum">{now.toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour12: false })} IST</span>
}

function ThemePicker() {
  const current = useStore((s) => s.theme)
  const setTheme = useStore((s) => s.setTheme)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const off = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('mousedown', off); window.addEventListener('keydown', esc)
    return () => { window.removeEventListener('mousedown', off); window.removeEventListener('keydown', esc) }
  }, [open])
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} title="Colour theme" aria-haspopup="menu" aria-expanded={open}
        className="flex items-center gap-1.5 rounded-lg border border-line bg-ink-2/40 px-2 py-1 text-[11px] text-fg-2 hover:border-line-2 hover:text-fg">
        <Palette size={13} />
        <span className="hidden whitespace-nowrap sm:inline">{THEMES[current].label.replace(/ \(.*\)$/, '')}</span>
      </button>
      {open && (
        <div role="menu" className="glass-strong absolute top-full right-0 z-[60] mt-2 w-[330px] rounded-xl p-1.5">
          <div className="label-xs px-2 pt-1 pb-1.5">Colour theme</div>
          {THEME_ORDER.map((n) => {
            const th = THEMES[n]
            const sw = [th.ui.void, th.ui.ink1, th.ui.accent, th.data.rain[2], th.data.rain[4], th.data.rain[5]]
            return (
              <button key={n} role="menuitemradio" aria-checked={n === current} onClick={() => { setOpen(false); if (n !== current) setTheme(n) }}
                className={`flex w-full items-start gap-3 rounded-lg px-2 py-2 text-left hover:bg-fg/[0.05] ${n === current ? 'bg-fg/[0.06]' : ''}`}>
                <span className="mt-0.5 flex h-7 shrink-0 overflow-hidden rounded-md border border-line-2">
                  {sw.map((c, i) => <span key={i} className="h-full w-3.5" style={{ background: c }} />)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-fg">{th.label}{n === current && <Check size={13} className="text-neon" />}</span>
                  <span className="block text-[11px] leading-snug text-fg-3">{th.desc}</span>
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Nav() {
  const t = useT()
  const { tab, set, lang, meta, verification } = useStore()
  return (
    <nav className="no-print relative z-50 flex h-14 items-center gap-4 bg-gradient-to-b from-ink-1/95 to-ink-1/75 px-4 backdrop-blur-xl">
      <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-line/80" />
      <span aria-hidden className="pointer-events-none absolute bottom-0 left-[8%] hidden h-px w-[40%] bg-gradient-to-r from-transparent via-neon/60 to-transparent vivid:block" />
      <span aria-hidden className="pointer-events-none absolute right-[10%] bottom-0 hidden h-px w-[30%] bg-gradient-to-r from-transparent via-plasma/50 to-transparent vivid:block" />
      <div className="group flex items-center gap-2.5">
        <div className="relative grid h-9 w-9 place-items-center rounded-xl border border-line-2 bg-ink-2 transition vivid:border-neon/30 vivid:bg-[radial-gradient(circle_at_30%_25%,#15294a,#070c16)] vivid:shadow-[0_0_22px_-6px_#22d3ee,inset_0_1px_0_#ffffff1a] vivid:group-hover:shadow-[0_0_28px_-4px_#22d3ee,inset_0_1px_0_#ffffff26]">
          <LogoMark size={26} />
        </div>
        <div className="leading-none">
          <div className="font-display text-[17px] font-bold tracking-[0.2em] text-gradient vivid:[filter:drop-shadow(0_0_10px_#22d3ee55)]">VARSHA</div>
          <div className="mt-0.5 font-mono text-[8.5px] tracking-[0.2em] text-fg-3">SIH26080 · MoES / NCMRWF</div>
        </div>
      </div>
      <div className="h-6 w-px bg-gradient-to-b from-transparent via-line-2 to-transparent" />
      <div className="flex items-center gap-0.5 rounded-xl border border-line/60 bg-ink-2/40 p-0.5 vivid:shadow-[inset_0_1px_2px_#00000080]">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => set({ tab: id })}
            className={`group/tab relative flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] transition ${tab === id ? 'text-fg' : 'text-fg-3 hover:bg-fg/[0.04] hover:text-fg-2'}`}>
            {tab === id && (
              <motion.span layoutId="tab" transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                className="absolute inset-0 rounded-lg border border-line-2 bg-ink-1 calm:shadow-[0_1px_2px_rgba(0,0,0,0.12)] vivid:border-neon/30 vivid:bg-transparent vivid:bg-gradient-to-b vivid:from-neon/15 vivid:to-neon/5 vivid:shadow-[0_0_18px_-6px_#22d3ee,inset_0_1px_0_#ffffff14]">
                <span className="absolute -bottom-px left-1/2 h-[2px] w-2/3 -translate-x-1/2 rounded-full bg-neon vivid:bg-transparent vivid:bg-gradient-to-r vivid:from-transparent vivid:via-neon-2 vivid:to-transparent vivid:shadow-[0_0_10px_#22d3ee]" />
              </motion.span>
            )}
            <Icon size={14} className={`relative transition ${tab === id ? 'text-neon-2 vivid:[filter:drop-shadow(0_0_4px_#22d3ee)]' : 'group-hover/tab:text-fg-2'}`} /><span className="relative">{t(label)}</span>
          </button>
        ))}
      </div>
      <div className="ml-auto flex items-center gap-3">
        <div className="hidden items-center gap-2 rounded-lg border border-good/25 bg-good/5 px-2 py-1 font-mono text-[9.5px] tracking-wider text-good lg:flex" title="All pipeline stages online">
          <span className="dot-live text-good" />
          <span className="hidden 2xl:inline">SYSTEM NOMINAL</span>
          <span className="hidden text-fg-3 2xl:inline">·</span>
          <span className="hidden text-fg-2 2xl:inline"><Clock /></span>
        </div>
        {verification && (
          <div className="hidden items-center gap-2.5 rounded-lg border border-line/60 bg-ink-2/40 px-2.5 py-1 font-mono text-[10.5px] xl:flex">
            <span className="text-fg-3">ETS@64.5</span>
            <span className="text-raw-2">{verification.overall.RAW.cat['64.5'].ets?.toFixed(3)}</span>
            <span className="text-fg-3">→</span>
            <span className="text-neon-2 glow-text">{verification.overall.VARSHA.cat['64.5'].ets?.toFixed(3)}</span>
          </div>
        )}
        <span className="rounded-md border border-caution/30 bg-caution/10 px-2 py-1 font-mono text-[9.5px] tracking-wider text-caution vivid:shadow-[0_0_14px_-6px_#fbbf24]" title="Trained and verified on a physically-based synthetic monsoon twin over the real India grid, terrain and district map. Swap in IMD/NCMRWF data for operations.">
          {meta?.app.mode === 'digital-twin' ? 'DIGITAL-TWIN DATA' : 'LIVE DATA'}
        </span>
        <ThemePicker />
        <div className="flex overflow-hidden rounded-lg border border-line bg-ink-2/40 p-0.5">
          {(['en', 'hi'] as const).map((l) => (
            <button key={l} onClick={() => set({ lang: l })} className={`rounded-md px-2 py-0.5 text-[11px] ${lang === l ? 'bg-neon text-on-accent vivid:bg-neon/15 vivid:text-neon-2 vivid:shadow-[inset_0_0_0_1px_#22d3ee40,0_0_10px_-4px_#22d3ee]' : 'text-fg-3 hover:text-fg-2'}`}>{l === 'en' ? 'EN' : 'हिं'}</button>
          ))}
        </div>
      </div>
    </nav>
  )
}

export default function App() {
  // remount the whole tree on theme change: canvases and deck.gl layers repaint with the new palette
  const themeName = useStore((s) => s.theme)
  return <Shell key={themeName} />
}

function Shell() {
  const { tab, booted, meta, set } = useStore()
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (useStore.getState().meta) return // already loaded (theme switch remount)
    Promise.all([loadMeta(), loadTimeline(), loadVerification()])
      .then(([meta, timeline, verification]) => {
        const ev = meta.events.find((e) => e.regime === 2) ?? meta.events[0]
        const idx = Math.max(0, timeline.findIndex((d) => d.date === ev?.date))
        set({ meta, timeline, verification, dateIdx: idx })
      })
      .catch((e) => setErr(String(e)))
  }, [set])

  return (
    <div className="relative flex h-full flex-col space-bg">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="aurora" />
        <div className="noise" />
      </div>
      <AnimatePresence>{!booted && <Boot key="boot" onDone={() => set({ booted: true })} />}</AnimatePresence>
      <Nav />
      <main className="relative flex-1 overflow-hidden">
        {err && <div className="m-8 rounded-xl border border-bad/40 bg-bad/10 p-4 font-mono text-sm text-bad">Could not load dashboard data ({err}). Run <code>backend/run_pipeline.py</code> first.</div>}
        {meta && (
          <Suspense fallback={<div className="flex items-center gap-2 p-8 font-mono text-xs text-fg-3"><span className="dot-live text-neon" />loading…</div>}>
            {tab === 'console' && <Console />}
            {tab === 'districts' && <Districts />}
            {tab === 'regimes' && <RegimeLab />}
            {tab === 'verify' && <Verification />}
            {tab === 'about' && <About />}
          </Suspense>
        )}
      </main>
    </div>
  )
}
