import { useEffect, useMemo, useRef, useState } from 'react'
import { Pause, Play, SkipBack, SkipForward, Sparkles } from 'lucide-react'
import { useStore } from '../lib/store'
import { REGIME_COLORS } from '../lib/colors'
import { useT } from '../lib/i18n'
import { Seg, fmtDate, useSize } from './ui'

export default function Timeline() {
  const t = useT()
  const { timeline, dateIdx, lead, playing, meta, set, step } = useStore()
  const [ref, size] = useSize<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const dragging = useRef(false)

  const cur = timeline[dateIdx]
  const year = cur ? cur.date.slice(0, 4) : ''
  const years = useMemo(() => Array.from(new Set(timeline.map((d) => d.date.slice(0, 4)))), [timeline])
  const season = useMemo(() => timeline.map((d, i) => ({ d, i })).filter((x) => x.d.date.startsWith(year)), [timeline, year])

  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => step(1), 650)
    return () => clearInterval(id)
  }, [playing, step])

  if (!cur || !meta) return null
  const W = Math.max(200, size.w), n = season.length
  const cw = W / n
  const H_SPARK = 34, H_PRED = 14, H_OBS = 6
  const maxRain = Math.max(...season.map((s) => s.d.obs_mean), 1)
  const maxHeavy = Math.max(...season.map((s) => s.d.n_obs_heavy), 1)
  const x = (k: number) => k * cw
  const area = season.map((s, k) => `${k === 0 ? 'M' : 'L'}${x(k) + cw / 2},${H_SPARK - (s.d.obs_mean / maxRain) * (H_SPARK - 4)}`).join(' ')
  const heavyLine = season.map((s, k) => `${k === 0 ? 'M' : 'L'}${x(k) + cw / 2},${H_SPARK - (s.d.n_obs_heavy / maxHeavy) * (H_SPARK - 4)}`).join(' ')
  const curK = season.findIndex((s) => s.i === dateIdx)
  const months = season.map((s, k) => ({ k, d: s.d.date })).filter((m) => m.d.endsWith('-01'))

  const pick = (clientX: number) => {
    const r = ref.current!.getBoundingClientRect()
    const k = Math.max(0, Math.min(n - 1, Math.floor((clientX - r.left) / cw)))
    return k
  }
  const hv = hover !== null ? season[hover] : null
  const hvPred = hv ? hv.d.pred[lead - 1].indexOf(Math.max(...hv.d.pred[lead - 1])) : 0

  return (
    <div className="glass hud-corners rounded-2xl px-4 pt-3 pb-2.5">
      <span aria-hidden className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-plasma/60 to-transparent" />
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <button className="btn-seg" onClick={() => step(-1)} title="Previous day"><SkipBack size={14} /></button>
          <button onClick={() => set({ playing: !playing })} title={playing ? 'Pause' : 'Play season'}
            className="relative mx-0.5 grid h-10 w-10 place-items-center rounded-full bg-[radial-gradient(circle_at_35%_30%,#cffafe,#22d3ee_55%,#0e7490)] text-void shadow-[0_0_22px_-2px_#22d3ee,inset_0_1px_0_#ffffffaa,inset_0_-2px_4px_#0e749088] transition hover:scale-105 active:scale-95">
            <span aria-hidden className={`pointer-events-none absolute -inset-1 rounded-full border border-neon/50 ${playing ? 'motion-safe:animate-[live-halo_1.8s_ease-out_infinite]' : 'opacity-40'}`} />
            <span aria-hidden className="pointer-events-none absolute -inset-[5px] rounded-full border border-dashed border-neon/30 motion-safe:animate-spin-slow" />
            {playing ? <Pause size={16} className="relative" /> : <Play size={16} className="relative ml-0.5" />}
          </button>
          <button className="btn-seg" onClick={() => step(1)} title="Next day"><SkipForward size={14} /></button>
        </div>
        <div className="min-w-[150px]">
          <div className="label-xs">Valid date</div>
          <div className="font-display text-lg leading-tight font-semibold tracking-tight [text-shadow:0_0_18px_#22d3ee33]">{fmtDate(cur.date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</div>
        </div>
        <Seg value={year} onChange={(y) => { const i = timeline.findIndex((d) => d.date.startsWith(y) && d.date.slice(5) === cur.date.slice(5)); set({ dateIdx: i >= 0 ? i : timeline.findIndex((d) => d.date.startsWith(y)) }) }}
          options={years.map((y) => ({ v: y, label: `JJAS ${y}` }))} />
        <Seg value={lead} onChange={(l) => set({ lead: l })} options={meta.leads.map((l) => ({ v: l, label: `${t('Day')}-${l}`, title: `${l * 24} h lead` }))} />
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <Sparkles size={13} className="text-plasma drop-shadow-[0_0_6px_#a78bfa]" />
          {meta.events.map((e) => {
            const c = REGIME_COLORS[e.regime], on = cur.date === e.date
            return (
              <button key={e.date + e.title} onClick={() => set({ dateIdx: timeline.findIndex((d) => d.date === e.date), playing: false })}
                title={`${fmtDate(e.date)} · ${e.desc}`}
                className={`flex items-center gap-1.5 rounded-full border py-1 pr-2.5 pl-2 text-[10.5px] transition hover:-translate-y-px hover:text-fg ${on ? 'text-fg' : 'text-fg-2'}`}
                style={{ borderColor: c + (on ? 'cc' : '55'), background: on ? `linear-gradient(180deg, ${c}40, ${c}1a)` : `linear-gradient(180deg, ${c}14, transparent)`, boxShadow: on ? `0 0 16px -4px ${c}, inset 0 1px 0 #ffffff1a` : 'inset 0 1px 0 #ffffff0a' }}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: c, boxShadow: `0 0 6px ${c}` }} />
                {e.title.split(' over ')[0]}
              </button>
            )
          })}
        </div>
      </div>

      <div ref={ref} className="relative mt-4 cursor-crosshair select-none before:pointer-events-none before:absolute before:-inset-x-2 before:-top-1.5 before:bottom-5 before:rounded-xl before:border before:border-line/70 before:bg-gradient-to-b before:from-ink-1/70 before:to-ink-2/30 before:shadow-[inset_0_1px_3px_#000000aa,inset_0_-1px_0_#ffffff08] before:content-['']"
        onPointerDown={(e) => { dragging.current = true; (e.target as Element).setPointerCapture?.(e.pointerId); set({ dateIdx: season[pick(e.clientX)].i, playing: false }) }}
        onPointerMove={(e) => { const k = pick(e.clientX); setHover(k); if (dragging.current) set({ dateIdx: season[k].i }) }}
        onPointerUp={() => { dragging.current = false }}
        onPointerLeave={() => { setHover(null); dragging.current = false }}>
        <svg width={W} height={H_SPARK + H_PRED + H_OBS + 22} className="relative block overflow-visible">
          <defs>
            <linearGradient id="spark" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#3987e5" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#3987e5" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="tl-head" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#22d3ee" stopOpacity="0" />
              <stop offset="50%" stopColor="#22d3ee" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
            </linearGradient>
          </defs>
          {months.map((m, j) => j % 2 === 0 && (
            <rect key={'band' + m.d} x={x(m.k)} y={0} width={x(months[j + 1]?.k ?? n) - x(m.k)} height={H_SPARK + H_PRED + H_OBS + 8} fill="#22d3ee" opacity={0.035} />
          ))}
          <path d={`${area} L${x(n - 1) + cw / 2},${H_SPARK} L${cw / 2},${H_SPARK} Z`} fill="url(#spark)" />
          <path d={area} fill="none" stroke="#5598e7" strokeWidth={1.5} strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 3px #3987e5aa)' }} />
          <path d={heavyLine} fill="none" stroke="#f5b8ff" strokeWidth={1} strokeOpacity={0.7} />
          {season.map((s, k) => {
            const P = s.d.pred[lead - 1]
            const pk = P.indexOf(Math.max(...P))
            return (
              <g key={s.d.date}>
                <rect x={x(k) + 0.5} y={H_SPARK + 4} width={Math.max(1, cw - 1)} height={H_PRED} rx={1.5} fill={REGIME_COLORS[pk]} opacity={0.35 + 0.65 * P[pk]} />
                <rect x={x(k) + 0.5} y={H_SPARK + 6 + H_PRED} width={Math.max(1, cw - 1)} height={H_OBS} rx={1} fill={REGIME_COLORS[s.d.regime]} opacity={0.9} />
                {pk !== s.d.regime && <circle cx={x(k) + cw / 2} cy={H_SPARK + 12 + H_PRED + H_OBS} r={1.4} fill="#e66767" />}
              </g>
            )
          })}
          {months.map((m) => (
            <g key={m.d}>
              <line x1={x(m.k)} x2={x(m.k)} y1={0} y2={H_SPARK + H_PRED + H_OBS + 8} stroke="#26395a" strokeWidth={1} strokeDasharray="2 2" />
              <text x={x(m.k) + 4} y={10} fill="#647795" fontSize={9.5} fontFamily="JetBrains Mono" letterSpacing="0.12em">{fmtDate(m.d, { month: 'short' }).toUpperCase()}</text>
            </g>
          ))}
          {curK >= 0 && (() => {
            const cx = x(curK) + cw / 2, bot = H_SPARK + H_PRED + H_OBS + 14
            const lbl = fmtDate(cur.date, { day: 'numeric', month: 'short' }).toUpperCase()
            const bw = lbl.length * 6 + 12, bx = Math.min(W - bw, Math.max(0, cx - bw / 2))
            return (
              <g className="pointer-events-none">
                <rect x={x(curK) - 6} y={-4} width={cw + 12} height={bot + 2} fill="url(#tl-head)" />
                <rect x={x(curK) - 1} y={-2} width={cw + 2} height={H_SPARK + H_PRED + H_OBS + 12} rx={2} fill="none" stroke="#e6edf7" strokeOpacity={0.85} strokeWidth={1.2} />
                <line x1={cx} x2={cx} y1={-6} y2={bot} stroke="#22d3ee" strokeWidth={1.2} style={{ filter: 'drop-shadow(0 0 4px #22d3ee)' }} />
                <circle cx={cx} cy={bot} r={2.6} fill="#22d3ee" stroke="#04070d" strokeWidth={1} style={{ filter: 'drop-shadow(0 0 4px #22d3ee)' }} />
                <g transform={`translate(${bx}, ${-18})`}>
                  <rect width={bw} height={13} rx={6.5} fill="#07202a" stroke="#22d3ee" strokeOpacity={0.8} style={{ filter: 'drop-shadow(0 0 5px #22d3ee88)' }} />
                  <text x={bw / 2} y={9.4} textAnchor="middle" fill="#a5f3fc" fontSize={8.5} fontFamily="JetBrains Mono" fontWeight={600} letterSpacing="0.06em">{lbl}</text>
                </g>
              </g>
            )
          })()}
        </svg>
        <div className="relative mt-1 flex items-center gap-4 font-mono text-[9.5px] text-fg-3">
          <span className="flex items-center gap-1"><span className="inline-block h-0.5 w-3 bg-[#5598e7]" />all-India rain (obs)</span>
          <span className="flex items-center gap-1"><span className="inline-block h-0.5 w-3 bg-[#f5b8ff]" />heavy-rain districts</span>
          <span>▮ predicted regime ({t('Day')}-{lead}) · ▬ observed · <span className="text-[#e66767]">•</span> miss</span>
          <span className="ml-auto flex flex-wrap gap-2">
            {meta.regimes.map((r, i) => <span key={r.key} className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm" style={{ background: REGIME_COLORS[i], boxShadow: `0 0 5px ${REGIME_COLORS[i]}88` }} />{r.short}</span>)}
          </span>
        </div>
        {hv && (
          <div className="pointer-events-none absolute -top-[74px] z-10 overflow-hidden rounded-lg border border-neon/30 bg-ink-2/95 px-2.5 py-1.5 font-mono text-[10.5px] shadow-[0_12px_30px_-10px_#000,0_0_20px_-8px_#22d3ee] backdrop-blur"
            style={{ left: Math.min(W - 190, Math.max(0, x(hover!) - 80)) }}>
            <span aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-neon to-transparent" />
            <div className="text-fg">{fmtDate(hv.d.date, { weekday: 'short', day: 'numeric', month: 'short' })}</div>
            <div className="text-fg-2">pred <span style={{ color: REGIME_COLORS[hvPred] }}>{meta.regimes[hvPred].short}</span> · obs <span style={{ color: REGIME_COLORS[hv.d.regime] }}>{meta.regimes[hv.d.regime].short}</span></div>
            <div className="text-fg-3">{hv.d.obs_mean.toFixed(1)} mm · {hv.d.n_obs_heavy} heavy districts</div>
          </div>
        )}
      </div>
    </div>
  )
}
