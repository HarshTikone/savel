import { BatteryWarning, Clock3, HeartPulse, Languages, RadioTower, Thermometer, Zap } from 'lucide-react'
import RiskBadge from './RiskBadge'
import TemperatureChart from './TemperatureChart'
function show(v, unit='') { return v === null || v === undefined || Number.isNaN(v) ? 'Unavailable' : `${v}${unit}` }
export default function HomeDetails({ home }) {
  return <section className="panel detail-panel">
    <div className="panel-head"><div><div className="eyebrow">HOUSEHOLD INTELLIGENCE / SYNTHETIC PROFILE</div><h2>{home.id} <span className="subhead">· BLOCK {home.block}</span></h2></div><RiskBadge status={home.status}/></div>
    <div className="home-metrics">
      <div><Thermometer size={15}/><small>INDOOR TEMP</small><b>{show(home.temp_f,'°F')}</b></div>
      <div><Clock3 size={15}/><small>TIME TO 50°F</small><b>{show(home.hours_to_50,' hrs')}</b></div>
      <div><Zap size={15}/><small>GRID POWER</small><b>{home.power_on?'ON':'OFF'}</b></div>
      <div className={home.co_ppm >=35?'metric-alert':''}><BatteryWarning size={15}/><small>CO SENSOR</small><b>{show(home.co_ppm,' ppm')}</b></div>
    </div>
    <div className="chart-header"><span>THERMAL TREND <small>SIMULATED TIME · °F</small></span><span className="chart-note">Actual / estimate / forecast</span></div>
    <TemperatureChart home={home}/>
    <div className="detail-meta">
      <span><RadioTower size={14}/> Sensor: <b>{home.online?'Online':'Offline · estimated'}</b></span>
      <span><HeartPulse size={14}/> Medical: <b>{home.medical_needs || 'Unknown'}</b></span>
      <span><Languages size={14}/> Language: <b>{home.language || 'Unknown'}</b></span>
      <span>Age band: <b>{home.age_band||'Unknown'}</b></span>
      <span>Learned k: <b>{show(home.k_est)}</b></span>
      <span>Call: <b>{home.call_status?.replaceAll('_',' ')||'Unknown'}</b></span>
    </div>
  </section>
}
