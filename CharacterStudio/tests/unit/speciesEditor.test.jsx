import React from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { CreatorDataContext, CreatorDataProvider } from "../../src/context/CreatorDataContext"
import { ViewContext, ViewMode } from "../../src/context/ViewContext"
import FoundationSelector from "../../src/pages/FoundationSelector"
import CreatorHub from "../../src/pages/CreatorHub"
import SpeciesEditor from "../../src/pages/SpeciesEditor"

function SpeciesWorkspaceHarness({ initialFoundationId = "wolf" }) {
  const [viewMode, setViewMode] = React.useState(ViewMode.SPECIES_EDITOR)
  const [selectedFoundationId, setSelectedFoundationId] = React.useState(initialFoundationId)
  const [selectedSpeciesId, setSelectedSpeciesId] = React.useState(null)
  const [creatorType, setCreatorType] = React.useState("species")
  const viewValue = {
    viewMode,
    setViewMode,
    creatorType,
    setCreatorType,
    selectedFoundationId,
    setSelectedFoundationId,
    selectedSpeciesId,
    setSelectedSpeciesId,
  }

  let activeScreen
  if (viewMode === ViewMode.SPECIES_EDITOR) {
    activeScreen = <SpeciesEditor />
  } else if (viewMode === ViewMode.SPECIES_FOUNDATION) {
    activeScreen = <FoundationSelector creatorContext="species" />
  } else if (viewMode === ViewMode.CHARACTER_SPECIES) {
    activeScreen = <FoundationSelector creatorContext="character" />
  } else if (viewMode === ViewMode.HUB) {
    activeScreen = <CreatorHub />
  } else {
    activeScreen = <output data-testid="selected-species" data-species-id={selectedSpeciesId}>{viewMode}</output>
  }

  return (
    <CreatorDataProvider>
      <ViewContext.Provider value={viewValue}>
        {activeScreen}
        <CreatorDataContext.Consumer>
          {({ userCreatedSpecies }) => (
            <output
              hidden
              data-testid="species-record"
              data-id={userCreatedSpecies[0]?.id}
              data-name={userCreatedSpecies[0]?.name}
              data-concept={userCreatedSpecies[0]?.concept}
              data-traits={JSON.stringify(userCreatedSpecies[0]?.traits ?? [])}
              data-foundation-id={userCreatedSpecies[0]?.foundationId}
              data-physical-profile={JSON.stringify(userCreatedSpecies[0]?.physicalProfile ?? null)}
            />
          )}
        </CreatorDataContext.Consumer>
      </ViewContext.Provider>
    </CreatorDataProvider>
  )
}

describe("Species Creator workspace", () => {
  it("creates a named species and makes it available to Character Creator in-session", () => {
    render(<SpeciesWorkspaceHarness />)

    expect(screen.getByRole("heading", { name: "Wolf" })).toBeInTheDocument()
    expect(screen.getByText("Animals / Beasts")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Create Species/ })).toBeDisabled()

    fireEvent.change(screen.getByLabelText(/Species name/), { target: { value: "Frostfang" } })
    fireEvent.change(screen.getByLabelText(/Short description/), {
      target: { value: "A cold-adapted people of the northern ice forests." },
    })
    fireEvent.change(screen.getByLabelText(/Defining concept/), {
      target: { value: "A wolf-descended people adapted to frozen forests." },
    })
    fireEvent.click(screen.getByRole("button", { name: /Add trait/ }))
    fireEvent.change(screen.getByLabelText("Defining trait 1"), { target: { value: "Cold adapted" } })
    fireEvent.click(screen.getByRole("button", { name: /Add trait/ }))
    fireEvent.change(screen.getByLabelText("Defining trait 2"), { target: { value: "Pack-oriented" } })
    fireEvent.change(screen.getByLabelText(/^Build/), { target: { value: "lean" } })
    fireEvent.change(screen.getByLabelText("Minimum height"), { target: { value: "80" } })
    fireEvent.change(screen.getByLabelText("Maximum height"), { target: { value: "76" } })
    expect(screen.getByText("Minimum must be less than or equal to maximum.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Create Species/ })).toBeDisabled()
    fireEvent.change(screen.getByLabelText("Minimum height"), { target: { value: "62" } })
    fireEvent.change(screen.getByLabelText("Minimum weight"), { target: { value: "120" } })
    fireEvent.change(screen.getByLabelText("Maximum weight"), { target: { value: "210" } })
    fireEvent.change(screen.getByLabelText("Minimum lifespan"), { target: { value: "80" } })
    fireEvent.change(screen.getByLabelText("Maximum lifespan"), { target: { value: "120" } })
    fireEvent.click(screen.getByRole("button", { name: "Bipedal" }))
    fireEvent.click(screen.getByRole("button", { name: "Aquatic" }))
    fireEvent.click(screen.getByRole("button", { name: /Add adaptation/ }))
    fireEvent.change(screen.getByLabelText("Natural adaptation 1"), { target: { value: "Cold resistance" } })
    fireEvent.change(screen.getByLabelText(/Distinguishing features/), {
      target: { value: "Bioluminescent markings along the forearms." },
    })
    fireEvent.click(screen.getByRole("button", { name: /Create Species/ }))

    expect(screen.getByRole("status")).toHaveTextContent("Species created for this session.")
    expect(screen.getByRole("heading", { name: "Frostfang" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Wolf" })).toBeInTheDocument()
    const originalId = screen.getByTestId("species-record").getAttribute("data-id")
    expect(screen.getByTestId("species-record")).toHaveAttribute("data-foundation-id", "wolf")
    expect(JSON.parse(screen.getByTestId("species-record").getAttribute("data-physical-profile"))).toEqual({
      build: "lean",
      height: { min: 62, max: 76, unit: "in" },
      weight: { min: 120, max: 210, unit: "lb" },
      lifespan: { min: 80, max: 120, unit: "years" },
      locomotion: ["bipedal", "aquatic"],
      adaptations: ["Cold resistance"],
      distinguishingFeatures: "Bioluminescent markings along the forearms.",
    })
    fireEvent.click(screen.getByRole("button", { name: "Return to Creator Hub" }))
    fireEvent.click(screen.getByRole("button", { name: "SPECIES PORTFOLIO" }))
    fireEvent.click(screen.getByRole("button", { name: /Frostfang.*Open species record/ }))

    expect(screen.getByLabelText(/Species name/)).toHaveValue("Frostfang")
    expect(screen.getByLabelText(/Defining concept/)).toHaveValue("A wolf-descended people adapted to frozen forests.")
    expect(screen.getByLabelText("Defining trait 1")).toHaveValue("Cold adapted")
    expect(screen.getByLabelText("Defining trait 2")).toHaveValue("Pack-oriented")
    expect(screen.getByLabelText(/^Build/)).toHaveValue("lean")
    expect(screen.getByLabelText("Minimum height")).toHaveValue(62)
    expect(screen.getByLabelText("Maximum height")).toHaveValue(76)
    expect(screen.getByRole("button", { name: "Bipedal" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("button", { name: "Aquatic" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByLabelText("Natural adaptation 1")).toHaveValue("Cold resistance")
    expect(screen.getByLabelText(/Distinguishing features/)).toHaveValue("Bioluminescent markings along the forearms.")
    expect(screen.getByRole("button", { name: "Save Changes" })).toBeDisabled()

    fireEvent.click(screen.getByRole("button", { name: /Add adaptation/ }))
    fireEvent.change(screen.getByLabelText("Natural adaptation 2"), { target: { value: "Night vision" } })
    fireEvent.click(screen.getByRole("button", { name: "Remove adaptation 1" }))
    expect(screen.getByLabelText("Natural adaptation 1")).toHaveValue("Night vision")

    fireEvent.change(screen.getByLabelText(/Defining concept/), { target: { value: "Unsaved concept change" } })
    fireEvent.click(screen.getByRole("button", { name: "Choose Foundation" }))
    expect(screen.getByRole("alertdialog")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Keep editing" }))

    fireEvent.change(screen.getByLabelText(/Defining concept/), {
      target: { value: "A cold-adapted wolf-descended people of the north." },
    })
    fireEvent.change(screen.getByLabelText("Defining trait 1"), { target: { value: "Keen hearing" } })
    fireEvent.change(screen.getByLabelText("Maximum height"), { target: { value: "78" } })
    fireEvent.change(screen.getByLabelText("Natural adaptation 1"), { target: { value: "Thick winter coat" } })
    fireEvent.click(screen.getByRole("button", { name: "Remove trait 2" }))
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }))

    expect(screen.getByRole("status")).toHaveTextContent("Changes saved for this session.")
    expect(screen.getByTestId("species-record")).toHaveAttribute("data-id", originalId)
    expect(screen.getByTestId("species-record")).toHaveAttribute("data-concept", "A cold-adapted wolf-descended people of the north.")
    expect(screen.getByTestId("species-record")).toHaveAttribute("data-traits", '["Keen hearing"]')
    expect(JSON.parse(screen.getByTestId("species-record").getAttribute("data-physical-profile"))).toMatchObject({
      build: "lean",
      height: { min: 62, max: 78, unit: "in" },
      adaptations: ["Thick winter coat"],
    })

    fireEvent.click(screen.getByRole("button", { name: "Return to Creator Hub" }))
    fireEvent.click(screen.getByRole("button", { name: /CHARACTER CREATOR/ }))
    expect(screen.getByRole("heading", { name: "My Species" })).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Choose species: Frostfang" }))
    expect(screen.getByTestId("selected-species")).toHaveAttribute("data-species-id", expect.stringMatching(/^user-species-/))
    expect(screen.getByTestId("selected-species")).toHaveTextContent(ViewMode.CHARACTER_AGE_GENDER)
  })

  it("uses a newly selected foundation when returning from the editor", () => {
    render(<SpeciesWorkspaceHarness />)

    fireEvent.click(screen.getByRole("button", { name: "Choose Foundation" }))
    fireEvent.click(screen.getByRole("button", { name: "Use foundation: Dragon" }))

    expect(screen.getByRole("heading", { name: "Dragon" })).toBeInTheDocument()
    expect(screen.getByText("A legendary scaled creature with a vast, powerful form.")).toBeInTheDocument()
  })

  it("shows a recovery action instead of crashing when no foundation is selected", () => {
    render(<SpeciesWorkspaceHarness initialFoundationId={null} />)

    expect(screen.getByRole("heading", { name: "No Foundation Selected" })).toBeInTheDocument()
    fireEvent.click(screen.getAllByRole("button", { name: "Choose Foundation" })[1])
    expect(screen.getByRole("heading", { name: "Choose Foundation" })).toBeInTheDocument()
  })

  it("opens a legacy session species without physical-profile data using empty defaults", () => {
    const legacySpecies = {
      id: "user-species-legacy",
      name: "Old Record",
      concept: "",
      description: "",
      foundationId: "wolf",
      foundationCategory: "animals-beasts",
      traits: [],
    }
    render(
      <CreatorDataContext.Provider value={{
        editingSpeciesId: legacySpecies.id,
        getSpeciesById: vi.fn(() => legacySpecies),
        setEditingSpeciesId: vi.fn(),
        createSpecies: vi.fn(),
        updateSpecies: vi.fn(),
      }}>
        <ViewContext.Provider value={{ selectedFoundationId: null, setViewMode: vi.fn() }}>
          <SpeciesEditor />
        </ViewContext.Provider>
      </CreatorDataContext.Provider>,
    )

    expect(screen.getByRole("heading", { name: "Old Record" })).toBeInTheDocument()
    expect(screen.getByLabelText("Minimum height")).toHaveValue(null)
    expect(screen.getByLabelText("Maximum weight")).toHaveValue(null)
    expect(screen.getByLabelText("Maximum lifespan")).toHaveValue(null)
    expect(screen.getByRole("button", { name: "Save Changes" })).toBeDisabled()
  })
})