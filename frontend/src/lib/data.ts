import type { Composites, DayData, GridDay, Meta, Series, TimelineDay, Verification } from './types'

// Static data written by the Python pipeline. Override with VITE_DATA_BASE to point at the FastAPI server.
const BASE = (import.meta.env.VITE_DATA_BASE as string | undefined) ?? '/data'

const cache = new Map<string, Promise<unknown>>()

function get<T>(path: string, kind: 'json' | 'bin' = 'json'): Promise<T> {
  const key = `${kind}:${path}`
  if (!cache.has(key)) {
    const p = fetch(`${BASE}/${path}`).then((r) => {
      if (!r.ok) throw new Error(`${path}: ${r.status}`)
      return kind === 'json' ? r.json() : r.arrayBuffer()
    })
    p.catch(() => cache.delete(key))
    cache.set(key, p)
  }
  return cache.get(key) as Promise<T>
}

export const loadMeta = () => get<Meta>('meta.json')
export const loadTimeline = () => get<{ days: TimelineDay[] }>('timeline.json').then((d) => d.days)
export const loadVerification = () => get<Verification>('verification.json')
export const loadComposites = () => get<Composites>('composites.json')
export const loadDay = (date: string) => get<DayData>(`days/${date}.json`)
export const loadSeries = (id: number) => get<Series>(`series/${id}.json`)
export const loadGeo = (name: 'districts' | 'states') => get<GeoJSON.FeatureCollection>(`${name}.geojson`)

const RAIN_LUT = new Float32Array(256).map((_, q) => Math.exp(q / 40) - 1)

export async function loadGrid(date: string, n: number, leads: number): Promise<GridDay> {
  const buf = new Uint8Array(await get<ArrayBuffer>(`grid/${date}.bin`, 'bin'))
  const rain = (off: number) => { const a = new Float32Array(n); for (let i = 0; i < n; i++) a[i] = RAIN_LUT[buf[off + i]]; return a }
  const prob = (off: number) => { const a = new Float32Array(n); for (let i = 0; i < n; i++) a[i] = buf[off + i] / 250; return a }
  const g: GridDay = { obs: rain(0), raw: [], cor: [], ph: [], pvh: [] }
  for (let l = 0; l < leads; l++) {
    const o = n * (1 + 4 * l)
    g.raw.push(rain(o)); g.cor.push(rain(o + n)); g.ph.push(prob(o + 2 * n)); g.pvh.push(prob(o + 3 * n))
  }
  return g
}

export function prefetchDay(date: string, n: number, leads: number) {
  loadDay(date).catch(() => {})
  loadGrid(date, n, leads).catch(() => {})
}
