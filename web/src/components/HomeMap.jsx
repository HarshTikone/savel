import { useEffect, useMemo, useRef } from 'react'
import L from 'leaflet'
import { MapContainer, TileLayer, CircleMarker, Rectangle, Marker, Tooltip, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { STATUS_META } from '../data/contract'
import { markerStyle, ALARM, OUTLINE } from '../lib/colors'
import { temp, stormDuration } from '../lib/format'

const TILE_FAIL_LIMIT = 3

// Keeps Leaflet's size in sync with its container and fits to the homes once per run.
// Re-fits after the first size change so the initial (pre-layout) measurement doesn't stick.
function MapController({ homes, runKey }) {
  const map = useMap()
  const fitted = useRef(null)
  const refitOnResize = useRef(true)
  const homesRef = useRef(homes)
  homesRef.current = homes

  const fit = () => {
    const list = homesRef.current
    if (list.length === 0) return false
    map.fitBounds(list.map((h) => [h.lat, h.lon]), { padding: [30, 30] })
    return true
  }

  useEffect(() => {
    if (homes.length === 0 || fitted.current === runKey) return
    map.invalidateSize()
    if (fit()) {
      fitted.current = runKey
      refitOnResize.current = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homes, runKey, map])

  useEffect(() => {
    const el = map.getContainer()
    if (typeof ResizeObserver === 'undefined') return undefined
    const ro = new ResizeObserver(() => {
      map.invalidateSize()
      if (refitOnResize.current && fitted.current !== null) {
        fit()
        refitOnResize.current = false
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map])

  return null
}

export default function HomeMap({ homes, blocks = [], selectedId, onSelect, runKey, pulseId, onTileFail }) {
  const failures = useRef(0)

  const blockBounds = useMemo(() => {
    const out = {}
    for (const h of homes) {
      const b = (out[h.block] ||= { s: h.lat, n: h.lat, w: h.lon, e: h.lon })
      b.s = Math.min(b.s, h.lat)
      b.n = Math.max(b.n, h.lat)
      b.w = Math.min(b.w, h.lon)
      b.e = Math.max(b.e, h.lon)
    }
    return out
  }, [homes])

  const powerOf = (b) => {
    const entry = blocks.find((x) => x.block === b)
    return entry ? entry.power_on : true
  }

  return (
    <MapContainer center={[40.705, -73.995]} zoom={14} className="leaflet-host" scrollWheelZoom={false}>
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        eventHandlers={{
          tileerror: () => {
            failures.current += 1
            if (failures.current >= TILE_FAIL_LIMIT && onTileFail) onTileFail()
          },
        }}
      />
      <MapController homes={homes} runKey={runKey} />
      {Object.entries(blockBounds).map(([b, r]) => {
        const on = powerOf(b)
        const pad = 0.0012
        return (
          <Rectangle
            key={`block-${b}`}
            bounds={[[r.s - pad, r.w - pad], [r.n + pad, r.e + pad]]}
            pathOptions={{ color: on ? OUTLINE : ALARM, weight: 2, dashArray: on ? undefined : '6 4', fill: false }}
          />
        )
      })}
      {Object.entries(blockBounds).map(([b, r]) => {
        const on = powerOf(b)
        const pad = 0.0012
        return (
          <Marker
            key={`label-${b}`}
            position={[r.n + pad, r.w - pad]}
            interactive={false}
            icon={L.divIcon({
              className: 'block-tag',
              html: `<span class="${on ? '' : 'off'}">${on ? `Block ${b}` : `Block ${b} · no power`}</span>`,
              iconSize: [0, 0],
              iconAnchor: [0, 22],
            })}
          />
        )
      })}
      {homes.map((h) => (
        <CircleMarker
          key={h.id}
          center={[h.lat, h.lon]}
          radius={h.id === pulseId ? 13 : 9}
          pathOptions={markerStyle(h, h.id === selectedId)}
          eventHandlers={{ click: () => onSelect(h.id) }}
        >
          <Tooltip>
            {h.id} · {STATUS_META[h.status]?.label ?? h.status} · {temp(h.temp_f)} · {stormDuration(h.hours_to_50)}
          </Tooltip>
        </CircleMarker>
      ))}
    </MapContainer>
  )
}
