import React from "react"
import styles from "./CatalogAssetPanel.module.css"
import { SceneContext } from "../context/SceneContext"

const categories = [
  { id: "body", label: "Bodies", slot: "body" },
  { id: "hair", label: "Hair", slot: "hair" },
  { id: "clothing", label: "Clothing", slot: "clothing" },
  { id: "prop", label: "Props", slot: "prop" },
  { id: "animation", label: "Animations", slot: "animation" },
]

function CatalogAssetPanel() {
  const {
    assetCatalog,
    assetCatalogLoading,
    assetCatalogError,
    assetAssemblyManager,
    characterManager,
  } = React.useContext(SceneContext)
  const [category, setCategory] = React.useState("body")
  const [bodyId, setBodyId] = React.useState(null)
  const [selectedIds, setSelectedIds] = React.useState({})
  const [selectionError, setSelectionError] = React.useState(null)

  if (assetCatalogLoading) return <div className={styles.panel}>Loading Quaternius assets...</div>
  if (assetCatalogError) return <div className={styles.panel}>Quaternius assets unavailable.</div>
  if (!assetCatalog?.isLoaded?.()) return null
  if (!characterManager || !assetAssemblyManager) return <div className={styles.panel}>Preparing character tools...</div>

  const selectedCategory = categories.find((item) => item.id === category)
  const baseAssets = assetCatalog.getByCategory(category)
  const visibleAssets = React.useMemo(() => {
    if (category === "body") return baseAssets
    if (!bodyId) return []
    return assetCatalog.getCompatible(category, {
      bodyId,
      rig: "quaternius-standard",
    })
  }, [assetCatalog, baseAssets, bodyId, category])

  React.useEffect(() => {
    if (bodyId || !assetCatalog?.isLoaded?.()) return
    const firstBody = assetCatalog.getByCategory("body")?.[0]
    if (!firstBody || !assetAssemblyManager || !characterManager) return

    void selectAsset(firstBody)
  }, [assetCatalog, assetAssemblyManager, bodyId, characterManager])

  const selectAsset = async (asset) => {
    setSelectionError(null)
    try {
      const nextBodyId = category === "body" ? asset.id : bodyId
      if (category !== "body" && !nextBodyId) {
        throw new Error("Select a body before adding this asset")
      }
      if (category === "body") {
        characterManager?.removeCurrentCharacter?.()
      }
      if (category === "animation") {
        await assetAssemblyManager.setAnimation(asset)
      } else {
        await assetAssemblyManager.setAsset(selectedCategory.slot, asset, {
          bodyId: nextBodyId,
          rig: "quaternius-standard",
        })
      }
      if (category === "body") setBodyId(asset.id)
      setSelectedIds((current) => ({ ...current, [category]: asset.id }))
    } catch (error) {
      setSelectionError(error.message)
    }
  }

  return (
    <section className={styles.panel} aria-label="Quaternius assets">
      <div className={styles.header}>
        <span>Quaternius assets</span>
        <span className={styles.status}>{bodyId ? `Body: ${bodyId}` : "Choose a body"}</span>
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
      {!bodyId && category !== "body" ? (
        <div className={styles.error} role="alert">Select a body to unlock compatible items for this category.</div>
      ) : null}
      <div className={styles.assets}>
        {visibleAssets.map((asset) => (
          <button
            key={asset.id}
            type="button"
            className={selectedIds[category] === asset.id ? styles.activeAsset : styles.asset}
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