import { Check, Thermometer, Wind, Clock, User, HeartPulse, Languages, WifiOff, Zap, ZapOff } from 'lucide-react'
import StatusPill from './StatusPill'
import { stormDuration, temp, ppm } from '../lib/format'

const LANG = { en: 'English', es: 'Spanish', ar: 'Arabic', bn: 'Bengali' }

function Stat({ icon: Icon, label, value, tone }) {
  return (
    <div className={`stat${tone ? ` ${tone}` : ''}`}>
      <span className="stat-label"><Icon size={13} /> {label}</span>
      <span className="stat-value">{value}</span>
    </div>
  )
}

export default function HouseCard({ home, rank, onHelp, helpPending, children }) {
  if (!home) return <div className="empty"><p>Select a house on the map or in the priority list.</p></div>
  const helped = home.outcome === 'helped'
  const canHelp = !helped && (['warning', 'critical', 'cooling'].includes(home.status) || ['needs_help', 'medical', 'unreachable'].includes(home.outcome))
  const slope = home.slope_f_per_h
  const trendText = home.heating ? (home.status === 'recovering' ? 'Warming up' : 'Heated')
    : home.trend === 'falling' ? (slope != null ? `Falling ${Math.abs(slope).toFixed(1)}°F / h` : 'Falling')
    : 'Holding steady'
  return (
    <div className="house">
      <div className="house-head">
        <div>
          <div className="house-id">{home.id} <span className="muted">Block {home.block}</span></div>
          <div className="house-badges">
            <StatusPill home={home} size="lg" />
            {rank && <span className="badge">Priority #{rank}</span>}
            {home.power_on ? <span className="badge ok"><Zap size={12} /> Power on</span> : <span className="badge bad"><ZapOff size={12} /> No power</span>}
            {home.online === false && <span className="badge"><WifiOff size={12} /> Sensor offline</span>}
          </div>
        </div>
        <div className="big-temp" title="Indoor temperature">{home.temp_f != null ? home.temp_f.toFixed(1) : '—'}<span>°F</span></div>
      </div>
      <div className="stats">
        <Stat icon={Thermometer} label="Trend" value={trendText} tone={home.trend === 'falling' ? 'bad' : ''} />
        <Stat icon={Clock} label="Reaches 60°F" value={home.heating ? '—' : home.hours_to_60 == null ? (home.trend === 'falling' ? 'Measuring…' : 'Not falling') : stormDuration(home.hours_to_60)} />
        <Stat icon={Clock} label="Reaches 50°F" value={home.heating ? '—' : home.hours_to_50 == null ? (home.trend === 'falling' ? 'Measuring…' : 'Not falling') : stormDuration(home.hours_to_50)} tone={home.hours_to_50 != null && home.hours_to_50 < 1 ? 'bad' : ''} />
        <Stat icon={Wind} label="CO" value={ppm(home.co_ppm)} tone={home.co_ppm >= 35 ? 'bad' : ''} />
      </div>
      <div className="people">
        <span><User size={13} /> Age {home.age_band || '—'}</span>
        <span><HeartPulse size={13} /> {home.medical_needs && home.medical_needs.length ? home.medical_needs.join(', ') : 'No medical needs'}</span>
        <span><Languages size={13} /> {LANG[home.language] || home.language}</span>
      </div>
      {!helped && home.outcome === 'unreachable' && (
        <div className="alert-banner">The resident did not answer. Treat as urgent and send help.</div>
      )}
      {helped ? (
        <div className="helped-banner"><Check size={18} strokeWidth={3} /> Help delivered. Power restored{home.status === 'heated' ? ', back to normal.' : ', warming up…'}</div>
      ) : (
        <button type="button" className="btn-help" disabled={!canHelp || helpPending} onClick={() => onHelp(home.id)}>
          <Check size={18} strokeWidth={3} /> {helpPending ? 'Sending…' : 'Mark help delivered'}
        </button>
      )}
      {children}
    </div>
  )
}
