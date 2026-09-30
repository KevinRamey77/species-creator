import React from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { ViewContext, ViewMode } from "../../src/context/ViewContext"
import { builtInSpecies, createCharacterSpeciesCatalog, FOUNDATION_CATEGORIES, foundations } from "../../src/library/foundationData"
import FoundationSelector from "../../src/pages/FoundationSelector"

const renderSelector = (creatorContext) => {
  const context = {
    setViewMode: vi.fn(),
    setCreatorType: vi.fn(),
    setSelectedFoundationId: vi.fn(),
    setSelectedSpeciesId: vi.fn(),
  }

  render(
    <ViewContext.Provider value={context}>
      <FoundationSelector creatorContext={creatorContext} />
    </ViewContext.Provider>,
  )

  return context
}

describe("foundation selection", () => {
  it("defines 30 built-in foundations across the two required categories", () => {
    expect(foundations).toHaveLength(30)
    expect(new Set(foundations.map(({ id }) => id)).size).toBe(30)
    expect(foundations.every(({ imageSrc }) => imageSrc === null)).toBe(true)
    expect(FOUNDATION_CATEGORIES.map(({ id }) => [
      id,
      foundations.filter((foundation) => foundation.category === id).length,
    ])).toEqual([
      ["fantasy-sci-fi", 15],
      ["animals-beasts", 15],
    ])
    expect(builtInSpecies).toBe(foundations)
    expect(createCharacterSpeciesCatalog().userCreatedSpecies).toEqual([])
  })

  it("stores a species foundation and enters the future Species Editor destination", () => {
    const context = renderSelector("species")

    expect(screen.getByRole("heading", { name: "Choose Foundation" })).toBeInTheDocument()
    expect(screen.getAllByRole("button", { name: /Use foundation:/ })).toHaveLength(30)
    fireEvent.click(screen.getByRole("button", { name: "Use foundation: Human" }))

    expect(context.setCreatorType).toHaveBeenCalledWith("species")
    expect(context.setSelectedFoundationId).toHaveBeenCalledWith("human")
    expect(context.setViewMode).toHaveBeenCalledWith(ViewMode.SPECIES_EDITOR)
    expect(context.setSelectedSpeciesId).not.toHaveBeenCalled()
  })

  it("stores a character species, enters Age & Gender, and navigates back to the Hub", () => {
    const context = renderSelector("character")

    expect(screen.getByRole("heading", { name: "Choose Species" })).toBeInTheDocument()
    expect(screen.getByText("30").parentElement).toHaveTextContent("built-in species")
    expect(screen.getByRole("heading", { name: "My Species" })).toBeInTheDocument()
    expect(screen.getByText("Species you create will appear here.")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Choose species: Wolf" }))

    expect(context.setCreatorType).toHaveBeenCalledWith("character")
    expect(context.setSelectedSpeciesId).toHaveBeenCalledWith("wolf")
    expect(context.setViewMode).toHaveBeenCalledWith(ViewMode.CHARACTER_AGE_GENDER)
    expect(context.setSelectedFoundationId).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole("button", { name: /Creator Hub/ }))
    expect(context.setViewMode).toHaveBeenLastCalledWith(ViewMode.HUB)
  })
})