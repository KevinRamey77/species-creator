import { describe, expect, it } from "vitest"

import { getFoundationById } from "../../src/library/foundationData"
import {
  createDefaultPhysicalProfile,
  createSpeciesDefinition,
  normalizePhysicalProfile,
  updateSpeciesDefinition,
  validatePhysicalProfile,
} from "../../src/library/speciesData"

describe("species definition data", () => {
  it("creates a distinct species record referencing the selected foundation", () => {
    const foundation = getFoundationById("wolf")
    const species = createSpeciesDefinition({
      id: "user-species-test",
      name: " Frostfang ",
      description: " A northern wolf-descended people. ",
      foundation,
    })

    expect(species).toEqual({
      id: "user-species-test",
      name: "Frostfang",
      concept: "",
      description: "A northern wolf-descended people.",
      foundationId: "wolf",
      foundationCategory: "animals-beasts",
      traits: [],
      physicalProfile: createDefaultPhysicalProfile(),
      imageSrc: null,
    })
    expect(species).not.toBe(foundation)
    expect(foundation.name).toBe("Wolf")
  })

  it("requires a name and valid foundation", () => {
    expect(() => createSpeciesDefinition({ id: "x", name: "  ", foundation: getFoundationById("wolf") }))
      .toThrow("A species name is required")
    expect(() => createSpeciesDefinition({ id: "x", name: "Frostfang", foundation: null }))
      .toThrow("A valid foundation is required")
  })

  it("updates identity and traits without changing its ID or foundation relationship", () => {
    const foundation = getFoundationById("wolf")
    const original = createSpeciesDefinition({
      id: "user-species-stable",
      name: "Frostfang",
      concept: "Northern wolf descendants.",
      foundation,
    })
    const updated = updateSpeciesDefinition(original, {
      name: "Frostfang Kin",
      concept: "A cold-adapted wolf-descended people.",
      description: "They inhabit the northern ice forests.",
      traits: [" Cold adapted ", "Pack-oriented", ""],
    }, foundation)

    expect(updated).toMatchObject({
      id: "user-species-stable",
      name: "Frostfang Kin",
      concept: "A cold-adapted wolf-descended people.",
      description: "They inhabit the northern ice forests.",
      foundationId: "wolf",
      foundationCategory: "animals-beasts",
      traits: ["Cold adapted", "Pack-oriented"],
      imageSrc: null,
    })
    expect(original.name).toBe("Frostfang")
    expect(foundation.name).toBe("Wolf")
  })

  it("provides empty, species-level physical profile defaults for older and new records", () => {
    const profile = createDefaultPhysicalProfile()
    const olderSpecies = createSpeciesDefinition({
      id: "user-species-old",
      name: "Old Record",
      foundation: getFoundationById("human"),
    })

    expect(profile).toEqual({
      build: "",
      height: { min: null, max: null, unit: "in" },
      weight: { min: null, max: null, unit: "lb" },
      lifespan: { min: null, max: null, unit: "years" },
      locomotion: [],
      adaptations: [],
      distinguishingFeatures: "",
    })
    expect(olderSpecies.physicalProfile).toEqual(profile)
    expect(normalizePhysicalProfile({ height: { min: 62, max: 76 } }).height)
      .toEqual({ min: 62, max: 76, unit: "in" })
  })

  it("retains structured ranges, build, locomotion, adaptations, and features", () => {
    const profile = normalizePhysicalProfile({
      build: "variable",
      height: { min: 62, max: 76, unit: "in" },
      weight: { min: 120, max: 210, unit: "lb" },
      lifespan: { min: 80, max: 120, unit: "years" },
      locomotion: ["bipedal", "aquatic", "bipedal"],
      adaptations: [" Cold resistance ", "Aquatic respiration", ""],
      distinguishingFeatures: " Bioluminescent markings ",
    })

    expect(profile).toEqual({
      build: "variable",
      height: { min: 62, max: 76, unit: "in" },
      weight: { min: 120, max: 210, unit: "lb" },
      lifespan: { min: 80, max: 120, unit: "years" },
      locomotion: ["bipedal", "aquatic"],
      adaptations: ["Cold resistance", "Aquatic respiration"],
      distinguishingFeatures: "Bioluminescent markings",
    })
  })

  it("flags inverted and negative ranges without swapping values", () => {
    const profile = {
      height: { min: 80, max: 60, unit: "in" },
      weight: { min: -2, max: 210, unit: "lb" },
      lifespan: { min: 80, max: 120, unit: "years" },
    }

    expect(validatePhysicalProfile(profile)).toEqual({
      height: "Minimum must be less than or equal to maximum.",
      weight: "Values must be zero or greater.",
    })
    expect(profile.height).toEqual({ min: 80, max: 60, unit: "in" })
  })
})