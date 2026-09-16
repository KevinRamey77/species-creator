import { AssetCatalog } from "../library/assetCatalog"
import { AssetAssemblyManager } from "../library/assetAssemblyManager"
import { AssetRuntimeLoader } from "../library/assetRuntimeLoader"
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

  useEffect(() => {
    const catalogURL = `${import.meta.env.BASE_URL}quaternius/runtime-catalog.json`
    assetCatalog.load(catalogURL)
      .catch((error) => {
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
  },[])


  const toggleDebugMode = (isDebug) => {
    if (isDebug == null)
      isDebug = !debugMode;

    setDebugMode(isDebug);
    scene.traverse((child) => {
      if (child.isMesh) {
        if (child.setDebugMode){
          child.setDebugMode(isDebug);
        }
      }
    });
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

      characterManager.removeCurrentCharacter()
      assetAssemblyManager.clear()
      await assetAssemblyManager.setAsset("body", body, {
        rig: "quaternius-standard",
      })
      setSelectedRuntimeBody(body)
      setSelectedRuntimeAssets({ body: body.id })
      moveCamera({ targetY: 0.8, distance: 3.2 })
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
        selectedRuntimeBody,
        runtimeBodyLoading,
        runtimeBodyError,
        selectRuntimeBody,
        clearRuntimeBody,
        selectedRuntimeAssets,
        selectRuntimeAsset,
      }}
    >
      {props.children}
    </SceneContext.Provider>
  )
}
