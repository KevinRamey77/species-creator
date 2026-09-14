import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspaceDirectory = path.resolve(appDirectory, "..");
const sourceDirectory = path.join(workspaceDirectory, "assets");
const outputPath = path.join(appDirectory, "public/quaternius/catalog.json");

const archives = [
  "Base Characters.zip",
  "Character Outfits.zip",
  "Fantasy Props.zip",
  "Fantasy Props 2.zip",
  "Animation Library.zip",
  "Animation Library 2.zip",
];

const listEntries = (archive) => execFileSync("unzip", ["-Z1", path.join(sourceDirectory, archive)], { encoding: "utf8" })
  .split("\n").filter(Boolean);
const slug = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const sourcePath = (archive, entry) => `${archive}:${entry}`;
const bodyId = (gender) => `quaternius.body.superhero-${gender}`;

const bodyAssets = (archive, entries) => entries
  .filter((entry) => /Base Characters\/Godot - UE\/Superhero_(Female|Male)_FullBody\.gltf$/.test(entry))
  .map((entry) => {
    const gender = /Female/.test(entry) ? "female" : "male";
    return {
      id: bodyId(gender), name: `Superhero ${gender[0].toUpperCase()}${gender.slice(1)}`,
      category: "body", source: "quaternius", format: "gltf", path: sourcePath(archive, entry),
      compatibleRigs: ["quaternius-standard"], runtimeStatus: "pending-normalization",
    };
  });

const hairAssets = (archive, entries) => entries
  .filter((entry) => /Hairstyles\/Rigged to Head Bone\/glTF .*\/(Hair_|Eyebrows_).*\.gltf$/.test(entry))
  .map((entry) => {
    const name = path.posix.basename(entry, ".gltf");
    return {
      id: `quaternius.hair.${slug(name)}`, name: name.replace(/_/g, " "), category: "hair", source: "quaternius",
      format: "gltf", path: sourcePath(archive, entry), compatibleBodies: [bodyId("female"), bodyId("male")],
      compatibleRigs: ["quaternius-standard"], attachmentBone: name.startsWith("Eyebrows") ? "Head" : "Head",
      runtimeStatus: "pending-normalization",
    };
  });

const outfitAssets = (archive, entries) => entries
  .filter((entry) => /Exports\/glTF \(Godot-Unreal\)\/(Outfits|Modular Parts)\/.*\.gltf$/.test(entry))
  .map((entry) => {
    const name = path.posix.basename(entry, ".gltf");
    const gender = /Female/.test(name) ? "female" : "male";
    const suffix = name.replace(/^(Female|Male)_/, "");
    const part = suffix.match(/_(Arms|Body|Feet|Legs|Head_Hood|Acc_Pauldrons?)(?:_Boots)?$/)?.[1];
    const id = `quaternius.clothing.${slug(name)}`;
    return {
      id, name: name.replace(/_/g, " "), category: "clothing", source: "quaternius", format: "gltf",
      path: sourcePath(archive, entry), compatibleBodies: [bodyId(gender)], compatibleRigs: ["quaternius-standard"],
      ...(part ? { slot: `clothing-${slug(part)}` } : { slot: "outfit" }),
      runtimeStatus: "pending-normalization",
    };
  });

const propAssets = (archive, entries, format) => entries
  .filter((entry) => format === "gltf"
    ? /Exports\/glTF .*\/.*\.gltf$/.test(entry)
    : /^OBJ\/.*\.obj$/.test(entry))
  .map((entry) => {
    const name = path.posix.basename(entry, path.posix.extname(entry));
    return {
      id: `quaternius.prop.${slug(name)}`, name: name.replace(/_/g, " "), category: "prop", source: "quaternius",
      format, path: sourcePath(archive, entry), attachmentBone: "hand_r", runtimeStatus: "pending-normalization",
    };
  });

const animationAssets = (archive, entries) => entries
  .filter((entry) => /Unity\/UAL\d+_(Standard|Standard_RM)\.fbx$/.test(entry))
  .map((entry) => {
    const name = path.posix.basename(entry, ".fbx");
    return {
      id: `quaternius.animation.${slug(name)}`, name: name.replace(/_/g, " "), category: "animation", source: "quaternius",
      format: "fbx", path: sourcePath(archive, entry), rig: "quaternius-standard", compatibleRigs: ["quaternius-standard"],
      animationSet: slug(name.split("_")[0]), runtimeStatus: "pending-normalization",
    };
  });

const main = async () => {
  const entriesByArchive = Object.fromEntries(archives.map((archive) => [archive, listEntries(archive)]));
  const assets = [
    ...bodyAssets(archives[0], entriesByArchive[archives[0]]),
    ...hairAssets(archives[0], entriesByArchive[archives[0]]),
    ...outfitAssets(archives[1], entriesByArchive[archives[1]]),
    ...propAssets(archives[2], entriesByArchive[archives[2]], "gltf"),
    ...propAssets(archives[3], entriesByArchive[archives[3]], "obj"),
    ...animationAssets(archives[4], entriesByArchive[archives[4]]),
    ...animationAssets(archives[5], entriesByArchive[archives[5]]),
  ];
  const ids = new Set();
  const duplicate = assets.find((asset) => {
    if (ids.has(asset.id)) return true;
    ids.add(asset.id);
    return false;
  });
  if (duplicate) throw new Error(`Duplicate generated asset id: ${duplicate.id}`);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify({
    schemaVersion: "1.0", source: { id: "quaternius", name: "Quaternius" }, status: "source-inventory",
    notes: "Generated from the six uploaded Quaternius source archives.", assets,
  }, null, 2)}\n`);
  console.log(`Generated ${assets.length} Quaternius catalog assets`);
};

main().catch((error) => { console.error(error.message); process.exitCode = 1; });