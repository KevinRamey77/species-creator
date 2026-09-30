import React from "react"

export const CameraMode = {
  NORMAL: "NORMAL",
  AR: "AR",
  AR_FRONT: "AR_FRONT",
  VR: "VR",
}

export const ViewMode = {
  LAUNCH: "LAUNCH",
  HUB: "HUB",
  LANDING: "LANDING",
  CREATE: "CREATE",
  SPECIES_FOUNDATION: "SPECIES_FOUNDATION",
  SPECIES_EDITOR: "SPECIES_EDITOR",
  CHARACTER_SPECIES: "CHARACTER_SPECIES",
  CHARACTER_AGE_GENDER: "CHARACTER_AGE_GENDER",
  CLAIM: "CLAIM",
  LOAD: "LOAD",
  APPEARANCE: "APPEARANCE",
  BATCHDOWNLOAD: "BATCHDOWNLOAD",
  SAVE: "SAVE",
  MINT: "MINT",
  OPTIMIZER: "OPTIMIZER",
  BATCHMANIFEST: "BATCHMANIFEST",
  WALLET: "WALLET"
}

export const ViewContext = React.createContext()

export const ViewProvider = (props) => {
  const [currentCameraMode, setCurrentCameraMode] = React.useState(CameraMode.NORMAL)
  const [viewMode, setViewMode] = React.useState(ViewMode.LAUNCH)
  const [isLoading, setIsLoading] = React.useState(false)
  const [mouseIsOverUI, setMouseIsOverUI] = React.useState(false)
  const [creatorType, setCreatorType] = React.useState(null)
  const [selectedFoundationId, setSelectedFoundationId] = React.useState(null)
  const [selectedSpeciesId, setSelectedSpeciesId] = React.useState(null)
  const [age, setAge] = React.useState(null)
  const [gender, setGender] = React.useState(null)
  
  return (
    <ViewContext.Provider value={{
      viewMode, setViewMode,
      isLoading, setIsLoading,
      mouseIsOverUI, setMouseIsOverUI,
      creatorType, setCreatorType,
      selectedFoundationId, setSelectedFoundationId,
      selectedSpeciesId, setSelectedSpeciesId,
      age, setAge,
      gender, setGender,
      currentCameraMode, setCurrentCameraMode,
    }}>
      {props.children}
    </ViewContext.Provider>
  )
}