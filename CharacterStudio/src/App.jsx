import React, { Fragment, useContext, useEffect, useRef, useState } from "react"
import * as THREE from "three"

import { LanguageContext } from "./context/LanguageContext"
import { SceneContext } from "./context/SceneContext"
import { ViewContext, ViewMode } from "./context/ViewContext"
import { EffectManager } from "./library/effectManager"
import MessageWindow from "./components/MessageWindow"

import Background from "./components/Background"

import Appearance from "./pages/Appearance"
import Create from "./pages/Create"
import Landing from "./pages/Landing"

export const resolveAssetImportPath = (assetPath) => {
  const normalized = typeof assetPath === "string" ? assetPath.trim() : ""
  const safeBase = normalized && normalized !== "undefined" ? normalized : "./"
  const cleanBase = safeBase.endsWith("/") ? safeBase.slice(0, -1) : safeBase
  return cleanBase ? `${cleanBase}/manifest.json` : "./manifest.json"
}

// dynamically import the manifest
const assetImportPath = resolveAssetImportPath(import.meta.env.VITE_ASSET_PATH)

const cameraDistanceOther = 6
const centerCameraTargetOther = new THREE.Vector3(0, 0.8, 0)
const centerCameraPositionOther = new THREE.Vector3(
  -2.2367993753934425,
  1.1512971720174363,
  2.2612065299409223,
) // note: get from `moveCamera({ targetY: 0.8, distance: 3.2 })`
async function fetchManifest(location) {
  try {
    const response = await fetch(location);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch manifest. Status: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Error fetching manifest: ${error.message}`);
    return [];
  }
}


async function fetchAll() {
  const initialManifest = await fetchManifest(assetImportPath)
  const effectManager = new EffectManager()

  return {
    initialManifest,
    effectManager,
  }
}

const fetchData = () => {
  let status, result

  const manifestPromise = fetchAll()
  // const modelPromise = fetchModel()
  const suspender = manifestPromise.then(
    (r) => {
      status = "success"
      result = r
    },
    (e) => {
      status = "error"
      result = e
    },
  )

  return {
    read() {
      if (status === "error") {
        throw result
      } else if (status === "success") {
        return result
      }
      throw suspender
    },
  }
}

const resource = typeof window === "undefined" || import.meta.env.MODE === "test"
  ? {
      read: () => ({
        initialManifest: [],
        effectManager: new EffectManager(),
      }),
    }
  : fetchData()

export default function App() {
  const {
    initialManifest,
    effectManager,
  } = resource.read()
  const [hideUi, setHideUi] = useState(false)
  const {
    camera,
    controls,
    scene,
    characterManager,
    moveCamera,
    setManifest,
    lookAtManager,
    showEnvironmentModels,
    assetCatalog,
    assetCatalogLoading,
    selectRuntimeBody,
    selectedRuntimeBody,
  } = useContext(SceneContext)
  const { viewMode, setViewMode } = useContext(ViewContext)

  effectManager.camera = camera
  effectManager.scene = scene

  const updateCameraPosition = () => {
    if (!effectManager.camera) return

      moveCamera({
        // center
        targetX: 0,
        targetY: centerCameraTargetOther.y,
        targetZ: 0,
        distance: cameraDistanceOther,
      })

    if (controls) {
      if (
        [ViewMode.APPEARANCE, ViewMode.SAVE, ViewMode.OPTIMIZER, ViewMode.BATCHDOWNLOAD, ViewMode.BATCHMANIFEST].includes(viewMode)
      ) {
        controls.enabled = true
      } else {
        controls.enabled = false
      }
    }
  }

  const [confirmDialogWindow, setConfirmDialogWindow] = useState(false)
  const [confirmDialogText, setConfirmDialogText] = useState("")
  const [confirmDialogCallback, setConfirmDialogCallback] = useState([])

  const confirmDialog = (msg, callback) => {
    setConfirmDialogText(msg)
    setConfirmDialogWindow(true)
    setConfirmDialogCallback([callback])
  }

  // map current app mode to a page
  const pages = {
    [ViewMode.LANDING]: <Landing />,
    [ViewMode.CREATE]: <Create />,
    [ViewMode.APPEARANCE]: <Appearance confirmDialog={confirmDialog} />,
  }

  let lastTap = 0
  useEffect(() => {
    const handleTap = (e) => {
      const now = new Date().getTime()
      const timesince = now - lastTap
      if (timesince < 300 && timesince > 10) {
        const tgt = e.target
        if (tgt.id == "editor-scene") setHideUi(!hideUi)
      }
      lastTap = now
    }
    window.addEventListener("touchend", handleTap)
    window.addEventListener("click", handleTap)
    return () => {
      window.removeEventListener("touchend", handleTap)
      window.removeEventListener("click", handleTap)
    }
  }, [hideUi])

  useEffect(() => {
    if (lookAtManager != null){
      updateCameraPosition()
      lookAtManager.enabled = true
      if ([ViewMode.LANDING, ViewMode.CREATE, ViewMode.CLAIM, ViewMode.LOAD, ViewMode.CLAIM, ViewMode.CLAIM].includes(viewMode))
        showEnvironmentModels(false)
      else
        showEnvironmentModels(true)
      window.addEventListener("resize", updateCameraPosition)
      return () => {
        window.removeEventListener("resize", updateCameraPosition)
      }
    }
    

  }, [viewMode, lookAtManager])

  useEffect(() => {
    setManifest(initialManifest)
  }, [initialManifest])

  // Translate hook
  const {t} = useContext(LanguageContext);

  return (
    <Fragment>
      
      <MessageWindow
        confirmDialogText = {confirmDialogText}
        confirmDialogCallback = {confirmDialogCallback}
        confirmDialogWindow = {confirmDialogWindow}
        setConfirmDialogWindow = {setConfirmDialogWindow}
      />
      <Background />
      
      {pages[viewMode] ?? pages[ViewMode.LANDING]}
      
    </Fragment>
  )
}
