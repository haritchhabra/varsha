// Colour system. Data colours follow the dataviz method:
//  - rain magnitude: ordinal ramp over the IMD intensity classes, analogous blue -> violet -> pink,
//    lightness rising with intensity so low values recede into the dark surface
//  - probability: second sequential context -> its own hue (orange)
//  - correction delta: diverging orange (drier) <-> gray <-> blue (wetter)
//  - warnings: fixed IMD status colours, always paired with a label
export type RGBA = [number, number, number, number]

export const hex = (h: string, a = 255): RGBA => {
  const n = parseInt(h.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, a]
}

export const RAIN_CLASSES = [
  { min: 0.1, label: 'Very light', short: '0.1–2.4', color: '#17324f' },
  { min: 2.5, label: 'Light', short: '2.5–15.5', color: '#1d5a93' },
  { min: 15.6, label: 'Moderate', short: '15.6–64.4', color: '#2f86d6' },
  { min: 64.5, label: 'Heavy', short: '64.5–115.5', color: '#62b3f0' },
  { min: 115.6, label: 'Very heavy', short: '115.6–204.4', color: '#a78bfa' },
  { min: 204.5, label: 'Extremely heavy', short: '≥ 204.5', color: '#f5b8ff' },
]
const RAIN_RGBA = RAIN_CLASSES.map((c) => hex(c.color))

export function rainClass(mm: number): number {
  for (let i = RAIN_CLASSES.length - 1; i >= 0; i--) if (mm >= RAIN_CLASSES[i].min) return i
  return -1
}
export function rainColor(mm: number, alpha = 235): RGBA {
  const k = rainClass(mm)
  if (k < 0) return [0, 0, 0, 0]
  const c = RAIN_RGBA[k]
  return [c[0], c[1], c[2], k === 0 ? Math.round(alpha * 0.55) : alpha]
}
export const rainCss = (mm: number) => { const k = rainClass(mm); return k < 0 ? '#0b1322' : RAIN_CLASSES[k].color }

export const PROB_STEPS = [
  { min: 0.1, color: '#3a1f0e', label: '10–30%' },
  { min: 0.3, color: '#7a3710', label: '30–50%' },
  { min: 0.5, color: '#c24e1c', label: '50–70%' },
  { min: 0.7, color: '#ec7a3f', label: '70–90%' },
  { min: 0.9, color: '#fdc49a', label: '≥ 90%' },
]
export function probColor(p: number, alpha = 235): RGBA {
  for (let i = PROB_STEPS.length - 1; i >= 0; i--) if (p >= PROB_STEPS[i].min) return hex(PROB_STEPS[i].color, alpha)
  return [0, 0, 0, 0]
}

export const DELTA_STEPS = [
  { max: -40, color: '#e2703f', label: '< −40' },
  { max: -15, color: '#b15a2e', label: '−40…−15' },
  { max: -3, color: '#6e4630', label: '−15…−3' },
  { max: 3, color: '#383835', label: '±3' },
  { max: 15, color: '#28507f', label: '3…15' },
  { max: 40, color: '#3170c0', label: '15…40' },
  { max: Infinity, color: '#5aa2f5', label: '> 40' },
]
export function deltaColor(d: number, alpha = 225): RGBA {
  for (const s of DELTA_STEPS) if (d < s.max) return hex(s.color, Math.abs(d) < 3 ? 70 : alpha)
  return hex(DELTA_STEPS[DELTA_STEPS.length - 1].color, alpha)
}

// IMD SOP (2021) s1.7.8 colour code: Green = No warning, Yellow = Watch, Orange = Alert, Red = Warning
export const WARN = [
  { key: 'green', label: 'No warning', name: 'Green', action: 'No action', color: '#0ca30c' },
  { key: 'yellow', label: 'Watch', name: 'Yellow', action: 'Be updated', color: '#fab219' },
  { key: 'orange', label: 'Alert', name: 'Orange', action: 'Be prepared', color: '#ec835a' },
  { key: 'red', label: 'Warning', name: 'Red', action: 'Take action', color: '#d03b3b' },
]
export const warnColor = (lvl: number, alpha = 220): RGBA => (lvl === 0 ? hex('#0ca30c', 28) : hex(WARN[lvl].color, alpha))

export const REGIME_COLORS = ['#3987e5', '#c98500', '#d55181', '#008300', '#9085e9', '#8a8980']

export const METHOD_COLORS: Record<string, string> = {
  RAW: '#e66767', QM: '#8b93a3', ML: '#6b7384', QMR: '#9aa3b5', MOE: '#9085e9', VARSHA: '#22d3ee',
}
