import { useId, useState } from 'react'
import { motion } from 'motion/react'
import { METHOD_COLORS, hex } from '../lib/colors'
import { glow, theme } from '../lib/theme'

// WCAG contrast helpers for picking a legible label ink over a computed fill (light themes only)
const mixRgb = (a: number[], b: number[], t: number) => [0, 1, 2].map((i) => a[i] * t + b[i] * (1 - t))
const relLum = (c: number[]) => {
  const f = (v: number) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }
  return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2])
}
const contrast = (a: number[], b: number[]) => { const x = relLum(a), y = relLum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) }

// neutral chart ink from the theme tokens (CSS variables resolve inside SVG attributes)
const INK = { grid: 'var(--color-line)', axis: 'var(--color-line-2)', text: 'var(--color-fg-3)', text2: 'var(--color-fg-2)', bg: 'var(--color-ink-1)' }
/** floating label/tooltip surface inside an svg: lightest surface on light themes, raised surface on dark ones */
const tipFill = () => (theme().mode === 'light' ? 'var(--color-ink-1)' : 'var(--color-ink-2)')
const MONO = 'JetBrains Mono'
/** svg-safe id from React's useId (which contains colons) */
const useSvgId = (p: string) => p + useId().replace(/[^a-zA-Z0-9_-]/g, '')

/** Small glass "tooltip" drawn inside an svg. Flips left when near the right edge. */
function SvgTip({ x, y, lines, W }: { x: number; y: number; lines: string[]; W: number }) {
  const w = Math.max(...lines.map((l) => l.length)) * 6.1 + 16, h = lines.length * 14 + 10
  const left = x + 12 + w > W ? x - 12 - w : x + 12
  return (
    <g pointerEvents="none">
      <rect x={left} y={y - h / 2} width={w} height={h} rx={7} fill={tipFill()} fillOpacity={0.96} stroke={theme().fx.vivid ? '#22d3ee' : 'var(--color-line-2)'} strokeOpacity={theme().fx.vivid ? 0.35 : 1}
        style={{ filter: theme().mode === 'light' ? 'drop-shadow(0 4px 10px rgba(0,0,0,0.16))' : 'drop-shadow(0 6px 16px rgba(0,0,0,0.55))' }} />
      {lines.map((l, i) => (
        <text key={i} x={left + 8} y={y - h / 2 + 17 + i * 14} fontSize={i === 0 ? 10.5 : 9.5} fill={i === 0 ? 'var(--color-fg)' : INK.text2} fontFamily={MONO}>{l}</text>
      ))}
    </g>
  )
}

/** Roebber (2009) performance diagram: x = success ratio (1-FAR), y = POD,
 *  dashed-free CSI isolines (curves) and frequency-bias rays. */
export function PerformanceDiagram({ points, size = 380 }: {
  points: { key: string; name: string; sr: number; pod: number; trail?: { sr: number; pod: number; lead: number }[] }[]
  size?: number
}) {
  const [hover, setHover] = useState<string | null>(null)
  const uid = useSvgId('pd')
  const m = { l: 42, r: 14, t: 14, b: 38 }
  const W = size, H = size, iw = W - m.l - m.r, ih = H - m.t - m.b
  const X = (v: number) => m.l + v * iw, Y = (v: number) => m.t + (1 - v) * ih
  const csi = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9].map((c) => {
    const pts: string[] = []
    for (let s = 0.01; s <= 1.0001; s += 0.01) {
      const pod = 1 / (1 / c - 1 / s + 1)
      if (pod > 0 && pod <= 1) pts.push(`${X(s)},${Y(pod)}`)
    }
    return { c, d: 'M' + pts.join(' L') }
  })
  const bias = [0.3, 0.5, 0.8, 1, 1.3, 2, 3, 5]
  const raw = points.find((p) => p.key === 'RAW'), vs = points.find((p) => p.key === 'VARSHA')
  const hp = hover ? points.find((p) => p.key === hover) : undefined
  const V = theme().fx.vivid
  return (
    <svg width={W} height={H} className="overflow-visible">
      <defs>
        <marker id={`${uid}-arrow`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--color-neon)" /></marker>
        {V && (
          <>
            <linearGradient id={`${uid}-bg`} x1="0" y1="1" x2="1" y2="0"><stop offset="0" stopColor="#22d3ee" stopOpacity="0" /><stop offset="1" stopColor="#22d3ee" stopOpacity="0.07" /></linearGradient>
            <radialGradient id={`${uid}-zone`} cx="1" cy="0" r="1.1"><stop offset="0" stopColor="#22d3ee" stopOpacity="0.16" /><stop offset="0.45" stopColor="#a78bfa" stopOpacity="0.05" /><stop offset="1" stopColor="#a78bfa" stopOpacity="0" /></radialGradient>
            <radialGradient id={`${uid}-poor`} cx="0" cy="1" r="0.8"><stop offset="0" stopColor="#04070d" stopOpacity="0.55" /><stop offset="1" stopColor="#04070d" stopOpacity="0" /></radialGradient>
          </>
        )}
        <clipPath id={`${uid}-clip`}><rect x={m.l} y={m.t} width={iw} height={ih} /></clipPath>
      </defs>
      <rect x={m.l} y={m.t} width={iw} height={ih} rx={4} fill={INK.bg} fillOpacity={0.5} />
      {V && (
        <>
          <rect x={m.l} y={m.t} width={iw} height={ih} fill={`url(#${uid}-bg)`} />
          <rect x={m.l} y={m.t} width={iw} height={ih} fill={`url(#${uid}-zone)`} />
          <rect x={m.l} y={m.t} width={iw} height={ih} fill={`url(#${uid}-poor)`} />
        </>
      )}
      <g clipPath={`url(#${uid}-clip)`}>
        {csi.map((c) => (
          <path key={c.c} d={c.d} fill="none" stroke={V ? (c.c >= 0.5 ? '#34507c' : '#2a3f63') : c.c >= 0.5 ? 'var(--color-fg-3)' : 'var(--color-line-2)'} strokeOpacity={V || c.c < 0.5 ? 1 : 0.55} strokeWidth={1} />
        ))}
        {bias.map((b) => {
          const s1 = b >= 1 ? 1 / b : 1, p1 = b >= 1 ? 1 : b
          return <line key={b} x1={X(0)} y1={Y(0)} x2={X(s1)} y2={Y(p1)} stroke={V ? (b === 1 ? '#3f5f8f' : '#1f3050') : b === 1 ? 'var(--color-fg-3)' : 'var(--color-line-2)'} strokeWidth={b === 1 ? 1.4 : 1} strokeDasharray={b === 1 ? undefined : '3 4'} />
        })}
      </g>
      <rect x={m.l} y={m.t} width={iw} height={ih} rx={4} fill="none" stroke={INK.axis} />
      {csi.map((c) => (
        <text key={c.c} x={X(0.985)} y={Y(1 / (1 / c.c - 1 / 0.985 + 1)) + 3} fontSize={9} fill={INK.text} textAnchor="end" fontFamily={MONO} paintOrder="stroke" stroke={INK.bg} strokeWidth={3}>{c.c.toFixed(1)}</text>
      ))}
      {bias.map((b) => {
        const s1 = b >= 1 ? 1 / b : 1, p1 = b >= 1 ? 1 : b
        return <text key={b} x={X(s1) + (b >= 1 ? 0 : 3)} y={Y(p1) + (b >= 1 ? -3 : 3)} fontSize={9} fill={b === 1 ? INK.text2 : INK.text} fontFamily={MONO} textAnchor={b >= 1 ? 'middle' : 'start'}>{b}</text>
      })}
      {[0, 0.2, 0.4, 0.6, 0.8, 1].map((v) => (
        <g key={v}>
          <line x1={X(v)} x2={X(v)} y1={H - m.b} y2={H - m.b + 4} stroke={INK.axis} />
          <line x1={m.l - 4} x2={m.l} y1={Y(v)} y2={Y(v)} stroke={INK.axis} />
          <text x={X(v)} y={H - m.b + 15} fontSize={10} fill={INK.text} textAnchor="middle" fontFamily={MONO}>{v.toFixed(1)}</text>
          <text x={m.l - 7} y={Y(v) + 3} fontSize={10} fill={INK.text} textAnchor="end" fontFamily={MONO}>{v.toFixed(1)}</text>
        </g>
      ))}
      <text x={m.l + iw / 2} y={H - 4} fontSize={10.5} fill={INK.text2} textAnchor="middle">Success ratio (1 − FAR)</text>
      <text transform={`translate(11 ${m.t + ih / 2}) rotate(-90)`} fontSize={10.5} fill={INK.text2} textAnchor="middle">Probability of detection</text>
      {raw && vs && (
        <>
          {V && <motion.line x1={X(raw.sr)} y1={Y(raw.pod)} x2={X(vs.sr)} y2={Y(vs.pod)} stroke="#22d3ee" strokeWidth={6} strokeOpacity={0.12} strokeLinecap="round"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2 }} />}
          <motion.line x1={X(raw.sr)} y1={Y(raw.pod)} x2={X(vs.sr)} y2={Y(vs.pod)} stroke="var(--color-neon)" strokeWidth={1.6} markerEnd={`url(#${uid}-arrow)`}
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2 }} opacity={0.9} style={{ filter: glow('drop-shadow(0 0 3px #22d3ee)') }} />
        </>
      )}
      {points.map((p) => {
        const c = METHOD_COLORS[p.key] ?? 'var(--color-fg-2)'
        const dim = hover && hover !== p.key
        const hero = p.key === 'VARSHA'
        return (
          <g key={p.key} opacity={dim ? 0.25 : 1} onMouseEnter={() => setHover(p.key)} onMouseLeave={() => setHover(null)} style={{ cursor: 'pointer', transition: 'opacity .2s' }}>
            {p.trail && <polyline points={p.trail.map((t) => `${X(t.sr)},${Y(t.pod)}`).join(' ')} fill="none" stroke={c} strokeOpacity={hover === p.key ? 0.85 : 0.45} strokeWidth={hover === p.key ? 1.8 : 1.2} strokeLinejoin="round" />}
            {p.trail?.map((t) => <circle key={t.lead} cx={X(t.sr)} cy={Y(t.pod)} r={hover === p.key ? 3 : 2.5} fill={c} fillOpacity={0.6} />)}
            {hover === p.key && p.trail?.map((t) => (
              <text key={`l${t.lead}`} x={X(t.sr)} y={Y(t.pod) - 6} fontSize={8.5} fill={INK.text2} textAnchor="middle" fontFamily={MONO} paintOrder="stroke" stroke={INK.bg} strokeWidth={3}>D{t.lead}</text>
            ))}
            <circle cx={X(p.sr)} cy={Y(p.pod)} r={14} fill="transparent" />
            {hero && V && (
              <circle cx={X(p.sr)} cy={Y(p.pod)} r={7} fill="none" stroke="#22d3ee" strokeWidth={1.5}
                className="motion-safe:animate-ping" style={{ transformBox: 'fill-box', transformOrigin: 'center', animationDuration: '2.4s' }} />
            )}
            {hero && V && <circle cx={X(p.sr)} cy={Y(p.pod)} r={12} fill="#22d3ee" fillOpacity={0.12} />}
            <circle cx={X(p.sr)} cy={Y(p.pod)} r={hero ? 7 : hover === p.key ? 6.5 : 5.5} fill={c} stroke={INK.bg} strokeWidth={2} style={hero && V ? { filter: 'drop-shadow(0 0 6px #22d3ee)' } : undefined} />
            {(hero || p.key === 'RAW' || hover === p.key) && (
              <text x={X(p.sr) + 10} y={Y(p.pod) - 8} fontSize={10.5} fontWeight={hero ? 600 : 400} fill="var(--color-fg)" fontFamily={MONO} paintOrder="stroke" stroke={INK.bg} strokeWidth={3}>{p.name}</text>
            )}
          </g>
        )
      })}
      {hp && (
        <SvgTip x={X(hp.sr)} y={Y(hp.pod) + 22} W={W} lines={[hp.name, `POD ${hp.pod.toFixed(2)} · SR ${hp.sr.toFixed(2)} · CSI ${(1 / (1 / hp.sr + 1 / hp.pod - 1)).toFixed(2)}`]} />
      )}
    </svg>
  )
}

export function Reliability({ bins, clim, size = 300, color = 'var(--color-prob)', label }: { bins: { p: number; obs: number; n: number }[]; clim: number; size?: number; color?: string; label: string }) {
  const [hi, setHi] = useState<number | null>(null)
  const uid = useSvgId('rel')
  const m = { l: 40, r: 10, t: 10, b: 36 }
  const W = size, H = size, iw = W - m.l - m.r, ih = H - m.t - m.b
  const X = (v: number) => m.l + v * iw, Y = (v: number) => m.t + (1 - v) * ih
  const maxN = Math.max(...bins.map((b) => b.n))
  const curve = bins.map((b) => `${X(b.p)},${Y(b.obs)}`).join(' ')
  const area = bins.length ? `${X(bins[0].p)},${Y(0)} ${curve} ${X(bins[bins.length - 1].p)},${Y(0)}` : ''
  const labelW = label.length * 6.1 + 14
  const V = theme().fx.vivid
  return (
    <svg width={W} height={H} className="overflow-visible">
      <defs>
        <linearGradient id={`${uid}-fill`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity={0.22} />
          <stop offset="1" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <rect x={m.l} y={m.t} width={iw} height={ih} rx={4} fill={INK.bg} fillOpacity={0.5} stroke={INK.axis} />
      {[0.25, 0.5, 0.75].map((v) => (
        <g key={v}>
          <line x1={X(v)} x2={X(v)} y1={m.t} y2={m.t + ih} stroke={INK.grid} strokeDasharray="2 4" />
          <line x1={m.l} x2={m.l + iw} y1={Y(v)} y2={Y(v)} stroke={INK.grid} strokeDasharray="2 4" />
        </g>
      ))}
      <polygon points={`${X(0)},${Y(clim / 2)} ${X(1)},${Y((1 + clim) / 2)} ${X(1)},${Y(1)} ${X(clim)},${Y(1)} ${X(clim)},${Y(clim)} ${X(0)},${Y(0)}`} fill={V ? '#22d3ee' : 'var(--color-fg)'} fillOpacity={V ? 0.05 : 0.045} />
      <line x1={X(0)} y1={Y(0)} x2={X(1)} y2={Y(1)} stroke={V ? '#3f5f8f' : 'var(--color-fg-3)'} strokeWidth={1.2} />
      <text transform={`translate(${X(0.88)} ${Y(0.88) + 11}) rotate(-45)`} fontSize={8.5} fill={INK.text} fontFamily={MONO} textAnchor="middle">perfect</text>
      <line x1={X(0)} y1={Y(clim)} x2={X(1)} y2={Y(clim)} stroke={INK.grid} />
      <line x1={X(0)} y1={Y(clim / 2)} x2={X(1)} y2={Y((1 + clim) / 2)} stroke={INK.grid} strokeDasharray="4 3" />
      {[0, 0.25, 0.5, 0.75, 1].map((v) => (
        <g key={v}>
          <text x={X(v)} y={H - m.b + 14} fontSize={10} fill={INK.text} textAnchor="middle" fontFamily={MONO}>{v}</text>
          <text x={m.l - 6} y={Y(v) + 3} fontSize={10} fill={INK.text} textAnchor="end" fontFamily={MONO}>{v}</text>
        </g>
      ))}
      <text x={m.l + iw / 2} y={H - 4} fontSize={10.5} fill={INK.text2} textAnchor="middle">Forecast probability</text>
      <text transform={`translate(11 ${m.t + ih / 2}) rotate(-90)`} fontSize={10.5} fill={INK.text2} textAnchor="middle">Observed frequency</text>
      {area && <polygon points={area} fill={`url(#${uid}-fill)`} />}
      <polyline points={curve} fill="none" stroke={color} strokeWidth={5} strokeOpacity={0.15} strokeLinejoin="round" />
      <polyline points={curve} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      {hi !== null && (
        <g pointerEvents="none">
          <line x1={m.l} x2={X(bins[hi].p)} y1={Y(bins[hi].obs)} y2={Y(bins[hi].obs)} stroke={INK.text2} strokeOpacity={0.5} strokeDasharray="2 3" />
          <line x1={X(bins[hi].p)} x2={X(bins[hi].p)} y1={Y(bins[hi].obs)} y2={m.t + ih} stroke={INK.text2} strokeOpacity={0.5} strokeDasharray="2 3" />
        </g>
      )}
      {bins.map((b, i) => (
        <g key={i} onMouseEnter={() => setHi(i)} onMouseLeave={() => setHi(null)} style={{ cursor: 'crosshair' }}>
          <circle cx={X(b.p)} cy={Y(b.obs)} r={12} fill="transparent" />
          <circle cx={X(b.p)} cy={Y(b.obs)} r={3 + 5 * Math.sqrt(b.n / maxN) + (hi === i ? 1.5 : 0)} fill={color} stroke={hi === i ? 'var(--color-fg)' : INK.bg} strokeWidth={2} />
        </g>
      ))}
      <g>
        <rect x={m.l + 5} y={m.t + 4} width={labelW} height={17} rx={8.5} fill={tipFill()} fillOpacity={0.9} stroke={color} strokeOpacity={0.45} />
        <circle cx={m.l + 13} cy={m.t + 12.5} r={3} fill={color} />
        <text x={m.l + 20} y={m.t + 16} fontSize={10} fill={INK.text2} fontFamily={MONO}>{label}</text>
      </g>
      {hi !== null && (
        <SvgTip x={X(bins[hi].p)} y={Y(bins[hi].obs) + 22} W={W}
          lines={[`p=${bins[hi].p.toFixed(2)} obs=${bins[hi].obs.toFixed(2)}`, `n=${bins[hi].n.toLocaleString()}`]} />
      )}
    </svg>
  )
}

/** Dumbbell: raw -> VARSHA per row, one shared axis. */
export function Dumbbell({ rows, max, width = 420, fmt = (v: number) => v.toFixed(2), lowerBetter = false }: {
  rows: { label: string; color: string; a: number; b: number; note?: string }[]
  max: number; width?: number; fmt?: (v: number) => string; lowerBetter?: boolean
}) {
  const [hi, setHi] = useState<number | null>(null)
  const rowH = 30, m = { l: 118, r: 70, t: 18, b: 22 }
  const iw = width - m.l - m.r, H = m.t + rows.length * rowH + m.b
  const X = (v: number) => m.l + (v / max) * iw
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max)
  const V = theme().fx.vivid
  return (
    <svg width={width} height={H} viewBox={`0 0 ${width} ${H}`} style={{ maxWidth: '100%', height: 'auto' }}>
      {rows.map((_, i) => (
        <rect key={`bg${i}`} x={0} y={m.t + i * rowH + 2} width={width} height={rowH - 4} rx={6}
          fill={hi === i ? 'var(--color-neon)' : 'var(--color-fg)'} fillOpacity={hi === i ? 0.06 : i % 2 ? (V ? 0.015 : 0.03) : 0} style={{ transition: 'fill-opacity .15s' }} />
      ))}
      {ticks.map((t) => (
        <g key={t}>
          <line x1={X(t)} x2={X(t)} y1={m.t - 6} y2={H - m.b} stroke={INK.grid} strokeDasharray={t === 0 ? undefined : '2 4'} />
          <text x={X(t)} y={H - 6} fontSize={9.5} fill={INK.text} textAnchor="middle" fontFamily={MONO}>{fmt(t)}</text>
        </g>
      ))}
      {rows.map((r, i) => {
        const y = m.t + i * rowH + rowH / 2
        const better = lowerBetter ? r.b < r.a : r.b > r.a
        const lc = better ? 'var(--color-neon)' : 'var(--color-raw)'
        return (
          <g key={r.label} onMouseEnter={() => setHi(i)} onMouseLeave={() => setHi(null)} opacity={hi !== null && hi !== i ? 0.55 : 1} style={{ transition: 'opacity .15s' }}>
            <rect x={4} y={y - 4} width={8} height={8} rx={2} fill={r.color} style={hi === i && V ? { filter: `drop-shadow(0 0 4px ${r.color})` } : undefined} />
            <text x={18} y={y + 4} fontSize={11} fill={hi === i ? 'var(--color-fg)' : V ? '#c9d4e5' : 'var(--color-fg-2)'}>{r.label}</text>
            {V && <motion.line x1={X(r.a)} y1={y} x2={X(r.b)} y2={y} stroke={lc} strokeWidth={7} strokeOpacity={0.1} strokeLinecap="round"
              initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.8, delay: i * 0.05 }} />}
            <motion.line x1={X(r.a)} y1={y} x2={X(r.b)} y2={y} stroke={lc} strokeWidth={2.5} strokeOpacity={V ? 0.55 : 0.7} strokeLinecap="round"
              initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.8, delay: i * 0.05 }} />
            <circle cx={X(r.a)} cy={y} r={5} fill="var(--color-raw)" stroke={INK.bg} strokeWidth={2} />
            <circle cx={X(r.b)} cy={y} r={hi === i ? 7 : 6} fill="var(--color-neon)" stroke={INK.bg} strokeWidth={2} style={{ filter: glow('drop-shadow(0 0 5px #22d3ee)') }} />
            {hi === i && (
              <>
                <text x={X(r.a)} y={y - 9} fontSize={9} fill={INK.text2} textAnchor="middle" fontFamily={MONO} paintOrder="stroke" stroke={INK.bg} strokeWidth={3}>{fmt(r.a)}</text>
                <text x={X(r.b)} y={y - 10} fontSize={9} fill="var(--color-fg)" textAnchor="middle" fontFamily={MONO} paintOrder="stroke" stroke={INK.bg} strokeWidth={3}>{fmt(r.b)}</text>
              </>
            )}
            {r.a > 0 && (
              <>
                <rect x={width - m.r + 4} y={y - 8.5} width={46} height={17} rx={8.5} fill={lc} fillOpacity={0.1} stroke={lc} strokeOpacity={0.35} />
                <text x={width - m.r + 27} y={y + 3.5} fontSize={10.5} fill={better ? 'var(--color-neon-2)' : 'var(--color-raw-2)'} fontFamily={MONO} textAnchor="middle">
                  {`${r.b >= r.a ? '+' : ''}${(((r.b - r.a) / r.a) * 100).toFixed(0)}%`}
                </text>
              </>
            )}
          </g>
        )
      })}
    </svg>
  )
}

export function ConfusionMatrix({ m, labels, colors, size = 330 }: { m: number[][]; labels: string[]; colors: string[]; size?: number }) {
  const n = labels.length, pad = 104, cell = (size - pad) / n
  const rowSum = m.map((r) => r.reduce((a, b) => a + b, 0) || 1)
  const [hi, setHi] = useState<[number, number] | null>(null)
  const T = theme(), V = T.fx.vivid
  // label ink flips to the on-accent colour once the cell fill is dense enough. On light surfaces the ink is
  // picked per cell from the actual fill (muted ink while it reads, else whichever of ink / on-accent contrasts more).
  const light = !V && T.mode === 'light'
  const surf = light ? mixRgb(hex(T.ui.void), hex(T.ui.panelBg), 0.3) : null
  const ink = (f: number, diag: boolean) => {
    if (!surf) return f > 0.45 ? 'var(--color-on-accent)' : 'var(--color-fg-2)'
    const cell = mixRgb(hex(diag ? T.ui.accent : T.ui.raw), surf, 0.06 + 0.85 * f)
    if (contrast(hex(T.ui.fg2), cell) >= 4.5) return 'var(--color-fg-2)'
    return contrast(hex(T.ui.fg), cell) >= contrast(hex(T.ui.onAccent), cell) ? 'var(--color-fg)' : 'var(--color-on-accent)'
  }
  return (
    <svg width={size} height={n * cell + 40}>
      {hi && (
        <g pointerEvents="none">
          <rect x={pad} y={hi[0] * cell} width={n * cell} height={cell} rx={5} fill="var(--color-neon)" fillOpacity={0.05} />
          <rect x={pad + hi[1] * cell} y={0} width={cell} height={n * cell} rx={5} fill="var(--color-neon)" fillOpacity={0.05} />
        </g>
      )}
      {m.map((row, i) => row.map((v, j) => {
        const f = v / rowSum[i]
        const on = hi && hi[0] === i && hi[1] === j
        const diag = i === j
        return (
          <g key={`${i}-${j}`} onMouseEnter={() => setHi([i, j])} onMouseLeave={() => setHi(null)} style={{ cursor: 'crosshair' }}>
            <rect x={pad + j * cell + 1} y={i * cell + 1} width={cell - 2} height={cell - 2} rx={4}
              fill={diag ? 'var(--color-neon)' : 'var(--color-raw)'} fillOpacity={0.06 + 0.85 * f}
              stroke={on ? (V ? '#fff' : 'var(--color-fg)') : diag ? 'var(--color-neon)' : 'none'} strokeOpacity={on ? 1 : 0.35} strokeWidth={on ? 1.5 : 1}
              style={diag && f > 0.5 && V ? { filter: 'drop-shadow(0 0 5px rgba(34,211,238,0.45))' } : undefined} />
            <text x={pad + j * cell + cell / 2} y={i * cell + cell / 2 + 4} fontSize={10.5} textAnchor="middle" fontFamily={MONO} fontWeight={diag ? 600 : 400} fill={ink(f, diag)} pointerEvents="none">{Math.round(f * 100)}</text>
          </g>
        )
      }))}
      {labels.map((l, i) => (
        <g key={l}>
          <text x={pad - 8} y={i * cell + cell / 2 + 4} fontSize={10.5} textAnchor="end" fill={hi && hi[0] === i ? 'var(--color-fg)' : V ? '#c9d4e5' : 'var(--color-fg-2)'}>{l}</text>
          <rect x={0} y={i * cell + cell / 2 - 4} width={7} height={7} rx={2} fill={colors[i]} />
          <text x={pad + i * cell + cell / 2} y={n * cell + 13} fontSize={9} textAnchor="middle" fill={hi && hi[1] === i ? 'var(--color-fg)' : 'var(--color-fg-3)'} fontFamily={MONO}>{l.slice(0, 5)}</text>
        </g>
      ))}
      <text x={pad + (n * cell) / 2} y={n * cell + 27} fontSize={9.5} textAnchor="middle" fill="var(--color-fg-2)">predicted →</text>
      {hi && <text x={0} y={n * cell + 38} fontSize={10} fill="var(--color-fg-2)" fontFamily={MONO}>observed {labels[hi[0]]} → predicted {labels[hi[1]]}: {m[hi[0]][hi[1]]} forecasts</text>}
    </svg>
  )
}
