import React from "react"

import { CreatorDataContext } from "../context/CreatorDataContext"
import { ViewContext, ViewMode } from "../context/ViewContext"
import { FOUNDATION_CATEGORIES, getFoundationById } from "../library/foundationData"
import { normalizePhysicalProfile, validatePhysicalProfile } from "../library/speciesData"
import CreatorLibraryShell from "../components/CreatorLibraryShell"
import FoundationArtworkSlot from "../components/FoundationArtworkSlot"
import styles from "./SpeciesEditor.module.css"

const BODY_BUILDS = [
  ["small-compact", "Small / compact"],
  ["lean", "Lean"],
  ["average", "Average"],
  ["muscular", "Muscular"],
  ["heavy", "Heavy"],
  ["massive", "Massive"],
  ["variable", "Variable / mixed"],
]

const LOCOMOTION_OPTIONS = [
  ["bipedal", "Bipedal"],
  ["quadrupedal", "Quadrupedal"],
  ["avian", "Avian"],
  ["serpentine", "Serpentine"],
  ["aquatic", "Aquatic"],
  ["burrowing", "Burrowing"],
  ["arboreal", "Arboreal"],
  ["multi-limbed", "Multi-limbed"],
  ["variable", "Variable"],
]

const RANGE_FIELDS = [
  { key: "height", label: "Height", step: 1, units: [["in", "inches"], ["cm", "centimeters"]] },
  { key: "weight", label: "Weight", step: 0.1, units: [["lb", "pounds"], ["kg", "kilograms"]] },
  { key: "lifespan", label: "Lifespan", step: 1, units: [["years", "years"]] },
]

function PhysicalRangeField({ rangeName, label, range, step, units, error, onChange }) {
  const minId = `${rangeName}-minimum`
  const maxId = `${rangeName}-maximum`
  const unitId = `${rangeName}-unit`
  const errorId = `${rangeName}-error`

  return (
    <fieldset className={styles.rangeField}>
      <legend>{label}</legend>
      <div className={styles.rangeInputs}>
        <label htmlFor={minId}>
          <span>Minimum {label.toLowerCase()}</span>
          <input
            id={minId}
            type="number"
            min="0"
            step={step}
            inputMode="decimal"
            value={range.min ?? ""}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : `${rangeName}-unit-note`}
            onChange={(event) => onChange(rangeName, "min", event.target.value)}
          />
        </label>
        <label htmlFor={maxId}>
          <span>Maximum {label.toLowerCase()}</span>
          <input
            id={maxId}
            type="number"
            min="0"
            step={step}
            inputMode="decimal"
            value={range.max ?? ""}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : `${rangeName}-unit-note`}
            onChange={(event) => onChange(rangeName, "max", event.target.value)}
          />
        </label>
      </div>
      <label className={styles.unitField} htmlFor={unitId}>
        <span>Unit</span>
        <select id={unitId} value={range.unit} onChange={(event) => onChange(rangeName, "unit", event.target.value)}>
          {units.map(([value, unitLabel]) => <option key={value} value={value}>{unitLabel}</option>)}
        </select>
      </label>
      <p id={`${rangeName}-unit-note`} className={styles.rangeNote}>Species-wide typical range, not an individual measurement.</p>
      {error && <p id={errorId} className={styles.rangeError} role="alert">{error}</p>}
    </fieldset>
  )
}

export default function SpeciesEditor() {
  const { selectedFoundationId, setViewMode } = React.useContext(ViewContext)
  const {
    createSpecies,
    updateSpecies,
    editingSpeciesId,
    setEditingSpeciesId,
    getSpeciesById,
  } = React.useContext(CreatorDataContext)
  const editingSpecies = getSpeciesById(editingSpeciesId)
  const foundation = getFoundationById(editingSpecies?.foundationId ?? selectedFoundationId)
  const category = FOUNDATION_CATEGORIES.find(({ id }) => id === foundation?.category)
  const [name, setName] = React.useState(() => editingSpecies?.name ?? "")
  const [concept, setConcept] = React.useState(() => editingSpecies?.concept ?? "")
  const [description, setDescription] = React.useState(() => editingSpecies?.description ?? "")
  const [traits, setTraits] = React.useState(() => editingSpecies?.traits ?? [])
  const [physicalProfile, setPhysicalProfile] = React.useState(() => normalizePhysicalProfile(editingSpecies?.physicalProfile))
  const [savedRecord, setSavedRecord] = React.useState(() => editingSpecies)
  const [saveMessage, setSaveMessage] = React.useState("")
  const [nameError, setNameError] = React.useState("")
  const [saveError, setSaveError] = React.useState("")
  const [pendingDestination, setPendingDestination] = React.useState(null)
  const normalizedTraits = traits.map((trait) => trait.trim()).filter(Boolean)
  const normalizedPhysicalProfile = normalizePhysicalProfile(physicalProfile)
  const physicalProfileErrors = validatePhysicalProfile(normalizedPhysicalProfile)
  const baseline = savedRecord ?? { name: "", concept: "", description: "", traits: [], physicalProfile: null }
  const isDirty = name.trim() !== baseline.name
    || concept.trim() !== (baseline.concept ?? "")
    || description.trim() !== (baseline.description ?? "")
    || normalizedTraits.join("\u0000") !== (baseline.traits ?? []).join("\u0000")
    || JSON.stringify(normalizedPhysicalProfile) !== JSON.stringify(normalizePhysicalProfile(baseline.physicalProfile))
  const isExistingSpecies = Boolean(editingSpecies)

  const requestNavigation = (destination) => {
    if (isDirty) {
      setPendingDestination(destination)
      return
    }
    if (destination === ViewMode.SPECIES_FOUNDATION) setEditingSpeciesId(null)
    setViewMode(destination)
  }

  const saveSpecies = (event) => {
    event.preventDefault()
    if (!foundation) return

    const normalizedName = name.trim()
    if (!normalizedName) {
      setNameError("Enter a species name before saving.")
      return
    }
    if (Object.keys(physicalProfileErrors).length > 0) return

    const values = {
      name: normalizedName,
      concept: concept.trim(),
      description: description.trim(),
      traits: normalizedTraits,
      physicalProfile: normalizedPhysicalProfile,
    }
    setNameError("")
    setSaveError("")
    try {
      const species = isExistingSpecies
        ? updateSpecies({ id: editingSpecies.id, ...values })
        : createSpecies({ ...values, foundationId: foundation.id })
      if (!isExistingSpecies) setEditingSpeciesId(species.id)
      setSavedRecord(species)
      setSaveMessage(isExistingSpecies ? "Changes saved for this session." : "Species created for this session.")
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Species changes could not be saved.")
    }
  }

  const updateTrait = (index, value) => {
    setTraits((currentTraits) => currentTraits.map((trait, traitIndex) => traitIndex === index ? value : trait))
    setSaveMessage("")
  }

  const updateRange = (rangeName, field, value) => {
    setPhysicalProfile((currentProfile) => ({
      ...currentProfile,
      [rangeName]: {
        ...currentProfile[rangeName],
        [field]: field === "unit" ? value : value === "" ? null : Number(value),
      },
    }))
    setSaveMessage("")
  }

  const toggleLocomotion = (locomotion) => {
    setPhysicalProfile((currentProfile) => ({
      ...currentProfile,
      locomotion: currentProfile.locomotion.includes(locomotion)
        ? currentProfile.locomotion.filter((item) => item !== locomotion)
        : [...currentProfile.locomotion, locomotion],
    }))
    setSaveMessage("")
  }

  const updateAdaptation = (index, value) => {
    setPhysicalProfile((currentProfile) => ({
      ...currentProfile,
      adaptations: currentProfile.adaptations.map((adaptation, adaptationIndex) =>
        adaptationIndex === index ? value : adaptation,
      ),
    }))
    setSaveMessage("")
  }

  const confirmNavigation = () => {
    if (pendingDestination === ViewMode.SPECIES_FOUNDATION) setEditingSpeciesId(null)
    setViewMode(pendingDestination)
    setPendingDestination(null)
  }

  return (
    <CreatorLibraryShell>
      <div className={styles.screen}>
      <div className={styles.ambient} aria-hidden="true" />
      <header className={styles.topbar}>
        <button type="button" className={styles.backButton} onClick={() => requestNavigation(ViewMode.SPECIES_FOUNDATION)}>
          <span aria-hidden="true">←</span> Choose Foundation
        </button>
        <span className={styles.brand}>World Engine <i /> Creator</span>
      </header>

      <main className={styles.main}>
        {!foundation ? (
          <section className={styles.recovery}>
            <p className={styles.eyebrow}>Species Creator</p>
            <h1>No Foundation Selected</h1>
            <p>Choose a foundation before creating a new species.</p>
            <button type="button" className={styles.primaryButton} onClick={() => requestNavigation(ViewMode.SPECIES_FOUNDATION)}>
              Choose Foundation
            </button>
          </section>
        ) : (
          <>
            <header className={styles.editorHeader}>
              <div className={styles.headerIdentity}>
                <p className={styles.eyebrow}>Species Creator <span /> Identity workspace</p>
                <h1>{name.trim() || (isExistingSpecies ? editingSpecies.name : "Untitled species")}</h1>
                <p className={styles.introText}>Shape a distinct species identity from the foundation of {foundation.name}.</p>
              </div>
              <div className={styles.sessionMark} aria-live="polite">
                <span>Creation status</span>
                <strong>{isDirty ? "Unsaved changes" : saveMessage || (isExistingSpecies ? "Saved this session" : "New species")}</strong>
              </div>
            </header>

            <form onSubmit={saveSpecies}>
              <div className={styles.workspace}>
                <div className={styles.editorColumn}>
                  <section className={styles.identitySection} aria-labelledby="identity-heading">
                    <div className={styles.sectionHeading}>
                      <span>01</span>
                      <div><p>Species definition</p><h2 id="identity-heading">Species identity</h2></div>
                    </div>
                    <div className={styles.form}>
                      <label className={styles.field} htmlFor="species-name">
                        <span>Species name <b>Required</b></span>
                        <input
                          id="species-name"
                          name="speciesName"
                          type="text"
                          value={name}
                          maxLength={80}
                          required
                          autoComplete="off"
                          aria-invalid={Boolean(nameError)}
                          aria-describedby={nameError ? "species-name-error" : "species-name-help"}
                          onChange={(event) => { setName(event.target.value); setNameError(""); setSaveMessage("") }}
                          placeholder="Name this species"
                        />
                        <small id={nameError ? "species-name-error" : "species-name-help"}>
                          {nameError || "Create a distinct name inspired by, not copied from, the foundation."}
                        </small>
                      </label>

                      <label className={styles.field} htmlFor="species-concept">
                        <span>Defining concept <b>Optional</b></span>
                        <textarea
                          id="species-concept"
                          name="speciesConcept"
                          value={concept}
                          maxLength={180}
                          rows={2}
                          aria-describedby="species-concept-help"
                          onChange={(event) => { setConcept(event.target.value); setSaveMessage("") }}
                          placeholder="What makes this species distinct?"
                        />
                        <small id="species-concept-help">A concise core idea, separate from the general description.</small>
                      </label>

                      <label className={styles.field} htmlFor="species-description">
                        <span>Short description <b>Optional</b></span>
                        <textarea
                          id="species-description"
                          name="speciesDescription"
                          value={description}
                          maxLength={280}
                          rows={3}
                          onChange={(event) => { setDescription(event.target.value); setSaveMessage("") }}
                          placeholder="Describe this species in a sentence or two."
                        />
                        <small className={styles.characterCount}>{description.length} / 280</small>
                      </label>
                    </div>
                  </section>

                  <section className={styles.physicalSection} aria-labelledby="physical-profile-heading">
                    <div className={styles.sectionHeading}>
                      <span>02</span>
                      <div>
                        <p>Typical members of this species</p>
                        <h2 id="physical-profile-heading">Physical profile</h2>
                      </div>
                    </div>
                    <p className={styles.profileIntro}>
                      Describe species-wide characteristics. Values start unspecified; the foundation does not prefill this profile.
                      These details do not define an individual character.
                    </p>

                    <label className={`${styles.field} ${styles.buildField}`} htmlFor="species-build">
                      <span>Build <b>Descriptive</b></span>
                      <select
                        id="species-build"
                        value={physicalProfile.build}
                        onChange={(event) => {
                          setPhysicalProfile((current) => ({ ...current, build: event.target.value }))
                          setSaveMessage("")
                        }}
                      >
                        <option value="">Not specified</option>
                        {BODY_BUILDS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </select>
                    </label>

                    <div className={styles.rangeGrid}>
                      {RANGE_FIELDS.map((field) => (
                        <PhysicalRangeField
                          key={field.key}
                          rangeName={field.key}
                          label={field.label}
                          range={physicalProfile[field.key]}
                          step={field.step}
                          units={field.units}
                          error={physicalProfileErrors[field.key]}
                          onChange={updateRange}
                        />
                      ))}
                    </div>

                    <fieldset className={styles.locomotionField}>
                      <legend>Locomotion <span>Choose all that apply</span></legend>
                      <div className={styles.locomotionOptions}>
                        {LOCOMOTION_OPTIONS.map(([value, label]) => {
                          const selected = physicalProfile.locomotion.includes(value)
                          return (
                            <button
                              type="button"
                              key={value}
                              aria-pressed={selected}
                              className={selected ? styles.locomotionSelected : ""}
                              onClick={() => toggleLocomotion(value)}
                            >
                              {label}
                            </button>
                          )
                        })}
                      </div>
                    </fieldset>

                    <section className={styles.adaptations} aria-labelledby="adaptations-heading">
                      <div className={styles.traitsHeading}>
                        <div className={styles.subsectionHeading}>
                          <p>Physical characteristics</p>
                          <h3 id="adaptations-heading">Natural adaptations</h3>
                        </div>
                        <button
                          type="button"
                          className={styles.addTraitButton}
                          disabled={physicalProfile.adaptations.length >= 8}
                          onClick={() => {
                            setPhysicalProfile((current) => ({ ...current, adaptations: [...current.adaptations, ""] }))
                            setSaveMessage("")
                          }}
                        >
                          <span aria-hidden="true">+</span> Add adaptation
                        </button>
                      </div>
                      {physicalProfile.adaptations.length === 0 ? (
                        <p className={styles.traitsEmpty}>No natural adaptations added.</p>
                      ) : (
                        <ul className={styles.traitList}>
                          {physicalProfile.adaptations.map((adaptation, index) => (
                            <li className={styles.traitRow} key={`adaptation-${index}`}>
                              <span className={styles.traitIndex}>{String(index + 1).padStart(2, "0")}</span>
                              <label className={styles.visuallyHidden} htmlFor={`species-adaptation-${index}`}>
                                Natural adaptation {index + 1}
                              </label>
                              <input
                                id={`species-adaptation-${index}`}
                                type="text"
                                maxLength={48}
                                value={adaptation}
                                placeholder="Describe a physical adaptation"
                                onChange={(event) => updateAdaptation(index, event.target.value)}
                              />
                              <button
                                type="button"
                                className={styles.removeTraitButton}
                                aria-label={`Remove adaptation ${index + 1}`}
                                onClick={() => {
                                  setPhysicalProfile((current) => ({
                                    ...current,
                                    adaptations: current.adaptations.filter((_, adaptationIndex) => adaptationIndex !== index),
                                  }))
                                  setSaveMessage("")
                                }}
                              >×</button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </section>

                    <label className={styles.field} htmlFor="distinguishing-features">
                      <span>Distinguishing features <b>Optional</b></span>
                      <textarea
                        id="distinguishing-features"
                        value={physicalProfile.distinguishingFeatures}
                        maxLength={500}
                        rows={4}
                        onChange={(event) => {
                          setPhysicalProfile((current) => ({ ...current, distinguishingFeatures: event.target.value }))
                          setSaveMessage("")
                        }}
                        placeholder="Note physical characteristics that do not fit into the fields above."
                      />
                      <small>Open-ended species reference; no individual anatomy controls.</small>
                    </label>
                  </section>

                  <section className={styles.traitsSection} aria-labelledby="traits-heading">
                    <div className={styles.traitsHeading}>
                      <div className={styles.sectionHeading}>
                        <span>03</span>
                        <div><p>Descriptive identity</p><h2 id="traits-heading">Defining traits</h2></div>
                      </div>
                      <button
                        type="button"
                        className={styles.addTraitButton}
                        disabled={traits.length >= 8}
                        onClick={() => { setTraits((current) => [...current, ""]); setSaveMessage("") }}
                      >
                        <span aria-hidden="true">+</span> Add trait
                      </button>
                    </div>
                    {traits.length === 0 ? (
                      <p className={styles.traitsEmpty}>No defining traits yet. Add descriptive notes that express this species' identity.</p>
                    ) : (
                      <ul className={styles.traitList}>
                        {traits.map((trait, index) => (
                          <li className={styles.traitRow} key={`trait-${index}`}>
                            <span className={styles.traitIndex}>{String(index + 1).padStart(2, "0")}</span>
                            <label className={styles.visuallyHidden} htmlFor={`species-trait-${index}`}>Defining trait {index + 1}</label>
                            <input
                              id={`species-trait-${index}`}
                              type="text"
                              maxLength={48}
                              value={trait}
                              placeholder="Describe a defining trait"
                              onChange={(event) => updateTrait(index, event.target.value)}
                            />
                            <button
                              type="button"
                              className={styles.removeTraitButton}
                              aria-label={`Remove trait ${index + 1}`}
                              onClick={() => { setTraits((current) => current.filter((_, traitIndex) => traitIndex !== index)); setSaveMessage("") }}
                            >×</button>
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className={styles.traitsNote}>Traits are descriptive identity notes, not ratings or combat statistics.</p>
                  </section>
                </div>

                <aside className={styles.referenceColumn}>
                  <section className={styles.foundationReference} aria-labelledby="foundation-heading">
                    <div className={styles.referenceHeading}>
                      <span>Foundation</span><span className={styles.readOnly}>Read only</span>
                    </div>
                    <div className={styles.artworkFrame}><FoundationArtworkSlot foundation={foundation} /></div>
                    <div className={styles.referenceDetails}>
                      <p className={styles.categoryLabel}>{category?.name ?? "Category unavailable"}</p>
                      <h2 id="foundation-heading">{foundation.name}</h2>
                      <p>{foundation.description}</p>
                      <p className={styles.foundationOrigin}>The original foundation for this species.</p>
                    </div>
                    <div className={styles.referenceFoot}><span>Foundation ID</span><code>{foundation.id}</code></div>
                  </section>

                  <section className={styles.speciesArtwork} aria-label="Species artwork placeholder">
                    <div className={styles.speciesArtworkHeader}>
                      <span>Species artwork</span><span>Future visual identity</span>
                    </div>
                    {editingSpecies?.imageSrc ? (
                      <img src={editingSpecies.imageSrc} alt={`${editingSpecies.name} species portrait`} />
                    ) : (
                      <div className={styles.portraitSlot}>
                        <span className={styles.portraitFrame} aria-hidden="true" />
                        <span className={styles.portraitTitle}>Species portrait</span>
                        <span className={styles.portraitMessage}>Artwork will appear here</span>
                      </div>
                    )}
                    <p>Distinct from the foundation reference.</p>
                  </section>
                </aside>
              </div>

              {Object.keys(physicalProfileErrors).length > 0 && (
                <p className={styles.formError} role="alert">Correct the physical profile ranges before saving.</p>
              )}
              {saveError && <p className={styles.formError} role="alert">{saveError}</p>}
              <footer className={styles.actionBar}>
                <span className={styles.actionStatus} role="status" aria-live="polite">
                  {isDirty ? "Unsaved changes" : saveMessage || "Stored for this app session only."}
                </span>
                <button type="button" className={styles.hubAction} onClick={() => requestNavigation(ViewMode.HUB)}>
                  Return to Creator Hub
                </button>
                <button
                  type="submit"
                  className={styles.primaryButton}
                  disabled={!name.trim() || !foundation || !isDirty || Object.keys(physicalProfileErrors).length > 0}
                >
                  {isExistingSpecies ? "Save Changes" : "Create Species"}<span aria-hidden="true">→</span>
                </button>
              </footer>
            </form>
          </>
        )}
      </main>

      {pendingDestination && (
        <div className={styles.confirmBackdrop}>
          <section className={styles.confirmDialog} role="alertdialog" aria-modal="true" aria-labelledby="leave-editor-title" aria-describedby="leave-editor-description">
            <p className={styles.eyebrow}>Unsaved work</p>
            <h2 id="leave-editor-title">Leave this species?</h2>
            <p id="leave-editor-description">Your latest changes have not been saved to this session species.</p>
            <div>
              <button type="button" className={styles.keepEditingButton} onClick={() => setPendingDestination(null)}>Keep editing</button>
              <button type="button" className={styles.discardButton} onClick={confirmNavigation}>Leave without saving</button>
            </div>
          </section>
        </div>
      )}
      </div>
    </CreatorLibraryShell>
  )
}