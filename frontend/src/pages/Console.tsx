import { useEffect, useMemo, useRef, useState } from 'react'
import { WebMercatorViewport, type MapViewState } from '@deck.gl/core'
import { motion } from 'motion/react'
import { useStore } from '../lib/store'
import { loadDay, loadGeo, loadGrid, prefetchDay } from '../lib/data'
import type { DayData, GridDay, Layer } from '../lib/types'
import MapView, { districtValue, type HoverInfo } from '../components/MapView'
import RegimePanel from '../components/RegimePanel'
import SituationPanel from '../components/SituationPanel'
import Timeline from '../components/Timeline'
import DistrictDrawer from '../components/DistrictDrawer'
import { LAYER_OPTS, Legend, LayerControls, RainOverlay, WarningTicker } from '../components/MapChrome'
import { WARN, rainClass, RAIN_CLASSES } from '../lib/colors'
import { useT } from '../lib/i18n'
import { useSize } from '../components/ui'

function fitIndia(w: number, h: number): MapViewState {
  const vp = new WebMercatorViewport({ width: Math.max(w, 400), height: Math.max(h, 300) })
  const padL = w > 1100 ? 345 : 20, padR = w > 1100 ? 365 : 20
  const { longitude, latitude, zoom } = vp.fitBounds([[68.2, 6.5], [97.4, 37.1]], { padding: { left: padL, right: padR, top: 16, bottom: 215 } })
  return { longitude, latitude, zoom, pitch: 0, bearing: 0 }
}

const NICE_KM = [25, 50, 100, 200, 250, 500, 1000, 2000]

/** Static-ish HUD chrome over the map: edge ruler, centre readout, compass, scale bar. Pure DOM, pointer-events-none. */
function MapHud({ vs }: { vs: MapViewState | null }) {
  if (!vs) return null
  const lat = vs.latitude, lon = vs.longitude
  const mpp = (40075016.686 * Math.cos((lat * Math.PI) / 180)) / (512 * Math.pow(2, vs.zoom))
  const km = NICE_KM.find((k) => (k * 1000) / mpp >= 70) ?? NICE_KM[NICE_KM.length - 1]
  const px = (km * 1000) / mpp
  const brg = vs.bearing ?? 0
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 select-none">
      <div className="absolute inset-x-6 top-0 h-2.5 bg-[repeating-linear-gradient(90deg,#22d3ee55_0_1px,transparent_1px_12px),repeating-linear-gradient(90deg,#22d3ee99_0_1px,transparent_1px_60px)] bg-[length:100%_5px,100%_10px] bg-no-repeat [mask-image:linear-gradient(90deg,transparent,black_18%,black_82%,transparent)]" />
      <div className="absolute top-4 right-2 flex items-center gap-2 rounded-md border border-neon/20 bg-ink-1/70 px-2 py-1 font-mono text-[9.5px] tracking-wider text-fg-3 shadow-[0_0_14px_-6px_#22d3ee] backdrop-blur-sm">
        <span className="text-neon/80">⌖</span>
        <span className="tabnum text-fg-2">{Math.abs(lat).toFixed(2)}°{lat >= 0 ? 'N' : 'S'} {Math.abs(lon).toFixed(2)}°{lon >= 0 ? 'E' : 'W'}</span>
        <span className="h-2.5 w-px bg-line-2" />
        <span className="tabnum">Z{vs.zoom.toFixed(1)}</span>
      </div>
      <div className="absolute right-2 bottom-1 flex items-end gap-3">
        <div className={`flex flex-col items-start gap-1 font-mono text-[9px] tracking-wider text-fg-3 transition-opacity duration-300 ${(vs.pitch ?? 0) > 2 ? 'opacity-0' : ''}`}>
          <span className="tabnum">{km} km</span>
          <div className="relative h-1.5 border-x border-b border-neon/70 shadow-[0_2px_6px_-2px_#22d3ee]" style={{ width: px }}>
            <span className="absolute bottom-0 left-1/2 h-1 w-px bg-neon/60" />
          </div>
        </div>
        <div className="relative grid h-11 w-11 place-items-center rounded-full border border-neon/25 bg-ink-1/60 shadow-[inset_0_0_12px_#22d3ee22,0_0_14px_-6px_#22d3ee] backdrop-blur-sm">
          <svg width={44} height={44} viewBox="-22 -22 44 44" className="absolute inset-0">
            {Array.from({ length: 24 }, (_, i) => {
              const a = (i * 15 * Math.PI) / 180, r0 = i % 6 === 0 ? 15.5 : 17.5
              return <line key={i} x1={Math.sin(a) * r0} y1={-Math.cos(a) * r0} x2={Math.sin(a) * 19.5} y2={-Math.cos(a) * 19.5} stroke="#22d3ee" strokeOpacity={i % 6 === 0 ? 0.7 : 0.3} strokeWidth={1} />
            })}
            <g transform={`rotate(${-brg})`}>
              <path d="M0,-12 L3,0 L0,2 L-3,0 Z" fill="#22d3ee" style={{ filter: 'drop-shadow(0 0 3px #22d3ee)' }} />
              <path d="M0,12 L3,0 L0,-2 L-3,0 Z" fill="#26395a" />
            </g>
          </svg>
          <span className="absolute -top-0.5 font-mono text-[8px] font-bold text-neon-2" style={{ transform: `rotate(${-brg}deg) translateY(-1px)`, transformOrigin: '50% 22px' }}>N</span>
        </div>
      </div>
    </div>
  )
}

export default function Console() {
  const t = useT()
  const { meta, timeline, dateIdx, lead, layer, mode, compare, selected, playing, set } = useStore()
  const [districts, setDistricts] = useState<GeoJSON.FeatureCollection | null>(null)
  const [states, setStates] = useState<GeoJSON.FeatureCollection | null>(null)
  const [day, setDay] = useState<DayData | null>(null)
  const [grid, setGrid] = useState<GridDay | null>(null)
  const [hover, setHover] = useState<HoverInfo | null>(null)
  const [ref, size] = useSize<HTMLDivElement>()
  const [vs, setVs] = useState<MapViewState | null>(null)
  const [split, setSplit] = useState(0.5)
  const [isDark, setIsDark] = useState(() => document.documentElement.getAttribute('data-theme') !== 'light')
  const fitted = useRef(false)
  const date = timeline[dateIdx]?.date

  const toggleTheme = () => {
    const next = isDark ? 'light' : 'dark'
    setIsDark(!isDark)
    document.documentElement.setAttribute('data-theme', next)
    localStorage.setItem('aegisx-theme', next)
  }

  useEffect(() => { loadGeo('districts').then(setDistricts); loadGeo('states').then(setStates) }, [])
  useEffect(() => {
    if (!meta || !date) return
    let live = true
    loadDay(date).then((d) => live && setDay(d))
    loadGrid(date, meta.grid.cells.length, meta.leads.length).then((g) => live && setGrid(g))
    const nxt = timeline[(dateIdx + 1) % timeline.length]?.date
    if (nxt) prefetchDay(nxt, meta.grid.cells.length, meta.leads.length)
    return () => { live = false }
  }, [date, meta, dateIdx, timeline])

  useEffect(() => {
    if (size.w && !fitted.current) { setVs(fitIndia(size.w, size.h)); fitted.current = true }
  }, [size])
  // own tween (deck's built-in transitions fight each other when two synced maps are mounted in swipe mode)
  useEffect(() => {
    if (!vs) return
    const from = { pitch: vs.pitch ?? 0, bearing: vs.bearing ?? 0, zoom: vs.zoom }
    const to = { pitch: mode === 'towers' ? 52 : 0, bearing: mode === 'towers' ? -12 : 0, zoom: from.zoom + (mode === 'towers' ? 0.25 : from.pitch > 0 ? -0.25 : 0) }
    if (from.pitch === to.pitch && from.bearing === to.bearing) return
    let raf = 0
    const t0 = performance.now()
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / 700), e = 1 - Math.pow(1 - k, 3)
      setVs((v) => v && { ...v, pitch: from.pitch + (to.pitch - from.pitch) * e, bearing: from.bearing + (to.bearing - from.bearing) * e, zoom: from.zoom + (to.zoom - from.zoom) * e })
      if (k < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [mode])

  const intensity = useMemo(() => (day ? Math.min(1, day.stats[lead - 1].cor_mean / 14) : 0.2), [day, lead])
  if (!meta) return null
  const hovered = hover && day ? meta.districts[hover.id] : null
  const leftLayer: Layer = 'raw'
  const rightLayer: Layer = layer === 'raw' ? 'cor' : layer

  const mapProps = { meta, districts, states, day, grid, lead, mode, selected, onHover: setHover, onSelect: (id: number | null) => set({ selected: id }), animate: true }

  return (
    <div className="relative flex h-full flex-col">
      <WarningTicker meta={meta} day={day} lead={lead} />
      <button onClick={toggleTheme} className="pointer-events-auto absolute top-2 right-4 z-50 flex h-8 w-8 items-center justify-center rounded-full border border-line bg-ink-1/90 text-fg-2 shadow-sm backdrop-blur transition-all hover:bg-ink-2">
        {isDark ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg> : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>}
      </button>
      <div ref={ref} className="relative flex-1 overflow-hidden">
        <div className="absolute inset-0 grid-overlay" />
        {vs && (
          compare ? (
            <>
              <div className="absolute inset-0"><MapView {...mapProps} animate={false} layer={leftLayer} viewState={vs} onViewState={setVs} /></div>
              <div className="absolute inset-0" style={{ clipPath: `inset(0 0 0 ${split * 100}%)` }}>
                <MapView {...mapProps} layer={rightLayer} viewState={vs} onViewState={setVs} />
              </div>
              <div className="absolute top-0 bottom-0 z-10 w-0" style={{ left: `${split * 100}%` }}>
                <div className="absolute top-0 bottom-0 -left-px w-0.5 bg-gradient-to-b from-neon/20 via-neon to-neon/20 shadow-[0_0_16px_#22d3ee]" />
                <div className="absolute top-1/2 -left-5 grid h-10 w-10 -translate-y-1/2 cursor-ew-resize place-items-center rounded-full border border-neon bg-[radial-gradient(circle_at_35%_30%,#0e3a48,#070c16_70%)] font-mono text-sm text-neon shadow-[0_0_24px_#22d3ee88,inset_0_1px_0_#ffffff22] transition-transform hover:scale-110"
                  onPointerDown={(e) => {
                    (e.target as Element).setPointerCapture(e.pointerId)
                    const move = (ev: PointerEvent) => { const r = (e.target as Element).closest('.relative.flex-1')!.getBoundingClientRect(); setSplit(Math.min(0.95, Math.max(0.05, (ev.clientX - r.left) / r.width))) }
                    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
                    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up)
                  }}><span aria-hidden className="pointer-events-none absolute -inset-1.5 rounded-full border border-dashed border-neon/40 motion-safe:animate-spin-slow" />⇆</div>
                <div className="absolute top-3 right-4 rounded-md border border-[#e66767]/40 bg-[#e66767]/20 px-2 py-1 font-mono text-[10px] whitespace-nowrap text-[#f0a3a3] shadow-[0_0_14px_-4px_#e66767] backdrop-blur-sm">◀ {t('Raw NWP')}</div>
                <div className="absolute top-3 left-4 rounded-md border border-neon/40 bg-neon/15 px-2 py-1 font-mono text-[10px] whitespace-nowrap text-neon-2 shadow-[0_0_14px_-4px_#22d3ee] backdrop-blur-sm">{t(LAYER_OPTS.find((o) => o.v === rightLayer)!.label)} ▶</div>
              </div>
            </>
          ) : (
            <div className="absolute inset-0"><MapView {...mapProps} layer={layer} viewState={vs} onViewState={setVs} /></div>
          )
        )}
        <RainOverlay intensity={intensity} />
        <div className="scanline" />
        <div className="vignette" />

        <div className="pointer-events-none absolute inset-0 z-20 grid grid-rows-[minmax(0,1fr)_auto] gap-3 p-3">
          <div className="grid min-h-0 grid-cols-[320px_minmax(0,1fr)_340px] gap-3">
            <div className="pointer-events-auto flex min-h-0 flex-col gap-3">
              <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl"><RegimePanel meta={meta} day={day} lead={lead} /><div aria-hidden className="pointer-events-none sticky bottom-0 -mt-7 h-7 rounded-b-2xl bg-gradient-to-t from-void/90 to-transparent" /></div>
              <LayerControls />
            </div>
            <div className="relative min-h-0">
              <MapHud vs={vs} />
              <div className="pointer-events-auto absolute bottom-0 left-0"><Legend layer={mode === 'grid' && layer === 'warn' ? 'ph' : layer} lead={lead} /></div>
            </div>
            <div className="pointer-events-auto min-h-0 overflow-y-auto rounded-2xl">
              {selected === null && <SituationPanel meta={meta} day={day} lead={lead} onSelect={(id) => set({ selected: id, playing: false })} />}
              {selected === null && <div aria-hidden className="pointer-events-none sticky bottom-0 -mt-7 h-7 rounded-b-2xl bg-gradient-to-t from-void/90 to-transparent" />}
            </div>
          </div>
          <div className="pointer-events-auto"><Timeline /></div>
        </div>
        <DistrictDrawer meta={meta} day={day} />

        {hovered && day && hover && (() => {
          const wl = day.d.warn[lead - 1][hover.id], wc = WARN[wl].color
          const vRaw = day.d.raw[lead - 1][hover.id], vCor = day.d.cor[lead - 1][hover.id], vObs = day.d.obs[hover.id]
          const vm = Math.max(vRaw, vCor, vObs, 1e-6)
          return (
            <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
              className="pointer-events-none absolute z-40 w-[230px] overflow-hidden rounded-xl border border-line bg-white/95 p-3 shadow-xl backdrop-blur"
              style={{ left: Math.min(hover.x + 16, size.w - 250), top: Math.max(8, hover.y - 30) }}>
              <span aria-hidden className="absolute inset-x-0 top-0 h-[2px]" style={{ background: `linear-gradient(90deg, transparent, ${wc}, transparent)` }} />
              <span aria-hidden className="absolute -top-10 -right-10 h-20 w-20 rounded-full blur-2xl" style={{ background: wc, opacity: 0.18 }} />
              <div className="relative font-display text-sm font-semibold tracking-tight">{hovered.name}</div>
              <div className="relative text-[11px] text-fg-3">{hovered.state}</div>
              <div className="relative mt-2 grid grid-cols-3 gap-1 font-mono text-[10.5px]">
                {[
                  { l: 'raw', v: vRaw, cls: 'text-red-500', c: '#ef4444' },
                  { l: 'varsha', v: vCor, cls: 'text-neon-2', c: '#22d3ee' },
                  { l: 'obs', v: vObs, cls: 'text-fg', c: '#e6edf7' },
                ].map((r) => (
                  <div key={r.l} className="rounded-md border border-line/70 bg-ink-1/60 px-1.5 py-1">
                    <div className="text-[9px] tracking-wider text-fg-3 uppercase">{r.l}</div>
                    <div className={`${r.cls} font-semibold tabnum`}>{r.v.toFixed(1)}</div>
                    <div className="mt-0.5 h-[2px] overflow-hidden rounded-full bg-line/70"><div className="h-full rounded-full" style={{ width: `${(r.v / vm) * 100}%`, background: r.c, boxShadow: `0 0 4px ${r.c}` }} /></div>
                  </div>
                ))}
              </div>
              <div className="relative mt-2 font-mono text-[10px] text-fg-2">max cell {day.d.corx[lead - 1][hover.id].toFixed(0)} mm · {RAIN_CLASSES[Math.max(0, rainClass(day.d.corx[lead - 1][hover.id]))].label}</div>
              <div className="relative font-mono text-[10px] text-fg-2">P(heavy) {day.d.ph[lead - 1][hover.id]}% · P(v.heavy) {day.d.pvh[lead - 1][hover.id]}%</div>
              <div className="relative mt-2 flex items-center gap-1.5 rounded-md border px-1.5 py-1 font-mono text-[10px]" style={{ color: wc, borderColor: wc + '55', background: wc + '14' }}>
                <span className="h-2 w-2 rounded-full" style={{ background: wc, boxShadow: `0 0 6px ${wc}` }} />
                {t(WARN[wl].name)} · {t(WARN[wl].action)}
              </div>
              {layer !== 'cor' && layer !== 'raw' && layer !== 'obs' && <div className="relative mt-1 font-mono text-[10px] text-fg-3">layer value {districtValue(day, layer, lead - 1, hover.id).toFixed(2)}</div>}
            </motion.div>
          )
        })()}
        {playing && <div className="absolute top-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full border border-line bg-ink-1/90 px-3 py-1 font-mono text-[10px] tracking-wider text-neon shadow-md backdrop-blur-sm"><span className="dot-live text-neon" />▶ REPLAYING SEASON</div>}
      </div>
    </div>
  )
}
