import { useEffect, useMemo, useState } from 'react'
import { CalendarClock, ChevronLeft, ChevronRight, Download, Grid3x3, Printer, Search, Timer } from 'lucide-react'
import { useStore } from '../lib/store'
import { loadDay } from '../lib/data'
import type { DayData } from '../lib/types'
import { RAIN_CLASSES, WARN } from '../lib/colors'
import { useT } from '../lib/i18n'
import { glow, theme } from '../lib/theme'
import { Panel, Seg, addDays, fmtDate } from '../components/ui'

interface Row { id: number; name: string; state: string; cells: { w: number; ph: number; pvh: number; mm: number; mean: number }[]; maxW: number; score: number }

export default function Districts() {
  const t = useT()
  const { meta, timeline, dateIdx, set, lang } = useStore()
  const issue = timeline[dateIdx]?.date
  const [days, setDays] = useState<(DayData | null)[]>([])
  const [q, setQ] = useState('')
  const [state, setState] = useState('All')
  const [minW, setMinW] = useState(1)

  useEffect(() => {
    if (!issue || !meta) return
    const ds = [1, 2, 3, 4, 5].map((l) => addDays(issue, l))
    Promise.all(ds.map((d) => (meta.dates.includes(d) ? loadDay(d) : Promise.resolve(null)))).then(setDays)
  }, [issue, meta])

  const rows: Row[] = useMemo(() => {
    if (!meta || !days.length) return []
    return meta.districts.map((d) => {
      const cells = days.map((dd, i) => dd
        ? { w: dd.d.warn[i][d.id], ph: dd.d.ph[i][d.id], pvh: dd.d.pvh[i][d.id], mm: dd.d.corx[i][d.id], mean: dd.d.cor[i][d.id] }
        : { w: -1, ph: 0, pvh: 0, mm: 0, mean: 0 })
      const maxW = Math.max(...cells.map((c) => c.w))
      return { id: d.id, name: d.name, state: d.state, cells, maxW, score: cells.reduce((a, c) => a + Math.max(0, c.w) * 100 + c.ph, 0) }
    })
  }, [meta, days])

  const statesList = useMemo(() => ['All', ...Array.from(new Set(meta?.districts.map((d) => d.state))).sort()], [meta])
  const shown = rows
    .filter((r) => (state === 'All' || r.state === state) && r.maxW >= minW && (q === '' || `${r.name} ${r.state}`.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => b.score - a.score)
  const counts = [0, 1, 2, 3, 4].map((i) => [1, 2, 3].map((lvl) => rows.filter((r) => r.cells[i]?.w === lvl).length))
  const dates = [1, 2, 3, 4, 5].map((l) => (issue ? addDays(issue, l) : ''))

  const csv = () => {
    const head = ['district', 'state', ...dates.flatMap((d, i) => [`D${i + 1}_${d}_warning`, `D${i + 1}_p_heavy_pct`, `D${i + 1}_p_vheavy_pct`, `D${i + 1}_max_mm`, `D${i + 1}_mean_mm`])]
    const lines = rows.map((r) => [r.name, r.state, ...r.cells.flatMap((c) => [c.w >= 0 ? WARN[c.w].name : 'NA', c.ph, c.pvh, c.mm.toFixed(1), c.mean.toFixed(1)])].map((x) => `"${x}"`).join(','))
    const blob = new Blob([[head.join(','), ...lines].join('\n')], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `varsha_district_bulletin_${issue}.csv`; a.click()
  }

  if (!meta || !issue) return null
  const V = theme().fx.vivid
  const dayTot = counts.map((c) => c[0] + c[1] + c[2])
  const maxTot = Math.max(1, ...dayTot)
  return (
    <div data-scroll className="print-page h-full overflow-y-auto">
      <div className="mx-auto max-w-[1500px] space-y-5 px-6 py-6">
        {/* ── bulletin header band ─────────────────────────────────────── */}
        <header className="glass hud-corners rounded-2xl print:rounded-none print:border-b print:border-neutral-300">
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit] print:hidden">
            <div className="hud-grid absolute inset-0 opacity-60" />
            <div className="absolute -top-24 -left-16 hidden h-64 w-64 rounded-full bg-neon/10 blur-3xl vivid:block" />
            <div className="absolute -right-10 -bottom-28 hidden h-64 w-80 rounded-full bg-plasma/10 blur-3xl vivid:block" />
            <div className="absolute inset-x-0 top-0 h-[3px] bg-neon vivid:bg-transparent vivid:bg-[linear-gradient(90deg,#22d3ee,#67e8f9_30%,#a78bfa_70%,#22d3ee00)] vivid:opacity-80" />
          </div>
          <div className="relative flex flex-wrap items-center justify-between gap-5 px-5 py-5">
            <div className="flex min-w-0 flex-1 items-center gap-5">
              <BulletinMark />
              <div className="min-w-0">
                <div className="label-xs flex items-center gap-2">
                  <span className="dot-live text-neon calm:after:hidden print:hidden" />
                  {lang === 'hi' ? 'ज़िला-स्तरीय उत्पाद' : 'District-level product'} · VARSHA · {t('Day')} 1–5
                </div>
                <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight print:text-black">
                  <span className="vivid:bg-[linear-gradient(95deg,#f8fafc_0%,#e6edf7_45%,#a5f3fc_80%,#c4b5fd_100%)] vivid:bg-clip-text vivid:text-transparent print:bg-none print:text-black">{t('District-wise Heavy Rainfall Warning')}</span>
                </h1>
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-neon-2 print:text-neutral-700">
                  <span className="chip normal-case tracking-normal"><CalendarClock size={11} />Issued {fmtDate(issue, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}, 0830 IST</span>
                  <span className="chip normal-case tracking-normal text-plasma print:text-neutral-700"><Timer size={11} />valid {fmtDate(dates[0])} – {fmtDate(dates[4])}</span>
                  <span className="chip text-fg-2 print:text-neutral-700"><Grid3x3 size={11} />{meta.districts.length} districts · 0.25°</span>
                </div>
                <p className="mt-2 max-w-4xl text-[12.5px] leading-relaxed text-fg-3">colour from calibrated P(heavy / very heavy / extremely heavy) at the heaviest grid cell in each district</p>
              </div>
            </div>
            <div className="no-print flex flex-wrap items-center gap-2">
              <div className="flex items-center rounded-xl border border-line bg-ink-1/70 p-0.5 calm:shadow-[inset_0_1px_2px_rgba(0,0,0,0.06)] vivid:shadow-[inset_0_1px_2px_#00000080]">
                <button className="btn-seg flex items-center gap-1 rounded-lg" onClick={() => set({ dateIdx: Math.max(0, dateIdx - 1) })}><ChevronLeft size={13} />prev issue</button>
                <span className="mx-0.5 h-4 w-px bg-line-2" />
                <button className="btn-seg flex items-center gap-1 rounded-lg" onClick={() => set({ dateIdx: Math.min(timeline.length - 1, dateIdx + 1) })}>next issue<ChevronRight size={13} /></button>
              </div>
              <button onClick={csv} className="btn-seg flex items-center gap-1.5 border border-neon/30 bg-neon/5 text-neon-2 vivid:hover:shadow-[0_0_18px_-6px_#22d3ee]"><Download size={13} />{t('Export CSV')}</button>
              <button onClick={() => window.print()} className="btn-seg flex items-center gap-1.5 border border-plasma/30 bg-plasma/5 text-plasma vivid:text-[#c4b5fd] vivid:hover:shadow-[0_0_18px_-6px_#a78bfa]"><Printer size={13} />{t('Print bulletin')}</button>
            </div>
          </div>
        </header>

        {/* ── day summary cards ────────────────────────────────────────── */}
        <div className="grid grid-cols-5 gap-3">
          {dates.map((d, i) => (
            <div key={d} className="glass edge-top group rounded-xl p-3 transition duration-300 hover:-translate-y-0.5 print:translate-y-0">
              <div className="flex items-baseline justify-between gap-2">
                <div className="label-xs">{t('Day')}-{i + 1} · {fmtDate(d, { day: 'numeric', month: 'short' })}</div>
                <div aria-hidden className="font-display text-[22px] leading-none font-semibold text-line-2 transition-colors group-hover:text-neon/40 print:hidden">0{i + 1}</div>
              </div>
              <div className="mt-2 flex gap-2">
                {[3, 2, 1].map((lvl, j) => {
                  const n = counts[i][2 - j]
                  return (
                    <div key={lvl} className="relative flex-1 overflow-hidden rounded-lg border px-2 py-1.5 text-center" style={{ borderColor: WARN[lvl].color + (n ? '77' : '33'), background: V ? `linear-gradient(180deg, ${WARN[lvl].color}${n ? '26' : '0d'}, ${WARN[lvl].color}08)` : WARN[lvl].color + (n ? '1c' : '0a'), boxShadow: glow(n ? `0 0 16px -8px ${WARN[lvl].color}, inset 0 1px 0 #ffffff10` : 'inset 0 1px 0 #ffffff08') }}>
                      <div className="kpi-number text-xl font-semibold" style={{ color: V ? WARN[lvl].color : n ? WARN[lvl].text : 'var(--color-fg-3)', opacity: n || !V ? 1 : 0.55 }}>{n}</div>
                      <div className="font-mono text-[9px] tracking-wider text-fg-2 uppercase">{t(WARN[lvl].name)}</div>
                    </div>
                  )
                })}
              </div>
              <div aria-hidden className="mt-2.5 flex h-1.5 overflow-hidden rounded-full bg-line/60 calm:bg-line/80 vivid:shadow-[inset_0_1px_2px_#00000099]">
                {[2, 1, 0].map((k) => counts[i][k] > 0 && (
                  <div key={k} className="h-full transition-[width] duration-700" style={{ width: `${(counts[i][k] / maxTot) * 100}%`, background: WARN[k + 1].color, boxShadow: glow(`0 0 8px ${WARN[k + 1].color}`) }} />
                ))}
              </div>
            </div>
          ))}
        </div>

        <Panel title={`${shown.length} districts shown`} right={
          <div className="no-print flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-lg border border-line bg-ink-1/70 px-2 py-1 transition focus-within:border-neon/50 calm:shadow-[inset_0_1px_2px_rgba(0,0,0,0.06)] calm:focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-neon)_18%,transparent)] vivid:shadow-[inset_0_1px_2px_#00000080] vivid:focus-within:shadow-[0_0_0_3px_#22d3ee1f,inset_0_1px_2px_#00000080]">
              <Search size={13} className="text-fg-3" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Search district…')} className="w-40 bg-transparent text-[12px] outline-none placeholder:text-fg-3" />
            </div>
            <select value={state} onChange={(e) => setState(e.target.value)} className="rounded-lg border border-line bg-ink-1 px-2 py-1 text-[12px] text-fg-2 transition hover:border-line-2 focus:border-neon/50">
              {statesList.map((s) => <option key={s}>{s}</option>)}
            </select>
            <Seg value={minW} onChange={setMinW} options={[{ v: 0, label: 'All' }, { v: 1, label: '≥ Yellow' }, { v: 2, label: '≥ Orange' }, { v: 3, label: 'Red' }]} />
          </div>
        }>
          <div className="overflow-x-auto px-4 pb-4 xl:overflow-visible">
            <table className="w-full min-w-[980px] border-separate border-spacing-y-1 text-left">
              <thead>
                <tr className="font-mono text-[10.5px] tracking-wider text-fg-3 uppercase">
                  <th className="sticky top-0 z-10 rounded-l-lg border-b border-line-2 bg-ink-1/95 vivid:border-neon/20 px-2 py-1.5 font-normal backdrop-blur print:static print:bg-white">{t('District')}</th>
                  <th className="sticky top-0 z-10 border-b border-line-2 bg-ink-1/95 px-2 vivid:border-neon/20 py-1.5 font-normal backdrop-blur print:static print:bg-white">{t('State')}</th>
                  {dates.map((d, i) => <th key={d} className={`sticky top-0 z-10 border-b border-line-2 bg-ink-1/95 px-1 vivid:border-neon/20 py-1.5 text-center font-normal backdrop-blur print:static print:bg-white ${i === 4 ? 'rounded-r-lg' : ''}`}><span className="text-fg-2">{t('Day')}-{i + 1}</span><div className="normal-case tracking-normal text-fg-3">{fmtDate(d, { day: 'numeric', month: 'short' })}</div></th>)}
                </tr>
              </thead>
              <tbody>
                {shown.slice(0, 300).map((r) => (
                  <tr key={r.id} className="group cursor-pointer" onClick={() => set({ tab: 'console', selected: r.id, dateIdx: Math.min(timeline.length - 1, dateIdx + 1), lead: 1 })}>
                    <td className="relative rounded-l-lg bg-ink-2/60 px-2 py-1.5 pl-3 text-[12.5px] text-fg transition-colors group-hover:bg-ink-3 group-hover:text-neon-2">
                      <span aria-hidden className="absolute top-1.5 bottom-1.5 left-0 w-[3px] rounded-full opacity-70 transition group-hover:opacity-100 print:hidden" style={r.maxW > 0 ? { background: WARN[r.maxW].color, boxShadow: glow(`0 0 8px ${WARN[r.maxW].color}`) } : { background: 'var(--color-line-2)' }} />
                      {r.name}
                    </td>
                    <td className="bg-ink-2/60 px-2 py-1.5 text-[11.5px] text-fg-3 transition-colors group-hover:bg-ink-3">{r.state}</td>
                    {r.cells.map((c, i) => (
                      <td key={i} className={`px-1 py-1 ${i === 4 ? 'rounded-r-lg calm:group-hover:shadow-[inset_-2px_0_0_var(--color-neon)] vivid:group-hover:shadow-[inset_-2px_0_0_#22d3ee88]' : ''} bg-ink-2/60 transition-colors group-hover:bg-ink-3`}>
                        {c.w >= 0 ? (
                          <div className="relative flex items-center justify-between gap-2 overflow-hidden rounded-md px-2 py-1 transition-shadow" style={{ background: V ? `linear-gradient(90deg, ${WARN[c.w].color}${c.w ? '3a' : '14'}, ${WARN[c.w].color}${c.w ? '14' : '06'})` : WARN[c.w].color + (c.w ? '24' : '0e'), borderLeft: `3px solid ${WARN[c.w].color}`, boxShadow: glow(c.w >= 2 ? `0 0 14px -7px ${WARN[c.w].color}, inset 0 1px 0 #ffffff12` : 'inset 0 1px 0 #ffffff08') }}>
                            <span className="font-mono text-[10px] font-semibold uppercase" style={{ color: WARN[c.w].text }}>{t(WARN[c.w].name)}</span>
                            <span className="text-right font-mono text-[10px] leading-tight text-fg-2">
                              {c.mm.toFixed(0)} mm<br /><span className="text-fg-3 calm:dark:text-fg-2">{c.ph}%{c.pvh >= 10 ? ` · ${c.pvh}%` : ''}</span>
                            </span>
                            <span aria-hidden className="absolute bottom-0 left-0 h-[2px] rounded-r-full" style={{ width: `${Math.max(0, Math.min(100, c.ph))}%`, background: WARN[c.w].color, opacity: c.w ? 0.9 : 0.5, boxShadow: c.w ? glow(`0 0 6px ${WARN[c.w].color}`) : undefined }} />
                          </div>
                        ) : <div className="text-center font-mono text-[10px] text-fg-3">—</div>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {shown.length > 300 && <div className="mt-2 font-mono text-[11px] text-fg-3">showing 300 of {shown.length}; export CSV for all</div>}
            {shown.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-fg-3">
                <Search size={22} className="text-line-2" />
                No districts match these filters for this issue.
              </div>
            )}
          </div>
        </Panel>

        <div className="grid gap-3 md:grid-cols-4">
          {WARN.map((w, i) => (
            <div key={w.key} className="relative overflow-hidden rounded-xl border p-3 pl-4 transition duration-300 hover:-translate-y-0.5" style={{ borderColor: w.color + '55', background: V ? `linear-gradient(135deg, ${w.color}1c, ${w.color}06 60%)` : w.color + '12', boxShadow: glow(`0 12px 30px -22px ${w.color}, inset 0 1px 0 #ffffff0c`) }}>
              <span aria-hidden className="absolute top-0 bottom-0 left-0 w-[3px]" style={{ background: w.color, boxShadow: glow(`0 0 10px ${w.color}`) }} />
              <span aria-hidden className="absolute -top-8 -right-8 hidden h-20 w-20 rounded-full opacity-25 blur-2xl print:hidden vivid:block" style={{ background: w.color }} />
              <div className="relative flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase" style={{ color: V ? w.color : w.text }}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: w.color, boxShadow: glow(`0 0 6px ${w.color}`) }} />
                {t(w.name)} · {t(w.label)}
              </div>
              <div className="relative mt-0.5 text-[12px] text-fg-2">{t(w.action)}</div>
              <div className="relative mt-1.5 inline-block rounded-md border border-line bg-ink-1/60 px-1.5 py-0.5 font-mono text-[10px] text-fg-3 print:bg-white">
                {i === 0 && 'P(heavy) < 30%'}
                {i === 1 && 'P(heavy) ≥ 30%'}
                {i === 2 && 'P(heavy) ≥ 60% or P(very heavy) ≥ 30%'}
                {i === 3 && 'P(very heavy) ≥ 60% or P(extremely heavy) ≥ 35%'}
              </div>
            </div>
          ))}
        </div>
        <div className="divider-glow print:hidden" />
        <div className="text-[11px] text-fg-3">
          Amounts are the heaviest 0.25° cell in the district (mm/24 h ending 0830 IST). IMD categories: {RAIN_CLASSES.slice(2).map((c) => `${c.label} ${c.short}`).join(' · ')}.
        </div>
      </div>
    </div>
  )
}

/** Generic VARSHA bulletin seal: concentric rings, 24 ticks, raindrop. Not any official emblem. */
function BulletinMark() {
  const T = theme(), V = T.fx.vivid
  return (
    <div aria-hidden className="relative hidden h-[76px] w-[76px] shrink-0 sm:block">
      <div className="absolute inset-0 hidden rounded-full bg-neon/10 blur-xl print:hidden vivid:block" />
      <svg viewBox="0 0 80 80" className="relative h-full w-full">
        <defs>
          <linearGradient id="bm-g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={V ? '#67e8f9' : 'var(--color-neon)'} />
            <stop offset="100%" stopColor={V ? '#a78bfa' : 'var(--color-neon)'} />
          </linearGradient>
        </defs>
        <circle cx="40" cy="40" r="37" fill="var(--color-ink-1)" stroke={V ? 'url(#bm-g)' : 'var(--color-line-2)'} strokeWidth="1.5" />
        <g className={V ? 'origin-center motion-safe:animate-[spin_40s_linear_infinite]' : ''} style={{ transformBox: 'fill-box' }}>
          {Array.from({ length: 24 }, (_, k) => (
            <line key={k} x1="40" y1="6.5" x2="40" y2={k % 6 === 0 ? 12 : 9.5} stroke={k % 6 === 0 ? (V ? '#67e8f9' : 'var(--color-neon)') : 'var(--color-line-2)'} strokeWidth={k % 6 === 0 ? 1.6 : 1} transform={`rotate(${k * 15} 40 40)`} />
          ))}
        </g>
        <circle cx="40" cy="40" r="25" fill="none" stroke="var(--color-neon)" strokeOpacity="0.35" strokeDasharray="2 3" />
        <path d="M40 22 C46 31 51 37 51 44 a11 11 0 0 1 -22 0 C29 37 34 31 40 22Z" fill="url(#bm-g)" opacity="0.95" />
        <path d="M35.5 44.5 a5 5 0 0 0 4.5 5" fill="none" stroke={V ? '#ffffff' : T.mode === 'light' ? 'var(--color-ink-1)' : 'var(--color-fg)'} strokeOpacity="0.7" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    </div>
  )
}
