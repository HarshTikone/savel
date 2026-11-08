export const STATUSES = ['heated', 'cooling', 'warning', 'critical', 'leaving', 'recovering']
export const CALL_STATUSES = ['none', 'queued', 'ringing', 'in_call', 'done', 'no_answer', 'unreachable']
export const OUTCOMES = ['none', 'ok', 'needs_help', 'medical', 'leaving', 'unreachable', 'helped']
export const PHASES = ['ringing', 'in_call', 'extracting', 'done', 'no_answer']
export const SOURCES = ['live', 'scripted']
export const EVENT_TYPES = [
  'power_cut', 'power_restored', 'vent_blocked', 'vent_cleared',
  'threshold', 'call_started', 'call_result', 'reset',
  'house_power_cut', 'house_power_restored', 'help_delivered',
]
export const SEVERITIES = ['info', 'warning', 'critical']
export const K_SOURCES = ['learned', 'median']

export const HOME_KEYS = [
  'id', 'block', 'lat', 'lon', 'temp_f', 'co_ppm', 'power_on', 'heating', 'online',
  'k_est', 'k_source', 'hours_to_60', 'hours_to_50', 'status', 'risk',
  'call_status', 'outcome', 'age_band', 'medical_needs', 'language',
]
