import { useEffect, useRef } from 'react'

// Opening shot for the map: 2 s of a lit, rotating Earth on black, then a 3 s camera dive toward
// North Buffalo while the map fades in underneath. three.js is loaded only for this intro.
const HOLD_MS = 2000
const ZOOM_MS = 3000
const TARGET = { lat: 42.947, lon: -78.852 }   // North Buffalo, where the simulated homes are

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

export default function GlobeIntro({ onDone, onStart }) {
  const host = useRef(null)
  const done = useRef(onDone)
  done.current = onDone
  const start = useRef(onStart)
  start.current = onStart

  useEffect(() => {
    const reduce = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce || typeof WebGLRenderingContext === 'undefined') { done.current(); return undefined }
    let raf = 0
    let disposed = false
    let cleanup = () => {}
    import('three').then((THREE) => {
      if (disposed || !host.current) return
      const el = host.current
      const w = el.clientWidth || 600
      const h = el.clientHeight || 400
      let renderer
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
      } catch {
        done.current(); return
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
      renderer.setSize(w, h)
      renderer.setClearColor(0x000000, 1)
      el.appendChild(renderer.domElement)

      const scene = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera(40, w / h, 0.01, 100)
      const startZ = 3.4
      camera.position.set(0, 0, startZ)

      // stars
      const starGeo = new THREE.BufferGeometry()
      const n = 1400
      const pos = new Float32Array(n * 3)
      for (let i = 0; i < n; i += 1) {
        const r = 30 + Math.random() * 20
        const th = Math.random() * Math.PI * 2
        const ph = Math.acos(2 * Math.random() - 1)
        pos[i * 3] = r * Math.sin(ph) * Math.cos(th)
        pos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th)
        pos[i * 3 + 2] = r * Math.cos(ph)
      }
      starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
      const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.09, sizeAttenuation: true, transparent: true, opacity: 0.85 }))
      scene.add(stars)

      // earth
      const tex = new THREE.TextureLoader().load('/earth.jpg')
      tex.colorSpace = THREE.SRGBColorSpace
      tex.anisotropy = 8
      const earth = new THREE.Mesh(
        new THREE.SphereGeometry(1, 96, 96),
        new THREE.MeshPhongMaterial({ map: tex, shininess: 18, specular: new THREE.Color(0x335577) }),
      )
      const tilt = new THREE.Group()
      tilt.add(earth)
      scene.add(tilt)

      // atmosphere glow (fresnel rim)
      const atmo = new THREE.Mesh(
        new THREE.SphereGeometry(1.08, 64, 64),
        new THREE.ShaderMaterial({
          transparent: true,
          side: THREE.BackSide,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          vertexShader: 'varying vec3 vN; void main(){ vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
          fragmentShader: 'varying vec3 vN; void main(){ float i = pow(0.72 - dot(vN, vec3(0.0,0.0,1.0)), 3.0); gl_FragColor = vec4(0.30, 0.62, 1.0, 1.0) * i * 1.6; }',
        }),
      )
      scene.add(atmo)

      scene.add(new THREE.AmbientLight(0xffffff, 0.28))
      const sun = new THREE.DirectionalLight(0xffffff, 2.1)
      sun.position.set(-3, 1.6, 3.2)
      scene.add(sun)

      // orientation that puts the target under the camera
      const lonRad = THREE.MathUtils.degToRad(TARGET.lon)
      const latRad = THREE.MathUtils.degToRad(TARGET.lat)
      const yawTarget = -lonRad - Math.PI / 2
      const yawStart = yawTarget + 1.9          // start ~110 degrees away and spin into place
      earth.rotation.y = yawStart

      let t0 = 0
      const frame = () => {
        if (!t0) { t0 = performance.now(); if (start.current) start.current() }   // map reveal shares this clock
        if (disposed) return
        const t = performance.now() - t0
        if (t < HOLD_MS) {
          const p = ease(t / HOLD_MS)
          earth.rotation.y = yawStart + (yawTarget - yawStart) * p
          tilt.rotation.x = latRad * 0.55 * p
        } else {
          const p = Math.min(1, (t - HOLD_MS) / ZOOM_MS)
          const e = ease(p)
          earth.rotation.y = yawTarget
          tilt.rotation.x = latRad * (0.55 + 0.45 * e)
          camera.position.z = startZ - (startZ - 1.08) * e    // dive toward the surface
          camera.fov = 40 - 18 * e
          camera.updateProjectionMatrix()
          el.style.opacity = String(p < 0.55 ? 1 : 1 - (p - 0.55) / 0.45)
          if (p >= 1) { done.current(); return }
        }
        stars.rotation.y += 0.0004
        renderer.render(scene, camera)
        raf = requestAnimationFrame(frame)
      }
      raf = requestAnimationFrame(frame)

      cleanup = () => {
        cancelAnimationFrame(raf)
        renderer.dispose()
        tex.dispose()
        if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement)
      }
    }).catch(() => done.current())
    return () => { disposed = true; cleanup() }
  }, [])

  return <div ref={host} className="globe-intro" aria-hidden="true" />
}
