export const createDefaultPhysicalProfile = () => ({
  build: "",
  height: { min: null, max: null, unit: "in" },
  weight: { min: null, max: null, unit: "lb" },
  lifespan: { min: null, max: null, unit: "years" },
  locomotion: [],
  adaptations: [],
  distinguishingFeatures: "",
})

const normalizeRange = (range, defaultUnit) => ({
  min: Number.isFinite(range?.min) ? range.min : null,
  max: Number.isFinite(range?.max) ? range.max : null,
  unit: typeof range?.unit === "string" && range.unit ? range.unit : defaultUnit,
})

export const normalizePhysicalProfile = (profile) => {
  const value = profile && typeof profile === "object" ? profile : {}
  return {
  build: typeof value.build === "string" ? value.build : "",
  height: normalizeRange(value.height, "in"),
  weight: normalizeRange(value.weight, "lb"),
  lifespan: normalizeRange(value.lifespan, "years"),
  locomotion: Array.isArray(value.locomotion)
    ? [...new Set(value.locomotion.filter((item) => typeof item === "string" && item))]
    : [],
  adaptations: Array.isArray(value.adaptations)
    ? value.adaptations.map((item) => typeof item === "string" ? item.trim() : "").filter(Boolean)
    : [],
  distinguishingFeatures: typeof value.distinguishingFeatures === "string"
    ? value.distinguishingFeatures.trim()
    : "",
  }
}

export const validatePhysicalProfile = (profile) => {
  const normalized = normalizePhysicalProfile(profile)
  return ["height", "weight", "lifespan"].reduce((errors, rangeName) => {
    const range = normalized[rangeName]
    if (range.min !== null && range.min < 0 || range.max !== null && range.max < 0) {
      errors[rangeName] = "Values must be zero or greater."
    } else if (range.min !== null && range.max !== null && range.min > range.max) {
      errors[rangeName] = "Minimum must be less than or equal to maximum."
    }
    return errors
  }, {})
}

export const createSpeciesDefinition = ({
  id,
  name,
  concept = "",
  description = "",
  traits = [],
  physicalProfile,
  foundation,
  imageSrc = null,
}) => {
  const normalizedName = typeof name === "string" ? name.trim() : ""

  if (!id) throw new Error("A species ID is required")
  if (!normalizedName) throw new Error("A species name is required")
  if (!foundation?.id || !foundation?.category) throw new Error("A valid foundation is required")

  return {
    id,
    name: normalizedName,
    concept: typeof concept === "string" ? concept.trim() : "",
    description: typeof description === "string" ? description.trim() : "",
    foundationId: foundation.id,
    foundationCategory: foundation.category,
    traits: Array.isArray(traits)
      ? traits.map((trait) => typeof trait === "string" ? trait.trim() : "").filter(Boolean)
      : [],
    physicalProfile: normalizePhysicalProfile(physicalProfile),
    imageSrc: typeof imageSrc === "string" && imageSrc ? imageSrc : null,
  }
}

export const updateSpeciesDefinition = (species, updates, foundation) => {
  if (!species?.id) throw new Error("A valid species record is required")

  return createSpeciesDefinition({
    ...species,
    ...updates,
    id: species.id,
    foundation: foundation ?? {
      id: species.foundationId,
      category: species.foundationCategory,
    },
    imageSrc: species.imageSrc ?? null,
  })
}