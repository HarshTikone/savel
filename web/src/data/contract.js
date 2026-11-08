import { Flame, Thermometer, Snowflake, AlertTriangle, CheckCircle2, Info, Sunrise } from 'lucide-react'

export * from './enums.js'

export const STATUS_META = {
  heated: { label: 'Heated', colorVar: '--status-heated', icon: Flame },
  cooling: { label: 'Cooling', colorVar: '--status-cooling', icon: Thermometer },
  warning: { label: 'Warning', colorVar: '--status-warning', icon: Snowflake },
  critical: { label: 'Critical', colorVar: '--status-critical', icon: AlertTriangle },
  leaving: { label: 'Safe, leaving', colorVar: '--status-leaving', icon: CheckCircle2 },
  recovering: { label: 'Recovering', colorVar: '--status-recovering', icon: Sunrise },
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
  unreachable: 'No answer · send help',
  helped: 'Help delivered',
}

export const SEVERITY_META = {
  info: { label: 'Info', colorVar: '--sev-info', icon: Info },
  warning: { label: 'Warning', colorVar: '--sev-warning', icon: Snowflake },
  critical: { label: 'Critical', colorVar: '--sev-critical', icon: AlertTriangle },
}
