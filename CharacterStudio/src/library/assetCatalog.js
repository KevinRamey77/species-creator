const ASSET_CATEGORIES = new Set([
  "body",
  "hair",
  "clothing",
  "accessory",
  "prop",
  "animation",
]);

const ASSET_FORMATS = new Set(["fbx", "glb", "gltf", "obj"]);

const REQUIRED_FIELDS = ["id", "name", "category", "source", "format", "path"];

export const EDITOR_ASSET_CATEGORIES = [
  { id: "body", label: "Body", shortLabel: "Body" },
  { id: "hair", label: "Hair", shortLabel: "Hair" },
  { id: "head", label: "Head", shortLabel: "Head" },
  { id: "torso", label: "Torso", shortLabel: "Torso" },
  { id: "arms", label: "Arms", shortLabel: "Arms" },
  { id: "legs", label: "Legs", shortLabel: "Legs" },
  { id: "feet", label: "Feet", shortLabel: "Feet" },
  { id: "shoulders", label: "Shoulders", shortLabel: "Shoulders" },
  { id: "weapons", label: "Weapons", shortLabel: "Weapons" },
  { id: "equipment", label: "Equipment", shortLabel: "Equipment" },
  { id: "outfits", label: "Outfits", shortLabel: "Outfits" },
];

const EDITOR_CATEGORY_SLOTS = {
  body: ["body"],
  hair: ["hair"],
  head: ["clothing-head-hood"],
  torso: ["clothing-body"],
  arms: ["clothing-arms"],
  legs: ["clothing-legs"],
  feet: ["clothing-feet"],
  shoulders: ["clothing-acc-pauldrons", "clothing-acc-pauldron"],
  weapons: ["prop"],
  equipment: ["prop"],
  outfits: ["outfit"],
};

const WEAPON_NAME_PARTS = ["sword", "dagger", "hammer", "axe", "bow", "arrow", "dart"];

const isWeaponProp = (asset) => {
  if (asset?.category !== "prop") return false;
  const metadata = `${asset.name || ""} ${asset.sourcePath || ""}`.toLowerCase();
  return WEAPON_NAME_PARTS.some((part) => metadata.includes(part));
};

export const getEditorAssetSlots = (category) => [...(EDITOR_CATEGORY_SLOTS[category] || [])];

export const getEditorAssetCategory = (asset) => {
  if (!asset) return null;
  if (asset.category === "body") return "body";
  if (asset.category === "hair") return "hair";
  if (asset.category === "prop") return isWeaponProp(asset) ? "weapons" : "equipment";
  if (asset.category !== "clothing") return null;

  return Object.entries(EDITOR_CATEGORY_SLOTS)
    .find(([, slots]) => slots.includes(asset.slot))?.[0] || null;
};

const isNonEmptyString = (value) => typeof value === "string" && value.trim() !== "";

const isStringArray = (value) => Array.isArray(value) && value.every(isNonEmptyString);

const validateAsset = (asset, ids) => {
  const errors = [];

  REQUIRED_FIELDS.forEach((field) => {
    if (!isNonEmptyString(asset?.[field])) {
      errors.push(`${field} is required`);
    }
  });

  if (asset?.id && ids.has(asset.id)) {
    errors.push(`duplicate asset id: ${asset.id}`);
  }
  if (asset?.id) ids.add(asset.id);

  if (asset?.category && !ASSET_CATEGORIES.has(asset.category)) {
    errors.push(`unsupported category: ${asset.category}`);
  }
  if (asset?.format && !ASSET_FORMATS.has(asset.format)) {
    errors.push(`unsupported format: ${asset.format}`);
  }
  if (asset?.compatibleRigs !== undefined && !isStringArray(asset.compatibleRigs)) {
    errors.push("compatibleRigs must be an array of strings");
  }
  if (asset?.compatibleBodies !== undefined && !isStringArray(asset.compatibleBodies)) {
    errors.push("compatibleBodies must be an array of strings");
  }

  if (asset?.category === "animation" && !isNonEmptyString(asset.rig)) {
    errors.push("animation assets require a rig");
  }
  if (asset?.category === "clothing" && !isStringArray(asset.compatibleBodies)) {
    errors.push("clothing assets require compatibleBodies");
  }
  if (asset?.category === "prop" && !isNonEmptyString(asset.attachmentBone)) {
    errors.push("prop assets require attachmentBone");
  }

  return errors;
};

export const validateAssetCatalog = (catalog) => {
  const errors = [];
  const ids = new Set();

  if (!catalog || typeof catalog !== "object") {
    return ["catalog must be an object"];
  }
  if (!isNonEmptyString(catalog.schemaVersion)) {
    errors.push("schemaVersion is required");
  }
  if (!isNonEmptyString(catalog.source?.id)) {
    errors.push("source.id is required");
  }
  if (!Array.isArray(catalog.assets)) {
    errors.push("assets must be an array");
    return errors;
  }

  catalog.assets.forEach((asset, index) => {
    validateAsset(asset, ids).forEach((error) => {
      errors.push(`assets[${index}]: ${error}`);
    });
  });

  return errors;
};

export const assertValidAssetCatalog = (catalog) => {
  const errors = validateAssetCatalog(catalog);
  if (errors.length > 0) {
    throw new Error(`Invalid asset catalog:\n${errors.join("\n")}`);
  }
  return catalog;
};

export const getAssetsByCategory = (catalog, category) => {
  assertValidAssetCatalog(catalog);
  if (!ASSET_CATEGORIES.has(category)) {
    throw new Error(`Unsupported asset category: ${category}`);
  }
  return catalog.assets.filter((asset) => asset.category === category);
};

export const isAssetCompatible = (asset, { bodyId, rig } = {}) => {
  if (!asset || validateAssetCatalog({
    schemaVersion: "runtime",
    source: { id: "runtime" },
    assets: [asset],
  }).length > 0) {
    return false;
  }

  const bodyCompatible = !asset.compatibleBodies || asset.compatibleBodies.includes(bodyId);
  const rigCompatible = !asset.compatibleRigs || asset.compatibleRigs.includes(rig);
  return bodyCompatible && rigCompatible;
};

export class AssetCatalog {
  constructor(catalog = null) {
    this.catalog = catalog;
  }

  async load(url, fetchImplementation = fetch) {
    const response = await fetchImplementation(url);
    if (!response.ok) {
      throw new Error(`Failed to load asset catalog. Status: ${response.status}`);
    }

    this.catalog = assertValidAssetCatalog(await response.json());
    return this.catalog;
  }

  isLoaded() {
    return this.catalog !== null;
  }

  getAll() {
    return this.catalog ? this.catalog.assets : [];
  }

  getByCategory(category) {
    return this.catalog ? getAssetsByCategory(this.catalog, category) : [];
  }

  getById(assetId) {
    return this.getAll().find((asset) => asset.id === assetId) || null;
  }

  getCompatible(category, compatibility) {
    return this.getByCategory(category).filter((asset) => isAssetCompatible(asset, compatibility));
  }

  getByEditorCategory(category) {
    if (!this.catalog) return [];
    assertValidAssetCatalog(this.catalog);
    return this.getAll().filter((asset) => getEditorAssetCategory(asset) === category);
  }

  getCompatibleEditorCategory(category, compatibility) {
    return this.getByEditorCategory(category).filter((asset) => isAssetCompatible(asset, compatibility));
  }
}

export { ASSET_CATEGORIES, ASSET_FORMATS };