import React, { createContext, useState } from "react"

import { getFoundationById } from "../library/foundationData"
import { createSpeciesDefinition, updateSpeciesDefinition } from "../library/speciesData"

let fallbackId = 0

const createSpeciesId = () => {
  if (globalThis.crypto?.randomUUID) return `user-species-${globalThis.crypto.randomUUID()}`
  fallbackId += 1
  return `user-species-${Date.now().toString(36)}-${fallbackId.toString(36)}`
}

export const CreatorDataContext = createContext({
  userCreatedSpecies: [],
  editingSpeciesId: null,
  setEditingSpeciesId: () => {},
  createSpecies: () => {
    throw new Error("CreatorDataProvider is required to create a species")
  },
  updateSpecies: () => {
    throw new Error("CreatorDataProvider is required to update a species")
  },
  getSpeciesById: () => null,
})

export function CreatorDataProvider({ children }) {
  const [userCreatedSpecies, setUserCreatedSpecies] = useState([])
  const [editingSpeciesId, setEditingSpeciesId] = useState(null)

  const getSpeciesById = (speciesId) => userCreatedSpecies.find((species) => species.id === speciesId) ?? null

  const createSpecies = ({ name, concept, description, traits, physicalProfile, foundationId }) => {
    const foundation = getFoundationById(foundationId)
    const species = createSpeciesDefinition({
      id: createSpeciesId(),
      name,
      concept,
      description,
      traits,
      physicalProfile,
      foundation,
    })
    setUserCreatedSpecies((currentSpecies) => [...currentSpecies, species])
    return species
  }

  const updateSpecies = ({ id, name, concept, description, traits, physicalProfile }) => {
    const existingSpecies = getSpeciesById(id)
    if (!existingSpecies) throw new Error("The species could not be found in this session")

    const foundation = getFoundationById(existingSpecies.foundationId)
    const updatedSpecies = updateSpeciesDefinition(existingSpecies, {
      name,
      concept,
      description,
      traits,
      physicalProfile,
    }, foundation)
    setUserCreatedSpecies((currentSpecies) => currentSpecies.map((species) =>
      species.id === id ? updatedSpecies : species,
    ))
    return updatedSpecies
  }

  return (
    <CreatorDataContext.Provider value={{
      userCreatedSpecies,
      editingSpeciesId,
      setEditingSpeciesId,
      createSpecies,
      updateSpecies,
      getSpeciesById,
    }}>
      {children}
    </CreatorDataContext.Provider>
  )
}