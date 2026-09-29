import { useEffect, useMemo, useRef, useState } from 'react'
import DeckGL from '@deck.gl/react'
import { BitmapLayer, ColumnLayer, GeoJsonLayer, LineLayer, PathLayer, ScatterplotLayer, TextLayer } from '@deck.gl/layers'
import type { MapViewState, PickingInfo } from '@deck.gl/core'
import type { DayData, GridDay, Layer, Meta, Mode } from '../lib/types'
import { deltaColor, hex, probColor, rainColor, warnColor, type RGBA } from '../lib/colors'

export interface HoverInfo { x: number; y: number; id: number }

interface Props {
  meta: Meta
  districts: GeoJSON.FeatureCollection | null
  states: GeoJSON.FeatureCollection | null
  day: DayData | null
  grid: GridDay | null
  lead: number
  layer: Layer
  mode: Mode
  selected: number | null
  viewState: MapViewState
  onViewState: (v: MapViewState) => void
  onHover?: (h: HoverInfo | null) => void
  onSelect?: (id: number | null) => void
  animate?: boolean
}

export function districtValue(day: DayData, layer: Layer, li: number, i: number): number {
  const d = day.d
  switch (layer) {
    case 'cor': return d.cor[li][i]
    case 'raw': return d.raw[li][i]
    case 'obs': return d.obs[i]
    case 'ph': return d.ph[li][i] / 100
    case 'pvh': return d.pvh[li][i] / 100
    case 'delta': return d.cor[li][i] - d.raw[li][i]
    case 'warn': return d.warn[li][i]
  }
}

export function colorFor(layer: Layer, v: number, alpha?: number): RGBA {
  switch (layer) {
    case 'ph': case 'pvh': return probColor(v, alpha)
    case 'delta': return deltaColor(v, alpha)
    case 'warn': return warnColor(v, alpha)
    default: return rainColor(v, alpha)
  }
}

function gridValues(g: GridDay, layer: Layer, li: number): Float32Array {
  switch (layer) {
    case 'raw': return g.raw[li]
    case 'obs': return g.obs
    case 'ph': case 'warn': return g.ph[li]
    case 'pvh': return g.pvh[li]
    case 'delta': { const a = new Float32Array(g.cor[li].length); for (let i = 0; i < a.length; i++) a[i] = g.cor[li][i] - g.raw[li][i]; return a }
    default: return g.cor[li]
  }
}

// Tolerant tap recogniser: slow integrated GPUs can take >250 ms to pick on pointer-down.
const RECOGNIZER_OPTS = { click: { time: 900, threshold: 8 } }

const GRATICULE = (() => {
  const lines: { path: [number, number][] }[] = []
  for (let lon = 65; lon <= 100; lon += 5) lines.push({ path: [[lon, 3], [lon, 40]] })
  for (let lat = 5; lat <= 40; lat += 5) lines.push({ path: [[62, lat], [102, lat]] })
  return lines
})()

const km = (a: [number, number], b: [number, number]) => {
  const R = 6371, r = Math.PI / 180
  const dLat = (b[0] - a[0]) * r, dLon = (b[1] - a[1]) * r
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export default function MapView(p: Props) {
  const { meta, day, grid, lead, layer, mode, selected } = p
  const li = lead - 1
  const g = meta.grid
  const [t, setT] = useState(0)
  const raf = useRef(0)

  // Pulse animation (~15 fps), paused while a pointer is pressed so taps/drags stay responsive on slow GPUs.
  const paused = useRef(false)
  useEffect(() => {
    if (!p.animate) return
    let last = 0
    const loop = (now: number) => {
      if (!paused.current && now - last > 66) { setT(now / 1000); last = now }
      raf.current = requestAnimationFrame(loop)
    }
    raf.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf.current)
  }, [p.animate])

  const cellPos = useMemo(() => g.cells.map((c) => {
    const i = Math.floor(c / g.nlon), j = c % g.nlon
    return [g.lon0 + j * g.res, g.lat0 + i * g.res] as [number, number]
  }), [g])

  const effLayer: Layer = mode === 'grid' && layer === 'warn' ? 'ph' : layer

  // --- grid bitmap (0.25 deg cells, north-up) -------------------------------------------
  const bitmap = useMemo(() => {
    if (!grid || mode !== 'grid') return null
    const vals = gridValues(grid, effLayer, li)
    const cv = document.createElement('canvas')
    cv.width = g.nlon; cv.height = g.nlat
    const ctx = cv.getContext('2d')!
    const img = ctx.createImageData(g.nlon, g.nlat)
    g.cells.forEach((c, k) => {
      const i = Math.floor(c / g.nlon), j = c % g.nlon
      const px = ((g.nlat - 1 - i) * g.nlon + j) * 4
      const col = colorFor(effLayer, vals[k], 245)
      img.data[px] = col[0]; img.data[px + 1] = col[1]; img.data[px + 2] = col[2]; img.data[px + 3] = col[3]
    })
    ctx.putImageData(img, 0, 0)
    return cv
  }, [grid, mode, effLayer, li, g])

  const towers = useMemo(() => {
    if (!grid || mode !== 'towers') return []
    const vals = gridValues(grid, effLayer === 'warn' ? 'cor' : effLayer, li)
    const out: { p: [number, number]; v: number }[] = []
    for (let k = 0; k < vals.length; k++) if (Math.abs(vals[k]) >= (effLayer === 'ph' || effLayer === 'pvh' ? 0.1 : 2.5)) out.push({ p: cellPos[k], v: vals[k] })
    return out
  }, [grid, mode, effLayer, li, cellPos])

  const values = useMemo(() => {
    if (!day) return null
    return meta.districts.map((d) => districtValue(day, layer, li, d.id))
  }, [day, layer, li, meta.districts])

  const redFeatures = useMemo(() => {
    if (!day || !p.districts) return []
    return p.districts.features.filter((f) => day.d.warn[li][(f.properties as { id: number }).id] === 3)
  }, [day, li, p.districts])

  const selFeature = useMemo(() => p.districts?.features.filter((f) => (f.properties as { id: number }).id === selected) ?? [], [p.districts, selected])

  // Stable props for <DeckGL>: the pulse animation re-renders ~25x/s, and fresh controller objects or
  // callback identities on every frame reset deck's tap recogniser, so clicks never register.
  const latest = useRef(p)
  latest.current = p
  const handlers = useMemo(() => ({
    onViewStateChange: (e: { viewState: unknown }) => latest.current.onViewState(e.viewState as MapViewState),
    getCursor: ({ isHovering }: { isHovering: boolean }) => (isHovering ? 'pointer' : 'grab'),
    onHover: (info: PickingInfo) => {
      const id = (info.object as GeoJSON.Feature | undefined)?.properties?.id
      latest.current.onHover?.(id === undefined ? null : { x: info.x, y: info.y, id })
    },
    onClick: (info: PickingInfo) => {
      const id = (info.object as GeoJSON.Feature | undefined)?.properties?.id
      latest.current.onSelect?.(id === undefined ? null : id)
    },
  }), [])
  const controller = useMemo(() => ({ dragRotate: mode === 'towers', inertia: 300, doubleClickZoom: false }), [mode])
  const pulse = (Math.sin(t * 4) + 1) / 2
  const layers = []

  layers.push(new PathLayer({ id: 'graticule', data: GRATICULE, getPath: (d) => d.path, getColor: [34, 211, 238, 18], widthUnits: 'pixels', getWidth: 1 }))

  if (mode === 'grid' && bitmap) {
    const b = [g.lon0 - g.res / 2, g.lat0 - g.res / 2, g.lon0 + (g.nlon - 0.5) * g.res, g.lat0 + (g.nlat - 0.5) * g.res] as [number, number, number, number]
    layers.push(new BitmapLayer({ id: `grid-${effLayer}-${li}`, image: bitmap, bounds: b, textureParameters: { minFilter: 'linear', magFilter: 'linear' } }))
  }

  if (p.districts && values) {
    const extr = mode === 'district' && false
    layers.push(new GeoJsonLayer({
      id: 'districts',
      data: p.districts,
      filled: mode === 'district',
      stroked: true,
      extruded: extr,
      pickable: true,
      autoHighlight: true,
      highlightColor: [255, 255, 255, 60],
      getFillColor: (f) => colorFor(layer, values[(f.properties as { id: number }).id]),
      getLineColor: mode === 'district' ? [120, 150, 190, 55] : [120, 150, 190, 38],
      lineWidthUnits: 'pixels',
      getLineWidth: 0.6,
      updateTriggers: { getFillColor: [values, layer, mode], getLineColor: [mode] },
    }))
  }

  if (mode === 'towers' && towers.length) {
    const isP = effLayer === 'ph' || effLayer === 'pvh'
    layers.push(new ColumnLayer({
      id: 'towers',
      data: towers,
      diskResolution: 4,
      angle: 45,
      radius: 12500,
      extruded: true,
      getPosition: (d) => d.p,
      getElevation: (d) => (isP ? d.v * 120 : effLayer === 'delta' ? Math.abs(d.v) : d.v),
      elevationScale: isP ? 4000 : 2600,
      getFillColor: (d) => colorFor(effLayer === 'warn' ? 'cor' : effLayer, d.v, 250),
      material: { ambient: 0.5, diffuse: 0.7, shininess: 40, specularColor: [120, 200, 255] },
      pickable: false,
      updateTriggers: { getElevation: [effLayer], getFillColor: [effLayer] },
      transitions: { getElevation: 500 },
    }))
  }

  if (p.states) {
    layers.push(new GeoJsonLayer({ id: 'states-halo', data: p.states, filled: false, stroked: true, getLineColor: [34, 211, 238, 14], lineWidthUnits: 'pixels', getLineWidth: 10 }))
    layers.push(new GeoJsonLayer({ id: 'states-glow', data: p.states, filled: false, stroked: true, getLineColor: [34, 211, 238, 40], lineWidthUnits: 'pixels', getLineWidth: 4 }))
    layers.push(new GeoJsonLayer({ id: 'states', data: p.states, filled: false, stroked: true, getLineColor: [103, 232, 249, 150], lineWidthUnits: 'pixels', getLineWidth: 0.9 }))
  }

  if (redFeatures.length && layer !== 'obs' && layer !== 'raw' && layer !== 'delta') {
    layers.push(new GeoJsonLayer({
      id: 'red-pulse', data: { type: 'FeatureCollection', features: redFeatures } as GeoJSON.FeatureCollection,
      filled: false, stroked: true, lineWidthUnits: 'pixels',
      getLineColor: [255, 80, 80, Math.round(90 + 150 * pulse)], getLineWidth: 1.2 + 2.5 * pulse,
      updateTriggers: { getLineColor: [pulse], getLineWidth: [pulse] },
    }))
  }

  if (selFeature.length) {
    layers.push(new GeoJsonLayer({ id: 'sel-glow', data: { type: 'FeatureCollection', features: selFeature } as GeoJSON.FeatureCollection, filled: true, getFillColor: [255, 255, 255, 25], stroked: true, getLineColor: [255, 255, 255, 90], lineWidthUnits: 'pixels', getLineWidth: 7 }))
    layers.push(new GeoJsonLayer({ id: 'sel', data: { type: 'FeatureCollection', features: selFeature } as GeoJSON.FeatureCollection, filled: false, stroked: true, getLineColor: [255, 255, 255, 255], lineWidthUnits: 'pixels', getLineWidth: 2 }))
  }

  // --- depression: observed track, observed centre, NWP centre + displacement -------------
  if (day?.dep) {
    const dep = day.dep
    const track = dep.track.map(([la, lo]) => [lo, la] as [number, number])
    const oc: [number, number] = [dep.obs[1], dep.obs[0]]
    layers.push(new PathLayer({ id: 'dep-track', data: [{ path: track }], getPath: (d) => d.path, getColor: hex('#d55181', 200), widthUnits: 'pixels', getWidth: 3, capRounded: true, jointRounded: true }))
    layers.push(new ScatterplotLayer({ id: 'dep-track-pts', data: track, getPosition: (d) => d, getRadius: 3, radiusUnits: 'pixels', getFillColor: hex('#f5b8ff', 220) }))
    layers.push(new ScatterplotLayer({
      id: 'dep-pulse', data: [oc], getPosition: (d) => d, radiusUnits: 'meters',
      getRadius: 60000 + 140000 * ((t * 0.6) % 1), filled: false, stroked: true, lineWidthUnits: 'pixels', getLineWidth: 2,
      getLineColor: [245, 184, 255, Math.round(230 * (1 - ((t * 0.6) % 1)))], updateTriggers: { getRadius: [t], getLineColor: [t] },
    }))
    layers.push(new ScatterplotLayer({ id: 'dep-core', data: [oc], getPosition: (d) => d, radiusUnits: 'pixels', getRadius: 7, getFillColor: hex('#d55181'), stroked: true, getLineColor: [255, 255, 255, 230], lineWidthUnits: 'pixels', getLineWidth: 2 }))
    const fc = dep.fc[li]
    const labels: { p: [number, number]; text: string; color: RGBA; off: [number, number]; anchor: 'start' | 'end' }[] = [
      { p: oc, text: `LOW · DAY ${dep.day}`, color: [245, 184, 255, 255], off: [12, -12], anchor: 'start' },
    ]
    if (fc) {
      const fp: [number, number] = [fc[1], fc[0]]
      layers.push(new LineLayer({ id: 'dep-err', data: [{ s: fp, t: oc }], getSourcePosition: (d) => d.s, getTargetPosition: (d) => d.t, getColor: [230, 103, 103, 200], widthUnits: 'pixels', getWidth: 1.5 }))
      layers.push(new ScatterplotLayer({ id: 'dep-nwp', data: [fp], getPosition: (d) => d, radiusUnits: 'pixels', getRadius: 8, filled: false, stroked: true, getLineColor: [230, 103, 103, 255], lineWidthUnits: 'pixels', getLineWidth: 2 }))
      labels.push({ p: fp, text: `NWP centre ${Math.round(km(fc, dep.obs))} km off`, color: [255, 150, 150, 255], off: [-12, 12], anchor: 'end' })
    }
    layers.push(new TextLayer({ id: 'dep-labels', data: labels, getPosition: (d) => d.p, getText: (d) => d.text, getColor: (d) => d.color, getTextAnchor: (d) => d.anchor, getSize: 12, getPixelOffset: (d) => d.off, fontFamily: 'Inter, sans-serif', fontWeight: 600, characterSet: 'auto', outlineWidth: 4, outlineColor: [4, 7, 13, 255], fontSettings: { sdf: true, fontSize: 64, buffer: 6 },
      background: true, getBackgroundColor: [7, 12, 22, 200], backgroundPadding: [6, 3, 6, 3], getBorderColor: (d) => [d.color[0], d.color[1], d.color[2], 110] as RGBA, getBorderWidth: 1 }))
  }

  return (
    <div className="absolute inset-0"
      onPointerDownCapture={() => { paused.current = true }}
      onPointerUpCapture={() => { setTimeout(() => { paused.current = false }, 450) }}>
    <DeckGL
      viewState={p.viewState}
      onViewStateChange={handlers.onViewStateChange}
      controller={controller}
      eventRecognizerOptions={RECOGNIZER_OPTS}
      layers={layers}
      getCursor={handlers.getCursor}
      onHover={handlers.onHover}
      onClick={handlers.onClick}
    />
    </div>
  )
}
