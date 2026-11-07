import { Phone, Thermometer, Zap } from "lucide-react"
import { formatHours, LANGUAGE_LABELS } from "../mockHomes"
import DemoTag from "./DemoTag"
import RiskBadge from "./RiskBadge"
import TemperatureChart from "./TemperatureChart"

export default function HomeDetail({ home, rank }) {
  return (
    <section className="panel detail-panel" aria-label="Selected home">
      <header className="panel-head">
        <div>
          <h2>Home detail</h2>
          <p>{home ? `Risk rank ${rank} of 40` : "Nothing selected"}</p>
        </div>
        <DemoTag />
      </header>
      {home ? <DetailBody home={home} /> : (
        <p className="empty-detail">Select a home on the map or in the ranked list.</p>
      )}
    </section>
  )
}

function DetailBody({ home }) {
  const language = LANGUAGE_LABELS[home.language]
    ? `${LANGUAGE_LABELS[home.language]} (${home.language})`
    : home.language

  return (
    <div className="detail-body">
      <div className="detail-title">
        <div>
          <p className="detail-id">{home.id} · {home.household} household</p>
          <p className="detail-address">
            {home.address}, {home.city}
          </p>
          <p className="detail-address">Block {home.block} · {home.area}</p>
        </div>
        <RiskBadge risk={home.risk} />
      </div>

      <p className={`temp-readout risk-${home.risk}`}>
        <Thermometer size={16} aria-hidden="true" />
        <span>{home.temp_f.toFixed(1)}</span>
        <small>°F indoor</small>
      </p>

      <dl className="facts">
        <Fact label="Power status" value={home.power_on ? "Power on" : "Power off"} icon={Zap} />
        <Fact label="CO reading" value={`${home.co_ppm} ppm · ${home.co_label}`} />
        <Fact label="Medical needs" value={home.medical_needs} />
        <Fact label="Call status" value={home.call_status} icon={Phone} />
        <Fact label="Call outcome" value={home.outcome} />
        <Fact label="Age band" value={home.age_band} />
        <Fact label="Language" value={language} />
        <Fact label="Sensor" value={home.online ? "Online" : "Offline"} />
        <Fact label="Last reading" value={home.last_reading} />
        <Fact label="Time to 60°F" value={formatHours(home.hours_to_60)} />
        <Fact label="Time to 50°F" value={formatHours(home.hours_to_50)} />
        <Fact label="Cooling rate" value={`${home.k_est.toFixed(1)} °F/h mock`} />
      </dl>

      <p className="call-note">
        Call status is mock text. This screen does not place calls or dispatch anyone.
      </p>

      <TemperatureChart home={home} />
    </div>
  )
}

function Fact({ label, value, icon: Icon }) {
  return (
    <div>
      <dt>
        {Icon ? <Icon size={12} aria-hidden="true" /> : null}
        {label}
      </dt>
      <dd>{value}</dd>
    </div>
  )
}
