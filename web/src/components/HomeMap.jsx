import { useEffect, useMemo, useState } from 'react'
import { MapContainer, Marker, Popup, TileLayer, ZoomControl, useMap } from 'react-leaflet'
import L from 'leaflet'
import { Grid2x2, Map as MapIcon, Layers3 } from 'lucide-react'

function MarkerIcon({ home, selected }) {
  const isOffline = !home.online
  const html = `<div class="map-pin pin-${home.status} ${isOffline ? 'pin-offline' : ''} ${selected ? 'pin-selected' : ''}"><span></span></div>`
  return L.divIcon({ html, className: 'custom-div-icon', iconSize: [23, 23], iconAnchor: [11, 11] })
}
function CenterOnSelected({ home }) {
  const map = useMap()
  useEffect(() => { if (home) map.panTo([home.lat, home.lon], {animate:true, duration:0.3}) }, [map, home?.id])
  return null
}
function BlockGrid({ homes, selectedId, onSelect }) {
  const colors = { heated: '#b8774f', cooling: '#4e9ac5', warning: '#dfbd64', critical: '#244e70', leaving: '#7eb38e' }
  return <div className="block-grid block-svg">
    <svg viewBox="0 0 520 325" role="group" aria-label="Offline geographical alternative: four blocks with 40 selectable synthetic homes">
      {['A','B','C','D'].map((block, blockIdx) => {
        const baseX = (blockIdx % 2) * 262 + 8
        const baseY = Math.floor(blockIdx / 2) * 162 + 6
        const blockHomes = homes.filter(h => h.block === block)
        return <g key={block}>
          <rect x={baseX} y={baseY} width="247" height="150" rx="6" fill="#1b3245" stroke="#3d5568" strokeWidth="1" />
          <text x={baseX + 16} y={baseY + 22} fill="#dfbf83" fontSize="13" fontWeight="700" letterSpacing="2">BLOCK {block}</text>
          <text x={baseX+221} y={baseY+22} fill="#91aabd" fontSize="10" textAnchor="end">10 HOMES</text>
          {blockHomes.map((h, i) => {
            const x = baseX + 18 + (i % 5) * 44
            const y = baseY + 38 + Math.floor(i / 5) * 51
            const selected = selectedId === h.id
            return <g key={h.id} tabIndex={0} role="button" aria-label={`Select ${h.id}: ${h.status}${!h.online ? ', offline' : ''}`}
              onClick={() => onSelect(h.id)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') {e.preventDefault();onSelect(h.id)} }}
              style={{cursor:'pointer'}}>
              <title>{h.id}: {h.status}, risk {h.risk}{!h.online ? ', sensor offline' : ''}</title>
              <rect x={x} y={y} width="34" height="33" rx="4" fill={colors[h.status] || '#477291'} fillOpacity="0.36"
                stroke={selected ? '#fff' : h.status === 'critical' ? '#f07881' : colors[h.status] || '#8caabd'}
                strokeWidth={selected ? 3 : 1.8} strokeDasharray={!h.online ? '4 3' : undefined}/>
              <text x={x + 17} y={y + 21} textAnchor="middle" fill="#f3f7f9" fontSize="12" fontWeight="700">{h.id.slice(-2)}</text>
            </g>
          })}
        </g>
      })}
    </svg>
  </div>
}
export default function HomeMap({ homes, selectedId, onSelect }) {
  const [mode, setMode] = useState('map')
  const [tileErrors, setTileErrors] = useState(0)
  const selectedHome = useMemo(() => homes.find(h => h.id === selectedId), [homes,selectedId])
  useEffect(() => { if (tileErrors >= 3) setMode('grid') }, [tileErrors])
  return <section className="panel map-panel">
    <div className="panel-head map-head"><div><div className="eyebrow">GEO-SPATIAL AWARENESS / BUFFALO, NY</div><h2>Operational threat map</h2></div>
      <div className="map-switch" role="group" aria-label="Map display"><button type="button" aria-pressed={mode === 'map'} onClick={() => {setTileErrors(0);setMode('map')}}><MapIcon size={15}/> Map</button><button type="button" aria-pressed={mode === 'grid'} onClick={() => setMode('grid')}><Grid2x2 size={15}/> Grid fallback</button></div>
    </div>
    <div className="map-body">
      {mode === 'map' ? <MapContainer center={[42.907,-78.863]} zoom={12} zoomControl={false} scrollWheelZoom={false} className="leaflet-map">
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" eventHandlers={{ tileerror: () => setTileErrors(n=>n+1) }} />
        <ZoomControl position="bottomright" />
        <CenterOnSelected home={selectedHome}/>
        {homes.map(home => <Marker key={home.id} position={[home.lat,home.lon]} icon={MarkerIcon({home,selected:selectedId===home.id})} eventHandlers={{click:()=>onSelect(home.id)}}>
          <Popup><strong>{home.id} · BLOCK {home.block}</strong><br/>{home.temp_f}°F · {home.status}{!home.online ? ' · sensor offline' : ''}<br/>Risk {home.risk}/100</Popup>
        </Marker>)}
      </MapContainer> : <BlockGrid homes={homes} selectedId={selectedId} onSelect={onSelect} />}
      <div className="map-source"><Layers3 size={12}/> {mode==='grid' ? 'LOCAL BLOCK GRID · NO TILE DEPENDENCY':'OPENSTREETMAP TILE LAYER'} <span>· DEMO / MOCK</span></div>
    </div>
    <div className="map-legend"><span>STATUS KEY</span>{[['heated','Heated'],['cooling','Cooling'],['warning','Warning'],['critical','Critical'],['leaving','Leaving']].map(([s,label])=><div className="legend-label" key={s}><span className={`legend-dot dot-${s}`}/>{label}</div>)}<div className="legend-label"><span className="legend-dot dot-offline"/> Offline</div></div>
  </section>
}
