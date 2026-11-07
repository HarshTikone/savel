import { BarChart3 } from 'lucide-react'
export default function AccuracyPanel() {
  return <section className="panel accuracy-panel">
    <div className="panel-head"><div><div className="eyebrow">MODEL PERFORMANCE / 30 & 60 MIN</div><h2><BarChart3 size={17}/> Forecast accuracy</h2></div></div>
    <div className="accuracy-empty"><strong>Insufficient observations</strong><span>Waiting for Piyush's <code>/api/accuracy</code> response</span><p>Will compare learned household k against global k with mean absolute error (°F) and sample count (n). No result is invented.</p></div>
  </section>
}
