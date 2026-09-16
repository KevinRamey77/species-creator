import React from "react"
import styles from "./CatalogAssetPanel.module.css"
import { SceneContext } from "../context/SceneContext"

const categories = [
  { id: "body", label: "Bodies", slot: "body" },
  { id: "hair", label: "Hair", slot: "hair" },
  { id: "clothing", label: "Clothing", slot: "clothing" },
]

function CatalogAssetPanel() {
  const {
    assetCatalog,
    assetCatalogLoading,
    assetCatalogError,
    selectedRuntimeBody,
    selectedRuntimeAssets = {},
    selectRuntimeAsset,
  } = React.useContext(SceneContext)
  const [category, setCategory] = React.useState("body")
  const [selectionError, setSelectionError] = React.useState(null)

  if (assetCatalogLoading) return <div className={styles.panel}>Loading Quaternius assets...</div>
  if (assetCatalogError) return <div className={styles.panel}>Quaternius assets unavailable.</div>
  if (!assetCatalog?.isLoaded?.()) return null

  const selectedCategory = categories.find((item) => item.id === category)
  const baseAssets = assetCatalog.getByCategory(category)
  const visibleAssets = category === "body"
    ? baseAssets
    : selectedRuntimeBody
      ? assetCatalog.getCompatible(category, {
          bodyId: selectedRuntimeBody.id,
          rig: "quaternius-standard",
        })
      : []

  const selectAsset = async (asset) => {
    setSelectionError(null)
    try {
      await selectRuntimeAsset(asset)
    } catch (error) {
      setSelectionError(error.message)
    }
  }

  return (
    <section className={styles.panel} aria-label="Quaternius assets">
      <div className={styles.header}>
        <span>Quaternius assets</span>
        <span className={styles.status}>{selectedRuntimeBody ? `${selectedRuntimeBody.name}` : "Choose a body"}</span>
      </div>
      <div className={styles.categories} role="tablist" aria-label="Asset categories">
        {categories.map((item) => (
          <button
            key={item.id}
            type="button"
            className={category === item.id ? styles.activeCategory : styles.category}
            onClick={() => setCategory(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      {!selectedRuntimeBody && category !== "body" ? (
        <div className={styles.error} role="alert">Select a body to unlock compatible items for this category.</div>
      ) : null}
      <div className={styles.assets}>
        {visibleAssets.map((asset) => (
          <button
            key={asset.id}
            type="button"
            className={selectedRuntimeAssets[asset.slot || selectedCategory.slot] === asset.id ? styles.activeAsset : styles.asset}
            onClick={() => selectAsset(asset)}
          >
            {asset.name}
          </button>
        ))}
      </div>
      {selectionError && <div className={styles.error} role="alert">{selectionError}</div>}
    </section>
  )
}

export default CatalogAssetPanel