import { useState, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { ArrowDownRight, ArrowRight, ArrowUpRight, Download, FlaskConical, ShieldCheck, Sparkles } from 'lucide-react'
import { Area, CartesianGrid, ComposedChart, Legend, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useStore } from '../lib/store'
import { METHOD_COLORS, REGIME_COLORS, WARN } from '../lib/colors'
import { glow, theme } from '../lib/theme'
import type { Scores } from '../lib/types'
import { Panel, Seg } from '../components/ui'
import { Dumbbell, PerformanceDiagram, Reliability } from '../charts/Charts'

const AX = { stroke: 'var(--color-line-2)', tickLine: false, tick: { fill: 'var(--color-fg-3)', fontSize: 10, fontFamily: 'JetBrains Mono' } }
const FOCUS = ['RAW', 'QM', 'ML', 'VARSHA']
const RAW_TXT = 'var(--color-raw-2)'

/* ── presentational helpers (local) ─────────────────────────────────────── */

type TipEntry = { name?: string | number; value?: unknown; color?: string; stroke?: string; dataKey?: unknown }
/** Glass tooltip: neutral text, colour only in the swatch. */
function ChartTip({ active, payload, label, digits = 3 }: { active?: boolean; payload?: readonly TipEntry[]; label?: unknown; digits?: number }) {
  if (!active || !payload?.length) return null
  const rows = payload.filter((p) => typeof p.value === 'number' && !String(p.color ?? p.stroke ?? '').startsWith('url('))
    .filter((p, i, a) => a.findIndex((q) => String(q.dataKey) === String(p.dataKey)) === i)
  return (
    <div className="glass-strong min-w-[170px] rounded-xl px-3 py-2 vivid:shadow-[0_10px_40px_-10px_rgba(34,211,238,0.35)]" style={theme().fx.vivid ? undefined : { boxShadow: 'var(--tt-shadow)' }}>
      <div className="mb-1.5 flex items-center gap-2 font-mono text-[10px] tracking-wider text-fg-3 uppercase">
        <span className="h-1 w-1 rounded-full bg-neon vivid:shadow-[0_0_6px_#22d3ee]" />{String(label ?? '')}
      </div>
      {rows.map((p) => {
        const c = p.color ?? p.stroke ?? 'var(--color-fg-2)'
        const hero = p.dataKey === 'VARSHA'
        return (
          <div key={String(p.dataKey)} className={`flex items-center justify-between gap-4 py-[2px] font-mono text-[11px] ${hero ? 'text-fg' : 'text-fg-2'}`}>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: c, boxShadow: hero ? glow(`0 0 8px ${c}`) : undefined }} />
              {p.name}
            </span>
            <span className={`tabnum ${hero ? 'font-semibold' : ''}`}>{(p.value as number).toFixed(digits)}</span>
          </div>
        )
      })}
    </div>
  )
}

/** Legend rendered as small glass chips (text stays neutral). */
function LegendChips({ payload }: { payload?: readonly { value?: unknown; color?: string; dataKey?: unknown; type?: string }[] }) {
  // drop the decorative VARSHA area fill (gradient colour / legendType none), keep one chip per series
  const items = (payload ?? []).filter((p) => p.type !== 'none' && !String(p.color ?? '').startsWith('url('))
    .filter((p, i, a) => a.findIndex((q) => String(q.dataKey) === String(p.dataKey)) === i)
  if (!items.length) return null
  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
      {items.map((p) => {
        const hero = p.dataKey === 'VARSHA'
        return (
          <span key={String(p.dataKey ?? p.value)} className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-[2px] font-mono text-[10px] ${hero ? 'border-neon/40 bg-neon/10 text-fg' : 'border-line bg-ink-1/60 text-fg-2'}`}>
            <span className="h-[3px] w-3 rounded-full" style={{ background: p.color, boxShadow: hero ? glow(`0 0 6px ${p.color}`) : undefined }} />
            {String(p.value)}
          </span>
        )
      })}
    </div>
  )
}

function Explainer({ children }: { children: ReactNode }) {
  return <p className="px-4 pb-1 text-[11px] leading-relaxed text-fg-3">{children}</p>
}

function Section({ n, title, hint }: { n: string; title: string; hint?: string }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <span className="font-mono text-[10px] tracking-[0.25em] text-neon/80 calm:text-neon">{n}</span>
      <span className="font-display text-[13px] font-medium tracking-wide text-fg">{title}</span>
      {hint && <span className="hidden font-mono text-[10px] text-fg-3 md:inline">{hint}</span>}
      <div className="divider-glow flex-1" />
    </div>
  )
}

function Delta({ pct, good, size = 'sm' }: { pct: number; good: boolean; size?: 'sm' | 'xs' }) {
  const Arrow = pct >= 0 ? ArrowUpRight : ArrowDownRight
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full border px-1.5 py-[1px] font-mono tabnum ${size === 'sm' ? 'text-[10.5px]' : 'text-[9.5px]'} ${good ? 'border-good/30 bg-good/10 text-good vivid:text-emerald-300 vivid:shadow-[0_0_10px_-2px_rgba(52,211,153,0.45)]' : 'border-bad/30 bg-bad/10 text-bad vivid:text-rose-300'}`}>
      <Arrow size={size === 'sm' ? 12 : 10} />{pct >= 0 ? '+' : ''}{pct.toFixed(0)}%
    </span>
  )
}

function Hero({ label, raw, var: v, lowerBetter = false, fmt = (x: number) => x.toFixed(3), note, i = 0 }: { label: string; raw: number; var: number; lowerBetter?: boolean; fmt?: (x: number) => string; note?: string; i?: number }) {
  const change = raw ? ((v - raw) / Math.abs(raw)) * 100 : 0
  const good = lowerBetter ? v < raw : v > raw
  const mx = Math.max(Math.abs(raw), Math.abs(v)) || 1
  const w = (x: number) => `${Math.max(2, (Math.max(0, x) / mx) * 100)}%`
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.05 * i, ease: [0.2, 0.7, 0.2, 1] }}
      whileHover={{ y: -3 }}
      className="glass hud-corners group overflow-hidden rounded-2xl p-4"
    >
      <span aria-hidden className={`pointer-events-none absolute inset-x-5 top-0 hidden h-px bg-gradient-to-r from-transparent to-transparent vivid:block ${good ? 'via-emerald-300/70' : 'via-rose-300/70'}`} />
      <span aria-hidden className="pointer-events-none absolute -top-12 -right-12 hidden h-28 w-28 rounded-full bg-neon/10 opacity-60 blur-2xl transition-opacity duration-300 group-hover:opacity-100 vivid:block" />
      <div className="label-xs truncate">{label}</div>
      <div className="mt-2 flex items-end justify-between gap-2">
        <div className="kpi-number text-3xl leading-none font-semibold text-neon-2">{fmt(v)}</div>
        <Delta pct={change} good={good} />
      </div>
      <div className="mt-3 space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="w-9 font-mono text-[9px] tracking-wider text-fg-3">VRSH</span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line/70 vivid:bg-ink-1/80 vivid:shadow-[inset_0_1px_2px_rgba(0,0,0,0.6)]">
            <motion.div initial={{ width: 0 }} animate={{ width: w(v) }} transition={{ duration: 0.9, delay: 0.15 + 0.05 * i }}
              className="h-full rounded-full bg-neon vivid:bg-transparent vivid:bg-gradient-to-r vivid:from-neon/40 vivid:to-neon vivid:shadow-[0_0_8px_#22d3ee]" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-9 font-mono text-[9px] tracking-wider text-fg-3">RAW</span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line/70 vivid:bg-ink-1/80 vivid:shadow-[inset_0_1px_2px_rgba(0,0,0,0.6)]">
            <motion.div initial={{ width: 0 }} animate={{ width: w(raw) }} transition={{ duration: 0.9, delay: 0.2 + 0.05 * i }}
              className="h-full rounded-full bg-raw/90 vivid:bg-transparent vivid:bg-gradient-to-r vivid:from-raw/30 vivid:to-raw/90" />
          </div>
        </div>
      </div>
      <div className="mt-2 font-mono text-[11px] text-fg-3">raw NWP <span style={{ color: RAW_TXT }}>{fmt(raw)}</span>{note && <> · {note}</>}</div>
    </motion.div>
  )
}

export default function Verification() {
  const { verification: V, meta } = useStore()
  const [thr, setThr] = useState('64.5')
  const [lead, setLead] = useState<number>(0)
  const [pthr, setPthr] = useState('64.5')
  if (!V || !meta) return null
  const pick = (m: string): Scores => (lead ? V.by_lead[m][lead - 1] : V.overall[m])
  const name = (m: string) => V.method_info[m].name
  const o = V.overall
  const fssIdx = V.fss_scales_cells.indexOf(5)

  const perf = V.methods.map((m) => {
    const c = pick(m).cat[thr]
    return { key: m, name: name(m), sr: c.sr ?? 0, pod: c.pod ?? 0, trail: lead ? undefined : V.by_lead[m].map((s, i) => ({ sr: s.cat[thr].sr ?? 0, pod: s.cat[thr].pod ?? 0, lead: i + 1 })) }
  })
  const fssThr = V.fss_thresholds.includes(thr) ? thr : '64.5'
  const fssData = V.fss_scales_km.map((km, j) => {
    const row: Record<string, number | string> = { km: `${km}` }
    V.methods.forEach((m) => { const f = (lead ? V.fss_by_lead[m][lead - 1] : V.fss[m])[fssThr].fss[j]; if (f !== null) row[m] = f })
    return row
  })
  const useful = (lead ? V.fss_by_lead.RAW[lead - 1] : V.fss.RAW)[fssThr].useful
  const leadData = [1, 2, 3, 4, 5].map((l) => {
    const row: Record<string, number | string> = { lead: `Day-${l}` }
    V.methods.forEach((m) => { row[m] = V.by_lead[m][l - 1].cat[thr].ets ?? 0 })
    return row
  })
  const regRows = meta.regimes.map((r, k) => ({ label: r.short, color: REGIME_COLORS[k], a: V.by_regime.RAW[k].cat[thr].ets ?? 0, b: V.by_regime.VARSHA[k].cat[thr].ets ?? 0 }))
  const regRmse = meta.regimes.map((r, k) => ({ label: r.short, color: REGIME_COLORS[k], a: V.by_regime.RAW[k].rmse, b: V.by_regime.VARSHA[k].rmse }))
  const regBest = meta.regimes.map((_, k) => {
    const best = V.methods.filter((m) => m !== 'RAW').sort((a, b) => (V.by_regime[b][k].cat[thr].ets ?? 0) - (V.by_regime[a][k].cat[thr].ets ?? 0))[0]
    return best
  })
  const P = V.prob[pthr]

  const cols: { k: string; label: string; get: (s: Scores) => number | null; lower?: boolean; d?: number }[] = [
    { k: 'rmse', label: 'RMSE', get: (s) => s.rmse, lower: true, d: 2 },
    { k: 'mae', label: 'MAE', get: (s) => s.mae, lower: true, d: 2 },
    { k: 'bias', label: 'Bias', get: (s) => Math.abs(s.bias), lower: true, d: 2 },
    { k: 'corr', label: 'r', get: (s) => s.corr, d: 3 },
    { k: 'pod', label: 'POD', get: (s) => s.cat[thr].pod, d: 3 },
    { k: 'far', label: 'FAR', get: (s) => s.cat[thr].far, lower: true, d: 3 },
    { k: 'csi', label: 'CSI', get: (s) => s.cat[thr].csi, d: 3 },
    { k: 'ets', label: 'ETS', get: (s) => s.cat[thr].ets, d: 3 },
    { k: 'fbi', label: 'Freq. bias', get: (s) => (s.cat[thr].fbi === null ? null : -Math.abs(1 - (s.cat[thr].fbi ?? 0))), d: 2 },
  ]
  const best: Record<string, number> = Object.fromEntries(cols.map((c) => {
    const vals = V.methods.map((m) => c.get(pick(m))).filter((x): x is number => x !== null)
    return [c.k, c.lower ? Math.min(...vals) : Math.max(...vals)]
  }))

  const download = () => {
    const blob = new Blob([JSON.stringify(V, null, 1)], { type: 'application/json' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'varsha_verification_report.json'; a.click()
  }
  const days = V.regime_days.reduce((a, b) => a + b, 0)

  // headline verdict (display only; derived from the same overall scores as the KPI tiles)
  const etsRaw = o.RAW.cat['64.5'].ets ?? 0, etsVar = o.VARSHA.cat['64.5'].ets ?? 0
  const etsGain = etsRaw ? ((etsVar - etsRaw) / Math.abs(etsRaw)) * 100 : 0
  const rmseGain = o.RAW.rmse ? ((o.VARSHA.rmse - o.RAW.rmse) / o.RAW.rmse) * 100 : 0

  const vivid = theme().fx.vivid
  const lineStyle = (m: string) => {
    const c = METHOD_COLORS[m], hero = m === 'VARSHA'
    return {
      stroke: c, strokeWidth: hero ? 3 : 1.6, strokeOpacity: hero ? 1 : 0.85,
      dot: { r: hero ? 3.5 : 2.5, fill: c, stroke: 'var(--color-ink-1)', strokeWidth: 1.5 },
      activeDot: { r: hero ? 6 : 4.5, fill: 'var(--color-ink-1)', stroke: c, strokeWidth: 2.5, style: hero && vivid ? { filter: 'drop-shadow(0 0 6px #22d3ee)' } : undefined },
      style: hero && vivid ? { filter: 'drop-shadow(0 0 5px rgba(34,211,238,0.55))' } : undefined,
    }
  }
  const cursor = { stroke: 'var(--color-neon)', strokeOpacity: 0.35, strokeDasharray: '3 3' }

  return (
    <div data-scroll className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[1500px] space-y-5 px-6 py-6">
        {/* ── hero header ── */}
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div aria-hidden className="pointer-events-none absolute -top-16 -left-10 hidden h-48 w-[520px] rounded-full bg-[radial-gradient(closest-side,rgba(34,211,238,0.12),transparent)] blur-2xl vivid:block" />
          <div className="relative">
            <div className="label-xs flex items-center gap-2">
              <span className="grid h-5 w-5 place-items-center rounded-md border border-neon/30 bg-neon/10 text-neon vivid:shadow-[0_0_10px_-2px_#22d3ee]"><FlaskConical size={11} /></span>
              Verification lab · independent test seasons
            </div>
            <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">
              Does <span className="text-gradient">regime-aware correction</span> beat raw NWP?
            </h1>
            <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-fg-2">
              JJAS {V.test_years.join(' & ')} — never seen in training ({V.training.train_years.join(', ')}) or calibration ({V.training.calib_years.join(', ')}).
              {' '}{days} days × 5 leads × {o.RAW.n / (days * 5) | 0} grid cells = <span className="font-medium text-fg">{(o.RAW.n / 1e6).toFixed(1)} M</span> forecast–observation pairs.
            </p>
          </div>
          <div className="relative flex flex-wrap items-end gap-2">
            <div>
              <div className="mb-1 pl-1 font-mono text-[9px] tracking-[0.2em] text-fg-3 uppercase">Threshold · mm/day</div>
              <Seg value={thr} onChange={setThr} options={V.thresholds.map((t) => ({ v: t, label: `≥${t}` }))} />
            </div>
            <div>
              <div className="mb-1 pl-1 font-mono text-[9px] tracking-[0.2em] text-fg-3 uppercase">Lead time</div>
              <Seg value={lead} onChange={setLead} options={[{ v: 0, label: 'All leads' }, ...[1, 2, 3, 4, 5].map((l) => ({ v: l, label: `D${l}` }))]} />
            </div>
            <button onClick={download} className="btn-seg group flex items-center gap-1.5 border border-neon/30 bg-neon/[0.06] text-neon-2 hover:border-neon/60 vivid:hover:shadow-[0_0_16px_-4px_#22d3ee]">
              <Download size={13} className="transition-transform group-hover:translate-y-[1px]" /> report.json
            </button>
          </div>
        </div>

        {/* ── headline verdict band ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
          className="glass overflow-hidden rounded-2xl"
        >
          <div aria-hidden className="pointer-events-none absolute inset-0 hidden bg-[radial-gradient(60%_140%_at_0%_50%,rgba(34,211,238,0.16),transparent_60%),radial-gradient(50%_120%_at_100%_50%,rgba(167,139,250,0.12),transparent_60%)] vivid:block" />
          <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-neon vivid:bg-transparent vivid:bg-gradient-to-b vivid:from-neon vivid:via-plasma vivid:to-neon vivid:shadow-[0_0_14px_#22d3ee]" />
          <div className="relative flex flex-wrap items-center gap-x-8 gap-y-3 px-6 py-4">
            <div className="flex items-center gap-4">
              <span className="grid h-11 w-11 place-items-center rounded-xl border border-good/30 bg-good/10 text-good vivid:text-emerald-300 vivid:shadow-[0_0_18px_-4px_rgba(52,211,153,0.6)]"><ShieldCheck size={22} /></span>
              <div>
                <div className="label-xs flex items-center gap-1.5"><Sparkles size={11} className="text-plasma" /> Headline verdict · heavy rain ≥ 64.5 mm</div>
                <div className="mt-0.5 flex items-baseline gap-3">
                  <span className={`kpi-number text-5xl leading-none font-bold ${vivid ? 'text-gradient' : 'text-neon-2'}`}>{etsGain >= 0 ? '+' : ''}{etsGain.toFixed(0)}%</span>
                  <span className="font-display text-sm text-fg-2">equitable threat score vs raw NWP</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 font-mono text-[12px]">
              <span className="rounded-lg border border-raw/30 bg-raw/10 px-2.5 py-1 text-fg-2">raw <span className="tabnum" style={{ color: RAW_TXT }}>{etsRaw.toFixed(3)}</span></span>
              <span className="relative h-px w-16 overflow-hidden bg-fg-3/60 vivid:bg-transparent vivid:bg-gradient-to-r vivid:from-raw/60 vivid:to-neon">
                <span className="absolute inset-y-0 hidden w-6 bg-gradient-to-r from-transparent via-white to-transparent motion-safe:animate-[verif-beam_2.2s_linear_infinite] vivid:block" />
              </span>
              <ArrowRight size={14} className="-ml-2 text-neon" />
              <span className="rounded-lg border border-neon/40 bg-neon/10 px-2.5 py-1 text-fg vivid:shadow-[0_0_14px_-4px_#22d3ee]">VARSHA <span className="tabnum font-semibold text-neon-2">{etsVar.toFixed(3)}</span></span>
            </div>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <span className="chip text-neon-2">RMSE {rmseGain >= 0 ? '+' : ''}{rmseGain.toFixed(0)}%</span>
              <span className="chip text-plasma">{(o.RAW.n / 1e6).toFixed(1)} M pairs</span>
              <span className="chip text-fg-2">test · JJAS {V.test_years.join(' & ')}</span>
            </div>
          </div>
          <style>{`@keyframes verif-beam { from { transform: translateX(-24px) } to { transform: translateX(72px) } }`}</style>
        </motion.div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-7">
          <Hero i={0} label="RMSE (mm/day)" raw={o.RAW.rmse} var={o.VARSHA.rmse} lowerBetter fmt={(x) => x.toFixed(2)} />
          <Hero i={1} label="ETS · heavy ≥64.5" raw={o.RAW.cat['64.5'].ets!} var={o.VARSHA.cat['64.5'].ets!} />
          <Hero i={2} label="CSI · heavy" raw={o.RAW.cat['64.5'].csi!} var={o.VARSHA.cat['64.5'].csi!} />
          <Hero i={3} label="POD · heavy" raw={o.RAW.cat['64.5'].pod!} var={o.VARSHA.cat['64.5'].pod!} />
          <Hero i={4} label="FAR · heavy" raw={o.RAW.cat['64.5'].far!} var={o.VARSHA.cat['64.5'].far!} lowerBetter />
          <Hero i={5} label={`FSS · heavy @${V.fss_scales_km[fssIdx]} km`} raw={V.fss.RAW['64.5'].fss[fssIdx]!} var={V.fss.VARSHA['64.5'].fss[fssIdx]!} />
          <Hero i={6} label="BSS · P(heavy)" raw={V.prob['64.5'].nwp.bss!} var={V.prob['64.5'].varsha.bss!} note="vs NWP nbhd prob" />
        </div>

        <Section n="01" title="Scorecard" hint="every method, every metric — ↑ higher is better · ↓ lower is better" />
        <Panel title={`Scorecard · threshold ≥ ${thr} mm · ${lead ? `Day-${lead}` : 'all leads'} · best in column highlighted`}>
          <div className="overflow-x-auto px-4 pb-4">
            <table className="w-full min-w-[900px] border-separate border-spacing-0 text-left">
              <thead>
                <tr className="font-mono text-[10.5px] tracking-wider text-fg-3 uppercase">
                  <th className="border-b border-line-2/70 bg-ink-1/40 py-2.5 pr-4 pl-3 font-normal first:rounded-tl-lg">Method</th>
                  {cols.map((c) => (
                    <th key={c.k} className="border-b border-line-2/70 bg-ink-1/40 px-2 py-2.5 text-right font-normal whitespace-nowrap last:rounded-tr-lg">
                      {c.label}<span className={`ml-1 ${c.lower ? 'text-plasma/80 calm:text-plasma' : 'text-neon/80 calm:text-neon'}`}>{c.lower ? '↓' : '↑'}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {V.methods.map((m, ri) => {
                  const s = pick(m)
                  const hero = m === 'VARSHA'
                  const mc = METHOD_COLORS[m]
                  return (
                    <tr key={m} className={`group transition-colors ${hero ? 'bg-neon/[0.07] vivid:bg-transparent vivid:bg-gradient-to-r vivid:from-neon/[0.12] vivid:via-neon/[0.05] vivid:to-transparent' : ri % 2 ? 'bg-fg/[0.03] vivid:bg-fg/[0.018]' : ''} hover:bg-neon/[0.05]`}>
                      <td className="relative border-t border-line/60 py-2.5 pr-4 pl-3">
                        {hero && <span aria-hidden className="absolute inset-y-1 left-0 w-[3px] rounded-full bg-neon vivid:shadow-[0_0_10px_#22d3ee]" />}
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ background: mc, boxShadow: `0 0 0 3px ${mc}22${hero && vivid ? `, 0 0 10px ${mc}` : ''}` }} />
                          <span className={`text-[13px] ${hero ? 'font-semibold text-neon-2' : 'text-fg'}`}>{name(m)}</span>
                          {hero && <span className="chip text-neon-2 !px-1.5 !py-0 !text-[8.5px]">operational</span>}
                        </div>
                        <div className="pl-[18px] text-[10.5px] text-fg-3">{V.method_info[m].desc}</div>
                      </td>
                      {cols.map((c) => {
                        const v = c.get(s)
                        const disp = c.k === 'bias' ? s.bias : c.k === 'fbi' ? s.cat[thr].fbi : v
                        const isBest = v !== null && Math.abs(v - best[c.k]) < 1e-9
                        return (
                          <td key={c.k} className={`border-t border-line/60 px-2 py-2.5 text-right font-mono text-[12.5px] tabnum ${isBest ? 'font-semibold text-neon-2' : hero ? 'text-fg' : 'text-fg-2'}`}>
                            {isBest ? (
                              <span className="inline-flex items-center gap-1 rounded-md border border-neon/40 bg-neon/10 px-1.5 py-[1px] vivid:shadow-[0_0_14px_-3px_rgba(34,211,238,0.6)]">
                                {disp === null ? '—' : disp.toFixed(c.d)}<span className="text-[9px] text-neon calm:text-neon-2">★</span>
                              </span>
                            ) : (disp === null ? '—' : disp.toFixed(c.d))}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Panel>

        <Section n="02" title="Where the skill comes from" hint="categorical geometry · spatial scale · lead time · weather regime" />
        <div className="grid gap-5 xl:grid-cols-[auto_1fr]">
          <Panel title={`Performance diagram · ≥ ${thr} mm · trail = Day-1→5`}>
            <div className="px-4 pt-2 pb-2"><PerformanceDiagram points={perf} size={400} /></div>
            <div className="mx-4 mb-3 flex max-w-[400px] flex-wrap gap-1.5">
              {perf.map((p) => {
                const c = METHOD_COLORS[p.key] ?? 'var(--color-fg-2)', hero = p.key === 'VARSHA'
                return (
                  <span key={p.key} className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-[2px] font-mono text-[10px] ${hero ? 'border-neon/40 bg-neon/10 text-fg' : 'border-line bg-ink-1/60 text-fg-2'}`}>
                    <span className="h-2 w-2 rounded-full" style={{ background: c, boxShadow: hero ? glow(`0 0 6px ${c}`) : undefined }} />{p.name}
                  </span>
                )
              })}
            </div>
            <div className="mx-4 mb-4 max-w-[400px] rounded-lg border border-line/70 bg-ink-1/50 px-3 py-2 text-[11px] leading-relaxed text-fg-3">
              <span className="text-fg-2">Up-and-right is better.</span> Curves = CSI, rays = frequency bias. Arrow: raw NWP → VARSHA. <span className="text-fg-2">Hover a point</span> for its scores.
            </div>
          </Panel>
          <div className="grid gap-5 lg:grid-cols-2">
            <Panel title={`Fractions skill score vs scale · ≥ ${fssThr} mm`}>
              <Explainer>How well the rain <span className="text-fg-2">pattern</span> matches at growing neighbourhood sizes. Higher is better; {vivid ? 'amber' : 'dashed'} line = “useful” skill.</Explainer>
              <div className="h-[280px] px-2 pb-3">
                <ResponsiveContainer>
                  <ComposedChart data={fssData} margin={{ top: 10, right: 16, bottom: 6, left: -10 }}>
                    <defs>
                      <linearGradient id="verif-fss-fill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0" stopColor="var(--color-neon)" stopOpacity={vivid ? 0.28 : 0.16} />
                        <stop offset="1" stopColor="var(--color-neon)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="var(--color-line)" strokeDasharray="2 4" vertical={false} />
                    <XAxis dataKey="km" {...AX} unit=" km" />
                    <YAxis {...AX} axisLine={false} domain={[0, 1]} />
                    <Tooltip content={<ChartTip />} cursor={cursor} />
                    <Legend content={<LegendChips />} />
                    <Area dataKey="VARSHA" fill="url(#verif-fss-fill)" stroke="none" legendType="none" tooltipType="none" isAnimationActive={false} />
                    <ReferenceLine y={useful} stroke={vivid ? WARN[1].text : 'var(--color-fg-2)'} strokeOpacity={vivid ? 0.6 : 0.75} strokeDasharray="5 4" label={{ value: `useful ${useful.toFixed(2)}`, fill: 'var(--color-fg-2)', fontSize: 10, fontFamily: 'JetBrains Mono', position: 'insideBottomRight' }} />
                    {FOCUS.map((m) => <Line key={m} dataKey={m} name={name(m)} {...lineStyle(m)} />)}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </Panel>
            <Panel title={`ETS by lead time · ≥ ${thr} mm`}>
              <Explainer>Skill as the forecast horizon grows from Day-1 to Day-5. The <span className="text-fg-2">gap</span> between VARSHA and raw NWP is the added value.</Explainer>
              <div className="h-[280px] px-2 pb-3">
                <ResponsiveContainer>
                  <ComposedChart data={leadData} margin={{ top: 10, right: 16, bottom: 6, left: -10 }}>
                    <defs>
                      <linearGradient id="verif-lead-fill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0" stopColor="var(--color-neon)" stopOpacity={vivid ? 0.28 : 0.16} />
                        <stop offset="1" stopColor="var(--color-neon)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="var(--color-line)" strokeDasharray="2 4" vertical={false} />
                    <XAxis dataKey="lead" {...AX} />
                    <YAxis {...AX} axisLine={false} />
                    <Tooltip content={<ChartTip />} cursor={cursor} />
                    <Legend content={<LegendChips />} />
                    <Area dataKey="VARSHA" fill="url(#verif-lead-fill)" stroke="none" legendType="none" tooltipType="none" isAnimationActive={false} />
                    {FOCUS.map((m) => <Line key={m} dataKey={m} name={name(m)} {...lineStyle(m)} />)}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </Panel>
            <Panel title={`By regime · ETS ≥ ${thr} mm · raw → VARSHA`}>
              <div className="px-4 pt-2 pb-3"><Dumbbell rows={regRows} max={Math.max(0.05, ...regRows.map((r) => Math.max(r.a, r.b))) * 1.1} width={440} /></div>
              <div className="mx-4 mb-4 flex flex-wrap items-center gap-1.5 font-mono text-[10px] text-fg-3">
                <span className="mr-1 tracking-wider uppercase">best post-processor per regime:</span>
                {meta.regimes.map((r, k) => (
                  <span key={r.short} className="inline-flex items-center gap-1 rounded-full border border-line bg-ink-1/60 px-2 py-[1px]">
                    <span className="h-1.5 w-1.5 rounded-sm" style={{ background: REGIME_COLORS[k] }} />
                    <span className="text-fg-2">{r.short}</span>→<span className={regBest[k] === 'VARSHA' ? 'text-neon-2' : 'text-fg-2'}>{name(regBest[k])}</span>
                  </span>
                ))}
              </div>
            </Panel>
            <Panel title="By regime · RMSE (mm/day) · raw → VARSHA">
              <div className="px-4 pt-2 pb-3"><Dumbbell rows={regRmse} max={Math.max(...regRmse.map((r) => Math.max(r.a, r.b))) * 1.1} width={440} fmt={(v) => v.toFixed(0)} lowerBetter /></div>
              <div className="mx-4 mb-4 flex items-center gap-4 font-mono text-[10px] text-fg-3">
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-raw" />raw NWP</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-neon vivid:shadow-[0_0_6px_#22d3ee]" />VARSHA</span>
                <span>lower is better</span>
              </div>
            </Panel>
          </div>
        </div>

        <Section n="03" title="Probabilistic heavy-rain guidance" hint="is a 30% forecast right 30% of the time?" />
        <div className="grid gap-5 lg:grid-cols-[auto_1fr]">
          <Panel title="Heavy-rainfall probability · reliability" right={<Seg value={pthr} onChange={setPthr} options={Object.keys(V.prob).map((k) => ({ v: k, label: `≥${k}` }))} />}>
            <div className="flex flex-wrap gap-4 px-4 pt-2 pb-4">
              <Reliability bins={P.varsha.reliability ?? []} clim={P.varsha.base_rate} size={300} label="VARSHA (isotonic-calibrated)" />
              <Reliability bins={P.nwp.reliability ?? []} clim={P.nwp.base_rate} size={300} color="var(--color-raw)" label="Raw NWP neighbourhood prob." />
            </div>
          </Panel>
          <Panel title={`Probabilistic skill · P(≥ ${pthr} mm)`}>
            <div className="grid grid-cols-2 gap-3 px-4 pt-2 pb-4 md:grid-cols-4">
              {[
                { l: 'Brier score ↓', a: P.nwp.brier, b: P.varsha.brier, d: 4, dir: -1 },
                { l: 'Brier skill score ↑', a: P.nwp.bss ?? 0, b: P.varsha.bss ?? 0, d: 3, dir: 1 },
                { l: 'ROC area ↑', a: P.nwp.auc ?? 0, b: P.varsha.auc ?? 0, d: 3, dir: 1 },
                { l: 'Base rate', a: P.nwp.base_rate, b: P.varsha.base_rate, d: 4, dir: 0 },
              ].map((k, i) => {
                const pct = k.a ? ((k.b - k.a) / Math.abs(k.a)) * 100 : 0
                return (
                  <motion.div key={k.l} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i }}
                    className="group relative overflow-hidden rounded-xl border border-line bg-ink-2 p-3 transition-colors hover:border-neon/40 vivid:bg-transparent vivid:bg-gradient-to-b vivid:from-ink-3/70 vivid:to-ink-2/60">
                    <span aria-hidden className="pointer-events-none absolute inset-x-3 top-0 hidden h-px bg-gradient-to-r from-transparent via-neon/60 to-transparent vivid:block" />
                    <div className="label-xs">{k.l}</div>
                    <div className="mt-1 flex items-end justify-between gap-2">
                      <div className="kpi-number text-2xl font-semibold text-neon-2">{k.b.toFixed(k.d)}</div>
                      {k.dir !== 0 && Math.abs(pct) >= 0.5 && <Delta pct={pct} good={k.dir > 0 ? k.b > k.a : k.b < k.a} size="xs" />}
                    </div>
                    <div className="font-mono text-[11px] text-fg-3">NWP <span style={{ color: RAW_TXT }}>{k.a.toFixed(k.d)}</span></div>
                  </motion.div>
                )
              })}
            </div>
            <div className="px-4 pb-4">
              <div className="label-xs mb-2">BSS by lead</div>
              <div className="grid grid-cols-5 gap-2">
                {(() => {
                  const top = Math.max(0.01, ...P.by_lead.map((b) => b.varsha.bss ?? 0))
                  return P.by_lead.map((b, i) => (
                    <div key={b.lead} className="relative overflow-hidden rounded-lg border border-line bg-ink-1/60 p-2 text-center">
                      <motion.div aria-hidden initial={{ height: 0 }} animate={{ height: `${Math.max(0, (b.varsha.bss ?? 0) / top) * 100}%` }} transition={{ duration: 0.8, delay: 0.06 * i }}
                        className="pointer-events-none absolute inset-x-0 bottom-0 bg-neon/[0.12] vivid:bg-transparent vivid:bg-gradient-to-t vivid:from-neon/20 vivid:to-transparent" />
                      <div className="relative font-mono text-[10px] text-fg-3">Day-{b.lead}</div>
                      <div className="kpi-number relative text-lg text-neon-2">{(b.varsha.bss ?? 0).toFixed(2)}</div>
                      <div className="relative font-mono text-[10px]" style={{ color: RAW_TXT }}>{(b.nwp.bss ?? 0).toFixed(2)}</div>
                    </div>
                  ))
                })()}
              </div>
              <p className="mt-3 border-l-2 border-plasma/40 pl-3 text-[11px] leading-relaxed text-fg-3">
                Probabilities come from a gradient-boosted exceedance model on the same predictors plus the regime probabilities, isotonic-calibrated on the {V.training.calib_years.join(', ')} season.
                The baseline is the fraction of raw-NWP grid points above the threshold in a 5×5 (≈140 km) neighbourhood.
              </p>
            </div>
          </Panel>
        </div>

        <Section n="04" title="District scale" hint="area-mean rainfall per district" />
        <Panel title="District-level verification (area-mean rainfall of each district)">
          <div className="overflow-x-auto px-4 pb-4">
            <table className="w-full min-w-[760px] border-separate border-spacing-0 text-left font-mono text-[12px]">
              <thead>
                <tr className="text-[10.5px] text-fg-3 uppercase">
                  <th className="border-b border-line-2/70 py-2.5 pl-3 font-normal">Lead</th>
                  {['RAW', 'ML', 'VARSHA'].map((m) => (
                    <th key={m} colSpan={3} className={`border-b px-2 py-2.5 font-normal ${m === 'VARSHA' ? 'border-neon/50 bg-neon/[0.07] text-neon-2' : 'border-line-2/70'}`}>
                      <span className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ background: METHOD_COLORS[m], boxShadow: m === 'VARSHA' ? glow('0 0 6px #22d3ee') : undefined }} />
                      {name(m)} · RMSE / ETS≥15.6 / ETS≥35
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[0, 1, 2, 3, 4].map((l) => (
                  <tr key={l} className={`transition-colors hover:bg-neon/[0.04] ${l % 2 ? 'bg-fg/[0.03] vivid:bg-fg/[0.018]' : ''}`}>
                    <td className="border-t border-line/60 py-2 pl-3 text-fg-2">Day-{l + 1}</td>
                    {['RAW', 'ML', 'VARSHA'].map((m) => {
                      const s = V.district[m][l]
                      return [s.rmse.toFixed(2), (s.cat['15.6'].ets ?? 0).toFixed(3), (s.cat['35.0'].ets ?? 0).toFixed(3)].map((v, i) => (
                        <td key={m + i} className={`border-t border-line/60 px-2 py-2 tabnum ${m === 'VARSHA' ? 'bg-neon/[0.05] font-medium text-neon-2' : 'text-fg-2'}`}>{v}</td>
                      ))
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </div>
  )
}
