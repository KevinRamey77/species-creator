import { execFileSync } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const appDirectory = path.resolve(scriptDirectory, "..");
const workspaceDirectory = path.resolve(appDirectory, "..");
const catalogPath = path.join(appDirectory, "public/quaternius/catalog.json");
const outputDirectory = path.join(appDirectory, "public/quaternius/normalized");
const sourceDirectory = path.join(workspaceDirectory, "assets");
const extractedArchives = new Map();

const readZipEntries = (archivePath) => execFileSync("unzip", ["-Z1", archivePath], {
  encoding: "utf8",
}).split("\n").filter(Boolean);

const getExtractedArchive = async (archivePath) => {
  if (!extractedArchives.has(archivePath)) {
    const extractionDirectory = await mkdtemp(path.join(appDirectory, ".quaternius-"));
    execFileSync("unzip", ["-q", archivePath, "-d", extractionDirectory]);
    extractedArchives.set(archivePath, extractionDirectory);
  }
  return extractedArchives.get(archivePath);
};

const splitSourcePath = (sourcePath) => {
  const separatorIndex = sourcePath.indexOf(":");
  if (separatorIndex < 1) {
    throw new Error(`Source path must include an archive and entry: ${sourcePath}`);
  }
  return {
    archiveName: sourcePath.slice(0, separatorIndex),
    entryPath: sourcePath.slice(separatorIndex + 1),
  };
};

const safeId = (id) => id.replace(/[^a-z0-9-]+/gi, "-").replace(/^-|-$/g, "");

const getEntriesToExtract = async (entries, extractionDirectory, entryPath, format) => {
  const directory = path.posix.dirname(entryPath);
  const fileName = path.posix.basename(entryPath);
  const stem = fileName.slice(0, fileName.lastIndexOf("."));

  if (format === "gltf") {
    const document = JSON.parse(await readFile(path.join(extractionDirectory, entryPath), "utf8"));
    const dependencies = [...(document.buffers || []), ...(document.images || [])]
      .map((resource) => resource.uri)
      .filter((uri) => uri && !uri.startsWith("data:"))
      .map((uri) => path.posix.normalize(path.posix.join(directory, uri)));
    const resolvedDependencies = dependencies.map((dependency) => {
      if (entries.includes(dependency)) return { sourcePath: dependency, outputPath: dependency };
      const alias = dependency.replace("_png.", ".");
      if (entries.includes(alias)) return { sourcePath: alias, outputPath: dependency };
      return null;
    });
    const missingDependencies = resolvedDependencies
      .map((dependency, index) => dependency ? null : dependencies[index])
      .filter(Boolean);
    if (missingDependencies.length > 0) {
      throw new Error(`Missing dependencies for ${entryPath}: ${missingDependencies.join(", ")}`);
    }
    return [{ sourcePath: entryPath, outputPath: entryPath }, ...resolvedDependencies];
  }

  return entries.filter((entry) => {
    if (entry === entryPath) return true;
    if (path.posix.dirname(entry) !== directory) return false;
    return path.posix.basename(entry).startsWith(`${stem}.`);
  }).map((entry) => ({ sourcePath: entry, outputPath: entry }));
};

const normalizeAsset = async (asset, runtimeAssets) => {
  const { archiveName, entryPath } = splitSourcePath(asset.path);
  const archivePath = path.join(sourceDirectory, archiveName);
  const extractionDirectory = await getExtractedArchive(archivePath);
  const archiveEntries = readZipEntries(archivePath);
  const entriesToExtract = await getEntriesToExtract(archiveEntries, extractionDirectory, entryPath, asset.format);
  const assetDirectory = path.join(outputDirectory, asset.category, safeId(asset.id));

  if (entriesToExtract.length === 0) {
    throw new Error(`Could not find ${entryPath} in ${archiveName}`);
  }

  await mkdir(assetDirectory, { recursive: true });
  for (const resource of entriesToExtract) {
    if (resource.sourcePath.endsWith("/")) continue;
    const relativeEntry = path.posix.relative(path.posix.dirname(entryPath), resource.outputPath);
    const outputPath = path.join(assetDirectory, relativeEntry);
    await mkdir(path.dirname(outputPath), { recursive: true });
    await copyFile(path.join(extractionDirectory, resource.sourcePath), outputPath);
  }

  const runtimeFileName = path.posix.basename(entryPath);
  runtimeAssets.push({
    ...asset,
    path: `/quaternius/normalized/${asset.category}/${safeId(asset.id)}/${runtimeFileName}`,
    sourcePath: asset.path,
    runtimeStatus: "normalized-source",
  });
};

const main = async () => {
  const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
  await rm(outputDirectory, { recursive: true, force: true });
  await mkdir(outputDirectory, { recursive: true });

  const runtimeAssets = [];
  for (const asset of catalog.assets) {
    await normalizeAsset(asset, runtimeAssets);
  }

  const runtimeCatalog = {
    ...catalog,
    status: "runtime-normalized",
    generatedFrom: "catalog.json",
    assets: runtimeAssets,
  };
  await writeFile(
    path.join(appDirectory, "public/quaternius/runtime-catalog.json"),
    `${JSON.stringify(runtimeCatalog, null, 2)}\n`,
  );
  await Promise.all([...extractedArchives.values()].map((directory) => rm(directory, { recursive: true, force: true })));
  console.log(`Normalized ${runtimeAssets.length} assets into ${path.relative(appDirectory, outputDirectory)}`);
};

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
}).finally(async () => {
  await Promise.all([...extractedArchives.values()].map((directory) => rm(directory, { recursive: true, force: true })));
});