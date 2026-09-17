import React from "react"
import styles from "./Landing.module.css"
import { ViewMode, ViewContext } from "../context/ViewContext"

import { SoundContext } from "../context/SoundContext"
import { AudioContext } from "../context/AudioContext"

function Landing() {
  const { setViewMode } = React.useContext(ViewContext)
  const { playSound } = React.useContext(SoundContext)
  const { isMute } = React.useContext(AudioContext)

  const createCharacter = () => {
    setViewMode(ViewMode.CREATE)
    !isMute && playSound('backNextButton');
  }

  return (
    <div className={styles.container}>
      <div className={styles.intro}>
        <div className={styles.eyebrow}>Character Studio</div>
        <h1>Build your next avatar</h1>
        <p>Choose a base, then shape the details of your character.</p>
      </div>
      <div className={styles.buttonContainer}>
        <button className={styles.button} onClick={createCharacter}>
          <img src="./assets/media/btn_create_character.png" alt="" />
          <span className={styles.buttonContent}>
            <strong>Create character</strong>
            <small>Choose a body and customize traits</small>
          </span>
        </button>
      </div>
    </div>
  )
}

export default Landing
