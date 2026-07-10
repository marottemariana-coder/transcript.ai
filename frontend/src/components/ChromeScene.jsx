import { useEffect, useRef } from 'react'
import * as THREE from 'three'

// Layout do aglomerado de cubos (shape="cubes") — posições e tamanhos variados,
// cada um com fase própria para flutuar e girar dessincronizado dos outros.
const CUBE_LAYOUT = [
  { p: [0.0, 0.5, 0.0], s: 1.3 },
  { p: [1.15, -0.3, 0.4], s: 0.95 },
  { p: [-1.0, -0.1, 0.25], s: 0.85 },
  { p: [0.4, -1.1, -0.3], s: 1.05 },
  { p: [-0.65, 1.15, -0.5], s: 0.65 },
  { p: [-1.3, -1.05, 0.1], s: 0.6 },
]

function buildSingleGeometry(shape) {
  if (shape === 'icosahedron') return new THREE.IcosahedronGeometry(1.1, 0)
  if (shape === 'octahedron') return new THREE.OctahedronGeometry(1.1, 0)
  return new THREE.TorusGeometry(0.9, 0.3, 32, 64) // "torus" e fallback
}

/**
 * Cena 3D decorativa: objetos de metal escuro polido flutuando sobre o fundo
 * papel, girando devagar e inclinando com o mouse. Puramente decorativa
 * (pointer-events: none no container) — nunca captura clique/scroll.
 */
export default function ChromeScene({ shape = 'cubes', height = 320 }) {
  const mountRef = useRef(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    mount.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100)
    camera.position.set(0, 0, 5)

    // metal preto-tinta polido — luzes brancas fortes é o que faz brilhar
    const material = new THREE.MeshStandardMaterial({ color: 0x141414, metalness: 0.92, roughness: 0.22 })
    scene.add(new THREE.AmbientLight(0xffffff, 0.15))
    const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(4, 6, 8); scene.add(key)
    const fill = new THREE.DirectionalLight(0xffffff, 0.5); fill.position.set(-6, -2, 4); scene.add(fill)
    const rim = new THREE.DirectionalLight(0xffffff, 1.2); rim.position.set(0, 4, -8); scene.add(rim)

    const group = new THREE.Group()
    const geometries = []
    let cubes = []

    if (shape === 'cubes') {
      cubes = CUBE_LAYOUT.map((c, i) => {
        const geometry = new THREE.BoxGeometry(c.s, c.s, c.s)
        geometries.push(geometry)
        const mesh = new THREE.Mesh(geometry, material)
        mesh.position.set(...c.p)
        const phase = i * 1.3
        mesh.rotation.set(phase, phase * 0.7, phase * 0.4)
        group.add(mesh)
        return { mesh, base: c.p, phase, spin: 0.15 + Math.random() * 0.12 }
      })
    } else {
      const geometry = buildSingleGeometry(shape)
      geometries.push(geometry)
      group.add(new THREE.Mesh(geometry, material))
    }
    scene.add(group)

    function resize() {
      const W = mount.clientWidth, H = mount.clientHeight
      if (!W || !H) return
      renderer.setSize(W, H)
      camera.aspect = W / H
      camera.updateProjectionMatrix()
      renderer.render(scene, camera)
    }
    resize()
    window.addEventListener('resize', resize)

    // frame único e estático — sem loop — quando o usuário prefere menos movimento
    if (reduced) {
      return () => {
        window.removeEventListener('resize', resize)
        renderer.dispose()
        material.dispose()
        geometries.forEach((g) => g.dispose())
        if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement)
      }
    }

    // tilt do grupo seguindo o mouse — ouvido no document (o container tem
    // pointer-events: none, então nunca intercepta o mouse do usuário)
    const target = { x: 0, y: 0 }
    const cur = { x: 0, y: 0 }
    function onMouseMove(e) {
      target.x = (e.clientX / window.innerWidth - 0.5) * 2
      target.y = (e.clientY / window.innerHeight - 0.5) * 2
    }
    function onMouseLeave() { target.x = 0; target.y = 0 }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseleave', onMouseLeave)

    let rafId = null
    let visible = false
    let t0 = performance.now()

    function loop(now) {
      const dt = Math.min((now - t0) / 16.7, 3); t0 = now
      const ease = 1 - Math.pow(1 - 0.06, dt)
      cur.x += (target.x - cur.x) * ease
      cur.y += (target.y - cur.y) * ease
      const t = now / 1000

      group.rotation.y = cur.x * 0.5
      group.rotation.x = cur.y * 0.35

      if (shape === 'cubes') {
        cubes.forEach((c) => {
          c.mesh.position.y = c.base[1] + Math.sin(t * 0.6 + c.phase) * 0.15
          c.mesh.position.x = c.base[0] + Math.cos(t * 0.4 + c.phase * 2) * 0.08
          c.mesh.rotation.x += 0.0025 * c.spin * dt
          c.mesh.rotation.y += 0.0035 * c.spin * dt
        })
      } else {
        const mesh = group.children[0]
        mesh.rotation.y = t * 0.15
        mesh.rotation.x = t * 0.08
      }

      renderer.render(scene, camera)
      rafId = requestAnimationFrame(loop)
    }
    function start() {
      if (rafId) return
      t0 = performance.now()
      rafId = requestAnimationFrame(loop)
    }
    function stop() {
      if (rafId) cancelAnimationFrame(rafId)
      rafId = null
    }

    // só roda quando o container está de fato visível na viewport
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        visible = entry.isIntersecting
        if (visible && !document.hidden) start(); else stop()
      })
    }, { threshold: 0.05 })
    io.observe(mount)

    function onVisibilityChange() {
      if (document.hidden) stop()
      else if (visible) start()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    // cleanup completo — obrigatório para não vazar memória ao trocar de rota
    return () => {
      stop()
      io.disconnect()
      window.removeEventListener('resize', resize)
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseleave', onMouseLeave)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      renderer.dispose()
      material.dispose()
      geometries.forEach((g) => g.dispose())
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement)
    }
  }, [shape, height])

  return (
    <div
      ref={mountRef}
      aria-hidden="true"
      style={{ width: '100%', height, pointerEvents: 'none' }}
    />
  )
}
