// Theme engine. A theme supplies UI tokens (written to CSS custom properties, which every Tailwind
// colour utility reads), an effects level, the data-viz ramps (swapped into lib/colors.ts in place)
// and the WebGL map colours. The app remounts on theme change so canvas/deck.gl layers repaint.
//
// Data ramps were checked for monotonic OKLab lightness; regime colours use the validated
// categorical steps for the theme's surface (light or dark) and are always shown with labels.
import type { RGBA } from './colors'

export type ThemeName = 'paper' | 'slate' | 'graphite' | 'monsoon' | 'neon'

export interface Theme {
  name: ThemeName
  label: string
  desc: string
  mode: 'light' | 'dark'
  ui: {
    void: string; ink1: string; ink2: string; ink3: string; line: string; line2: string
    fg: string; fg2: string; fg3: string
    accent: string; accent2: string; onAccent: string; plasma: string
    good: string; bad: string; caution: string; raw: string; raw2: string; prob: string
    glow: string // 'transparent' in calm themes: every glow shadow built on var(--color-glow) disappears
    panelBg: string; panelBgStrong: string; panelBorder: string; panelShadow: string
    selection: string; scrollThumb: string
  }
  fx: {
    vivid: boolean // neon glows, gradient text, HUD brackets, aurora, starfield, scanline
    noise: number // film-grain opacity
    rain: string // rain-streak stroke colour for the console overlay
    rainOpacity: number
    rainBlend: 'screen' | 'multiply' | 'normal'
  }
  data: {
    rain: string[] // 6 IMD classes: very light .. extremely heavy
    prob: string[] // 5 probability steps: 10, 30, 50, 70, 90 %
    delta: string[] // 7 diverging steps: much drier .. much wetter
    seq: string[] // regime-atlas mean rainfall (sqrt scale)
    div: string[] // regime-atlas bias
    regimes: string[]
    methods: Record<string, string>
    warnText: string[] // IMD status colours tuned for text on this surface
  }
  map: {
    graticule: RGBA; districtLine: RGBA; districtLineFaint: RGBA; stateLine: RGBA; stateGlow: RGBA | null
    textOutline: RGBA; selection: RGBA; selectionFill: RGBA; hover: RGBA; greenAlpha: number; lowAlpha: number
  }
}

const LIGHT_REGIMES = ['#2a78d6', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#7c7a72']
const DARK_REGIMES = ['#3987e5', '#c98500', '#d55181', '#008300', '#9085e9', '#8a8980']
const LIGHT_WARN_TEXT = ['#0a7a0a', '#8a6100', '#a64313', '#b3261e']
const DARK_WARN_TEXT = ['#5cc45c', '#fab219', '#ec835a', '#ef6b6b']

export const THEMES: Record<ThemeName, Theme> = {
  paper: {
    name: 'paper', label: 'Paper', mode: 'light',
    desc: 'Warm off-white and ink, like a printed IMD bulletin. Green→blue→purple rain scale, as on weather maps.',
    ui: {
      void: '#ece7dd', ink1: '#faf8f3', ink2: '#f4f0e7', ink3: '#e9e3d6', line: '#ddd5c5', line2: '#c7bda9',
      fg: '#1f1c17', fg2: '#524c42', fg3: '#6e6759',
      accent: '#1d5b8f', accent2: '#164a76', onAccent: '#ffffff', plasma: '#a4492a',
      good: '#207126', bad: '#b3261e', caution: '#8a5a00', raw: '#c0392b', raw2: '#a93226', prob: '#c2581f',
      glow: 'transparent',
      panelBg: '#fbfaf6', panelBgStrong: '#fdfcf9', panelBorder: '#dcd4c3',
      panelShadow: '0 1px 1px rgba(60,48,28,0.05), 0 10px 28px -18px rgba(60,48,28,0.28)',
      selection: 'rgba(29,91,143,0.18)', scrollThumb: '#c7bda9',
    },
    fx: { vivid: false, noise: 0.035, rain: 'rgba(30,60,100,0.16)', rainOpacity: 0.45, rainBlend: 'multiply' },
    data: {
      rain: ['#dcecc9', '#9ccf8d', '#3f9e6e', '#2b73b5', '#3c3d99', '#5e1d6e'],
      prob: ['#f7dfcc', '#eeb88f', '#df8a55', '#c65f2a', '#933f16'],
      delta: ['#9c4a1c', '#cf8452', '#ecc6a6', '#e7e2d8', '#b7cde3', '#6f9bcb', '#2c62a0'],
      seq: ['#f1eee6', '#cfe3c4', '#8cc49a', '#3f9e8a', '#2b6fa8', '#28357f'],
      div: ['#9c4a1c', '#c9824f', '#e6c3a3', '#ebe7df', '#b6cde2', '#6f9bcb', '#2c62a0'],
      regimes: LIGHT_REGIMES,
      methods: { RAW: '#c0392b', QM: '#a39d92', ML: '#857f74', QMR: '#bdb7ac', MOE: '#4a3aa7', VARSHA: '#1d5b8f' },
      warnText: LIGHT_WARN_TEXT,
    },
    map: {
      graticule: [120, 108, 88, 38], districtLine: [110, 100, 84, 90], districtLineFaint: [110, 100, 84, 55],
      stateLine: [58, 52, 42, 190], stateGlow: null, textOutline: [250, 248, 243, 255],
      selection: [31, 28, 23, 255], selectionFill: [29, 91, 143, 28], hover: [31, 28, 23, 30], greenAlpha: 40, lowAlpha: 0.7,
    },
  },
  slate: {
    name: 'slate', label: 'Slate', mode: 'light',
    desc: 'Cool white and grey with a deep-teal accent, like an operations tool (Grafana/GitHub light).',
    ui: {
      void: '#e9edf1', ink1: '#ffffff', ink2: '#f6f8fa', ink3: '#eaeef2', line: '#d8dee4', line2: '#c2cad3',
      fg: '#1f2328', fg2: '#4b5563', fg3: '#636b75',
      accent: '#0f766e', accent2: '#0b5c56', onAccent: '#ffffff', plasma: '#9a5b13',
      good: '#08762e', bad: '#cf222e', caution: '#8e5b00', raw: '#cf222e', raw2: '#a40e26', prob: '#c2581f',
      glow: 'transparent',
      panelBg: '#ffffff', panelBgStrong: '#ffffff', panelBorder: '#d8dee4',
      panelShadow: '0 1px 2px rgba(31,35,40,0.06), 0 8px 24px -16px rgba(31,35,40,0.22)',
      selection: 'rgba(15,118,110,0.16)', scrollThumb: '#c2cad3',
    },
    fx: { vivid: false, noise: 0, rain: 'rgba(40,70,110,0.14)', rainOpacity: 0.4, rainBlend: 'multiply' },
    data: {
      rain: ['#dbe9f6', '#a9cbe8', '#5e9fd1', '#2a6fb0', '#1f3f8c', '#3d0f55'],
      prob: ['#fde4cf', '#f9bb8c', '#ee8a4f', '#cf5f24', '#983f14'],
      delta: ['#9c4a1c', '#cf8452', '#ecc6a6', '#e9edf1', '#b7cde3', '#6f9bcb', '#2c62a0'],
      seq: ['#f4f6f8', '#d4e4f2', '#9cc2e3', '#5b98cc', '#2d66a6', '#1a3a78'],
      div: ['#9c4a1c', '#c9824f', '#e6c3a3', '#edf0f3', '#b6cde2', '#6f9bcb', '#2c62a0'],
      regimes: LIGHT_REGIMES,
      methods: { RAW: '#cf222e', QM: '#a3aab3', ML: '#848c96', QMR: '#bcc3cb', MOE: '#4a3aa7', VARSHA: '#0f766e' },
      warnText: LIGHT_WARN_TEXT,
    },
    map: {
      graticule: [60, 80, 100, 30], districtLine: [90, 100, 112, 80], districtLineFaint: [90, 100, 112, 50],
      stateLine: [36, 41, 47, 180], stateGlow: null, textOutline: [255, 255, 255, 255],
      selection: [31, 35, 40, 255], selectionFill: [15, 118, 110, 26], hover: [31, 35, 40, 28], greenAlpha: 40, lowAlpha: 0.7,
    },
  },
  graphite: {
    name: 'graphite', label: 'Graphite', mode: 'dark',
    desc: 'Neutral charcoal with a single amber accent, like a professional instrument panel. No glow.',
    ui: {
      void: '#0f1011', ink1: '#151618', ink2: '#1b1d20', ink3: '#24272b', line: '#2b2e32', line2: '#3a3e44',
      fg: '#ebe8e2', fg2: '#b0aca4', fg3: '#8e8a83',
      accent: '#e0a43a', accent2: '#f0bd5e', onAccent: '#1a1408', plasma: '#7fa9c9',
      good: '#7bbf6a', bad: '#e07a6e', caution: '#e0a43a', raw: '#e07a6e', raw2: '#eda197', prob: '#e8894a',
      glow: 'transparent',
      panelBg: '#17181b', panelBgStrong: '#191a1d', panelBorder: '#2c2f33',
      panelShadow: 'inset 0 1px 0 rgba(255,255,255,0.03), 0 14px 32px -20px rgba(0,0,0,0.85)',
      selection: 'rgba(224,164,58,0.28)', scrollThumb: '#3a3e44',
    },
    fx: { vivid: false, noise: 0.03, rain: 'rgba(210,215,220,0.16)', rainOpacity: 0.5, rainBlend: 'screen' },
    data: {
      rain: ['#1c2a38', '#224b70', '#2d71ab', '#5b9bd3', '#b6a6ea', '#f4d9f4'],
      prob: ['#3b2717', '#6e3f1a', '#b0602a', '#e08a4c', '#f6c79c'],
      delta: ['#e0874e', '#a9602f', '#5e4330', '#34332f', '#2c4763', '#3f74b0', '#78aee6'],
      seq: ['#141517', '#1c2f45', '#23517a', '#2f7cb8', '#6aa8dc', '#d4e6f7'],
      div: ['#e0874e', '#a9602f', '#5e4330', '#34332f', '#2c4763', '#3f74b0', '#78aee6'],
      regimes: DARK_REGIMES,
      methods: { RAW: '#e07a6e', QM: '#8d8983', ML: '#6e6a64', QMR: '#a5a19a', MOE: '#7fa9c9', VARSHA: '#e0a43a' },
      warnText: DARK_WARN_TEXT,
    },
    map: {
      graticule: [255, 255, 255, 10], districtLine: [200, 195, 185, 42], districtLineFaint: [200, 195, 185, 28],
      stateLine: [226, 220, 208, 140], stateGlow: null, textOutline: [15, 16, 17, 255],
      selection: [245, 242, 235, 255], selectionFill: [255, 255, 255, 18], hover: [255, 255, 255, 40], greenAlpha: 26, lowAlpha: 0.55,
    },
  },
  monsoon: {
    name: 'monsoon', label: 'Monsoon', mode: 'dark',
    desc: 'Deep teal-slate, sand text and a marigold accent. Viridis rain scale, as in scientific plots.',
    ui: {
      void: '#0d1513', ink1: '#121c1a', ink2: '#172421', ink3: '#1e2e2a', line: '#243631', line2: '#324841',
      fg: '#ece6d8', fg2: '#b6ae9d', fg3: '#958e7e',
      accent: '#e39a2d', accent2: '#f0b457', onAccent: '#1b1206', plasma: '#6fb3a0',
      good: '#8cc47a', bad: '#e2765f', caution: '#e39a2d', raw: '#e2765f', raw2: '#efa08d', prob: '#e8894a',
      glow: 'transparent',
      panelBg: '#131e1c', panelBgStrong: '#15211e', panelBorder: '#26382f',
      panelShadow: 'inset 0 1px 0 rgba(255,245,220,0.03), 0 14px 32px -20px rgba(0,0,0,0.85)',
      selection: 'rgba(227,154,45,0.28)', scrollThumb: '#324841',
    },
    fx: { vivid: false, noise: 0.045, rain: 'rgba(180,220,205,0.15)', rainOpacity: 0.5, rainBlend: 'screen' },
    data: {
      rain: ['#3a2f5b', '#35568a', '#22808b', '#2fae7a', '#9dd24c', '#f5e04a'],
      prob: ['#3a2416', '#6c3a19', '#a8592a', '#dc8446', '#f4c08e'],
      delta: ['#d9824a', '#a35d31', '#5b4232', '#2f3431', '#28495a', '#3a7ea0', '#77b9d6'],
      seq: ['#101a18', '#2d2c55', '#2f5f8a', '#23908a', '#5dbb6a', '#e4dc4c'],
      div: ['#d9824a', '#a35d31', '#5b4232', '#2f3431', '#28495a', '#3a7ea0', '#77b9d6'],
      regimes: DARK_REGIMES,
      methods: { RAW: '#e2765f', QM: '#8f9a93', ML: '#6f7a74', QMR: '#a8b1ab', MOE: '#6fb3a0', VARSHA: '#e39a2d' },
      warnText: DARK_WARN_TEXT,
    },
    map: {
      graticule: [235, 228, 210, 10], districtLine: [205, 215, 205, 40], districtLineFaint: [205, 215, 205, 26],
      stateLine: [228, 216, 190, 140], stateGlow: null, textOutline: [13, 21, 19, 255],
      selection: [245, 238, 222, 255], selectionFill: [255, 245, 220, 18], hover: [255, 245, 220, 40], greenAlpha: 26, lowAlpha: 0.55,
    },
  },
  neon: {
    name: 'neon', label: 'Neon (original)', mode: 'dark',
    desc: 'The original look: navy space backdrop, neon cyan and violet, glows and HUD brackets.',
    ui: {
      void: '#04070d', ink1: '#070c16', ink2: '#0b1322', ink3: '#111c30', line: '#1c2a42', line2: '#26395a',
      fg: '#e6edf7', fg2: '#9fb0c8', fg3: '#647795',
      accent: '#22d3ee', accent2: '#67e8f9', onAccent: '#04070d', plasma: '#a78bfa',
      good: '#34d399', bad: '#fb7185', caution: '#fcd34d', raw: '#e66767', raw2: '#f0a3a3', prob: '#ec7a3f',
      glow: '#22d3ee',
      panelBg: 'linear-gradient(180deg, #0e192ccc, #080f1cd9)', panelBgStrong: 'linear-gradient(180deg, #0c1628f5, #070d19f5)',
      panelBorder: '#ffffff08',
      panelShadow: '0 0 0 1px #00000050, 0 24px 60px -24px #000000e0, 0 30px 80px -50px #22d3ee40, inset 0 1px 0 #ffffff12, inset 0 0 40px -20px #22d3ee14',
      selection: '#22d3ee40', scrollThumb: '#26395a',
    },
    fx: { vivid: true, noise: 0.05, rain: 'rgba(125,211,252,0.22)', rainOpacity: 0.7, rainBlend: 'screen' },
    data: {
      rain: ['#17324f', '#1d5a93', '#2f86d6', '#62b3f0', '#a78bfa', '#f5b8ff'],
      prob: ['#3a1f0e', '#7a3710', '#c24e1c', '#ec7a3f', '#fdc49a'],
      delta: ['#e2703f', '#b15a2e', '#6e4630', '#383835', '#28507f', '#3170c0', '#5aa2f5'],
      seq: ['#0b1a2e', '#123a66', '#1f5f99', '#2f86d6', '#62b3f0', '#d6ecff'],
      div: ['#e2703f', '#9c4d27', '#4a3a31', '#383835', '#2a4568', '#3170c0', '#5aa2f5'],
      regimes: DARK_REGIMES,
      methods: { RAW: '#e66767', QM: '#8b93a3', ML: '#6b7384', QMR: '#9aa3b5', MOE: '#9085e9', VARSHA: '#22d3ee' },
      warnText: ['#6fcf6f', '#fab219', '#ec835a', '#d03b3b'],
    },
    map: {
      graticule: [34, 211, 238, 18], districtLine: [120, 150, 190, 55], districtLineFaint: [120, 150, 190, 38],
      stateLine: [103, 232, 249, 150], stateGlow: [34, 211, 238, 40], textOutline: [4, 7, 13, 255],
      selection: [255, 255, 255, 255], selectionFill: [255, 255, 255, 25], hover: [255, 255, 255, 60], greenAlpha: 28, lowAlpha: 0.55,
    },
  },
}

export const THEME_ORDER: ThemeName[] = ['paper', 'slate', 'graphite', 'monsoon', 'neon']
export const DEFAULT_THEME: ThemeName = 'neon'

let current: Theme = THEMES[DEFAULT_THEME]
/** The active theme. Components read it during render (the app remounts on change). */
export const theme = () => current

type Listener = (t: Theme) => void
const listeners = new Set<Listener>()
export const onThemeApplied = (fn: Listener) => { listeners.add(fn); return () => { listeners.delete(fn) } }

export function applyTheme(name: ThemeName) {
  const t = THEMES[name] ?? THEMES[DEFAULT_THEME]
  current = t
  const root = document.documentElement
  const u = t.ui
  const vars: Record<string, string> = {
    '--color-void': u.void, '--color-ink-1': u.ink1, '--color-ink-2': u.ink2, '--color-ink-3': u.ink3,
    '--color-line': u.line, '--color-line-2': u.line2, '--color-fg': u.fg, '--color-fg-2': u.fg2, '--color-fg-3': u.fg3,
    '--color-neon': u.accent, '--color-neon-2': u.accent2, '--color-on-accent': u.onAccent, '--color-plasma': u.plasma,
    '--color-good': u.good, '--color-bad': u.bad, '--color-caution': u.caution,
    '--color-raw': u.raw, '--color-raw-2': u.raw2, '--color-prob': u.prob, '--color-glow': u.glow,
    '--panel-bg': u.panelBg, '--panel-bg-strong': u.panelBgStrong, '--panel-border': u.panelBorder, '--panel-shadow': u.panelShadow,
    '--selection-bg': u.selection, '--scroll-thumb': u.scrollThumb,
    '--noise-opacity': String(t.fx.noise),
  }
  t.data.regimes.forEach((c, i) => { vars[`--color-rg-${i}`] = c })
  t.data.warnText.forEach((c, i) => { vars[`--color-wt-${i}`] = c })
  for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v)
  root.dataset.theme = t.name
  root.dataset.fx = t.fx.vivid ? 'vivid' : 'calm'
  root.dataset.mode = t.mode
  root.style.colorScheme = t.mode
  listeners.forEach((fn) => fn(t))
}

export function loadSavedTheme(): ThemeName {
  try {
    const v = localStorage.getItem('varsha-theme') as ThemeName | null
    if (v && v in THEMES) return v
  } catch { /* storage unavailable */ }
  return DEFAULT_THEME
}

export function saveTheme(name: ThemeName) {
  try { localStorage.setItem('varsha-theme', name) } catch { /* storage unavailable */ }
}

/** Glow helper for inline styles: returns the CSS only in vivid themes. */
export const glow = (css: string) => (current.fx.vivid ? css : undefined)
