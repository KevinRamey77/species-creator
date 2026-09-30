import React from "react"

import CreatorLibraryShell from "../components/CreatorLibraryShell"
import FoundationArtworkSlot from "../components/FoundationArtworkSlot"
import { CreatorDataContext } from "../context/CreatorDataContext"
import { getFoundationById } from "../library/foundationData"
import { ViewContext, ViewMode } from "../context/ViewContext"
import styles from "./CreatorHub.module.css"

const destinations = [
  { key: "character", title: "CHARACTER", subtitle: "CREATOR", inscription: "Give a life its face" },
  { key: "species", title: "SPECIES", subtitle: "CREATOR", inscription: "Begin with a foundation" },
]

function PortfolioTab({ side, open, onClick, children }) {
  return (
    <button
      type="button"
      className={`${styles.portfolioTab} ${styles[side]} ${open ? styles.tabOpen : ""} library-control`}
      aria-expanded={open}
      onClick={onClick}
    >
      <span>{children}</span>
      <span className={styles.tabMark} aria-hidden="true">{open ? "−" : "+"}</span>
    </button>
  )
}

function ShelfItem({ species, onSelect }) {
  const foundation = getFoundationById(species.foundationId)
  return (
    <button type="button" className={`${styles.shelfItem} library-control`} onClick={() => onSelect(species)}>
      <span className={styles.shelfPortrait}><FoundationArtworkSlot foundation={foundation} /></span>
      <span className={styles.shelfLabel}>
        <strong>{species.name}</strong>
        <span>{foundation?.name ?? "Foundation unavailable"}</span>
        <em>Open species record <span aria-hidden="true">→</span></em>
      </span>
    </button>
  )
}

export default function CreatorHub() {
  const { setViewMode, setCreatorType, setSelectedFoundationId } = React.useContext(ViewContext)
  const { userCreatedSpecies, setEditingSpeciesId } = React.useContext(CreatorDataContext)
  const [openPortfolio, setOpenPortfolio] = React.useState(null)

  const startCreator = (creator) => {
    setCreatorType(creator)
    setViewMode(creator === "species" ? ViewMode.SPECIES_FOUNDATION : ViewMode.CHARACTER_SPECIES)
  }

  const editSpecies = (species) => {
    setCreatorType("species")
    setEditingSpeciesId(species.id)
    setSelectedFoundationId(species.foundationId)
    setViewMode(ViewMode.SPECIES_EDITOR)
  }

  const togglePortfolio = (portfolio) => {
    setOpenPortfolio((current) => current === portfolio ? null : portfolio)
  }

  const portfolioOpen = openPortfolio !== null

  return (
    <CreatorLibraryShell>
      <div className={styles.hub}>
        <header className={styles.header}>
          <button type="button" className={`${styles.wordmark} library-control`} onClick={() => setViewMode(ViewMode.LAUNCH)}>
            <span aria-hidden="true">W</span> WORLD ENGINE
          </button>
          <p>THE CREATIVE LIBRARY</p>
          <button type="button" className={`${styles.exitButton} library-control`} onClick={() => setViewMode(ViewMode.LAUNCH)}>
            Entrance <span aria-hidden="true">↗</span>
          </button>
        </header>

        <main className={`${styles.centerRoom} ${portfolioOpen ? styles.roomSecondary : ""}`}>
          <div className={styles.roomStage}>
            <div className={styles.heading}>
              <p>CREATION HUB</p>
              <h1>What do you want to create?</h1>
            </div>

            <section className={styles.destinations} aria-label="Choose a creator">
              {destinations.map((destination, index) => (
                <button
                  key={destination.key}
                  type="button"
                  className={`${styles.door} ${styles[`door${index + 1}`]} library-control`}
                  onClick={() => startCreator(destination.key)}
                >
                  <span className={styles.doorInner}>
                    <span className={styles.doorIndex}>0{index + 1} <i /></span>
                    <span className={styles.doorTitle}>{destination.title}<br />{destination.subtitle}</span>
                    <span className={styles.doorInscription}>{destination.inscription}</span>
                    <span className={styles.doorAction}>ENTER WORKROOM <b aria-hidden="true">→</b></span>
                  </span>
                  <span className={styles.doorHandle} aria-hidden="true" />
                </button>
              ))}
            </section>
          </div>
        </main>

        <section className={styles.continueSection} aria-labelledby="continue-heading">
            <div className={styles.continueHeading}>
              <span aria-hidden="true" />
              <h2 id="continue-heading">Continue Working</h2>
              <span aria-hidden="true" />
            </div>
            <div className={styles.emptyWork}>
              <span className={styles.emptyGlyph} aria-hidden="true">✧</span>
              <div>
                <strong>NOTHING IN PROGRESS</strong>
                <p>Your unfinished creations will appear here.</p>
              </div>
            </div>
        </section>

        <PortfolioTab side="left" open={openPortfolio === "characters"} onClick={() => togglePortfolio("characters")}>
          CHARACTER PORTFOLIO
        </PortfolioTab>
        <PortfolioTab side="right" open={openPortfolio === "species"} onClick={() => togglePortfolio("species")}>
          SPECIES PORTFOLIO
        </PortfolioTab>

        <aside
          className={`${styles.bookshelf} ${styles.leftShelf} ${openPortfolio === "characters" ? styles.shelfOpen : ""}`}
          aria-label="Character portfolio"
          aria-hidden={openPortfolio !== "characters"}
          inert={openPortfolio !== "characters"}
        >
          <div className={styles.shelfHeader}>
            <span className={styles.shelfOverline}>THE WEST WALL</span>
            <h2>Character Portfolio</h2>
            <p>Finished characters, kept close at hand.</p>
          </div>
          <div className={styles.shelfInterior}>
            <div className={styles.emptyShelf}>
              <span className={styles.emptyFrame} aria-hidden="true"><i /></span>
              <strong>NO FINISHED CHARACTERS</strong>
              <p>Characters you complete will be stored here.</p>
            </div>
            <div className={styles.shelfBoard} aria-hidden="true" />
          </div>
          <span className={styles.shelfFoot}>CHARACTER RECORDS</span>
        </aside>

        <aside
          className={`${styles.bookshelf} ${styles.rightShelf} ${openPortfolio === "species" ? styles.shelfOpen : ""}`}
          aria-label="Species portfolio"
          aria-hidden={openPortfolio !== "species"}
          inert={openPortfolio !== "species"}
        >
          <div className={styles.shelfHeader}>
            <span className={styles.shelfOverline}>THE EAST WALL</span>
            <h2>Species Portfolio</h2>
            <p>Saved lineages and their foundations.</p>
          </div>
          <div className={styles.shelfInterior}>
            {userCreatedSpecies.length > 0 ? (
              <ul className={styles.speciesShelfList}>
                {userCreatedSpecies.map((species) => (
                  <li key={species.id}><ShelfItem species={species} onSelect={editSpecies} /></li>
                ))}
              </ul>
            ) : (
              <div className={styles.emptyShelf}>
                <span className={styles.emptyFrame} aria-hidden="true"><i /></span>
                <strong>NO SAVED SPECIES</strong>
                <p>Species you create will be catalogued here.</p>
              </div>
            )}
            <div className={styles.shelfBoard} aria-hidden="true" />
          </div>
          <span className={styles.shelfFoot}>SPECIES RECORDS · {String(userCreatedSpecies.length).padStart(2, "0")}</span>
        </aside>
      </div>
    </CreatorLibraryShell>
  )
}