import React, { useEffect, useRef } from "react"
import * as THREE from "three"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader"

const disposeModel = (model) => {
  model.traverse((child) => {
    child.geometry?.dispose()
    const materials = Array.isArray(child.material) ? child.material : [child.material]
    materials.filter(Boolean).forEach((material) => {
      Object.values(material).forEach((value) => {
        if (value?.isTexture) value.dispose()
      })
      material.dispose()
    })
  })
}

export default function AssetPreview({ assetPaths, className, errorClassName }) {
  const containerRef = useRef(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container || !assetPaths) return undefined

    let active = true
    let renderer
    const scene = new THREE.Scene()
    const modelGroup = new THREE.Group()
    scene.add(modelGroup)
    scene.add(new THREE.HemisphereLight(0xffffff, 0x536052, 2))
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.1)
    keyLight.position.set(2, 3, 4)
    scene.add(keyLight)

    const camera = new THREE.PerspectiveCamera(34, 1.55, 0.01, 100)
    camera.position.set(0, 0.2, 3)
    camera.lookAt(0, 0, 0)

    const showFailure = () => {
      const message = document.createElement("span")
      message.className = errorClassName
      message.textContent = "Preview unavailable"
      container.replaceChildren(message)
    }

    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" })
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
      renderer.setSize(256, 160, false)
      renderer.outputColorSpace = THREE.SRGBColorSpace
      renderer.setClearColor(0x000000, 0)
      container.replaceChildren(renderer.domElement)
    } catch {
      showFailure()
      return () => {
        active = false
      }
    }

    const assetUrls = assetPaths.split("|").map((assetPath) => (
      `${import.meta.env.BASE_URL}${assetPath.replace(/^\/+/, "")}`
    ))
    const loader = new GLTFLoader()
    Promise.all(assetUrls.map((url) => loader.loadAsync(url)))
      .then((models) => {
        const roots = models.map((model) => model.scene)
        if (!active) {
          roots.forEach((root) => disposeModel(root))
          return
        }

        roots.forEach((root) => modelGroup.add(root))
        const bounds = new THREE.Box3().setFromObject(modelGroup)
        const size = bounds.getSize(new THREE.Vector3())
        const center = bounds.getCenter(new THREE.Vector3())
        const largestDimension = Math.max(size.x, size.y, size.z, 0.2)
        modelGroup.position.sub(center)
        modelGroup.scale.setScalar(1.7 / largestDimension)
        renderer.render(scene, camera)
      })
      .catch(() => {
        if (active) showFailure()
      })

    return () => {
      active = false
      disposeModel(modelGroup)
      renderer.dispose()
      container.replaceChildren()
    }
  }, [assetPaths, errorClassName])

  return <span ref={containerRef} className={className} aria-hidden="true" />
}