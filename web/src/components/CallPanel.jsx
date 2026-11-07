import { PhoneCall, MessageSquareText } from 'lucide-react'
import { mockCall } from '../data/mockHomes'
export default function CallPanel() {
  return <section className="panel call-panel">
    <div className="panel-head"><div><div className="eyebrow">VOICE AGENT / NON-LIVE EXAMPLE</div><h2><PhoneCall size={16}/> Welfare call monitor</h2></div><span className="pill pill-gold">SCRIPTED</span></div>
    <div className="call-meta"><span>HOME <b>{mockCall.home_id}</b></span><span>PHASE <b>{mockCall.phase.toUpperCase()}</b></span><span>LANG <b>{mockCall.language}</b></span></div>
    <div className="transcript"><div className="transcript-label"><MessageSquareText size={14}/> DEMO TRANSCRIPT</div>
      {mockCall.transcript.map((line,i)=><div className="transcript-line" key={i}><strong>{line.speaker}</strong><p>{line.text}</p></div>)}
    </div>
    <div className="extracted"><span>EXTRACTED · SCRIPTED JSON</span><code>{JSON.stringify(mockCall.extracted)}</code></div>
  </section>
}
