import { create } from 'zustand'
import type { Layer, Meta, Mode, Tab, TimelineDay, Verification } from './types'
import { applyTheme, loadSavedTheme, saveTheme, type ThemeName } from './theme'

interface State {
  meta: Meta | null
  timeline: TimelineDay[]
  verification: Verification | null
  tab: Tab
  dateIdx: number
  lead: number // 1..5
  layer: Layer
  mode: Mode
  compare: boolean
  selected: number | null
  playing: boolean
  lang: 'en' | 'hi'
  booted: boolean
  theme: ThemeName
  setTheme: (t: ThemeName) => void
  set: (p: Partial<State>) => void
  step: (d: number) => void
}

export const useStore = create<State>((set, get) => ({
  meta: null,
  timeline: [],
  verification: null,
  tab: 'console',
  dateIdx: 0,
  lead: 1,
  layer: 'cor',
  mode: 'district',
  compare: false,
  selected: null,
  playing: false,
  lang: 'en',
  booted: false,
  theme: loadSavedTheme(),
  setTheme: (t) => { applyTheme(t); saveTheme(t); set({ theme: t }) },
  set: (p) => set(p),
  step: (d) => {
    const n = get().timeline.length
    if (!n) return
    set({ dateIdx: (get().dateIdx + d + n) % n })
  },
}))

export const useDate = () => useStore((s) => s.timeline[s.dateIdx]?.date ?? null)

if (import.meta.env.DEV) (window as unknown as { __store: typeof useStore }).__store = useStore
