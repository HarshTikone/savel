import { Shield, RadioTower, Clock3 } from 'lucide-react'
import { SIM_NOW, formatSimTime } from '../data/mockHomes'
export default function Header() {
  return <header className="topbar">
    <div className="brand-area">
      <div className="brand-emblem" aria-hidden="true"><Shield size={27} strokeWidth={1.6}/></div>
      <div><div className="brand-name">SAVEL<span className="brand-mark"> / C2</span></div><div className="brand-desc">SITUATIONAL AWARENESS · VULNERABILITY EVALUATION · LOGISTICS</div></div>
    </div>
    <div className="topbar-status">
      <span className="pill pill-gold">SIMULATION</span>
      <span className="pill pill-dark"><RadioTower size={13}/> MOCK DATA</span>
      <div className="simclock"><Clock3 size={16}/><span>SIM TIME<br/><b>17 JAN 2026 · {formatSimTime(SIM_NOW)} EST</b></span></div>
    </div>
    <div className="disclaimer">Prototype · No government affiliation · No real dispatch</div>
  </header>
}
