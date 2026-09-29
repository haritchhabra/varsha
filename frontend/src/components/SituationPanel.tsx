import { useMemo, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { AlertTriangle, ChevronRight, Crosshair, Eye, ShieldAlert, Siren } from 'lucide-react'
import type { DayData, Meta } from '../lib/types'
import { WARN, rainCss } from '../lib/colors'
import { useT } from '../lib/i18n'
import { Panel, Stat, WarnChip, addDays, fmtDate } from './ui'

const WARN_ICON = { 3: Siren, 2: AlertTriangle, 1: Eye } as const

/** Three thin bars comparing obs / raw / VARSHA on a shared scale (presentational only). */
function TriBars({ obs, raw, cor }: { obs: number; raw: number; cor: number }) {
  const m = Math.max(obs, raw, cor, 1e-6)
  const rows = [
    { l: 'obs', v: obs, c: '#e6edf7' },
    { l: 'raw', v: raw, c: '#e66767' },
    { l: 'varsha', v: cor, c: '#22d3ee' },
  ]
  return (
    <div className="-mt-1 grid grid-cols-3 gap-2 px-0.5">
      {rows.map((r) => (
        <div key={r.l} className="h-[3px] overflow-hidden rounded-full bg-line/60">
          <motion.div className="h-full rounded-full" style={{ background: `linear-gradient(90deg, ${r.c}40, ${r.c})`, boxShadow: `0 0 6px ${r.c}88` }}
            animate={{ width: `${(r.v / m) * 100}%` }} transition={{ duration: 0.6, ease: 'easeOut' }} />
        </div>
      ))}
    </div>
  )
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="mb-1.5 flex items-center gap-2">
      <div className="label-xs flex items-center gap-1.5">{children}</div>
      <span aria-hidden className="h-px min-w-3 flex-1 bg-gradient-to-r from-line-2 to-transparent" />
    </div>
  )
}

export default function SituationPanel({ meta, day, lead, onSelect }: { meta: Meta; day: DayData | null; lead: number; onSelect: (id: number) => void }) {
  const t = useT()
  const li = lead - 1
  const top = useMemo(() => {
    if (!day) return []
    return meta.districts
      .map((d) => ({ d, w: day.d.warn[li][d.id], ph: day.d.ph[li][d.id], pvh: day.d.pvh[li][d.id], cx: day.d.corx[li][d.id], obs: day.d.obsx[d.id] }))
      .sort((a, b) => b.w - a.w || b.pvh - a.pvh || b.ph - a.ph || b.cx - a.cx)
      .slice(0, 7)
  }, [day, li, meta.districts])

  if (!day) return <Panel title={t('Situation report')} className="p-4"><div className="skeleton h-96 rounded-xl bg-ink-2" /></Panel>
  const s = day.stats[li]
  const caughtMax = Math.max(1, s.n_obs_heavy)

  return (
    <Panel title={t('Situation report')} right={<span className="chip text-fg-3">issued {fmtDate(addDays(day.date, -lead), { day: 'numeric', month: 'short' })}</span>}>
      <div className="space-y-3 px-4 pb-4">
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Obs mean" value={s.obs_mean} unit="mm" />
          <Stat label="Raw NWP" value={s.raw_mean} unit="mm" accent="#f0a3a3" />
          <Stat label="VARSHA" value={s.cor_mean} unit="mm" accent="#67e8f9" />
        </div>
        <TriBars obs={s.obs_mean} raw={s.raw_mean} cor={s.cor_mean} />
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Peak obs" value={s.max_obs} decimals={0} unit="mm" />
          <Stat label="Peak raw" value={s.max_raw} decimals={0} unit="mm" accent="#f0a3a3" />
          <Stat label="Peak VARSHA" value={s.max_cor} decimals={0} unit="mm" accent="#67e8f9" />
        </div>
        <TriBars obs={s.max_obs} raw={s.max_raw} cor={s.max_cor} />

        <div>
          <SectionLabel><ShieldAlert size={11} /> District warnings · {t('Day')}-{lead}</SectionLabel>
          <div className="grid grid-cols-3 gap-2">
            {([3, 2, 1] as const).map((lvl) => {
              const c = WARN[lvl].color, n = s.n_warn[lvl], I = WARN_ICON[lvl]
              const hot = lvl === 3 && n > 0
              return (
                <div key={lvl} className="group relative overflow-hidden rounded-xl border px-2.5 py-2 transition duration-300 hover:-translate-y-px"
                  style={{ borderColor: c + (n ? '66' : '33'), background: `linear-gradient(160deg, ${c}${n ? '26' : '12'}, ${c}08 70%)`, boxShadow: n ? `inset 0 1px 0 #ffffff12, 0 8px 22px -14px ${c}` : 'inset 0 1px 0 #ffffff0a' }}>
                  <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${c}, transparent)` }} />
                  <span aria-hidden className="pointer-events-none absolute -top-6 -right-6 h-16 w-16 rounded-full blur-xl" style={{ background: c, opacity: n ? 0.22 : 0.08 }} />
                  {hot && <span aria-hidden className="pointer-events-none absolute inset-0 rounded-xl border motion-safe:animate-pulse" style={{ borderColor: c, boxShadow: `inset 0 0 18px -6px ${c}` }} />}
                  <div className="relative flex items-start justify-between">
                    <div className="kpi-number text-2xl font-semibold" style={{ color: c }}>{n}</div>
                    <span className="grid h-5 w-5 place-items-center rounded-md" style={{ background: c + '22', boxShadow: `inset 0 0 0 1px ${c}55` }}>
                      <I size={11} color={c} className={hot ? 'motion-safe:animate-pulse' : ''} />
                    </span>
                  </div>
                  <div className="relative font-mono text-[9.5px] uppercase tracking-wider text-fg-2">{t(WARN[lvl].name)} · {t(WARN[lvl].label)}</div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="relative overflow-hidden rounded-xl border border-line bg-gradient-to-b from-ink-2/80 to-ink-1/60 p-3 shadow-[inset_0_1px_0_#ffffff0d]">
          <span aria-hidden className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-neon/50 to-transparent" />
          <SectionLabel><Crosshair size={11} /> {t('Heavy-rain districts caught')}</SectionLabel>
          <div className="mb-2 text-[11px] text-fg-2"><span className="kpi-number mr-0.5 text-lg text-fg">{s.n_obs_heavy}</span> districts observed ≥ 64.5 mm somewhere</div>
          {[
            { name: 'VARSHA (≥ Yellow)', v: s.hits_varsha, fa: s.fa_varsha, c: '#22d3ee' },
            { name: 'Raw NWP (≥ 64.5 mm)', v: s.hits_raw, fa: s.fa_raw, c: '#e66767' },
          ].map((r) => (
            <div key={r.name} className="mb-2">
              <div className="flex items-center justify-between font-mono text-[10.5px]">
                <span className="flex items-center gap-1.5 text-fg-2"><span className="h-1.5 w-1.5 rounded-full" style={{ background: r.c, boxShadow: `0 0 6px ${r.c}` }} />{r.name}</span>
                <span className="tabnum"><span className="font-semibold text-fg">{r.v}</span><span className="text-fg-3">/{s.n_obs_heavy}</span></span>
              </div>
              <div className="relative mt-1 h-2.5 overflow-hidden rounded-full bg-line/50 shadow-[inset_0_1px_3px_#000000cc]">
                <motion.div className="relative h-full rounded-full" style={{ background: `linear-gradient(90deg, ${r.c}55, ${r.c})`, boxShadow: `0 0 12px ${r.c}` }} animate={{ width: `${(r.v / caughtMax) * 100}%` }} transition={{ duration: 0.6 }}>
                  <span aria-hidden className="absolute inset-x-0 top-0 h-1/2 rounded-full bg-white/25" />
                  <span aria-hidden className="absolute top-0 right-0 h-full w-1 rounded-full bg-white/80 blur-[1px]" />
                </motion.div>
                <span aria-hidden className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent_0_9px,#04070d99_9px_10px)]" />
              </div>
            </div>
          ))}
          <div className="mt-1.5 border-t border-line/70 pt-1.5 font-mono text-[10px] text-fg-3">false alarms (flagged, no heavy rain): VARSHA <span className="text-fg-2">{s.fa_varsha}</span> · raw <span className="text-fg-2">{s.fa_raw}</span></div>
        </div>

        <div>
          <SectionLabel>Highest-risk districts</SectionLabel>
          <div className="space-y-1">
            {top.map((r, i) => {
              const rc = rainCss(r.cx) === '#0b1322' ? '#9fb0c8' : rainCss(r.cx)
              return (
                <motion.button key={r.d.id} onClick={() => onSelect(r.d.id)}
                  initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                  className="group relative grid w-full grid-cols-[18px_1fr_auto_auto] items-center gap-2 overflow-hidden rounded-lg border border-transparent py-1.5 pr-2 pl-1.5 text-left transition hover:border-line-2 hover:bg-ink-3/60 hover:shadow-[0_6px_18px_-10px_#22d3ee66]">
                  <span aria-hidden className="absolute inset-y-1.5 left-0 w-0.5 rounded-full opacity-70 transition-opacity group-hover:opacity-100" style={{ background: WARN[r.w].color, boxShadow: `0 0 6px ${WARN[r.w].color}` }} />
                  <span className="text-center font-mono text-[9.5px] text-fg-3 tabnum">{String(i + 1).padStart(2, '0')}</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1 truncate text-[12px] text-fg">{r.d.name}<ChevronRight size={11} className="shrink-0 -translate-x-1 text-neon opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100" /></div>
                    <div className="truncate text-[10px] text-fg-3">{r.d.state}</div>
                  </div>
                  <div className="text-right font-mono text-[10.5px] leading-tight">
                    <div style={{ color: rc }}>{r.cx.toFixed(0)} mm</div>
                    <div className="text-fg-3">P {r.ph}% · {r.pvh}%</div>
                  </div>
                  <WarnChip level={r.w} compact t={t} />
                </motion.button>
              )
            })}
          </div>
        </div>
      </div>
    </Panel>
  )
}
