import { useEffect, useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { Activity, AlertTriangle, ArrowRight, Brain, Sparkles, Wand2 } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useStore } from '../lib/store'
import { loadComposites, loadGeo } from '../lib/data'
import type { Composites } from '../lib/types'
import { REGIME_COLORS, dataInk } from '../lib/colors'
import { useT } from '../lib/i18n'
import { glow, theme } from '../lib/theme'
import { Bar as UIBar, Panel, REGIME_ICON, Ring, Seg } from '../components/ui'
import { ConfusionMatrix } from '../charts/Charts'
import MiniMap, { DIV, SEQ, divColor, seqColor } from '../charts/MiniMap'

const AX = { stroke: 'var(--color-line-2)', tick: { fill: 'var(--color-fg-3)', fontSize: 10, fontFamily: 'JetBrains Mono' } }
const TT = { contentStyle: { background: 'var(--color-ink-2)', border: '1px solid var(--color-line-2)', borderRadius: 10, fontSize: 11, fontFamily: 'JetBrains Mono', boxShadow: 'var(--tt-shadow)' }, labelStyle: { color: 'var(--color-fg-2)' } }
// legend text stays neutral ink in the calm themes (series colour only in the swatch)
const legendText = (v: string) => <span style={{ color: 'var(--color-fg-2)' }}>{v}</span>
/** hollow line-chart dots: filled with the surface colour */
const DOT_BG = 'var(--color-ink-1)'

type Field = 'obs' | 'raw' | 'rawbias' | 'corbias'
const FIELDS: { v: Field; label: string }[] = [
  { v: 'obs', label: 'Observed mean' }, { v: 'raw', label: 'Raw NWP mean' }, { v: 'rawbias', label: 'Raw NWP bias' }, { v: 'corbias', label: 'VARSHA bias' },
]

const PHYSICS = [
  { err: 'Trough rain placed too far north; heavy rain along the trough and the Western Ghats under-forecast.', fix: 'Expert learns a southward shift through offset-neighbourhood predictors and amplifies peaks.' },
  { err: 'Model keeps the trough near normal: spurious rain over central India; foothill and NE India rain missed.', fix: 'Suppresses central-India false alarms; boosts foothill/NE rain from terrain and windward-slope predictors.' },
  { err: 'Track displaced, and too fast westward as lead grows; rain symmetric instead of SW-sector; too weak.', fix: 'Directional-offset features let the expert re-centre the rain shield and restore SW-sector intensity.' },
  { err: 'Smoothed terrain: windward Ghats rain under-forecast by about half, spill-over onto the lee side.', fix: 'Terrain/coast-distance features re-concentrate rain on the windward slopes and dry the leeward plateau.' },
  { err: 'Rain pushed onto the Punjab–Haryana plains, too weak over high terrain.', fix: 'Elevation-aware expert moves rain upslope to J&K / Himachal / Uttarakhand.' },
  { err: 'Mostly drizzle bias: too many light-rain days, damped extremes.', fix: 'Light-rain suppression plus mild peak restoration.' },
]

export default function RegimeLab() {
  const t = useT()
  const { meta, verification: V } = useStore()
  const [comp, setComp] = useState<Composites | null>(null)
  const [states, setStates] = useState<GeoJSON.FeatureCollection | null>(null)
  const [field, setField] = useState<Field>('rawbias')
  const [cm, setCm] = useState<'all' | 'd1'>('all')
  useEffect(() => { loadComposites().then(setComp); loadGeo('states').then(setStates) }, [])

  const maps = useMemo(() => {
    if (!comp) return []
    return comp.regimes.map((r) => {
      const v = r.obs.map((o, i) => {
        if (field === 'obs') return o / 10
        if (field === 'raw') return r.raw[i] / 10
        if (field === 'rawbias') return (r.raw[i] - o) / 10
        return (r.cor[i] - o) / 10
      })
      const mae = v.reduce((a, b) => a + Math.abs(b), 0) / v.length
      return { v, mae }
    })
  }, [comp, field])
  const seqF = (x: number) => seqColor(x, 40)
  const divF = (x: number) => divColor(x, 15)
  if (!meta || !V) return null
  const rc = V.regime_classifier
  const imp = rc.importance.slice(0, 12).map((d) => ({ name: meta.feature_labels[d.feature] ?? d.feature, v: d.importance }))
  const accLead = rc.by_lead.map((b) => ({ lead: `Day-${b.lead}`, ml: b.accuracy, rule: b.rule_accuracy }))
  const isBias = field === 'rawbias' || field === 'corbias'

  const totalDays = V.regime_days.reduce((a, b) => a + b, 0) || 1
  const vivid = theme().fx.vivid

  return (
    <div data-scroll className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[1500px] space-y-5 px-6 py-6">
        {/* ── page header ─────────────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
          className="relative overflow-hidden rounded-2xl border border-line/70 bg-ink-1/40 px-6 pt-5 pb-4">
          <div aria-hidden className="hud-grid pointer-events-none absolute inset-0 opacity-50" />
          <div aria-hidden className="pointer-events-none absolute -top-24 -right-16 hidden h-64 w-96 rounded-full bg-plasma/10 blur-3xl vivid:block" />
          <div aria-hidden className="pointer-events-none absolute -bottom-28 left-10 hidden h-56 w-80 rounded-full bg-neon/10 blur-3xl vivid:block" />
          <div className="relative flex flex-wrap items-end justify-between gap-6">
            <div className="min-w-0">
              <div className="label-xs flex items-center gap-2">
                <span className="grid h-5 w-5 place-items-center rounded-md border border-neon/30 bg-neon/10 text-neon vivid:shadow-[0_0_10px_#22d3ee44]"><Activity size={11} /></span>
                Regime lab
                <span className="h-px w-10 bg-gradient-to-r from-line-2 to-transparent vivid:from-neon/60" />
              </div>
              <h1 className="mt-2 font-display text-[34px] leading-tight font-semibold tracking-tight">
                One correction does not fit <span className="text-gradient">all weather.</span>
              </h1>
              <p className="mt-1.5 max-w-3xl text-sm text-fg-2">Mean rainfall and the raw model's error for each synoptic regime over the test seasons, at Day-1. Each regime's error has its own shape, so VARSHA first names the regime, then routes to a specialist.</p>
            </div>
            <div className="flex shrink-0 items-center gap-2 font-mono text-[10px] text-fg-3">
              <span className="chip text-neon calm:text-neon-2"><Sparkles size={11} /> {meta.regimes.length} regimes</span>
            </div>
          </div>
          {/* regime spectrum strip: segment width = share of test days */}
          <div className="relative mt-4">
            <div className="flex h-2 w-full overflow-hidden rounded-full bg-line/50 vivid:shadow-[inset_0_1px_2px_#00000099]">
              {meta.regimes.map((r, k) => (
                <motion.div key={r.key} initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.15 + k * 0.06, duration: 0.5, ease: 'easeOut' }}
                  className="h-full origin-left border-r border-void/70 last:border-r-0"
                  style={{ width: `${(V.regime_days[k] / totalDays) * 100}%`, background: REGIME_COLORS[k], boxShadow: glow(`0 0 12px ${REGIME_COLORS[k]}aa`) }} />
              ))}
            </div>
            <div className="mt-1.5 flex w-full">
              {meta.regimes.map((r, k) => (
                <div key={r.key} title={`${r.short} · ${V.regime_days[k]} test days`} className="min-w-0 truncate pr-1 font-mono text-[9.5px] text-fg-3" style={{ width: `${(V.regime_days[k] / totalDays) * 100}%` }}>
                  <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full align-middle" style={{ background: REGIME_COLORS[k] }} />
                  {r.short} <span className="text-fg-3/70 calm:text-fg-3">{Math.round((V.regime_days[k] / totalDays) * 100)}%</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* ── regime atlas ────────────────────────────────────────────── */}
        <Panel title="Regime atlas · composite over test seasons (Day-1)" right={<Seg value={field} onChange={setField} options={FIELDS.map((f) => ({ v: f.v, label: f.label }))} />}>
          <div className="grid grid-cols-2 gap-4 px-4 pb-4 md:grid-cols-3 xl:grid-cols-6">
            {meta.regimes.map((r, k) => {
              const Icon = REGIME_ICON[k]
              const col = REGIME_COLORS[k]
              return (
                <motion.div key={r.key} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: k * 0.05 }}
                  whileHover={{ y: -3 }}
                  className="group relative overflow-hidden rounded-xl border p-2.5 transition-shadow duration-300"
                  style={vivid
                    ? { borderColor: col + '55', background: `radial-gradient(120% 70% at 50% 0%, ${col}1f, transparent 60%), linear-gradient(180deg, #0b1322cc, #070c16e6)`, boxShadow: `0 10px 30px -18px ${col}` }
                    : { borderColor: col + '4d', background: 'var(--color-ink-1)' }}>
                  <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px" style={{ background: vivid ? `linear-gradient(90deg, transparent, ${col}, transparent)` : col }} />
                  <div aria-hidden className="pointer-events-none absolute inset-0 rounded-xl opacity-0 transition-opacity duration-300 group-hover:opacity-100" style={{ boxShadow: vivid ? `inset 0 0 0 1px ${col}99, 0 0 24px -6px ${col}` : `inset 0 0 0 1px ${col}99` }} />
                  <div className="relative mb-1.5 flex items-center justify-between gap-1">
                    <div className="flex min-w-0 items-center gap-1.5 text-[12px] font-medium" style={{ color: dataInk(col) }}>
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full" style={vivid ? { background: `radial-gradient(circle at 35% 30%, ${col}55, ${col}14 70%)`, boxShadow: `0 0 10px ${col}55, inset 0 0 0 1px ${col}66` } : { background: col + '24', boxShadow: `inset 0 0 0 1px ${col}66` }}><Icon size={12} /></span>
                      <span className="truncate">{r.short}</span>
                    </div>
                    <span className="shrink-0 rounded-full border border-line-2/70 bg-void/60 px-1.5 py-px font-mono text-[9.5px] text-fg-2 tabnum">{comp?.n[k] ?? 0} d</span>
                  </div>
                  <div className="relative flex justify-center">
                    {maps[k]
                      ? <div className="transition-transform duration-300 ease-out group-hover:scale-[1.035]"><MiniMap meta={meta} values={maps[k].v} color={isBias ? divF : seqF} states={states} width={196} /></div>
                      : <div className="skeleton h-[230px] w-[196px] rounded-lg" />}
                  </div>
                  {maps[k] && (
                    <div className="relative mt-1.5 flex items-center justify-center gap-1.5 border-t border-line/70 pt-1.5 font-mono text-[10px] text-fg-2">
                      <span className="h-1 w-1 rounded-full" style={{ background: col, boxShadow: glow(`0 0 6px ${col}`) }} />
                      {isBias ? `mean |error| ${maps[k].mae.toFixed(1)} mm` : `mean ${(maps[k].v.reduce((a, b) => a + b, 0) / maps[k].v.length).toFixed(1)} mm/day`}
                    </div>
                  )}
                </motion.div>
              )
            })}
          </div>
          <div className="mx-4 mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-line/60 bg-void/40 px-3 py-2 font-mono text-[10px] text-fg-3">
            <span className="label-xs text-fg-2">scale</span>
            {isBias ? (
              <>
                <span>drier than obs</span>
                <div className="h-2.5 w-56 rounded-full ring-1 ring-line-2/70" style={{ background: `linear-gradient(90deg, ${DIV.join(',')})` }} />
                <span>wetter than obs</span><span className="ml-2">(−15 … +15 mm/day)</span>
              </>
            ) : (
              <>
                <span>0</span>
                <div className="h-2.5 w-56 rounded-full ring-1 ring-line-2/70" style={{ background: `linear-gradient(90deg, ${SEQ.join(',')})` }} />
                <span>40+ mm/day (sqrt scale)</span>
              </>
            )}
          </div>
        </Panel>

        {/* ── classifier diagnostics ──────────────────────────────────── */}
        <div className="grid gap-5 lg:grid-cols-3">
          <Panel title="Regime classifier · accuracy by lead">
            <div className="px-4">
              <div className="flex items-center gap-4 rounded-xl border border-line/60 p-3 vivid:bg-gradient-to-br vivid:from-neon/[0.06] vivid:to-transparent">
                <Ring value={rc.accuracy} size={84} stroke={6} color="var(--color-neon)">
                  <Brain size={22} className="text-neon-2 vivid:drop-shadow-[0_0_6px_#22d3ee]" />
                </Ring>
                <div className="flex-1 space-y-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="label-xs">accuracy</div>
                    <div className="kpi-number font-display text-2xl font-semibold text-neon-2 glow-text">{(rc.accuracy * 100).toFixed(1)}%</div>
                  </div>
                  <div className="flex items-baseline justify-between gap-2 border-t border-line/60 pt-1.5">
                    <div className="label-xs">macro-F1</div>
                    <div className="kpi-number font-display text-xl font-semibold">{rc.macro_f1.toFixed(3)}</div>
                  </div>
                  <div className="flex items-baseline justify-between gap-2 border-t border-line/60 pt-1.5">
                    <div className="label-xs">rule baseline</div>
                    <div className="kpi-number font-display text-xl font-semibold text-raw-2">{(rc.rule_accuracy * 100).toFixed(0)}%</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="h-[200px] px-2 pb-3">
              <ResponsiveContainer>
                <LineChart data={accLead} margin={{ top: 12, right: 16, bottom: 0, left: -12 }}>
                  <CartesianGrid stroke="var(--color-line)" strokeDasharray="2 4" vertical={false} />
                  <XAxis dataKey="lead" {...AX} />
                  <YAxis {...AX} domain={[0, 1]} />
                  <Tooltip {...TT} cursor={{ stroke: 'var(--color-line-2)', strokeDasharray: '3 3' }} formatter={(v) => `${(Number(v) * 100).toFixed(1)}%`} />
                  <Legend wrapperStyle={{ fontSize: 10, fontFamily: 'JetBrains Mono' }} formatter={vivid ? undefined : legendText} />
                  <Line dataKey="ml" name="VARSHA classifier" stroke="var(--color-neon)" strokeWidth={3} dot={{ r: 3.5, fill: DOT_BG, strokeWidth: 2 }} activeDot={{ r: 5, fill: 'var(--color-neon)', stroke: DOT_BG, strokeWidth: 2 }} />
                  <Line dataKey="rule" name="Threshold rules" stroke="var(--color-raw)" strokeWidth={1.6} strokeDasharray="4 3" dot={{ r: 2.5, fill: DOT_BG, strokeWidth: 1.5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Panel>
          <Panel title="Confusion · row %" right={<Seg value={cm} onChange={setCm} options={[{ v: 'all', label: 'All' }, { v: 'd1', label: 'D1' }]} className="flex-nowrap" />}>
            <div className="px-4 pb-4">
              <div className="flex justify-center rounded-xl border border-line/60 bg-void/30 py-2">
                <ConfusionMatrix m={cm === 'all' ? rc.confusion : rc.confusion_lead1} labels={meta.regimes.map((r) => r.short)} colors={REGIME_COLORS} size={360} />
              </div>
              <div className="mt-2 font-mono text-[10px] text-fg-3">rows = true regime · columns = predicted · diagonal = correct</div>
            </div>
          </Panel>
          <Panel title="What the classifier looks at · permutation importance">
            <div className="mx-4 flex items-center gap-2 font-mono text-[10px] text-fg-3">
              <span className="inline-block h-2 w-2 rounded-sm bg-neon vivid:shadow-[0_0_6px_#22d3ee]" /> top 3
              <span className="ml-2 inline-block h-2 w-2 rounded-sm bg-fg-3 vivid:bg-[#2f86d6]" /> others
              <span className="ml-auto">accuracy drop when shuffled</span>
            </div>
            <div className="h-[330px] px-2 pb-3">
              <ResponsiveContainer>
                <BarChart data={imp} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 60 }}>
                  <CartesianGrid stroke="var(--color-line)" strokeDasharray="2 4" horizontal={false} />
                  <XAxis type="number" {...AX} />
                  <YAxis type="category" dataKey="name" {...AX} width={150} tick={{ fill: 'var(--color-fg-2)', fontSize: 10.5 }} />
                  <Tooltip {...TT} cursor={{ fill: 'var(--color-fg)', fillOpacity: 0.035 }} formatter={(v) => Number(v).toFixed(3)} />
                  <Bar dataKey="v" name="accuracy drop" radius={[0, 4, 4, 0]} maxBarSize={14} background={{ fill: 'var(--color-fg)', fillOpacity: vivid ? 0.02 : 0.04, radius: 4 }}>
                    {imp.map((_, i) => <Cell key={i} fill={i < 3 ? 'var(--color-neon)' : vivid ? '#2f86d6' : 'var(--color-fg-3)'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        </div>

        {/* ── regime playbook ─────────────────────────────────────────── */}
        <Panel title="Regime playbook · what goes wrong, what the expert does">
          <div className="grid gap-4 px-4 pb-4 md:grid-cols-2 xl:grid-cols-3">
            {meta.regimes.map((r, k) => {
              const Icon = REGIME_ICON[k]
              const col = REGIME_COLORS[k]
              const ets = (m: string) => V.by_regime[m][k].cat['64.5'].ets ?? 0
              const eR = ets('RAW'), eV = ets('VARSHA'), eMax = Math.max(eR, eV, 1e-6)
              return (
                <motion.div key={r.key} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }} transition={{ delay: (k % 3) * 0.06 }}
                  whileHover={{ y: -3 }}
                  className="group relative flex flex-col overflow-hidden rounded-xl border p-4"
                  style={{ borderColor: col + '44', background: vivid ? `radial-gradient(90% 60% at 0% 0%, ${col}1a, transparent 60%), linear-gradient(180deg, #0b1322b3, #070c16d9)` : 'var(--color-ink-1)' }}>
                  <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[2px]" style={{ background: vivid ? `linear-gradient(90deg, ${col}, ${col}00 80%)` : col, boxShadow: glow(`0 0 12px ${col}`) }} />
                  <div aria-hidden className="pointer-events-none absolute inset-0 rounded-xl opacity-0 transition-opacity duration-300 group-hover:opacity-100" style={{ boxShadow: vivid ? `inset 0 0 0 1px ${col}88, 0 0 28px -8px ${col}` : `inset 0 0 0 1px ${col}88` }} />
                  <div aria-hidden className="pointer-events-none absolute -top-3 -right-3 opacity-[0.07] transition-transform duration-500 group-hover:scale-110" style={{ color: col }}><Icon size={96} /></div>
                  <div className="relative flex items-center gap-2.5">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl" style={vivid ? { background: `radial-gradient(circle at 35% 30%, ${col}55, ${col}14 70%)`, boxShadow: `0 0 14px ${col}44, inset 0 0 0 1px ${col}66` } : { background: col + '24', boxShadow: `inset 0 0 0 1px ${col}66` }}><Icon size={17} color={vivid ? col : dataInk(col)} /></div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold" style={{ color: dataInk(col) }}>{t(r.name)}</div>
                      <div className="font-mono text-[10px] text-fg-3">F1 <span className="text-fg-2">{rc.per_class_f1[k].toFixed(2)}</span> · {V.regime_days[k]} test days</div>
                    </div>
                  </div>
                  <p className="relative mt-2.5 text-[12px] text-fg-2">{r.desc}</p>
                  <div className="relative mt-3 grid flex-1 grid-cols-[1fr_auto_1fr] items-stretch gap-1.5 text-[11.5px]">
                    <div className="rounded-lg border border-raw/25 bg-raw/[0.06] p-2.5">
                      <div className="mb-1 flex items-center gap-1 font-mono text-[9.5px] tracking-wider text-raw-2"><AlertTriangle size={10} /> NWP ERROR</div>
                      <div className="text-fg-2">{PHYSICS[k].err}</div>
                    </div>
                    <div className="grid place-items-center">
                      <div className="grid h-6 w-6 place-items-center rounded-full border border-line-2 bg-ink-2 text-neon vivid:shadow-[0_0_10px_#22d3ee33]"><ArrowRight size={12} /></div>
                    </div>
                    <div className="rounded-lg border border-neon/25 bg-neon/[0.05] p-2.5">
                      <div className="mb-1 flex items-center gap-1 font-mono text-[9.5px] tracking-wider text-neon"><Wand2 size={10} /> EXPERT</div>
                      <div className="text-fg-2">{PHYSICS[k].fix}</div>
                    </div>
                  </div>
                  <div className="relative mt-3 rounded-lg border border-line/60 bg-void/40 px-3 py-2 font-mono text-[10.5px]">
                    <div className="mb-1.5 flex items-center gap-2">
                      <Brain size={12} className="text-plasma" /> <span className="text-fg-2">ETS≥64.5</span>
                      <span className="ml-auto text-raw-2">{eR.toFixed(3)}</span> → <span className="text-neon-2">{eV.toFixed(3)}</span>
                    </div>
                    <div className="grid grid-cols-[46px_1fr] items-center gap-x-2 gap-y-1 text-[9.5px] text-fg-3">
                      <span>RAW</span><UIBar value={eR} max={eMax} color="var(--color-raw)" h={4} />
                      <span>VARSHA</span><UIBar value={eV} max={eMax} color="var(--color-neon)" h={4} />
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </Panel>
      </div>
    </div>
  )
}
