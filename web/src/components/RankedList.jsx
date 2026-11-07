import { formatHours } from "../mockHomes"
import DemoTag from "./DemoTag"
import RiskBadge from "./RiskBadge"

export default function RankedList({ homes, selectedId, onSelect }) {
  return (
    <section className="panel list-panel" aria-label="Top 10 risk-ranked homes">
      <header className="panel-head">
        <div>
          <h2>Top 10 by risk</h2>
          <p>Supplied risk, then hours to 50°F</p>
        </div>
        <DemoTag />
      </header>
      <ol className="rank-list">
        {homes.map((home, index) => {
          const selected = home.id === selectedId
          return (
            <li key={home.id}>
              <button
                type="button"
                className={selected ? "rank-row is-selected" : "rank-row"}
                aria-current={selected ? "true" : undefined}
                onClick={() => onSelect(home.id)}
              >
                <span className="rank-num">{index + 1}</span>
                <span className="rank-copy">
                  <span className="rank-title">
                    <span className="rank-id">{home.id}</span>
                    {home.online ? null : <span className="offline-pill">offline</span>}
                  </span>
                  <span className="rank-address">{home.address}</span>
                  <span className="rank-meta">
                    Block {home.block} · to 50°F {formatHours(home.hours_to_50)}
                  </span>
                </span>
                <span className="rank-temp">{home.temp_f.toFixed(1)}°</span>
                <RiskBadge risk={home.risk} />
              </button>
            </li>
          )
        })}
      </ol>
      <p className="panel-foot">
        30 other homes stay on the map. Choosing a row selects its marker.
      </p>
    </section>
  )
}
