import { useEffect, useId, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { CalendarRange, Crosshair, LineChart as LineIcon, MapPin, X } from 'lucide-react'
import { Bar as RBar, BarChart, CartesianGrid, Legend as RLegend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, Area, AreaChart } from 'recharts'
import type { DayData, Meta, Series } from '../lib/types'
import { loadDay, loadSeries } from '../lib/data'
import { RAIN_CLASSES, WARN, rainClass } from '../lib/colors'
import { useStore } from '../lib/store'
import { glow, theme } from '../lib/theme'
import { useT } from '../lib/i18n'
import { Ring, WarnChip, addDays, fmtDate } from './ui'

const AX = { stroke: 'var(--color-line-2)', tick: { fill: 'var(--color-fg-3)', fontSize: 10, fontFamily: 'JetBrains Mono' } }
// tooltip surface/shadow come from the theme (index.css --tt-shadow carries the neon glow)
const TT = { contentStyle: { background: 'var(--panel-bg-strong)', border: '1px solid var(--color-line-2)', borderRadius: 10, fontSize: 11, fontFamily: 'JetBrains Mono', boxShadow: 'var(--tt-shadow)' }, labelStyle: { color: 'var(--color-fg-2)' } }
// legend text stays neutral ink (series colour only in the swatch)
const legendText = (v: string) => <span style={{ color: 'var(--color-fg-2)' }}>{v}</span>
const LG = { wrapperStyle: { fontSize: 10, fontFamily: 'JetBrains Mono' }, formatter: legendText, iconSize: 9 }

function ChartCard({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <section className="relative overflow-hidden rounded-xl border border-line bg-ink-2/60 px-3 pt-2.5 pb-2 vivid:bg-transparent vivid:bg-gradient-to-b vivid:from-ink-2/70 vivid:to-ink-1/40 vivid:shadow-[inset_0_1px_0_#ffffff0a]">
      <span aria-hidden className="pointer-events-none absolute inset-x-6 top-0 hidden h-px bg-gradient-to-r from-transparent via-neon/50 to-transparent vivid:block" />
      <span aria-hidden className="pointer-events-none absolute -top-10 -right-10 hidden h-24 w-24 rounded-full bg-neon/5 blur-2xl vivid:block" />
      <div className="label-xs relative mb-1 flex items-center gap-1.5"><LineIcon size={10} className="text-neon/70" />{title}</div>
      <div className="relative">{children}</div>
    </section>
  )
}

export default function DistrictDrawer({ meta, day }: { meta: Meta; day: DayData | null }) {
  const t = useT()
  const { selected, lead, timeline, dateIdx, set } = useStore()
  const [series, setSeries] = useState<Series | null>(null)
  const [outlook, setOutlook] = useState<{ date: string; w: number; cor: number; ph: number }[]>([])
  const d = selected !== null ? meta.districts[selected] : null
  const issue = day ? addDays(day.date, -lead) : null

  useEffect(() => { if (selected !== null) loadSeries(selected).then(setSeries) }, [selected])
  useEffect(() => {
    if (selected === null || !issue) return
    const dates = [1, 2, 3, 4, 5].map((l) => addDays(issue, l))
    Promise.all(dates.map((ds) => (meta.dates.includes(ds) ? loadDay(ds) : Promise.resolve(null)))).then((days) =>
      setOutlook(days.map((dd, i) => ({ date: dates[i], w: dd ? dd.d.warn[i][selected] : -1, cor: dd ? dd.d.corx[i][selected] : 0, ph: dd ? dd.d.ph[i][selected] : 0 }))))
  }, [selected, issue, meta.dates])

  const li = lead - 1
  const evo = day && d ? [5, 4, 3, 2, 1].map((l) => ({ name: `D-${l}`, raw: day.d.rawx[l - 1][d.id], varsha: day.d.corx[l - 1][d.id] })) : []
  const year = timeline[dateIdx]?.date.slice(0, 4)
  const seasonDays = timeline.map((x, i) => ({ x, i })).filter((o) => o.x.date.startsWith(year ?? ''))
  const ts = series ? seasonDays.map(({ x, i }) => ({ date: x.date.slice(5), obs: series.obsx[i], raw: series.raw1[i], varsha: series.corx1[i], ph: series.ph1[i] })) : []
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const V = theme().fx.vivid

  return (
    <AnimatePresence>
      {d && day && (
        <motion.aside key="drawer" initial={{ x: 460, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 460, opacity: 0 }} transition={{ type: 'spring', damping: 26, stiffness: 240 }}
          className="glass-strong absolute top-3 right-3 bottom-3 z-30 w-[440px] overflow-y-auto rounded-2xl">
          <div className="sticky top-0 z-10 overflow-hidden rounded-t-2xl border-b border-line bg-ink-1/90 px-5 py-4 backdrop-blur">
            <div aria-hidden className="pointer-events-none absolute inset-0 hidden vivid:block">
              <div className="hud-grid absolute inset-0 opacity-50" />
              <div className="absolute -top-16 -left-10 h-40 w-56 rounded-full bg-neon/15 blur-3xl" />
              <div className="absolute -top-12 right-0 h-32 w-40 rounded-full bg-plasma/15 blur-3xl" />
              <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-neon/60 via-plasma/40 to-transparent" />
            </div>
            <div className="relative flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="label-xs flex items-center gap-1.5"><MapPin size={11} className="text-neon" />{t('District')} · {d.lat.toFixed(2)}°N {d.lon.toFixed(2)}°E · {d.ncell} grid cells</div>
                <h2 className="mt-0.5 truncate font-display text-[26px] leading-tight font-semibold tracking-tight">
                  <span className="text-gradient vivid:[filter:drop-shadow(0_0_14px_#22d3ee40)]">{d.name}</span>
                </h2>
                <div className="flex items-center gap-2 text-sm text-fg-2">
                  <span className="h-px w-4 bg-fg-3/60 vivid:bg-transparent vivid:bg-gradient-to-r vivid:from-neon vivid:to-transparent" />{d.state}
                </div>
              </div>
              <button className="group rounded-lg border border-line bg-ink-2/70 p-1.5 text-fg-2 transition hover:rotate-90 hover:border-line-2 hover:bg-ink-3 hover:text-fg vivid:hover:border-neon/40 vivid:hover:shadow-[0_0_14px_-4px_#22d3ee]" onClick={() => set({ selected: null })}><X size={18} /></button>
            </div>
            <div className="relative mt-2.5 flex flex-wrap items-center gap-2"><WarnChip level={day.d.warn[li][d.id]} t={t} /><span className="flex items-center gap-1 rounded-md border border-line/80 bg-ink-2/60 px-1.5 py-0.5 font-mono text-[10.5px] text-fg-3"><Crosshair size={10} className="text-neon/70" />valid {fmtDate(day.date)} · {t('Day')}-{lead}</span></div>
          </div>

          <div className="space-y-5 px-5 py-4">
            {(() => {
              const tiles = [
                { l: 'Raw NWP', m: day.d.raw[li][d.id], x: day.d.rawx[li][d.id], c: 'var(--color-raw-2)' },
                { l: 'VARSHA', m: day.d.cor[li][d.id], x: day.d.corx[li][d.id], c: 'var(--color-neon-2)' },
                { l: 'Observed', m: day.d.obs[d.id], x: day.d.obsx[d.id], c: 'var(--color-fg)' },
              ]
              const top = Math.max(1, ...tiles.map((b) => b.x))
              return (
                <section className="grid grid-cols-3 gap-2">
                  {tiles.map((b) => (
                    <div key={b.l} className="group relative overflow-hidden rounded-xl border border-line bg-ink-2 p-2.5 transition duration-300 hover:border-line-2 vivid:bg-transparent vivid:bg-gradient-to-b vivid:from-ink-3/60 vivid:to-ink-2/40 vivid:shadow-[inset_0_1px_0_#ffffff0d] vivid:hover:-translate-y-px">
                      <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 hidden h-px opacity-60 vivid:block vivid:opacity-100" style={{ background: `linear-gradient(90deg, transparent, ${b.c}, transparent)` }} />
                      <span aria-hidden className="pointer-events-none absolute -top-8 left-1/2 hidden h-12 w-3/4 -translate-x-1/2 rounded-full opacity-[0.12] blur-xl vivid:block" style={{ background: b.c }} />
                      <div className="label-xs relative">{b.l}</div>
                      <div className="kpi-number relative text-xl font-semibold" style={{ color: b.c }}>{b.m.toFixed(1)}<span className="ml-0.5 font-mono text-[10px] font-normal tracking-normal text-fg-3 [text-shadow:none]">mm</span></div>
                      <div className="relative font-mono text-[10px] text-fg-3">max {b.x.toFixed(0)} · {rainClass(b.x) >= 0 ? RAIN_CLASSES[rainClass(b.x)].label : 'dry'}</div>
                      <div aria-hidden className="relative mt-1.5 h-1 overflow-hidden rounded-full bg-line/60 calm:bg-line/80 vivid:shadow-[inset_0_1px_1px_#00000099]">
                        <motion.div className="h-full rounded-full" initial={{ width: 0 }} animate={{ width: `${(b.x / top) * 100}%` }} transition={{ duration: 0.5, ease: 'easeOut' }}
                          style={{ background: V ? `linear-gradient(90deg, color-mix(in srgb, ${b.c} 40%, transparent), ${b.c})` : b.c, boxShadow: glow(`0 0 8px color-mix(in srgb, ${b.c} 53%, transparent)`) }} />
                      </div>
                    </div>
                  ))}
                </section>
              )
            })()}

            <section className="relative overflow-hidden rounded-xl border border-line px-2 pt-2.5 pb-3 vivid:bg-[radial-gradient(120%_90%_at_50%_0%,#ec7a3f14,transparent_60%)]">
              <div className="label-xs mb-2 px-1">{t('Probability')} of heaviest cell exceeding IMD thresholds</div>
              <div className="flex justify-around">
                {[
                  { l: 'Heavy ≥ 64.5', v: day.d.ph[li][d.id] },
                  { l: 'V. heavy ≥ 115.6', v: day.d.pvh[li][d.id] },
                  { l: 'Extr. heavy ≥ 204.5', v: day.d.pxh[li][d.id] },
                ].map((g) => (
                  <div key={g.l} className="flex flex-col items-center gap-1.5">
                    <div className="relative">
                      <span aria-hidden className="absolute inset-2 hidden rounded-full bg-prob blur-xl vivid:block" style={{ opacity: 0.08 + 0.25 * (g.v / 100) }} />
                      <Ring value={g.v / 100} size={74} color="var(--color-prob)"><span className="kpi-number text-lg font-semibold text-fg">{g.v}%</span></Ring>
                    </div>
                    <span className="rounded-full border border-line/80 bg-ink-2/60 px-2 py-px font-mono text-[10px] text-fg-2">{g.l}</span>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <div className="label-xs mb-2 flex items-center gap-1.5"><CalendarRange size={10} className="text-neon/70" />5-day outlook · issued {issue && fmtDate(issue)}</div>
              <div className="relative">
                <div aria-hidden className="absolute top-1/2 right-3 left-3 h-px -translate-y-1/2 bg-line-2 vivid:bg-transparent vivid:bg-gradient-to-r vivid:from-neon/30 vivid:via-line-2 vivid:to-plasma/30" />
                <div className="relative grid grid-cols-5 gap-1.5">
                  {outlook.map((o, i) => {
                    const col = o.w >= 0 ? WARN[o.w].color : 'var(--color-fg-3)'
                    const bg = V
                      ? (o.w > 0 ? `linear-gradient(180deg, ${col}2e, ${col}0d 70%, #0b1322)` : 'linear-gradient(180deg, #0f1a2e, #0b1322)')
                      : (o.w > 0 ? col + '1c' : 'var(--color-ink-2)')
                    return (
                      <div key={o.date} className="relative overflow-hidden rounded-lg border p-1.5 text-center transition duration-300 hover:-translate-y-0.5"
                        style={{ borderColor: o.w >= 0 ? col + '66' : 'var(--color-line)', background: bg, boxShadow: glow(o.w >= 2 ? `0 0 18px -8px ${col}, inset 0 1px 0 #ffffff14` : 'inset 0 1px 0 #ffffff0a') }}>
                        {o.w > 0 && <span aria-hidden className="absolute inset-x-0 top-0 h-[2px]" style={{ background: col, boxShadow: glow(`0 0 8px ${col}`) }} />}
                        <div className="font-mono text-[9.5px] text-fg-3">{t('Day')}-{i + 1}</div>
                        <div className="text-[11px] text-fg">{fmtDate(o.date, { day: 'numeric', month: 'short' })}</div>
                        <div className="mt-0.5 font-mono text-[10px] font-semibold" style={{ color: o.w < 0 || V ? col : WARN[o.w].text }}>{o.w >= 0 ? t(WARN[o.w].name) : '—'}</div>
                        <div className="font-mono text-[9.5px] text-fg-2">{o.w >= 0 ? `${o.ph}%` : ''}</div>
                        {o.w >= 0 && (
                          <div aria-hidden className="mx-auto mt-1 h-[3px] w-full overflow-hidden rounded-full bg-line/70">
                            <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, o.ph))}%`, background: 'var(--color-prob)', boxShadow: glow('0 0 6px #ec7a3f') }} />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </section>

            <ChartCard title={<>Forecast evolution for {fmtDate(day.date, { day: 'numeric', month: 'short' })} · heaviest cell (mm)</>}>
              <div className="h-[170px]">
                <ResponsiveContainer>
                  <BarChart data={evo} barGap={2} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                    <defs>
                      <linearGradient id={`${uid}-raw`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--color-raw)" /><stop offset="100%" stopColor="var(--color-raw)" stopOpacity={0.35} /></linearGradient>
                      <linearGradient id={`${uid}-var`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--color-neon)" /><stop offset="100%" stopColor="var(--color-neon)" stopOpacity={0.35} /></linearGradient>
                    </defs>
                    <CartesianGrid stroke="var(--color-line)" strokeDasharray="2 4" vertical={false} />
                    <XAxis dataKey="name" {...AX} />
                    <YAxis {...AX} />
                    <Tooltip {...TT} cursor={{ fill: 'var(--color-neon)', fillOpacity: 0.05 }} />
                    <RLegend {...LG} />
                    <ReferenceLine y={day.d.obsx[d.id]} stroke="var(--color-fg)" strokeWidth={1.5} label={{ value: `obs ${day.d.obsx[d.id].toFixed(0)}`, fill: 'var(--color-fg)', fontSize: 10, position: 'insideTopRight' }} />
                    <ReferenceLine y={64.5} stroke={WARN[1].text} strokeOpacity={V ? 0.5 : 0.7} strokeDasharray="4 3" />
                    <RBar dataKey="raw" name="Raw NWP" fill={V ? `url(#${uid}-raw)` : 'var(--color-raw)'} stroke="var(--color-raw)" strokeOpacity={0.6} radius={[4, 4, 0, 0]} maxBarSize={18} />
                    <RBar dataKey="varsha" name="VARSHA" fill={V ? `url(#${uid}-var)` : 'var(--color-neon)'} stroke="var(--color-neon)" strokeOpacity={0.7} radius={[4, 4, 0, 0]} maxBarSize={18} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            <ChartCard title={<>JJAS {year} · heaviest cell, {t('Day')}-1 forecasts vs observed (mm)</>}>
              <div className="h-[170px]">
                <ResponsiveContainer>
                  <LineChart data={ts} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                    <CartesianGrid stroke="var(--color-line)" strokeDasharray="2 4" vertical={false} />
                    <XAxis dataKey="date" {...AX} interval={29} />
                    <YAxis {...AX} />
                    <Tooltip {...TT} cursor={{ stroke: 'var(--color-neon)', strokeOpacity: 0.3 }} />
                    <RLegend {...LG} />
                    <ReferenceLine x={day.date.slice(5)} stroke="var(--color-neon)" strokeOpacity={0.6} strokeDasharray="3 3" />
                    <Line dataKey="obs" name="Observed" stroke="var(--color-fg)" dot={false} strokeWidth={1.5} />
                    <Line dataKey="raw" name="Raw NWP" stroke="var(--color-raw)" dot={false} strokeWidth={1.5} />
                    <Line dataKey="varsha" name="VARSHA" stroke="var(--color-neon)" dot={false} strokeWidth={2} activeDot={{ r: 4, fill: 'var(--color-neon)', stroke: 'var(--color-void)', strokeWidth: 2 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="divider-glow my-2" />
              <div className="label-xs mb-1">P(heavy) · {t('Day')}-1 (%)</div>
              <div className="h-[80px]">
                <ResponsiveContainer>
                  <AreaChart data={ts} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
                    <defs>
                      <linearGradient id={`${uid}-ph`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--color-prob)" stopOpacity={0.45} /><stop offset="100%" stopColor="var(--color-prob)" stopOpacity={0.02} /></linearGradient>
                    </defs>
                    <XAxis dataKey="date" {...AX} interval={29} />
                    <YAxis {...AX} domain={[0, 100]} ticks={[0, 50, 100]} />
                    <Tooltip {...TT} cursor={{ stroke: 'var(--color-prob)', strokeOpacity: 0.4 }} />
                    <Area dataKey="ph" name="P(heavy) %" stroke="var(--color-prob)" fill={`url(#${uid}-ph)`} fillOpacity={1} strokeWidth={1.5} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
