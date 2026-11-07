import { Flame, Thermometer, Snowflake, AlertTriangle, CheckCircle2, Info } from 'lucide-react'

export const STATUSES = ['heated', 'cooling', 'warning', 'critical', 'leaving']
export const CALL_STATUSES = ['none', 'queued', 'ringing', 'in_call', 'done', 'no_answer', 'unreachable']
export const OUTCOMES = ['none', 'ok', 'needs_help', 'medical', 'leaving', 'unreachable']
export const PHASES = ['ringing', 'in_call', 'extracting', 'done', 'no_answer']
export const SOURCES = ['live', 'scripted']
export const EVENT_TYPES = [
  'power_cut', 'power_restored', 'vent_blocked', 'vent_cleared',
  'threshold', 'call_started', 'call_result', 'reset',
]
export const SEVERITIES = ['info', 'warning', 'critical']
export const K_SOURCES = ['learned', 'median']

export const HOME_KEYS = [
  'id', 'block', 'lat', 'lon', 'temp_f', 'co_ppm', 'power_on', 'heating', 'online',
  'k_est', 'k_source', 'hours_to_60', 'hours_to_50', 'status', 'risk',
  'call_status', 'outcome', 'age_band', 'medical_needs', 'language',
]

export const STATUS_META = {
  heated: { label: 'Heated', colorVar: '--status-heated', icon: Flame },
  cooling: { label: 'Cooling', colorVar: '--status-cooling', icon: Thermometer },
  warning: { label: 'Warning', colorVar: '--status-warning', icon: Snowflake },
  critical: { label: 'Critical', colorVar: '--status-critical', icon: AlertTriangle },
  leaving: { label: 'Safe, leaving', colorVar: '--status-leaving', icon: CheckCircle2 },
}

export const CALL_STATUS_LABEL = {
  none: 'Not called',
  queued: 'In queue',
  ringing: 'Ringing',
  in_call: 'On call',
  done: 'Call done',
  no_answer: 'No answer',
  unreachable: 'Unreachable',
}

export const OUTCOME_LABEL = {
  none: '—',
  ok: 'OK',
  needs_help: 'Needs help',
  medical: 'Medical',
  leaving: 'Safe, leaving',
  unreachable: 'Unreachable',
}

export const SEVERITY_META = {
  info: { label: 'Info', colorVar: '--sev-info', icon: Info },
  warning: { label: 'Warning', colorVar: '--sev-warning', icon: Snowflake },
  critical: { label: 'Critical', colorVar: '--sev-critical', icon: AlertTriangle },
}
