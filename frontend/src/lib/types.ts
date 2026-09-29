// Data contract written by backend/varsha/export.py

export interface Regime { id: number; key: string; name: string; short: string; color: string; desc: string }
export interface District { id: number; name: string; state: string; lat: number; lon: number; ncell: number }
export interface MethodInfo { name: string; desc: string; color: string }
export interface EventCase { date: string; regime: number; title: string; desc: string }

export interface Meta {
  app: { name: string; tagline: string; version: string; mode: string; generated: string }
  grid: { lat0: number; lon0: number; res: number; nlat: number; nlon: number; cells: number[] }
  regimes: Regime[]
  categories: { key: string; label: string; min: number }[]
  leads: number[]
  thresholds: { heavy: number; vheavy: number; xheavy: number }
  warning_levels: string[]
  districts: District[]
  methods: Record<string, MethodInfo>
  dates: string[]
  events: EventCase[]
  feature_labels: Record<string, string>
}

export interface TimelineDay {
  date: string
  regime: number
  pred: number[][] // [lead][regime]
  obs_mean: number
  raw_mean: number[]
  cor_mean: number[]
  warn: number[][] // [lead][green,yellow,orange,red]
  n_obs_heavy: number
  hits_varsha: number[]
  hits_raw: number[]
  max_obs: number
  dep: [number, number] | null
}

export interface Signal { f: string; label: string; v: number; z: number }
export interface LeadStats {
  lead: number; obs_mean: number; raw_mean: number; cor_mean: number
  max_obs: number; max_raw: number; max_cor: number
  n_warn: number[]; n_obs_heavy: number; hits_varsha: number; hits_raw: number; fa_varsha: number; fa_raw: number
}
export interface DayData {
  date: string
  regime: number
  pred: number[][]
  signals: Signal[][]
  dep: null | { obs: [number, number]; fc: ([number, number] | null)[]; track: [number, number][]; day: number }
  stats: LeadStats[]
  d: {
    obs: number[]; obsx: number[]
    raw: number[][]; rawx: number[][]; cor: number[][]; corx: number[][]
    ph: number[][]; pvh: number[][]; pxh: number[][]; warn: number[][]
  }
}

export interface GridDay {
  obs: Float32Array
  raw: Float32Array[]
  cor: Float32Array[]
  ph: Float32Array[]
  pvh: Float32Array[]
}

export interface Series {
  id: number; name: string; state: string
  obs: number[]; obsx: number[]; raw1: number[]; cor1: number[]; corx1: number[]; ph1: number[]; raw3: number[]; cor3: number[]
}

export interface Cat { pod: number | null; far: number | null; csi: number | null; ets: number | null; fbi: number | null; hss: number | null; sr: number | null; hits: number; false_alarms: number; misses: number; correct_neg: number }
export interface Scores { rmse: number; mae: number; bias: number; corr: number; n: number; cat: Record<string, Cat> }
export interface FssRes { fss: (number | null)[]; useful: number; base_rate: number }
export interface ProbRes { brier: number; bss: number | null; auc: number | null; base_rate: number; reliability?: { p: number; obs: number; n: number }[] }

export interface Verification {
  methods: string[]
  method_info: Record<string, MethodInfo>
  thresholds: string[]
  fss_scales_cells: number[]
  fss_scales_km: number[]
  fss_thresholds: string[]
  test_years: number[]
  overall: Record<string, Scores>
  by_lead: Record<string, Scores[]>
  by_regime: Record<string, Scores[]>
  regime_days: number[]
  district: Record<string, Scores[]>
  fss: Record<string, Record<string, FssRes>>
  fss_by_lead: Record<string, Record<string, FssRes>[]>
  fss_by_regime: Record<string, Record<string, FssRes>[]>
  prob: Record<string, {
    varsha: ProbRes; nwp: ProbRes
    by_lead: { lead: number; varsha: ProbRes; nwp: ProbRes }[]
    by_regime: { regime: number; varsha: ProbRes; nwp: ProbRes }[]
  }>
  regime_classifier: {
    accuracy: number; macro_f1: number; rule_accuracy: number; rule_macro_f1: number
    by_lead: { lead: number; accuracy: number; macro_f1: number; rule_accuracy: number }[]
    confusion: number[][]; confusion_lead1: number[][]; per_class_f1: number[]
    importance: { feature: string; importance: number }[]
  }
  training: { rows: number; cell_features: string[]; regime_features: string[]; train_years: number[]; calib_years: number[]; test_years: number[]; grid: string; districts: number; runtime_s: number }
}

export interface Composites { n: number[]; regimes: { obs: number[]; raw: number[]; cor: number[] }[] }

export type Layer = 'cor' | 'raw' | 'obs' | 'ph' | 'pvh' | 'delta' | 'warn'
export type Mode = 'district' | 'grid' | 'towers'
export type Tab = 'console' | 'districts' | 'regimes' | 'verify' | 'about'
