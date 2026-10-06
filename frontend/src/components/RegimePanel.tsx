import { motion, AnimatePresence } from 'motion/react'
import { Check, X, GitBranch } from 'lucide-react'
import type { DayData, Meta } from '../lib/types'
import { DELTA_STEPS, REGIME_COLORS, dataInk } from '../lib/colors'
import { glow, theme } from '../lib/theme'
import { useT } from '../lib/i18n'
import { Panel, REGIME_ICON, Ring } from './ui'

export default function RegimePanel({ meta, day, lead }: { meta: Meta; day: DayData | null; lead: number }) {
  const t = useT()
  if (!day) return <Panel title="Regime engine" className="p-4"><div className="skeleton h-60 rounded-xl bg-ink-2" /></Panel>
  const P = day.pred[lead - 1]
  const k = P.indexOf(Math.max(...P))
  const R = meta.regimes[k]
  const Icon = REGIME_ICON[k]
  const truth = meta.regimes[day.regime]
  const ok = k === day.regime
  const col = REGIME_COLORS[k]
  const signals = day.signals[lead - 1]
  const V = theme().fx.vivid
  // z-score bars: diverging pair (neon keeps its original blue/orange; calm themes use their delta-ramp ends)
  const zPos = V ? '#3987e5' : DELTA_STEPS[DELTA_STEPS.length - 1].color, zNeg = V ? '#d95926' : DELTA_STEPS[0].color

  return (
    <Panel title={`Regime engine · ${t('Day')}-${lead}`} right={<span className="max-w-[120px] text-right font-mono text-[9.5px] leading-tight text-fg-3">gradient boosting · 26 predictors</span>}>
      <div className="px-4 pb-4">
        <AnimatePresence mode="wait">
          <motion.div key={k + day.date} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.25 }}
            className="relative -mx-1.5 flex items-center gap-3.5 rounded-xl px-2 py-0.5"
            style={V ? { background: `radial-gradient(120% 140% at 0% 50%, ${col}1f, transparent 62%)` } : undefined}>
            <div className="relative shrink-0">
              <span aria-hidden className="pointer-events-none absolute -inset-1.5 hidden rounded-full blur-md vivid:block" style={{ background: `radial-gradient(circle, ${col}55 0%, ${col}14 55%, transparent 72%)` }} />
              <span aria-hidden className="pointer-events-none absolute inset-1 hidden rounded-full border motion-safe:animate-[live-halo_3s_cubic-bezier(0.2,0.6,0.3,1)_infinite] vivid:block" style={{ borderColor: col + '66' }} />
              <span aria-hidden className="pointer-events-none absolute -inset-1 hidden rounded-full border border-dashed opacity-35 motion-safe:animate-spin-slow vivid:block" style={{ borderColor: col }} />
              <Ring value={P[k]} size={68} color={col}>
                <span className="grid h-10 w-10 place-items-center rounded-full" style={V ? { background: `radial-gradient(circle at 35% 30%, ${col}4d, ${col}10 60%, transparent)`, boxShadow: `inset 0 0 12px ${col}33` } : { background: col + '1f' }}>
                  <Icon size={22} color={V ? col : dataInk(col)} style={{ filter: glow(`drop-shadow(0 0 6px ${col})`) }} />
                </span>
              </Ring>
            </div>
            <div className="min-w-0 flex-1">
              <div className="label-xs flex items-center gap-1.5"><span className="dot-live calm:after:hidden" style={{ color: col, width: 5, height: 5 }} />Detected regime</div>
              <div className="font-display text-xl leading-tight font-semibold tracking-tight" style={{ color: dataInk(col), textShadow: glow(`0 0 18px ${col}88`) }}>{t(R.name)}</div>
              <div className="mt-1 flex items-center gap-2 font-mono text-[11px] text-fg-2">
                <span className="shrink-0">confidence</span>
                <span className="relative h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-line/70 vivid:shadow-[inset_0_1px_1px_#00000099]">
                  <motion.span className="absolute inset-y-0 left-0 rounded-full" style={{ background: V ? `linear-gradient(90deg, ${col}55, ${col})` : col, boxShadow: glow(`0 0 8px ${col}`) }}
                    initial={{ width: 0 }} animate={{ width: `${P[k] * 100}%` }} transition={{ duration: 0.6, ease: 'easeOut' }} />
                </span>
                <span className="shrink-0 font-semibold text-fg tabnum">{Math.round(P[k] * 100)}%</span>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        <div className="relative mt-2.5 flex items-center justify-between overflow-hidden rounded-lg border border-line bg-ink-2 px-2.5 py-1.5 font-mono text-[10.5px] vivid:bg-transparent vivid:bg-gradient-to-r vivid:from-ink-1/80 vivid:to-ink-2/60 vivid:shadow-[inset_0_1px_0_#ffffff0a]">
          <span aria-hidden className="absolute inset-y-0 left-0 w-0.5" style={{ background: col, boxShadow: glow(`0 0 8px ${col}`) }} />
          <span className="flex items-center gap-1.5 text-fg-2"><GitBranch size={12} className="text-neon vivid:drop-shadow-[0_0_4px_#22d3ee]" />routed to <span className="rounded px-1 font-semibold" style={{ color: dataInk(col), background: col + (V ? '1f' : '24') }}>expert #{k + 1}</span></span>
          <span className="flex items-center gap-1 text-fg-3" title="Observed regime, known in hindsight">
            obs: <span style={{ color: dataInk(REGIME_COLORS[day.regime]) }}>{truth.short}</span>
            {ok
              ? <span className="grid h-3.5 w-3.5 place-items-center rounded-full bg-good/15 ring-1 ring-good/40"><Check size={10} className="text-good" /></span>
              : <span className="grid h-3.5 w-3.5 place-items-center rounded-full bg-bad/15 ring-1 ring-bad/40"><X size={10} className="text-bad" /></span>}
          </span>
        </div>

        <div className="mt-2.5 space-y-[3px]">
          {meta.regimes.map((r, i) => {
            const on = i === k, c = REGIME_COLORS[i]
            return (
              <div key={r.key} className={`grid grid-cols-[88px_1fr_38px] items-center gap-2 rounded-md px-1.5 py-px transition-colors ${on ? '' : 'hover:bg-fg/[0.03]'}`}
                style={on ? { background: V ? `linear-gradient(90deg, ${c}24, transparent 85%)` : c + '1c', boxShadow: `inset 2px 0 0 ${c}` } : undefined}>
                <span className={`flex min-w-0 items-center gap-1.5 text-[11px] ${on ? 'font-medium text-fg' : 'text-fg-3'}`}>
                  <span className="h-1.5 w-1.5 shrink-0 rounded-[2px]" style={{ background: c, boxShadow: on ? glow(`0 0 6px ${c}`) : undefined, opacity: on ? 1 : 0.75 }} />
                  <span className="truncate">{r.short}</span>
                </span>
                <div className="relative h-[6px] overflow-hidden rounded-full bg-line/50 calm:bg-line/80 vivid:shadow-[inset_0_1px_2px_#000000aa]">
                  <motion.div className="relative h-full rounded-full" style={{ background: V ? `linear-gradient(90deg, ${c}66, ${c})` : c, boxShadow: on ? glow(`0 0 10px ${c}`) : undefined }}
                    animate={{ width: `${P[i] * 100}%` }} transition={{ duration: 0.5, ease: 'easeOut' }}>
                    <span aria-hidden className="absolute inset-x-0 top-0 hidden h-1/2 rounded-full bg-white/20 vivid:block" />
                  </motion.div>
                </div>
                <span className={`rounded px-1 text-right font-mono text-[10.5px] tabnum ${on ? 'font-semibold text-fg' : 'text-fg-3'}`}
                  style={on ? { background: c + '26', boxShadow: `inset 0 0 0 1px ${c}55` } : undefined}>{Math.round(P[i] * 100)}%</span>
              </div>
            )
          })}
        </div>

        <div className="mt-3.5 flex items-center gap-2">
          <span className="label-xs">Why · strongest signals (z-score vs season)</span>
          <span aria-hidden className="h-px min-w-3 flex-1 bg-gradient-to-r from-line-2 to-transparent" />
        </div>
        <div className="mt-1.5 space-y-1">
          {signals.map((s) => {
            const z = Math.max(-3, Math.min(3, s.z))
            const c = z >= 0 ? zPos : zNeg
            return (
              <div key={s.f} className="grid grid-cols-[1fr_84px_30px] items-center gap-2" title={`${s.label}: ${s.v}`}>
                <span className="truncate text-[11px] text-fg-2">{s.label}</span>
                <div className="relative h-[7px] rounded-full bg-line/40 calm:bg-line/70 vivid:shadow-[inset_0_1px_2px_#000000aa]">
                  {[1 / 6, 2 / 6, 4 / 6, 5 / 6].map((q) => <span key={q} aria-hidden className="absolute top-[1px] bottom-[1px] w-px bg-fg-3/25" style={{ left: `${q * 100}%` }} />)}
                  <div className="absolute top-[-3px] bottom-[-3px] left-1/2 w-px bg-fg-3/70" />
                  <motion.div className="absolute top-0 h-full rounded-full"
                    style={{ background: !V ? c : z >= 0 ? `linear-gradient(90deg, ${c}55, ${c})` : `linear-gradient(270deg, ${c}55, ${c})`, boxShadow: glow(`0 0 8px ${c}88`), left: z >= 0 ? '50%' : undefined, right: z < 0 ? '50%' : undefined }}
                    animate={{ width: `${(Math.abs(z) / 3) * 50}%` }} transition={{ duration: 0.4 }} />
                </div>
                <span className="text-right font-mono text-[9.5px] text-fg-3 tabnum">{s.z >= 0 ? '+' : '−'}{Math.abs(s.z).toFixed(1)}σ</span>
              </div>
            )
          })}
        </div>
        <p className="mt-3 border-l-2 pl-2.5 text-[11px] leading-relaxed text-fg-3" style={{ borderColor: col + '88' }}>{R.desc}</p>
      </div>
    </Panel>
  )
}
