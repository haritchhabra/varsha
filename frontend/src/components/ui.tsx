import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { animate, motion } from 'motion/react'
import { CloudRainWind, Cloud, Mountain, Sun, Tornado, Wind, type LucideIcon } from 'lucide-react'
import { WARN } from '../lib/colors'
import { glow, theme } from '../lib/theme'

export const REGIME_ICON: LucideIcon[] = [CloudRainWind, Sun, Tornado, Mountain, Wind, Cloud]

export function Panel({ children, className = '', title, right, delay = 0 }: { children: ReactNode; className?: string; title?: ReactNode; right?: ReactNode; delay?: number }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12, filter: 'blur(6px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 0.5, delay, ease: [0.2, 0.7, 0.2, 1] }}
      className={`glass hud-corners rounded-2xl ${className}`}
    >
      <span aria-hidden className="pointer-events-none absolute inset-x-8 top-0 hidden h-px bg-gradient-to-r from-transparent via-neon/70 to-transparent vivid:block" />
      {title !== undefined && (
        <header className="relative flex items-center justify-between gap-3 px-4 pt-3 pb-2">
          <div className="label-xs flex items-center gap-2">
            <span className="relative grid h-3 w-3 place-items-center">
              <span className="absolute inset-0 hidden rounded-[3px] border border-neon/40 motion-safe:animate-[spin_6s_linear_infinite] vivid:block" />
              <span className="h-1.5 w-1.5 rounded-[2px] bg-neon vivid:h-1 vivid:w-1 vivid:rounded-full vivid:shadow-[0_0_8px_#22d3ee]" />
            </span>
            {title}
          </div>
          {right}
          <span aria-hidden className="pointer-events-none absolute inset-x-4 bottom-0 h-px bg-line/70 vivid:bg-transparent vivid:bg-gradient-to-r vivid:from-neon/25 vivid:via-line/60 vivid:to-transparent" />
        </header>
      )}
      {children}
    </motion.section>
  )
}

export function CountUp({ value, decimals = 0, suffix = '', className = '' }: { value: number; decimals?: number; suffix?: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const prev = useRef(0)
  useEffect(() => {
    const c = animate(prev.current, value, {
      duration: 0.8, ease: 'easeOut',
      onUpdate: (v) => { if (ref.current) ref.current.textContent = v.toFixed(decimals) + suffix },
    })
    prev.current = value
    return () => c.stop()
  }, [value, decimals, suffix])
  return <span ref={ref} className={`tabnum ${className}`}>{value.toFixed(decimals)}{suffix}</span>
}

export function Stat({ label, value, decimals = 1, unit, sub, accent }: { label: string; value: number; decimals?: number; unit?: string; sub?: ReactNode; accent?: string }) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-line bg-ink-2 px-3 py-2.5 transition duration-300 hover:border-line-2 calm:hover:shadow-[0_6px_18px_-12px_rgba(0,0,0,0.35)] vivid:bg-transparent vivid:bg-gradient-to-b vivid:from-ink-3/70 vivid:to-ink-2/50 vivid:shadow-[inset_0_1px_0_#ffffff0d] vivid:hover:-translate-y-px vivid:hover:shadow-[inset_0_1px_0_#ffffff14,0_10px_24px_-14px_#22d3ee55]">
      <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 hidden h-px opacity-60 vivid:block vivid:opacity-80" style={{ background: `linear-gradient(90deg, transparent, ${accent ?? 'var(--color-fg-2)'}, transparent)` }} />
      <span aria-hidden className="pointer-events-none absolute -top-8 left-1/2 hidden h-12 w-3/4 -translate-x-1/2 rounded-full opacity-[0.14] blur-xl transition-opacity duration-300 group-hover:opacity-25 vivid:block" style={{ background: accent ?? 'var(--color-fg-2)' }} />
      <div className="label-xs relative">{label}</div>
      <div className="kpi-number relative mt-1 flex items-baseline gap-1 text-2xl font-semibold" style={{ color: accent }}>
        <CountUp value={value} decimals={decimals} />
        {unit && <span className="font-mono text-xs font-normal tracking-normal text-fg-3 [text-shadow:none]">{unit}</span>}
      </div>
      {sub && <div className="relative mt-0.5 text-[11px] text-fg-2">{sub}</div>}
    </div>
  )
}

export function Seg<T extends string | number>({ value, options, onChange, className = '' }: { value: T; options: { v: T; label: ReactNode; title?: string }[]; onChange: (v: T) => void; className?: string }) {
  // sliding active pill: measured only when the value/options change or the group resizes (no per-frame work)
  const wrap = useRef<HTMLDivElement>(null)
  const [pill, setPill] = useState<{ x: number; y: number; w: number; h: number; ready: boolean } | null>(null)
  useLayoutEffect(() => {
    const el = wrap.current
    if (!el) return
    const measure = () => {
      const b = el.querySelector<HTMLElement>('button[data-on="true"]')
      setPill((p) => {
        if (!b) return null
        const n = { x: b.offsetLeft, y: b.offsetTop, w: b.offsetWidth, h: b.offsetHeight }
        if (p && p.x === n.x && p.y === n.y && p.w === n.w && p.h === n.h) return p
        return { ...n, ready: p !== null }
      })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    el.querySelectorAll('button').forEach((b) => ro.observe(b)) // labels can change width (EN/हिं)
    return () => ro.disconnect()
  }, [value, options.length])
  return (
    <div ref={wrap} className={`relative flex flex-wrap gap-1 rounded-xl border border-line bg-ink-2 p-1 calm:shadow-[inset_0_1px_2px_rgba(0,0,0,0.08)] vivid:bg-transparent vivid:bg-gradient-to-b vivid:from-ink-1/80 vivid:to-ink-2/60 vivid:shadow-[inset_0_1px_2px_#00000080,inset_0_-1px_0_#ffffff08] ${className}`}>
      {pill && (
        <span aria-hidden className={`pointer-events-none absolute top-0 left-0 rounded-lg bg-neon shadow-[0_1px_2px_rgba(0,0,0,0.22)] vivid:bg-[linear-gradient(180deg,#a5f3fc,#22d3ee_55%,#0fb5d0)] vivid:shadow-[0_0_18px_-2px_#22d3ee99,inset_0_1px_0_#ffffff99,inset_0_-1px_0_#0891b2] ${pill.ready ? 'motion-safe:transition-[transform,width,height] motion-safe:duration-300 motion-safe:ease-[cubic-bezier(0.2,0.8,0.2,1)]' : ''}`}
          style={{ transform: `translate(${pill.x}px, ${pill.y}px)`, width: pill.w, height: pill.h }} />
      )}
      {options.map((o) => (
        <button key={String(o.v)} title={o.title} data-on={o.v === value} className={`btn-seg relative ${pill ? 'seg-slide' : ''}`} onClick={() => onChange(o.v)}>{o.label}</button>
      ))}
    </div>
  )
}

export function WarnChip({ level, compact = false, t }: { level: number; compact?: boolean; t?: (s: string) => string }) {
  const w = WARN[level]
  const tr = t ?? ((s: string) => s)
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider"
      style={{
        borderColor: w.color + '66',
        background: `linear-gradient(180deg, ${w.color}${level ? '33' : '18'}, ${w.color}${level ? '1a' : '0a'})`,
        color: w.text,
        boxShadow: glow(level ? `0 0 14px -6px ${w.color}, inset 0 1px 0 #ffffff14` : 'inset 0 1px 0 #ffffff0a'),
      }}>
      {level >= 2
        ? <span className="dot-live" style={{ color: w.color, width: 6, height: 6 }} />
        : <span className="h-1.5 w-1.5 rounded-full" style={{ background: w.color, boxShadow: glow(`0 0 6px ${w.color}`) }} />}
      {compact ? tr(w.name) : `${tr(w.name)} · ${tr(w.label)}`}
    </span>
  )
}

export function Bar({ value, max = 1, color = 'var(--color-neon)', h = 6 }: { value: number; max?: number; color?: string; h?: number }) {
  return (
    <div className="w-full overflow-hidden rounded-full bg-line/70 vivid:bg-line/60 vivid:shadow-[inset_0_1px_2px_#00000099]" style={{ height: h }}>
      <motion.div className="relative h-full rounded-full"
        style={{ background: theme().fx.vivid ? `linear-gradient(90deg, color-mix(in srgb, ${color} 55%, transparent), ${color})` : color, boxShadow: glow(`0 0 10px color-mix(in srgb, ${color} 55%, transparent)`) }}
        initial={{ width: 0 }} animate={{ width: `${Math.max(0, Math.min(1, value / max)) * 100}%` }} transition={{ duration: 0.6, ease: 'easeOut' }}>
        <span aria-hidden className="absolute inset-x-0 top-0 hidden h-1/2 rounded-full bg-white/20 vivid:block" />
        <span aria-hidden className="absolute top-0 right-0 hidden h-full w-1 rounded-full bg-white/70 blur-[1px] vivid:block" />
      </motion.div>
    </div>
  )
}

export function Ring({ value, size = 64, stroke = 6, color = 'var(--color-neon)', children }: { value: number; size?: number; stroke?: number; color?: string; children?: ReactNode }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r
  const gid = 'rg' + useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const ri = Math.max(2, r - stroke / 2 - 3), ci = 2 * Math.PI * ri
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.55} />
            <stop offset="100%" stopColor={color} stopOpacity={1} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--color-line)" strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={ri} stroke="var(--color-line-2)" strokeWidth={1} fill="none" strokeDasharray={`1 ${ci / 40 - 1}`} opacity={0.9} />
        <motion.circle cx={size / 2} cy={size / 2} r={r} stroke={`url(#${gid})`} strokeWidth={stroke} fill="none" strokeLinecap="round"
          strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - Math.max(0, Math.min(1, value))) }}
          transition={{ duration: 0.8, ease: 'easeOut' }} style={{ filter: glow(`drop-shadow(0 0 6px ${color})`) }} />
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--color-ink-1)" strokeOpacity={0.55} strokeWidth={stroke + 1} fill="none" strokeDasharray={`1.2 ${c / 24 - 1.2}`} />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  )
}

export function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  useEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }))
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])
  return [ref, size] as const
}

export const fmtDate = (d: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) =>
  new Date(d + 'T00:00:00').toLocaleDateString('en-IN', opts)

export const addDays = (d: string, n: number) => {
  const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n)
  return x.toISOString().slice(0, 10)
}
