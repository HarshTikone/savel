import { useState } from 'react'
import HomeMap from './HomeMap'
import BlockGridMap from './BlockGridMap'
import MapLegend from './MapLegend'

export default function MapPanel({ homes, blocks, selectedId, onSelect, runKey, pulseId }) {
  const [mode, setMode] = useState('map')
  return (
    <div className="map-panel">
      <div className="map-toolbar">
        <button type="button" className="btn" onClick={() => setMode((m) => (m === 'map' ? 'grid' : 'map'))}>
          {mode === 'map' ? 'Grid view' : 'Map view'}
        </button>
        {mode === 'grid' && <span className="muted">Block grid view</span>}
      </div>
      <div className="map-body">
        {mode === 'map' ? (
          <HomeMap
            homes={homes}
            blocks={blocks}
            selectedId={selectedId}
            onSelect={onSelect}
            runKey={runKey}
            pulseId={pulseId}
            onTileFail={() => setMode('grid')}
          />
        ) : (
          <BlockGridMap homes={homes} blocks={blocks} selectedId={selectedId} onSelect={onSelect} pulseId={pulseId} />
        )}
      </div>
      <MapLegend />
    </div>
  )
}
