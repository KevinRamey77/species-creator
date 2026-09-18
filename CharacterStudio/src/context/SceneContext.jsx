import { AssetCatalog } from "../library/assetCatalog"
import { AssetAssemblyManager } from "../library/assetAssemblyManager"
import { AssetRuntimeLoader } from "../library/assetRuntimeLoader"
import * as THREE from "three"
import React, { createContext, useEffect, useState } from "react"

import gsap from "gsap"
import { sceneInitializer } from "../library/sceneInitializer"
import { LoraDataGenerator } from "../library/loraDataGenerator"
import { SpriteAtlasGenerator } from "../library/spriteAtlasGenerator"
import { ThumbnailGenerator } from "../library/thumbnailsGenerator"

export const SceneContext = createContext({
    /**
 * @typedef {import('../library/characterManager').CharacterManager} CharacterManager
 * @type {CharacterManager}
 */
  characterManager: null,
  /**
   * @typedef {Object} MoveCameraParam
   * @property {number} targetX
   * @property {number} targetY
   * @property {number} targetZ
   * @property {number} distance
   * @param {MoveCameraParam} _value
   */
  // eslint-disable-next-line no-unused-vars
  moveCamera: (_value) => {},
  assetCatalog: null,
  assetCatalogLoading: false,
  assetCatalogError: null,
})

export const SceneProvider = (props) => {
  const [characterManager, setCharacterManager] = useState(null)
  const [loraDataGenerator, setLoraDataGenerator] = useState(null)
  const [spriteAtlasGenerator, setSpriteAtlasGenerator] = useState(null)
  const [decalManager, setDecalManager] = useState(null)
  const [thumbnailsGenerator, setThumbnailsGenerator] = useState(null)
  const [sceneElements, setSceneElements] = useState(null)
  const [animationManager, setAnimationManager] = useState(null)
  const [lookAtManager, setLookAtManager] = useState(null)
  const [scene, setScene] = useState(null)
  const [camera, setCamera] = useState(null)
  const [controls, setControls] = useState(null)
  const [assetCatalog] = useState(() => new AssetCatalog())
  const [assetAssemblyManager] = useState(() => new AssetAssemblyManager())
  const [assetRuntimeLoader] = useState(() => new AssetRuntimeLoader({ baseURL: import.meta.env.BASE_URL }))
  const [assetCatalogLoading, setAssetCatalogLoading] = useState(true)
  const [assetCatalogError, setAssetCatalogError] = useState(null)
  const [selectedRuntimeBody, setSelectedRuntimeBody] = useState(null)
  const [runtimeBodyLoading, setRuntimeBodyLoading] = useState(false)
  const [runtimeBodyError, setRuntimeBodyError] = useState(null)
  const [selectedRuntimeAssets, setSelectedRuntimeAssets] = useState({})

  const [manifest, setManifest] = useState(null)
  const [debugMode, setDebugMode] = useState(false);
  const initRef = React.useRef(false)
  const isolatedClothingRef = React.useRef(false)

  useEffect(() => {
    const catalogURL = `${import.meta.env.BASE_URL}quaternius/runtime-catalog.json`
    console.info("[CharacterStudio] Loading runtime catalog", { catalogURL })
    assetCatalog.load(catalogURL)
      .then((catalog) => {
        const maleBody = catalog.assets.find((asset) => asset.id === "quaternius.body.superhero-male")
        console.info("[CharacterStudio] Runtime catalog loaded", {
          assetCount: catalog.assets.length,
          maleBody,
        })
      })
      .catch((error) => {
        console.error("[CharacterStudio] Runtime catalog failed", error)
        setAssetCatalogError(error)
      })
      .finally(() => {
        setAssetCatalogLoading(false)
      })
  }, [assetCatalog])

  useEffect(()=>{
    if (initRef.current) return
    initRef.current = true

    const {
      scene,
      camera,
      controls,
      characterManager,
      sceneElements
    } = sceneInitializer("editor-scene");
    setCamera(camera);
    setScene(scene);
    setCharacterManager(characterManager);
    setSceneElements(sceneElements);
    setAnimationManager(characterManager.animationManager)
    setLookAtManager(characterManager.lookAtManager)
    setDecalManager(characterManager.overlayedTextureManager)
    setControls(controls);
    setLoraDataGenerator(new LoraDataGenerator(characterManager))
    setSpriteAtlasGenerator(new SpriteAtlasGenerator(characterManager))
    setThumbnailsGenerator(new ThumbnailGenerator(characterManager))
    assetAssemblyManager.root = characterManager.characterModel || characterManager.rootModel
    assetAssemblyManager.loader = assetRuntimeLoader
    assetAssemblyManager.setCatalog(assetCatalog)
    characterManager.assetAssemblyManager = assetAssemblyManager
    characterManager.setRuntimeBodyAuthoritative(true)
    console.info("[CharacterStudio] Scene and asset managers initialized", {
      sceneChildren: scene.children.length,
      characterRootAttached: scene.getObjectById(characterManager.characterModel?.id) === characterManager.characterModel,
      assemblyRoot: assetAssemblyManager.root?.name || "unnamed",
    })
  },[])


  const toggleDebugMode = (isDebug) => {
    if (isDebug == null)
      isDebug = !debugMode;

    setDebugMode(isDebug);
    scene?.traverse((child) => {
      if (child.isMesh) {
        if (child.setDebugMode){
          child.setDebugMode(isDebug);
        }
      }
    });
  }

  const resetRuntimeEditorState = () => {
    toggleDebugMode(false)
    lookAtManager?.setActive(false)
    animationManager?.enableMouseLook(false)
    animationManager?.pause()
    characterManager?.setCharacterVerticalOffset?.(0)
  }
  useEffect(() => {
    if (manifest != null && animationManager != null){
      if (manifest.defaultAnimations?.length > 0){
        const animationPaths = manifest.defaultAnimations.map(animation =>
          typeof animation === "string" ? animation : animation.location
        );
        animationManager.storeDefaultAnimationPaths(animationPaths, "");
      }
    }
  }, [manifest, animationManager])

  const showEnvironmentModels = (display) => {

    if (display){
        scene.add(sceneElements);
    }
    else{
        scene.remove(sceneElements);
    }

  }

  const moveCamera = (value) => {
    if (!controls) return
    gsap.to(controls.target, {
      x: value.targetX ?? 0,
      y: value.targetY ?? 0,
      z: value.targetZ ?? 0,
      duration: 1,
    })

    gsap
      .fromTo(
        controls,
        {
          maxDistance: controls.getDistance(),
          minDistance: controls.getDistance(),
          minPolarAngle: controls.getPolarAngle(),
          maxPolarAngle: controls.getPolarAngle(),
          minAzimuthAngle: controls.getAzimuthalAngle(),
          maxAzimuthAngle: controls.getAzimuthalAngle(),
        },
        {
          maxDistance: value.distance,
          minDistance: value.distance,
          minPolarAngle: Math.PI / 2 - 0.11,
          maxPolarAngle: Math.PI / 2 - 0.11,
          minAzimuthAngle: -0.78,
          maxAzimuthAngle: -0.78,
          duration: 1,
        },
      )
      .then(() => {
        controls.minPolarAngle = 0
        controls.maxPolarAngle = 3.1415
        controls.minDistance = 0.5
        controls.maxDistance = 10
        controls.minAzimuthAngle = Infinity
        controls.maxAzimuthAngle = Infinity
      })
  }

    const frameRuntimeBody = (model) => {
      if (!camera || !controls || !model) return

      const bounds = new THREE.Box3().setFromObject(model)
      if (bounds.isEmpty()) return

      const center = bounds.getCenter(new THREE.Vector3())
      const size = bounds.getSize(new THREE.Vector3())
      const radius = Math.max(size.x, size.y, size.z) / 2
      const distance = Math.min(
        10,
        Math.max(1.5, radius / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 1.35),
      )

      moveCamera({
        targetX: center.x,
        targetY: center.y,
        targetZ: center.z,
        distance,
      })
    }

  useEffect(() => {
    if (isolatedClothingRef.current || !scene || !camera || !controls || !assetCatalog.isLoaded()) return
    const params = new URLSearchParams(window.location.search)
    if (!params.has("DEBUG_ISOLATED_CLOTHING")) return

    const isolatedAsset = assetCatalog.getById("quaternius.clothing.male-ranger-feet-boots")
    if (!isolatedAsset) return
    isolatedClothingRef.current = true

    assetRuntimeLoader.loadAsync(isolatedAsset).then((loaded) => {
      const model = loaded.scene || loaded
      scene.add(model)
      model.updateMatrixWorld(true)
      const bounds = new THREE.Box3().setFromObject(model)
      console.info("[CharacterStudio] ISOLATED CLOTHING SCENE — NO BODY, NO ASSEMBLY, NO RETARGETING", {
        id: isolatedAsset.id,
        parent: model.parent?.name || null,
        bounds: {
          min: bounds.min.toArray(),
          max: bounds.max.toArray(),
          size: bounds.getSize(new THREE.Vector3()).toArray(),
        },
      })
      frameRuntimeBody(model)
    }).catch((error) => {
      console.error("[CharacterStudio] Isolated clothing load failed", error)
      isolatedClothingRef.current = false
    })
  }, [assetCatalog, assetRuntimeLoader, camera, controls, scene])

  const selectRuntimeBody = async (bodyId) => {
    setRuntimeBodyLoading(true)
    setRuntimeBodyError(null)

    try {
      const body = assetCatalog.getById(bodyId)
      if (!body || body.category !== "body") {
        throw new Error("The selected Quaternius body is unavailable")
      }
      if (!characterManager || !assetAssemblyManager.loader) {
        throw new Error("Character rendering is still initializing")
      }
      if (!assetAssemblyManager.root) {
        throw new Error("Character scene is still initializing")
      }

      resetRuntimeEditorState()
      characterManager.removeCurrentCharacter()
      assetAssemblyManager.clear()
      const model = await assetAssemblyManager.setAsset("body", body, {
        rig: "quaternius-standard",
      })
      const rootAttached = scene?.getObjectById(characterManager.characterModel?.id) === characterManager.characterModel
      const bodyAttached = characterManager.characterModel?.getObjectById?.(model.id) === model
      console.info("[CharacterStudio] Male body render path complete", {
        bodyId,
        rootAttached,
        bodyAttached,
        camera: camera ? {
          position: camera.position.toArray(),
          near: camera.near,
          far: camera.far,
        } : null,
        target: controls?.target?.toArray?.() || null,
      })
      setSelectedRuntimeBody(body)
      setSelectedRuntimeAssets({ body: body.id })
      frameRuntimeBody(model)
      return body
    } catch (error) {
      setSelectedRuntimeBody(null)
      setRuntimeBodyError(error.message)
      throw error
    } finally {
      setRuntimeBodyLoading(false)
    }
  }

  const clearRuntimeBody = () => {
    assetAssemblyManager.clear()
    characterManager?.removeCurrentCharacter?.()
    setSelectedRuntimeBody(null)
    setRuntimeBodyError(null)
    setSelectedRuntimeAssets({})
  }

  const selectRuntimeAsset = async (asset) => {
    if (!asset || asset.category === "body") {
      return selectRuntimeBody(asset?.id)
    }

    if (!selectedRuntimeBody) {
      throw new Error("Select a body before adding appearance assets")
    }

    setRuntimeBodyError(null)
    await assetAssemblyManager.setAsset(asset.slot || asset.category, asset, {
      bodyId: selectedRuntimeBody.id,
      rig: "quaternius-standard",
    })
    setSelectedRuntimeAssets((current) => ({
      ...current,
      [asset.slot || asset.category]: asset.id,
    }))
    return asset
  }

  const clearRuntimeAsset = (slot) => {
    if (slot === "clothing") {
      Object.keys(assetAssemblyManager.getActiveSlots())
        .filter((activeSlot) => activeSlot !== "body" && activeSlot !== "hair")
        .forEach((activeSlot) => assetAssemblyManager.removeAsset(activeSlot))
      setSelectedRuntimeAssets((current) => Object.fromEntries(
        Object.entries(current).filter(([activeSlot]) => activeSlot === "body" || activeSlot === "hair"),
      ))
      return
    }

    if (!slot || slot === "body") return
    assetAssemblyManager.removeAsset(slot)
    setSelectedRuntimeAssets((current) => {
      const next = { ...current }
      delete next[slot]
      return next
    })
  }

  return (
    <SceneContext.Provider
      value={{
        manifest,
        setManifest,
        scene,
        decalManager,
        characterManager,
        loraDataGenerator,
        spriteAtlasGenerator,
        thumbnailsGenerator,
        showEnvironmentModels,
        debugMode,
        toggleDebugMode,
        animationManager,
        lookAtManager,
        camera,
        moveCamera,
        controls,
        sceneElements,
        assetCatalog,
        assetCatalogLoading,
        assetCatalogError,
        assetAssemblyManager,
        assetRuntimeLoader,
        resetRuntimeEditorState,
        selectedRuntimeBody,
        runtimeBodyLoading,
        runtimeBodyError,
        selectRuntimeBody,
        clearRuntimeBody,
        selectedRuntimeAssets,
        selectRuntimeAsset,
        clearRuntimeAsset,
      }}
    >
      {props.children}
    </SceneContext.Provider>
  )
}
