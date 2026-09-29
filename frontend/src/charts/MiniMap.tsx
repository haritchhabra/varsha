import { useEffect, useRef } from 'react'
import type { Meta } from '../lib/types'

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const hx = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
function ramp(stops: string[], t: number) {
  const x = Math.max(0, Math.min(1, t)) * (stops.length - 1)
  const i = Math.min(stops.length - 2, Math.floor(x)), f = x - i
  const a = hx(stops[i]), b = hx(stops[i + 1])
  return `rgb(${lerp(a[0], b[0], f) | 0},${lerp(a[1], b[1], f) | 0},${lerp(a[2], b[2], f) | 0})`
}
export const SEQ = ['#0b1a2e', '#123a66', '#1f5f99', '#2f86d6', '#62b3f0', '#d6ecff']
export const DIV = ['#e2703f', '#9c4d27', '#4a3a31', '#383835', '#2a4568', '#3170c0', '#5aa2f5']
export const seqColor = (v: number, max: number) => ramp(SEQ, Math.sqrt(Math.max(0, v) / max))
export const divColor = (v: number, lim: number) => ramp(DIV, (v / lim + 1) / 2)

const X0 = 67.8, X1 = 97.8, Y0 = 6.2, Y1 = 37.4

export default function MiniMap({ meta, values, color, states, width = 210 }: {
  meta: Meta; values: number[]; color: (v: number) => string; states: GeoJSON.FeatureCollection | null; width?: number
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const kx = Math.cos((22 * Math.PI) / 180)
  const height = Math.round((width * (Y1 - Y0)) / ((X1 - X0) * kx))
  useEffect(() => {
    const cv = ref.current!
    const dpr = window.devicePixelRatio || 1
    cv.width = width * dpr; cv.height = height * dpr
    const ctx = cv.getContext('2d')!
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, width, height)
    const g = meta.grid
    const px = (lon: number) => ((lon - X0) / (X1 - X0)) * width
    const py = (lat: number) => ((Y1 - lat) / (Y1 - Y0)) * height
    const cw = (g.res / (X1 - X0)) * width + 0.6, ch = (g.res / (Y1 - Y0)) * height + 0.6
    g.cells.forEach((c, k) => {
      const i = Math.floor(c / g.nlon), j = c % g.nlon
      ctx.fillStyle = color(values[k])
      ctx.fillRect(px(g.lon0 + j * g.res - g.res / 2), py(g.lat0 + i * g.res + g.res / 2), cw, ch)
    })
    if (states) {
      // build the state outlines once, then stroke twice: a dark under-stroke for crisp separation, then the cyan hairline
      const path = new Path2D()
      for (const f of states.features) {
        const geom = f.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon
        const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates
        for (const poly of polys) for (const ring of poly) {
          ring.forEach(([lo, la], n) => (n ? path.lineTo(px(lo), py(la)) : path.moveTo(px(lo), py(la))))
        }
      }
      ctx.lineJoin = 'round'
      ctx.strokeStyle = 'rgba(4,7,13,0.55)'
      ctx.lineWidth = 1.4
      ctx.stroke(path)
      ctx.strokeStyle = 'rgba(103,232,249,0.42)'
      ctx.lineWidth = 0.6
      ctx.stroke(path)
    }
  }, [meta, values, color, states, width, height])
  return (
    <canvas ref={ref} className="transition-[filter] duration-300"
      style={{ width, height, filter: 'drop-shadow(0 0 1px rgba(103,232,249,0.55)) drop-shadow(0 0 8px rgba(34,211,238,0.22))' }} />
  )
}
