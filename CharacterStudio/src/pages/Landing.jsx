import React from "react"
import styles from "./Landing.module.css"
import { ViewMode, ViewContext } from "../context/ViewContext"

import { SoundContext } from "../context/SoundContext"
import { AudioContext } from "../context/AudioContext"
import { SceneContext } from "../context/SceneContext"

import { connectWallet } from "../library/mint-utils"

const opensea_Key = import.meta.env.VITE_OPENSEA_KEY;

function Landing() {
  const { setViewMode } = React.useContext(ViewContext)
  const { playSound } = React.useContext(SoundContext)
  const { isMute } = React.useContext(AudioContext)
  const { characterManager } = React.useContext(SceneContext)

  const createCharacter = () => {
    setViewMode(ViewMode.CREATE)
    !isMute && playSound('backNextButton');
  }

  const createVRMCharacter = () => {
    setViewMode(ViewMode.CLAIM)
    !isMute && playSound('backNextButton');
  }

  const optimizeCharacter = () => {
    setViewMode(ViewMode.OPTIMIZER)
    characterManager.loadOptimizerManifest();
    !isMute && playSound('backNextButton');
  }
  const getWallet = async() => {
    const address = await connectWallet()
    if (address != "")setViewMode(ViewMode.WALLET)
    !isMute && playSound('backNextButton');
  }

  const loadCharacter = () => {
    setViewMode(ViewMode.LOAD)
    !isMute && playSound('backNextButton');
  }

  const actions = [
    {
      label: "Create character",
      description: "Choose a base and customize traits",
      image: "./assets/media/btn_create_character.png",
      action: createCharacter,
    },
    {
      label: "Batch character",
      description: "Generate characters from metadata",
      image: "./assets/media/btn_batch_download_character.png",
      action: createVRMCharacter,
    },
    {
      label: "Optimize character",
      description: "Prepare an existing avatar for export",
      image: "./assets/media/btn_optimize_character.png",
      action: optimizeCharacter,
    },
    {
      label: "Load character",
      description: "Load an owned character from your wallet",
      image: "./assets/media/btn_load_character.png",
      action: loadCharacter,
    },
  ]

  return (
    <div className={styles.container}>
      <div className={styles.intro}>
        <div className={styles.eyebrow}>Character Studio</div>
        <h1>Build your next avatar</h1>
        <p>Choose a workflow to start creating, processing, or exporting a character.</p>
      </div>
      <div className={styles.buttonContainer}>
        {actions.map((item) => (
          <button className={styles.button} onClick={item.action} key={item.label}>
            <img src={item.image} alt="" />
            <span className={styles.buttonContent}>
              <strong>{item.label}</strong>
              <small>{item.description}</small>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

export default Landing
