import { Web3Provider } from "@ethersproject/providers"
import { Web3ReactProvider } from "@web3-react/core"
import React, { Suspense } from "react"
import ReactDOM from "react-dom/client"
import * as THREE from "three"
import { AudioProvider } from "./context/AudioContext"

import { AccountProvider } from "./context/AccountContext"
import { SceneContext, SceneProvider } from "./context/SceneContext"
import { ViewProvider } from "./context/ViewContext"

import { SoundProvider } from "./context/SoundContext"

// import i18n (needs to be bundled ;))
import "./lib/localization/i18n"

import { LanguageProvider } from "./context/LanguageContext"
import { AssetRuntimeLoader } from "./library/assetRuntimeLoader"

const App = React.lazy(() => import("./App"))

class AppErrorBoundary extends React.Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, errorInfo) {
    console.error("Character Studio startup error:", error, errorInfo)
  }

  render() {
    if (this.state.error) {
      return (
        <main style={{ padding: "2rem", color: "white", fontFamily: "sans-serif" }}>
          <h1>Character Studio could not start</h1>
          <pre>{this.state.error.stack || this.state.error.message}</pre>
        </main>
      )
    }

    return this.props.children
  }
}

const getLibrary = (provider) => {
  const library = new Web3Provider(provider)
  library.pollingInterval = 12000
  return library
}

const hasDiagnosticParameter = (parameter) => {
  if (typeof window === "undefined") return false
  const value = new URLSearchParams(window.location.search).get(parameter)
  return value === "" || value?.toLowerCase() === "true"
}

const DiagnosticBanner = () => {
  const isolatedClothing = hasDiagnosticParameter("DEBUG_ISOLATED_CLOTHING")
  const attachOnly = hasDiagnosticParameter("DEBUG_CLOTHING_ATTACH_ONLY")
  const realAssembly = hasDiagnosticParameter("DEBUG_REAL_CLOTHING_ASSEMBLY")
  const gltfHierarchy = hasDiagnosticParameter("DEBUG_GLTF_HIERARCHY")
  const loggedRef = React.useRef(false)

  React.useEffect(() => {
    if (loggedRef.current) return
    loggedRef.current = true
    if (isolatedClothing) {
      console.info("[CharacterStudio DIAGNOSTIC] DEBUG_ISOLATED_CLOTHING = TRUE")
    }
    if (attachOnly) {
      console.info("[CharacterStudio DIAGNOSTIC] DEBUG_CLOTHING_ATTACH_ONLY = TRUE")
    }
    if (realAssembly) {
      console.info("[CharacterStudio DIAGNOSTIC] DEBUG_REAL_CLOTHING_ASSEMBLY = TRUE")
    }
    if (gltfHierarchy) {
      console.info("[CharacterStudio DIAGNOSTIC] DEBUG_GLTF_HIERARCHY = TRUE")
    }
  }, [gltfHierarchy, isolatedClothing])

  if (!isolatedClothing && !attachOnly && !realAssembly) return null

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 2147483647,
        padding: "1rem",
        background: "#ffea00",
        color: "#000",
        fontFamily: "sans-serif",
        fontSize: "clamp(1.25rem, 3vw, 2rem)",
        fontWeight: 900,
        lineHeight: 1.2,
        textAlign: "center",
        borderBottom: "4px solid #000",
      }}
    >
      <div>{realAssembly ? "REAL CLOTHING ASSEMBLY DIAGNOSTIC ACTIVE" : attachOnly ? "CLOTHING ATTACHMENT DIAGNOSTIC ACTIVE" : "ISOLATED CLOTHING DIAGNOSTIC ACTIVE"}</div>
      <div>{realAssembly ? "REAL ASSEMBLY PIPELINE — MANUAL CHECKPOINTS" : "BODY / ASSEMBLY / RETARGETING DISABLED"}</div>
    </div>
  )
}

const CLOTHING_TRACE_CHECKPOINTS = [
  "clothing loaded",
  "before clothing processing",
  "after clothing processing",
  "before clothing attachment",
  "after clothing attachment",
  "after pose-binding creation",
  "after skeleton processing",
  "after final assembly",
  "before clothing pose synchronization",
  "after clothing pose synchronization",
]

const isClothingTraceEnabled = () => typeof window !== "undefined"
  && new URLSearchParams(window.location.search).get("DEBUG_CLOTHING_TRACE")?.toLowerCase() === "true"

const ClothingTracePanel = () => {
  const [events, setEvents] = React.useState([])

  React.useEffect(() => {
    if (!isClothingTraceEnabled()) return undefined
    const trace = window.__characterStudioClothingTrace ||= { events: [] }
    setEvents([...trace.events])
    const handleTrace = (event) => setEvents((current) => [...current, event.detail])
    window.addEventListener("characterStudio-clothing-trace", handleTrace)
    return () => window.removeEventListener("characterStudio-clothing-trace", handleTrace)
  }, [])

  if (!isClothingTraceEnabled()) return null

  const latestByCheckpoint = new Map(events.map((event) => [event.checkpoint, event]))
  const order = events.map((event) => event.checkpoint).join(" -> ")
  const formatVector = (value) => value ? `[${value.map((part) => Number(part).toFixed(3)).join(", ")}]` : "-"

  return (
    <aside style={{ position: "fixed", top: "7.5rem", right: "1rem", zIndex: 2147483647, width: "min(34rem, calc(100vw - 2rem))", maxHeight: "min(32rem, calc(100vh - 9rem))", overflowY: "auto", overflowX: "hidden", pointerEvents: "auto", padding: "0.75rem", color: "#fff", background: "rgba(0, 0, 0, 0.86)", fontFamily: "monospace", fontSize: "0.75rem", lineHeight: 1.45 }}>
      <strong>DEBUG_CLOTHING_TRACE</strong>
      <div style={{ margin: "0.4rem 0", whiteSpace: "normal", overflowWrap: "anywhere" }}>ORDER: {order || "waiting"}</div>
      {CLOTHING_TRACE_CHECKPOINTS.map((checkpoint) => {
        const event = latestByCheckpoint.get(checkpoint)
        return (
          <div key={checkpoint} style={{ marginTop: "0.35rem", opacity: event ? 1 : 0.45 }}>
            <div>{event ? "[x]" : "[ ]"} {checkpoint}</div>
            {event && <div style={{ paddingLeft: "1.5rem" }}>
              parent={event.parent || "-"} position={formatVector(event.position)} scale={formatVector(event.scale)} poseBinding={event.poseBindingExists ? "yes" : "no"}
            </div>}
          </div>
        )
      })}
    </aside>
  )
}

const getAttachOnlyAsset = () => {
  const useFullOutfit = new URLSearchParams(window.location.search).get("DEBUG_CLOTHING_ASSET") === "full"
  return useFullOutfit ? {
    id: "quaternius.clothing.male-ranger",
    path: "quaternius/normalized/clothing/quaternius-clothing-male-ranger/Male_Ranger.gltf",
    fileName: "Male_Ranger.gltf",
  } : {
    id: "quaternius.clothing.male-ranger-feet-boots",
    path: "quaternius/normalized/clothing/quaternius-clothing-male-ranger-feet-boots/Male_Ranger_Feet_Boots.gltf",
    fileName: "Male_Ranger_Feet_Boots.gltf",
  }
}

const captureAttachOnlySnapshot = (model, label) => {
  const snapshot = {
    stage: label,
    hierarchy: [],
  }
  model.traverse((object) => {
    const entry = {
      name: object.name || null,
      type: object.type || null,
      parent: object.parent?.name || null,
      children: object.children.map((child) => child.name || child.type),
      position: object.position?.toArray?.() || null,
      rotation: object.rotation?.toArray?.() || null,
      quaternion: object.quaternion?.toArray?.() || null,
      scale: object.scale?.toArray?.() || null,
      matrix: object.matrix?.elements?.slice() || null,
      matrixWorld: object.matrixWorld?.elements?.slice() || null,
    }
    if (object.isSkinnedMesh) {
      entry.bindMode = object.bindMode
      entry.bindMatrix = object.bindMatrix.elements.slice()
      entry.bindMatrixInverse = object.bindMatrixInverse.elements.slice()
      entry.skeleton = {
        uuid: object.skeleton.uuid,
        root: object.skeleton.bones[0]?.name || null,
        boneCount: object.skeleton.bones.length,
        bones: object.skeleton.bones.map((bone) => ({
          name: bone.name,
          uuid: bone.uuid,
          parent: bone.parent?.name || null,
          position: bone.position.toArray(),
          rotation: bone.rotation.toArray(),
          quaternion: bone.quaternion.toArray(),
          scale: bone.scale.toArray(),
          matrix: bone.matrix.elements.slice(),
          matrixWorld: bone.matrixWorld.elements.slice(),
        })),
      }
    }
    snapshot.hierarchy.push(entry)
  })
  console.info("[CharacterStudio DIAGNOSTIC] Attach-only snapshot", snapshot)
  return snapshot
}

const DiagnosticAttachOnlyScene = () => {
  const asset = React.useMemo(getAttachOnlyAsset, [])
  const [state, setState] = React.useState({ loaded: false, stage: 0, error: null, meshCount: 0, boneCount: 0 })
  const canvasRef = React.useRef(null)
  const runtimeRef = React.useRef(null)
  const stageRef = React.useRef(0)

  React.useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x20242a)
    const characterModel = new THREE.Group()
    characterModel.name = "characterModel"
    const camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.01, 100)
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false })
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setSize(window.innerWidth, window.innerHeight)
    scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 2))
    const keyLight = new THREE.DirectionalLight(0xffffff, 2)
    keyLight.position.set(2, 3, 4)
    scene.add(keyLight)
    scene.add(characterModel)

    const fitCamera = (model) => {
      const bounds = new THREE.Box3().setFromObject(model)
      const center = bounds.getCenter(new THREE.Vector3())
      const size = bounds.getSize(new THREE.Vector3())
      const radius = Math.max(size.x, size.y, size.z) / 2
      camera.position.set(center.x, center.y, center.z + Math.max(1, radius / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 1.8))
      camera.lookAt(center)
    }
    const resize = () => {
      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix()
      renderer.setSize(window.innerWidth, window.innerHeight)
    }
    window.addEventListener("resize", resize)
    let animationFrame
    const render = () => {
      animationFrame = requestAnimationFrame(render)
      renderer.render(scene, camera)
    }
    render()

    const loader = new AssetRuntimeLoader({ baseURL: import.meta.env.BASE_URL })
    loader.loadAsync({ id: asset.id, format: "gltf", path: asset.path }).then((loaded) => {
      const model = loaded.scene
      scene.add(model)
      scene.updateMatrixWorld(true)
      const meshes = []
      model.traverse((child) => { if (child.isSkinnedMesh) meshes.push(child) })
      runtimeRef.current = { model, scene, characterModel, fitCamera }
      fitCamera(model)
      captureAttachOnlySnapshot(model, "stage-1-direct-scene")
      stageRef.current = 1
      setState({ loaded: true, stage: 1, error: null, meshCount: meshes.length, boneCount: Math.max(...meshes.map((mesh) => mesh.skeleton?.bones?.length || 0), 0) })
    }).catch((error) => {
      setState({ loaded: false, stage: 0, error: error.message, meshCount: 0, boneCount: 0 })
    })

    return () => {
      cancelAnimationFrame(animationFrame)
      window.removeEventListener("resize", resize)
      renderer.dispose()
    }
  }, [asset])

  const advanceStage = () => {
    const runtime = runtimeRef.current
    if (!runtime || stageRef.current >= 4) return
    const nextStage = stageRef.current + 1
    const { model, scene, characterModel, fitCamera } = runtime
    if (nextStage === 2) {
      scene.remove(model)
      characterModel.add(model)
    }
    if (nextStage === 3) {
      model.position.set(0, 0, 0)
      model.rotation.set(0, 0, 0)
      model.scale.setScalar(1)
      model.updateMatrixWorld(true)
    }
    if (nextStage === 4) {
      scene.updateMatrixWorld(true)
      const bounds = new THREE.Box3().setFromObject(model)
      console.info("[CharacterStudio DIAGNOSTIC] Attach-only bounds", {
        min: bounds.min.toArray(), max: bounds.max.toArray(), size: bounds.getSize(new THREE.Vector3()).toArray(),
      })
    }
    scene.updateMatrixWorld(true)
    captureAttachOnlySnapshot(model, `stage-${nextStage}-${["", "", "characterModel-parent", "root-operations", "bounds"][nextStage]}`)
    fitCamera(model)
    stageRef.current = nextStage
    console.info(`[CharacterStudio DIAGNOSTIC] Attach-only advanced to Stage ${nextStage}`)
    setState((current) => ({ ...current, stage: nextStage }))
  }

  return (
    <>
      <canvas ref={canvasRef} style={{ position: "fixed", inset: 0, width: "100%", height: "100%" }} />
      <div style={{ position: "fixed", top: "7.5rem", left: "1rem", zIndex: 2147483647, pointerEvents: "auto", padding: "0.75rem 1rem", color: "#fff", background: "rgba(0, 0, 0, 0.85)", fontFamily: "sans-serif", fontSize: "1rem", lineHeight: 1.5 }}>
        <div>ATTACH-ONLY ASSET: {asset.fileName}</div>
        <div>GLTF LOADED: {state.loaded ? "YES" : "NO"}</div>
        <div>STAGE: {state.stage || "LOADING"}</div>
        <div>SKINNED MESHES: {state.meshCount}</div>
        <div>SKELETON BONES: {state.boneCount}</div>
        {state.error && <div>ERROR: {state.error}</div>}
        {state.loaded && state.stage < 4 && <button type="button" onClick={advanceStage} style={{ position: "relative", zIndex: 1, pointerEvents: "auto", marginTop: "0.5rem", padding: "0.5rem", cursor: "pointer" }}>Advance to Stage {state.stage + 1}</button>}
      </div>
    </>
  )
}

const DiagnosticIsolatedClothingScene = () => {
  const [status, setStatus] = React.useState({ loaded: false, error: null, meshCount: 0, boneCount: 0 })
  const canvasRef = React.useRef(null)

  React.useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x20242a)
    const camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.01, 100)
    camera.position.set(0, 1, 3)
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false })
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setSize(window.innerWidth, window.innerHeight)
    scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 2))
    const keyLight = new THREE.DirectionalLight(0xffffff, 2)
    keyLight.position.set(2, 3, 4)
    scene.add(keyLight)

    const resize = () => {
      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix()
      renderer.setSize(window.innerWidth, window.innerHeight)
    }
    window.addEventListener("resize", resize)

    let animationFrame
    const render = () => {
      animationFrame = requestAnimationFrame(render)
      renderer.render(scene, camera)
    }
    render()

    const loader = new AssetRuntimeLoader({ baseURL: import.meta.env.BASE_URL })
    loader.loadAsync({
      id: "quaternius.clothing.male-ranger-feet-boots",
      format: "gltf",
      path: "quaternius/normalized/clothing/quaternius-clothing-male-ranger-feet-boots/Male_Ranger_Feet_Boots.gltf",
    }).then((loaded) => {
      const model = loaded.scene
      scene.add(model)
      const meshes = []
      model.traverse((child) => {
        if (child.isSkinnedMesh) meshes.push(child)
      })
      const bounds = new THREE.Box3().setFromObject(model)
      const center = bounds.getCenter(new THREE.Vector3())
      const size = bounds.getSize(new THREE.Vector3())
      const radius = Math.max(size.x, size.y, size.z) / 2
      camera.position.set(center.x, center.y, center.z + Math.max(1, radius / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 1.8))
      camera.lookAt(center)
      setStatus({
        loaded: true,
        error: null,
        meshCount: meshes.length,
        boneCount: meshes.reduce((count, mesh) => Math.max(count, mesh.skeleton?.bones?.length || 0), 0),
      })
    }).catch((error) => {
      setStatus({ loaded: false, error: error.message, meshCount: 0, boneCount: 0 })
    })

    return () => {
      cancelAnimationFrame(animationFrame)
      window.removeEventListener("resize", resize)
      renderer.dispose()
    }
  }, [])

  return (
    <>
      <canvas ref={canvasRef} style={{ position: "fixed", inset: 0, width: "100%", height: "100%" }} />
      <div
        style={{
          position: "fixed",
          top: "7.5rem",
          left: "1rem",
          zIndex: 2147483647,
          padding: "0.75rem 1rem",
          color: "#fff",
          background: "rgba(0, 0, 0, 0.8)",
          fontFamily: "sans-serif",
          fontSize: "1rem",
          lineHeight: 1.5,
        }}
      >
        <div>ISOLATED ASSET: Male_Ranger_Feet_Boots.gltf</div>
        <div>GLTF LOADED: {status.loaded ? "YES" : "NO"}</div>
        <div>SKINNED MESHES: {status.meshCount}</div>
        <div>SKELETON BONES: {status.boneCount}</div>
        {status.error && <div>ERROR: {status.error}</div>}
      </div>
    </>
  )
}

const DiagnosticRealAssemblyScene = () => {
  const {
    assetCatalog,
    assetAssemblyManager,
    assetRuntimeLoader,
  } = React.useContext(SceneContext)
  const [state, setState] = React.useState({ checkpoint: "starting", asset: null, error: null, complete: false })
  const resolverRef = React.useRef(null)
  const startedRef = React.useRef(false)

  React.useEffect(() => {
    if (startedRef.current || !assetAssemblyManager.loader || !assetAssemblyManager.root || !assetCatalog.isLoaded()) return undefined
    startedRef.current = true

    const checkpointHandler = (checkpoint, context) => new Promise((resolve) => {
      resolverRef.current = resolve
      setState({ checkpoint, asset: context.asset?.id || null, error: null, complete: false })
      console.info(`[CharacterStudio DIAGNOSTIC] REAL ASSEMBLY CHECKPOINT: ${checkpoint}`, context)
    })
    assetAssemblyManager.setDiagnosticCheckpointHandler(checkpointHandler)

    const boots = assetCatalog.getById("quaternius.clothing.male-ranger-feet-boots")
    Promise.resolve()
      .then(() => assetAssemblyManager.setAsset("clothing-feet", boots, {
        bodyId: "quaternius.body.superhero-male",
        rig: "quaternius-standard",
      }))
      .then(() => setState((current) => ({ ...current, checkpoint: "complete", complete: true })))
      .catch((error) => setState((current) => ({ ...current, error: error.message, complete: false })))

    return () => {
      resolverRef.current?.()
      assetAssemblyManager.setDiagnosticCheckpointHandler(null)
    }
  }, [assetAssemblyManager, assetCatalog])

  const releaseCheckpoint = async () => {
    if (state.checkpoint === "after-attachment") {
      const body = assetCatalog.getById("quaternius.body.superhero-male")
      const loaded = await assetRuntimeLoader.loadAsync(body)
      const bodyModel = loaded.scene || loaded
      bodyModel.updateMatrixWorld(true)
      let bodyMesh = null
      bodyModel.traverse((child) => {
        if (!bodyMesh && child.isSkinnedMesh && child.skeleton) bodyMesh = child
      })
      if (!bodyMesh) throw new Error("Diagnostic body skeleton was not found")
      assetAssemblyManager.bodySkeleton = bodyMesh.skeleton
      const rootWorldInverse = assetAssemblyManager.root.matrixWorld.clone().invert()
      assetAssemblyManager.bodyRestMatrices = new Map(
        bodyMesh.skeleton.bones.map((bone) => [
          bone.name.toLowerCase(),
          rootWorldInverse.clone().multiply(bone.matrixWorld),
        ]),
      )
      console.info("[CharacterStudio DIAGNOSTIC] Body skeleton state seeded after clothing attachment", {
        boneCount: bodyMesh.skeleton.bones.length,
        boneNames: bodyMesh.skeleton.bones.map((bone) => bone.name),
      })
    }
    const resolve = resolverRef.current
    resolverRef.current = null
    resolve?.()
  }

  return (
    <div style={{ position: "fixed", top: "7.5rem", left: "1rem", zIndex: 2147483647, pointerEvents: "auto", padding: "0.75rem 1rem", color: "#fff", background: "rgba(0, 0, 0, 0.88)", fontFamily: "sans-serif", fontSize: "1rem", lineHeight: 1.5 }}>
      <div>REAL ASSEMBLY ASSET: Male_Ranger_Feet_Boots.gltf</div>
      <div>CHECKPOINT: {state.checkpoint}</div>
      <div>ASSET: {state.asset || "loading clothing"}</div>
      {state.error && <div>ERROR: {state.error}</div>}
      {!state.complete && !state.error && state.checkpoint !== "starting" && <button type="button" onClick={releaseCheckpoint} style={{ position: "relative", zIndex: 1, pointerEvents: "auto", marginTop: "0.5rem", padding: "0.5rem", cursor: "pointer" }}>Release checkpoint</button>}
      {state.complete && <div>REAL ASSEMBLY PIPELINE COMPLETE</div>}
    </div>
  )
}

const NormalApplication = () => (
  <Web3ReactProvider getLibrary={getLibrary}>
    <AccountProvider>
      <LanguageProvider>
        <AudioProvider>
          <ViewProvider>
            <SceneProvider>
              <SoundProvider>
                <ClothingTracePanel />
                <Suspense fallback={<main style={{ padding: "2rem", color: "white", fontFamily: "sans-serif" }}>Loading Character Studio...</main>}>
                  <App />
                </Suspense>
              </SoundProvider>
            </SceneProvider>
          </ViewProvider>
        </AudioProvider>
      </LanguageProvider>
    </AccountProvider>
  </Web3ReactProvider>
)

const DiagnosticAssemblyApplication = () => (
  <Web3ReactProvider getLibrary={getLibrary}>
    <AccountProvider>
      <LanguageProvider>
        <AudioProvider>
          <ViewProvider>
            <SceneProvider>
              <SoundProvider>
                <DiagnosticRealAssemblyScene />
              </SoundProvider>
            </SceneProvider>
          </ViewProvider>
        </AudioProvider>
      </LanguageProvider>
    </AccountProvider>
  </Web3ReactProvider>
)

const RootApplication = () => (
  <AppErrorBoundary>
    <DiagnosticBanner />
    {hasDiagnosticParameter("DEBUG_REAL_CLOTHING_ASSEMBLY")
      ? <DiagnosticAssemblyApplication />
      : hasDiagnosticParameter("DEBUG_CLOTHING_ATTACH_ONLY")
      ? <DiagnosticAttachOnlyScene />
      : hasDiagnosticParameter("DEBUG_ISOLATED_CLOTHING")
      ? <DiagnosticIsolatedClothingScene />
      : <NormalApplication />}
  </AppErrorBoundary>
)

ReactDOM.createRoot(document.getElementById("root")).render(
  <RootApplication />,
)
