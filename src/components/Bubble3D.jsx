import React, { useEffect, useRef } from 'react'
import * as THREE from 'three'

export default function Bubble3D({ a, b, dir }) {
  const mountRef = useRef(null)

  useEffect(() => {
    const width = 300
    const height = 300
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000)
    camera.position.set(0, 0, 5)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(width, height)
    if (mountRef.current.firstChild) {
      mountRef.current.removeChild(mountRef.current.firstChild)
    }
    mountRef.current.appendChild(renderer.domElement)

    const geometry = new THREE.SphereGeometry(1, 32, 32)
    const material = new THREE.MeshPhongMaterial({ color: 0x3ad1c9, wireframe: true })
    const mesh = new THREE.Mesh(geometry, material)
    mesh.scale.set(a / 50, b / 50, b / 50)
    mesh.rotation.z = (-dir * Math.PI) / 180
    scene.add(mesh)

    const light = new THREE.DirectionalLight(0xffffff, 1)
    light.position.set(2, 2, 3)
    scene.add(light)
    scene.add(new THREE.AmbientLight(0xffffff, 0.5))

    renderer.render(scene, camera)

    return () => {
      renderer.dispose()
      geometry.dispose()
      material.dispose()
    }
  }, [a, b, dir])

  return <div ref={mountRef} />
}
