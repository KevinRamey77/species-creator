import React from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import AgeGender from "../../src/pages/AgeGender"
import { CreatorDataContext } from "../../src/context/CreatorDataContext"
import { SceneContext } from "../../src/context/SceneContext"
import { ViewContext, ViewMode } from "../../src/context/ViewContext"

function CharacterFlowHarness({ selectRuntimeBody, selectedSpeciesId = "human" }) {
  const [age, setAge] = React.useState(null)
  const [gender, setGender] = React.useState(null)
  const [viewMode, setViewMode] = React.useState(ViewMode.CHARACTER_AGE_GENDER)
  const viewValue = {
    creatorType: "character",
    selectedSpeciesId,
    age,
    setAge,
    gender,
    setGender,
    setViewMode,
  }

  return (
    <ViewContext.Provider value={viewValue}>
      <SceneContext.Provider value={{ selectRuntimeBody }}>
        {viewMode === ViewMode.CHARACTER_AGE_GENDER ? (
          <AgeGender />
        ) : (
          <output
            data-testid="handoff-state"
            data-age={age}
            data-gender={gender}
            data-species={selectedSpeciesId}
          >
            {viewMode}
          </output>
        )}
      </SceneContext.Provider>
    </ViewContext.Provider>
  )
}

describe("Character Creator age and gender", () => {
  it("shows the selected species and exactly four choices with Continue disabled initially", () => {
    render(<CharacterFlowHarness selectRuntimeBody={vi.fn()} />)

    expect(screen.getByRole("heading", { name: "Age & Gender" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Human" })).toBeInTheDocument()
    expect(screen.getAllByRole("button", { pressed: false })).toHaveLength(4)
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled()
  })

  it.each([
    ["Adult, Male", "adult", "male", "quaternius.body.superhero-male"],
    ["Adult, Female", "adult", "female", "quaternius.body.superhero-female"],
    ["Child, Boy", "child", "male", "quaternius.body.superhero-male"],
    ["Child, Girl", "child", "female", "quaternius.body.superhero-female"],
  ])("sets normalized state for %s and enters the existing Appearance editor", async (label, age, gender, bodyId) => {
    const selectRuntimeBody = vi.fn().mockResolvedValue({ id: bodyId })
    render(<CharacterFlowHarness selectRuntimeBody={selectRuntimeBody} />)

    const choice = screen.getByRole("button", { name: label })
    fireEvent.click(choice)
    expect(choice).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled()
    fireEvent.click(screen.getByRole("button", { name: "Continue" }))

    await waitFor(() => expect(selectRuntimeBody).toHaveBeenCalledWith(bodyId))
    expect(await screen.findByTestId("handoff-state")).toHaveAttribute("data-age", age)
    expect(screen.getByTestId("handoff-state")).toHaveAttribute("data-gender", gender)
    expect(screen.getByTestId("handoff-state")).toHaveAttribute("data-species", "human")
    expect(screen.getByTestId("handoff-state")).toHaveTextContent(ViewMode.APPEARANCE)
  })

  it("returns to species selection without clearing the selected species", () => {
    render(<CharacterFlowHarness selectRuntimeBody={vi.fn()} />)

    fireEvent.click(screen.getByRole("button", { name: /Choose Species/ }))
    expect(screen.getByTestId("handoff-state")).toHaveTextContent(ViewMode.CHARACTER_SPECIES)
    expect(screen.getByTestId("handoff-state")).toHaveAttribute("data-species", "human")
  })

  it("resolves a user-created species name without a built-in foundation ID", () => {
    render(
      <CreatorDataContext.Provider value={{
        userCreatedSpecies: [{ id: "user-species-frostfang", name: "Frostfang" }],
        createSpecies: vi.fn(),
      }}>
        <CharacterFlowHarness
          selectRuntimeBody={vi.fn()}
          selectedSpeciesId="user-species-frostfang"
        />
      </CreatorDataContext.Provider>,
    )

    expect(screen.getByRole("heading", { name: "Frostfang" })).toBeInTheDocument()
  })
})