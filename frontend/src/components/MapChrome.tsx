import { useEffect, useRef } from 'react'
import { Box, Columns2, Grid3x3, Layers3, Map as MapIcon, type LucideIcon } from 'lucide-react'
import type { DayData, Layer, Meta, Mode } from '../lib/types'
import { DELTA_STEPS, PROB_STEPS, RAIN_CLASSES, WARN } from '../lib/colors'
import { useStore } from '../lib/store'
import { useT } from '../lib/i18n'
import { Seg } from './ui'

export const LAYER_OPTS: { v: Layer; label: string }[] = [
  { v: 'cor', label: 'Corrected' }, { v: 'raw', label: 'Raw NWP' }, { v: 'obs', label: 'Observed' },
  { v: 'ph', label: 'P(Heavy)' }, { v: 'pvh', label: 'P(V.Heavy)' }, { v: 'delta', label: 'Correction Δ' }, { v: 'warn', label: 'Warnings' },
]

const withIcon = (I: LucideIcon, label: string) => <span className="flex items-center gap-1"><I size={11} className="shrink-0 opacity-80" />{label}</span>

export function LayerControls() {
  const t = useT()
  const { layer, mode, compare, set } = useStore()
  return (
    <div className="glass hud-corners w-full rounded-2xl p-3">
      <div className="mb-2 flex items-center gap-2">
        <div className="label-xs flex items-center gap-1.5"><Layers3 size={11} className="text-neon drop-shadow-[0_0_4px_#22d3ee]" /> Layer</div>
        <span aria-hidden className="h-px min-w-3 flex-1 bg-gradient-to-r from-line-2 to-transparent" />
      </div>
      <Seg value={layer} onChange={(v) => set({ layer: v })} options={LAYER_OPTS.map((o) => ({ v: o.v, label: t(o.label) }))} />
      <div className="mt-2 flex items-center gap-2">
        <Seg value={mode} onChange={(v: Mode) => set({ mode: v })} options={[{ v: 'district', label: withIcon(MapIcon, t('Districts')) }, { v: 'grid', label: withIcon(Grid3x3, t('Grid')) }, { v: 'towers', label: withIcon(Box, t('3D Towers')) }]} />
        <button data-on={compare} className="btn-seg flex items-center gap-1.5 border border-line bg-gradient-to-b from-ink-1/80 to-ink-2/60 shadow-[inset_0_1px_0_#ffffff0a]" onClick={() => set({ compare: !compare })} title="Swipe between raw NWP and the selected layer">
          <Columns2 size={13} /> {t('Swipe compare')}
        </button>
      </div>
    </div>
  )
}

export function Legend({ layer, lead }: { layer: Layer; lead: number }) {
  const t = useT()
  let title = ''
  let items: { c: string; l: string; r?: string }[] = []
  if (layer === 'ph' || layer === 'pvh') {
    title = `${layer === 'ph' ? 'P(≥ 64.5 mm)' : 'P(≥ 115.6 mm)'} · ${t('Day')}-${lead}`
    items = PROB_STEPS.map((s) => ({ c: s.color, l: s.label }))
  } else if (layer === 'delta') {
    title = 'VARSHA − raw (mm/day)'
    items = DELTA_STEPS.map((s) => ({ c: s.color, l: s.label }))
  } else if (layer === 'warn') {
    title = `IMD colour code · ${t('Day')}-${lead}`
    items = WARN.map((w) => ({ c: w.color, l: `${t(w.name)} · ${t(w.action)}` }))
  } else {
    title = `24-h rainfall (mm) · IMD categories`
    items = RAIN_CLASSES.map((c) => ({ c: c.color, l: c.label, r: c.short }))
  }
  return (
    <div className="glass hud-corners rounded-xl px-3 pt-2 pb-2.5">
      <div className="mb-1.5 flex items-center gap-2">
        <span className="h-1 w-1 rounded-full bg-neon shadow-[0_0_6px_#22d3ee]" />
        <span className="label-xs">{title}</span>
      </div>
      <div className="grid grid-cols-[8px_1fr] gap-x-2.5">
        <div className="flex flex-col overflow-hidden rounded-full shadow-[0_0_0_1px_#ffffff14,0_0_12px_-2px_#22d3ee44]">
          {items.map((i) => <span key={i.l} className="flex-1" style={{ background: `linear-gradient(90deg, ${i.c}, color-mix(in srgb, ${i.c} 80%, white))` }} />)}
        </div>
        <div className="flex flex-col">
          {items.map((i) => (
            <div key={i.l} className="flex h-[18px] items-center gap-1.5 text-[10.5px] text-fg-2">
              <span aria-hidden className="h-px w-2 bg-fg-3/60" />
              <span>{i.l}</span>
              {i.r && <span className="ml-auto pl-2 font-mono text-[9.5px] text-fg-3 tabnum">{i.r}</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Canvas rain streaks; density follows all-India rainfall of the selected day. */
export function RainOverlay({ intensity }: { intensity: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const I = useRef(intensity)
  I.current = intensity
  useEffect(() => {
    const cv = ref.current!
    const ctx = cv.getContext('2d')!
    let raf = 0
    const drops: { x: number; y: number; v: number; l: number }[] = []
    const resize = () => { cv.width = cv.clientWidth * devicePixelRatio; cv.height = cv.clientHeight * devicePixelRatio }
    resize()
    window.addEventListener('resize', resize)
    const loop = () => {
      const target = Math.round(40 + 260 * Math.min(1, I.current))
      while (drops.length < target) drops.push({ x: Math.random() * cv.width, y: Math.random() * cv.height, v: 6 + Math.random() * 10, l: 8 + Math.random() * 18 })
      if (drops.length > target) drops.length = target
      ctx.clearRect(0, 0, cv.width, cv.height)
      ctx.strokeStyle = 'rgba(125, 211, 252, 0.22)'
      ctx.lineWidth = devicePixelRatio
      ctx.beginPath()
      for (const d of drops) {
        ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - d.l * 0.25, d.y + d.l)
        d.y += d.v * devicePixelRatio; d.x -= d.v * 0.25 * devicePixelRatio
        if (d.y > cv.height) { d.y = -20; d.x = Math.random() * cv.width * 1.1 }
      }
      ctx.stroke()
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize) }
  }, [])
  return <canvas ref={ref} className="pointer-events-none absolute inset-0 h-full w-full opacity-70 mix-blend-screen" />
}

export function WarningTicker({ meta, day, lead }: { meta: Meta; day: DayData | null; lead: number }) {
  const t = useT()
  if (!day) return null
  const li = lead - 1
  const items = meta.districts
    .map((d) => ({ d, w: day.d.warn[li][d.id], p: day.d.pvh[li][d.id], ph: day.d.ph[li][d.id] }))
    .filter((x) => x.w >= 2)
    .sort((a, b) => b.w - a.w || b.p - a.p)
    .slice(0, 40)
  const text = items.length ? items : [{ d: { name: 'No orange or red warnings', state: 'All India', id: -1 }, w: 0, p: 0, ph: 0 }]
  const row = (
    <div className="flex shrink-0 items-center">
      {text.map((x, i) => (
        <span key={i} className="flex items-center gap-2 pr-5 font-mono text-[11px] after:ml-3 after:h-3 after:w-px after:rotate-[20deg] after:bg-gradient-to-b after:from-transparent after:via-neon/50 after:to-transparent after:content-['']">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: WARN[x.w].color, boxShadow: `0 0 8px ${WARN[x.w].color}` }} />
          <span className="rounded-sm px-1 font-semibold" style={{ color: x.w ? WARN[x.w].color : '#6fcf6f', background: (x.w ? WARN[x.w].color : '#6fcf6f') + '1a' }}>{t(WARN[x.w].name).toUpperCase()}</span>
          <span className="text-fg">{x.d.name}</span><span className="text-fg-3">{x.d.state}</span>
          {x.w > 0 && <span className="text-fg-2">P(heavy) {x.ph}% · P(v.heavy) {x.p}%</span>}
        </span>
      ))}
    </div>
  )
  return (
    <div className="relative flex h-7 items-center overflow-hidden border-y border-line/80 bg-gradient-to-r from-ink-1/95 via-ink-2/80 to-ink-1/95 shadow-[inset_0_1px_0_#ffffff08]">
      <div className="relative z-10 flex h-full shrink-0 items-center gap-1.5 bg-gradient-to-r from-[#b02a2a] to-[#d03b3b] pr-4 pl-3 font-mono text-[10px] font-bold tracking-widest text-white shadow-[6px_0_18px_-4px_#d03b3b] [clip-path:polygon(0_0,100%_0,calc(100%-10px)_100%,0_100%)]">
        <span className="relative grid h-2 w-2 place-items-center"><span className="absolute inset-0 rounded-full bg-white/70 motion-safe:animate-ping" /><span className="h-1.5 w-1.5 rounded-full bg-white" /></span> LIVE · {t('Day')}-{lead}
      </div>
      <div className="flex animate-marquee">{row}{row}</div>
      <span aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-ink-1 to-transparent" />
    </div>
  )
}
