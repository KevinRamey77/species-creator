import React from "react"

import CreatorLibraryShell from "../components/CreatorLibraryShell"
import { ViewContext, ViewMode } from "../context/ViewContext"
import styles from "./CreatorEntry.module.css"

export default function CreatorEntry() {
  const { setViewMode } = React.useContext(ViewContext)

  return (
    <CreatorLibraryShell>
      <main className={styles.entry}>
        <div className={styles.wordmark} aria-label="World Engine">
          <span className={styles.wordmarkSeal} aria-hidden="true">W</span>
          <span>World Engine</span>
        </div>
        <h1>CREATOR</h1>
        <button
          type="button"
          className={`${styles.enterButton} library-control`}
          onClick={() => setViewMode(ViewMode.HUB)}
        >
          ENTER
        </button>
      </main>
    </CreatorLibraryShell>
  )
}
