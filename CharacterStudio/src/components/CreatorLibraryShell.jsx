import React from "react"

import styles from "./CreatorLibraryShell.module.css"

export default function CreatorLibraryShell({ children }) {
  return (
    <div className={styles.shell}>
      <div className={styles.roomImage} aria-hidden="true" />
      <div className={styles.wallTexture} aria-hidden="true" />
      <div className={styles.candlelight} aria-hidden="true" />
      <div className={styles.roomDepth} aria-hidden="true" />
      <div className={styles.content}>{children}</div>
    </div>
  )
}