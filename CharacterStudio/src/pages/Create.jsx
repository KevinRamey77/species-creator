import React from "react"
import styles from "./Create.module.css"
import { ViewMode, ViewContext } from "../context/ViewContext"
import CustomButton from "../components/custom-button"
import { LanguageContext } from "../context/LanguageContext"
import { useContext } from "react"

import { SceneContext } from "../context/SceneContext"
import { SoundContext } from "../context/SoundContext"
import { AudioContext } from "../context/AudioContext"


const BODY_IDS = [
  "quaternius.body.superhero-male",
  "quaternius.body.superhero-female",
]

function Create() {
  
  const {t} = useContext(LanguageContext);

  const { setViewMode } = React.useContext(ViewContext)
  const { playSound } = React.useContext(SoundContext)
  const { isMute } = React.useContext(AudioContext)
  const {
    assetCatalog,
    assetCatalogLoading,
    assetCatalogError,
    selectRuntimeBody,
    runtimeBodyLoading,
    runtimeBodyError,
  } = React.useContext(SceneContext)

  const back = () => {
    setViewMode(ViewMode.LANDING)
    !isMute && playSound('backNextButton');
  }

  const bodies = BODY_IDS.map((bodyId) => assetCatalog?.getById(bodyId)).filter(Boolean)

  const selectBody = async (body) => {
    try {
      await selectRuntimeBody(body.id)
      setViewMode(ViewMode.APPEARANCE)
      !isMute && playSound('classSelect')
    } catch (error) {
      console.error("Unable to load Quaternius body:", error)
    }
  }

  const hoverSound = () => {
    !isMute && playSound('classMouseOver');
  }

  const activateOnEnter = (event, action) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      action()
    }
  }
  
  return (
    <div className={`${styles.container} horizontalScroll`}>
      <div className={"sectionTitle"}>{t('pageTitles.chooseClass')}</div>
      <div className={styles.vrmOptimizerButton}>
      </div>

      
      <div className={styles.topLine} />
      
      <div className={styles.classContainer}>
        {assetCatalogLoading && (
          <div className={styles.statusMessage}>Loading Quaternius bodies...</div>
        )}
        {!assetCatalogLoading && assetCatalogError && (
          <div className={styles.statusMessage}>Quaternius bodies could not be loaded.</div>
        )}
        {!assetCatalogLoading && !assetCatalogError && bodies.length === 0 && (
          <div className={styles.statusMessage}>
            No Male or Female body assets are available.
          </div>
        )}
        {bodies.map((body) => {
          const isFemale = body.id.endsWith("female")
          const name = isFemale ? "Female" : "Male"
          return (
            <div
              key={body.id}
              className={styles.class}
              role="button"
              tabIndex={0}
              aria-label={`Select ${name} Human`}
              onKeyDown={(event) => activateOnEnter(event, () => selectBody(body))}
              onClick={() => selectBody(body)}
              onMouseOver={() => hoverSound()}
            >
              <div className={styles.classFrame}>
                <svg
                  className={styles.portraitIllustration}
                  viewBox="0 0 200 200"
                  aria-hidden="true"
                >
                  <circle
                    cx="100"
                    cy="52"
                    r="22"
                    fill={isFemale ? "#f6d9df" : "#dfeaff"}
                    stroke="#edf2ff"
                    strokeWidth="5"
                  />
                  <path
                    d={
                      isFemale
                        ? "M75 46 C87 22, 113 22, 125 46 L118 68 H82 Z"
                        : "M80 42 H120 L116 64 H84 Z"
                    }
                    fill={isFemale ? "#d77ca8" : "#7ea3d9"}
                  />
                  <path d="M100 74 L100 120" stroke="#edf2ff" strokeWidth="8" strokeLinecap="round" />
                  <path d="M100 92 L74 112" stroke="#edf2ff" strokeWidth="8" strokeLinecap="round" />
                  <path d="M100 92 L126 112" stroke="#edf2ff" strokeWidth="8" strokeLinecap="round" />
                  <path d="M100 120 L82 152" stroke="#edf2ff" strokeWidth="8" strokeLinecap="round" />
                  <path d="M100 120 L118 152" stroke="#edf2ff" strokeWidth="8" strokeLinecap="round" />
                  <path d="M88 82 L111 82" stroke="#edf2ff" strokeWidth="5" strokeLinecap="round" opacity="0.8" />
                </svg>
                <div className={styles.frameContainer}>
                  <img
                    src={"./assets/backgrounds/class-frame.svg"}
                    alt=""
                    className={styles.frame}
                  />
                </div>
              </div>

              <div className={styles.name}>{name}</div>
              <div className={styles.description}>Human</div>
            </div>
          )
        })}
      </div>

      <div className={styles.bottomLine} />
      {runtimeBodyLoading && <div className={styles.statusMessage}>Loading selected body...</div>}
      {!runtimeBodyLoading && runtimeBodyError && (
        <div className={styles.statusMessage}>Unable to render the selected body: {runtimeBodyError}</div>
      )}
      <div className={styles.buttonContainer}>
        { <CustomButton
          theme="light"
          text={t('callToAction.back')}
          size={14}
          className={styles.buttonLeft}
          onClick={back}
      />}
      </div>
    </div>
  )
}

export default Create
