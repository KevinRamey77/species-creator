import React from "react"

import { CreatorDataContext } from "../context/CreatorDataContext"
import { SceneContext } from "../context/SceneContext"
import { ViewContext, ViewMode } from "../context/ViewContext"
import { getFoundationById } from "../library/foundationData"
import CreatorLibraryShell from "../components/CreatorLibraryShell"
import styles from "./AgeGender.module.css"

const EDITOR_BODY_BY_GENDER = {
  male: "quaternius.body.superhero-male",
  female: "quaternius.body.superhero-female",
}

const ageGenderOptions = [
  { id: "adult-male", age: "adult", gender: "male", group: "Adult", label: "Male", detail: "Adult form" },
  { id: "adult-female", age: "adult", gender: "female", group: "Adult", label: "Female", detail: "Adult form" },
  { id: "child-male", age: "child", gender: "male", group: "Child", label: "Boy", detail: "Child form" },
  { id: "child-female", age: "child", gender: "female", group: "Child", label: "Girl", detail: "Child form" },
]

export default function AgeGender() {
  const { userCreatedSpecies } = React.useContext(CreatorDataContext)
  const {
    creatorType,
    selectedSpeciesId,
    age,
    setAge,
    gender,
    setGender,
    setViewMode,
  } = React.useContext(ViewContext)
  const { selectRuntimeBody } = React.useContext(SceneContext)
  const [isContinuing, setIsContinuing] = React.useState(false)
  const [loadError, setLoadError] = React.useState("")
  const species = getFoundationById(selectedSpeciesId)
    ?? userCreatedSpecies.find((createdSpecies) => createdSpecies.id === selectedSpeciesId)
  const hasSelection = Boolean(age && gender)
  const canContinue = creatorType === "character" && Boolean(selectedSpeciesId) && hasSelection

  const continueToEditor = async () => {
    if (!canContinue || isContinuing) return

    setLoadError("")
    setIsContinuing(true)
    try {
      await selectRuntimeBody(EDITOR_BODY_BY_GENDER[gender])
      setViewMode(ViewMode.APPEARANCE)
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "The editor body could not be loaded.")
    } finally {
      setIsContinuing(false)
    }
  }

  return (
    <CreatorLibraryShell>
      <div className={styles.screen}>
      <div className={styles.ambient} aria-hidden="true" />
      <header className={styles.topbar}>
        <button
          type="button"
          className={styles.backButton}
          onClick={() => setViewMode(ViewMode.CHARACTER_SPECIES)}
        >
          <span aria-hidden="true">←</span> Choose Species
        </button>
        <span className={styles.brand}>World Engine <i /> Creator</span>
      </header>

      <main className={styles.main}>
        <section className={styles.identity} aria-label="Selected species">
          <div className={styles.identityMark} aria-hidden="true"><span /></div>
          <div>
            <p className={styles.identityLabel}>Creating a character</p>
            <span className={styles.speciesLabel}>Species</span>
            <h2>{species?.name ?? "Species unavailable"}</h2>
          </div>
          <span className={styles.identityIndex}>01 / 02</span>
        </section>

        <section className={styles.heading}>
          <p className={styles.eyebrow}>Character Creator</p>
          <h1>Age &amp; Gender</h1>
          <p className={styles.description}>
            Define the basic identity of your character before entering the character creator.
          </p>
        </section>

        <section className={styles.choiceSection} aria-label="Choose age and gender">
          {[
            { age: "adult", label: "Adult", number: "01", options: ageGenderOptions.slice(0, 2) },
            { age: "child", label: "Child", number: "02", options: ageGenderOptions.slice(2) },
          ].map((group) => (
            <fieldset className={styles.ageGroup} key={group.age}>
              <legend className={styles.groupHeading}>
                <span>{group.number}</span>{group.label}
              </legend>
              <div className={styles.optionGrid}>
                {group.options.map((option) => {
                  const isSelected = age === option.age && gender === option.gender
                  return (
                    <button
                      className={`${styles.option} ${isSelected ? styles.selected : ""}`}
                      type="button"
                      key={option.id}
                      aria-label={`${option.group}, ${option.label}`}
                      aria-pressed={isSelected}
                      onClick={() => {
                        setAge(option.age)
                        setGender(option.gender)
                        setLoadError("")
                      }}
                    >
                      <span className={styles.optionTopline}>
                        <span className={styles.optionDetail}>{option.detail}</span>
                        <span className={styles.selectionMark} aria-hidden="true">{isSelected ? "Selected" : "Select"}</span>
                      </span>
                      <span className={styles.optionTitle}>{option.label}</span>
                      <span className={styles.optionRule} aria-hidden="true" />
                    </button>
                  )
                })}
              </div>
            </fieldset>
          ))}
        </section>

        <aside className={styles.runtimeNote}>
          <span className={styles.noteMark} aria-hidden="true">i</span>
          <p>
            The existing editor currently has male and female base bodies only. Your selected species
            and age are retained as creator state; they do not change the available 3D body in this phase.
          </p>
        </aside>

        <footer className={styles.footer}>
          <span className={styles.footerStatus} aria-live="polite">
            {loadError || (isContinuing ? "Preparing character editor…" : "")}
          </span>
          <button
            className={styles.continueButton}
            type="button"
            disabled={!canContinue || isContinuing}
            onClick={continueToEditor}
          >
            {isContinuing ? "Loading…" : "Continue"}<span aria-hidden="true">→</span>
          </button>
        </footer>
      </main>
      </div>
    </CreatorLibraryShell>
  )
}