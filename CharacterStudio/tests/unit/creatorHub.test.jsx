import React from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { CreatorDataContext, CreatorDataProvider } from "../../src/context/CreatorDataContext"
import { ViewContext, ViewMode, ViewProvider } from "../../src/context/ViewContext"
import CreatorEntry from "../../src/pages/CreatorEntry"
import CreatorHub from "../../src/pages/CreatorHub"

const renderEntry = () => {
  const context = { setViewMode: vi.fn() }
  render(
    <ViewContext.Provider value={context}>
      <CreatorEntry />
    </ViewContext.Provider>,
  )
  return context
}

const renderHub = (userCreatedSpecies = []) => {
  const viewContext = {
    setViewMode: vi.fn(),
    setCreatorType: vi.fn(),
    setSelectedFoundationId: vi.fn(),
  }
  const dataContext = { userCreatedSpecies, setEditingSpeciesId: vi.fn() }
  const { container } = render(
    <ViewContext.Provider value={viewContext}>
      <CreatorDataContext.Provider value={dataContext}>
        <CreatorHub />
      </CreatorDataContext.Provider>
    </ViewContext.Provider>,
  )
  return { container, viewContext, dataContext }
}

function EntryToHubRouter() {
  const { viewMode } = React.useContext(ViewContext)
  return viewMode === ViewMode.LAUNCH ? <CreatorEntry /> : <CreatorHub />
}

describe("Creator library entry and hub", () => {
  it("shows only the entrance action and enters the Hub", () => {
    const context = renderEntry()

    expect(screen.getByText("World Engine")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "CREATOR" })).toBeInTheDocument()
    expect(screen.getAllByRole("button")).toHaveLength(1)
    fireEvent.click(screen.getByRole("button", { name: "ENTER" }))
    expect(context.setViewMode).toHaveBeenCalledWith(ViewMode.HUB)
  })

  it("switches from Entry to Hub through the real view provider", () => {
    render(
      <ViewProvider>
        <CreatorDataProvider>
          <EntryToHubRouter />
        </CreatorDataProvider>
      </ViewProvider>,
    )

    fireEvent.click(screen.getByRole("button", { name: "ENTER" }))
    expect(screen.getByRole("heading", { name: "What do you want to create?" })).toBeInTheDocument()
  })

  it("routes the two creator doors to their existing flows", () => {
    const { viewContext } = renderHub()
    const creatorStage = screen.getByRole("main")

    expect(creatorStage).toContainElement(screen.getByRole("button", { name: /CHARACTER CREATOR/ }))
    expect(creatorStage).toContainElement(screen.getByRole("button", { name: /SPECIES CREATOR/ }))
    expect(creatorStage).not.toContainElement(screen.getByRole("heading", { name: "Continue Working" }))

    fireEvent.click(screen.getByRole("button", { name: /CHARACTER CREATOR/ }))
    expect(viewContext.setCreatorType).toHaveBeenCalledWith("character")
    expect(viewContext.setViewMode).toHaveBeenLastCalledWith(ViewMode.CHARACTER_SPECIES)

    fireEvent.click(screen.getByRole("button", { name: /SPECIES CREATOR/ }))
    expect(viewContext.setCreatorType).toHaveBeenLastCalledWith("species")
    expect(viewContext.setViewMode).toHaveBeenLastCalledWith(ViewMode.SPECIES_FOUNDATION)
  })

  it("opens, closes, and switches the opposing portfolio shelves", () => {
    const { container } = renderHub()
    const characterTab = screen.getByRole("button", { name: "CHARACTER PORTFOLIO" })
    const speciesTab = screen.getByRole("button", { name: "SPECIES PORTFOLIO" })
    const characterShelf = container.querySelector('[aria-label="Character portfolio"]')
    const speciesShelf = container.querySelector('[aria-label="Species portfolio"]')

    expect(characterShelf).toHaveAttribute("aria-hidden", "true")
    fireEvent.click(characterTab)
    expect(characterTab).toHaveAttribute("aria-expanded", "true")
    expect(characterShelf).toHaveAttribute("aria-hidden", "false")

    fireEvent.click(speciesTab)
    expect(characterShelf).toHaveAttribute("aria-hidden", "true")
    expect(speciesShelf).toHaveAttribute("aria-hidden", "false")

    fireEvent.click(speciesTab)
    expect(speciesTab).toHaveAttribute("aria-expanded", "false")
    expect(speciesShelf).toHaveAttribute("aria-hidden", "true")
  })

  it("reopens a real session species in its existing editor", () => {
    const species = {
      id: "user-species-briarling",
      name: "Briarling",
      foundationId: "wolf",
      concept: "A woodland lineage",
      description: "",
      traits: [],
    }
    const { dataContext, viewContext } = renderHub([species])

    fireEvent.click(screen.getByRole("button", { name: "SPECIES PORTFOLIO" }))
    fireEvent.click(screen.getByRole("button", { name: /Briarling.*Wolf.*Open species record/ }))

    expect(dataContext.setEditingSpeciesId).toHaveBeenCalledWith(species.id)
    expect(viewContext.setCreatorType).toHaveBeenCalledWith("species")
    expect(viewContext.setSelectedFoundationId).toHaveBeenCalledWith("wolf")
    expect(viewContext.setViewMode).toHaveBeenCalledWith(ViewMode.SPECIES_EDITOR)
  })
})