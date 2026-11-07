import { CircleOff, RotateCcw, ZapOff } from 'lucide-react'
export default function SimulatorControls({home}) {
  return <section className="panel controls-panel">
    <div className="panel-head"><div><div className="eyebrow">SCENARIO ENGINE / BACKEND REQUIRED</div><h2>Simulation controls</h2></div><span className="pill pill-muted"><CircleOff size={12}/> DISABLED</span></div>
    <p className="controls-info">Visible for Phase 1; controls activate only after Piyush's simulator API is connected. No mock action is presented as successful.</p>
    <div className="control-target"><span>SELECTED HOME</span><strong>{home.id}</strong><span>· BLOCK {home.block}</span></div>
    <div className="control-buttons"><button type="button" disabled><ZapOff size={15}/> Cut power</button><button type="button" disabled>Restore power</button><button type="button" disabled>Block vent</button><button type="button" disabled>Clear vent</button></div>
    <div className="control-parameter"><label htmlFor="outdoor">Outdoor temperature</label><span>Pending API</span><input id="outdoor" type="range" min="-30" max="20" value="-10" disabled readOnly/></div>
    <div className="control-parameter"><label htmlFor="speed">Simulation speed</label><span>Pending API</span><input id="speed" type="range" min="1" max="8" value="1" disabled readOnly/></div>
    <button className="reset-button" type="button" disabled><RotateCcw size={14}/> Reset scenario (API required)</button>
  </section>
}
