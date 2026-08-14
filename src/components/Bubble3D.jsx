import React, { useEffect, useRef } from 'react'

/**
 * 3D soap-bubble view. Lazy-loads three.js (so it stays out of the main bundle)
 * and renders an iridescent, refracting ellipsoid that follows the *same* live
 * physics as the 2D view: the measured semi-axes (a, b) drive its scale and the
 * measured tilt drives its in-plane rotation. Same simulation, real 3D shading.
 *
 * @param {() => ({a,b,angle,R0,popped})|null} getFrame  latest measured shape
 */
export default function Bubble3D({ getFrame, width = 720, height = 380 }) {
  const mountRef = useRef(null)

  useEffect(() => {
    let raf = 0
    let cancelled = false
    let cleanup = () => {}

    ;(async () => {
      const THREE = await import('three')
      const { RoomEnvironment } = await import('three/examples/jsm/environments/RoomEnvironment.js')
      if (cancelled || !mountRef.current) return

      const scene = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera(34, width / height, 0.1, 100)
      camera.position.set(0, 0, 5)

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
      renderer.setSize(width, height, false)
      Object.assign(renderer.domElement.style, {
        width: '100%', height: 'auto', display: 'block', border: 'none', borderRadius: '12px',
      })
      mountRef.current.appendChild(renderer.domElement)

      // An environment gives the transmissive film something to reflect/refract.
      const pmrem = new THREE.PMREMGenerator(renderer)
      const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04)
      scene.environment = envRT.texture

      const geo = new THREE.SphereGeometry(1, 64, 48)
      const mat = new THREE.MeshPhysicalMaterial({
        transmission: 1, thickness: 1.1, roughness: 0.06, metalness: 0,
        ior: 1.15, iridescence: 1, iridescenceIOR: 1.3, iridescenceThicknessRange: [120, 780],
        clearcoat: 0.5, clearcoatRoughness: 0.25, transparent: true, envMapIntensity: 1.3,
        attenuationColor: new THREE.Color(0xbfe6ff), attenuationDistance: 6,
      })
      const bubble = new THREE.Mesh(geo, mat)
      bubble.rotation.x = 0.28 // slight tilt so the ellipsoid reads as 3D
      scene.add(bubble)

      const key = new THREE.DirectionalLight(0xffffff, 1.0)
      key.position.set(3, 4, 5)
      scene.add(key)
      scene.add(new THREE.AmbientLight(0xffffff, 0.35))

      const render = () => {
        raf = requestAnimationFrame(render)
        const f = getFrame && getFrame()
        if (f && f.R0) {
          const sx = Math.max(0.2, f.a / f.R0)
          const sy = Math.max(0.2, f.b / f.R0)
          bubble.scale.set(sx, sy, Math.sqrt(sx * sy))
          bubble.rotation.z = f.angle || 0
          bubble.visible = !f.popped
        }
        renderer.render(scene, camera)
      }
      render()

      cleanup = () => {
        cancelAnimationFrame(raf)
        geo.dispose()
        mat.dispose()
        envRT.dispose?.()
        pmrem.dispose()
        renderer.dispose()
        renderer.domElement.remove()
      }
    })().catch((e) => {
      // WebGL unavailable — leave a gentle note rather than a blank box.
      if (mountRef.current) {
        mountRef.current.innerHTML =
          '<div class="notice small" style="margin:0">3D view needs WebGL, which this browser blocked. The 2D view has the same physics.</div>'
      }
      console.warn('Bubble3D:', e?.message || e)
    })

    return () => {
      cancelled = true
      cleanup()
    }
  }, [getFrame, width, height])

  return <div ref={mountRef} className="sim3d" style={{ width: '100%' }} />
}
