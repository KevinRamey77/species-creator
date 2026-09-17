import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader";

const SUPPORTED_FORMATS = new Set(["fbx", "glb", "gltf", "obj"]);

export class AssetRuntimeLoader {
  constructor({ gltfLoader = new GLTFLoader(), fbxLoader = new FBXLoader(), objLoader = new OBJLoader(), baseURL = "/" } = {}) {
    this.loaders = {
      gltf: gltfLoader,
      glb: gltfLoader,
      fbx: fbxLoader,
      obj: objLoader,
    };
    this.baseURL = baseURL.endsWith("/") ? baseURL : `${baseURL}/`;
  }

  getLoader(format) {
    if (!SUPPORTED_FORMATS.has(format) || !this.loaders[format]) {
      throw new Error(`Unsupported runtime asset format: ${format}`);
    }
    return this.loaders[format];
  }

  loadAsync(asset) {
    if (!asset?.path) {
      return Promise.reject(new Error("A runtime asset path is required"));
    }
    const path = asset.path.match(/^(blob:|data:|https?:\/\/)/) ? asset.path : `${this.baseURL}${asset.path.replace(/^\/+/, "")}`;
    const loader = this.getLoader(asset.format);
    console.info("[CharacterStudio] Runtime asset request", {
      id: asset.id,
      format: asset.format,
      path,
    });

    const diagnostics = typeof window !== "undefined"
      ? (window.__characterStudioDiagnostics ||= { events: [] })
      : null;
    diagnostics?.events.push({ type: "asset-request", id: asset.id, format: asset.format, path });

    const shouldVerifyURL = import.meta.env.MODE !== "test" && typeof window !== "undefined";
    const urlVerification = shouldVerifyURL
      ? fetch(path, { method: "HEAD" }).then((response) => {
        if (!response.ok) {
          throw new Error(`Runtime asset URL is not fetchable: ${response.status} ${path}`);
        }
        console.info("[CharacterStudio] Runtime asset URL verified", { path, status: response.status });
        diagnostics?.events.push({ type: "asset-url-verified", path, status: response.status });
      })
      : Promise.resolve();

    return urlVerification
      .then((response) => {
        return loader.loadAsync(path);
      })
      .then((loaded) => {
        const model = loaded?.scene || loaded;
        let meshCount = 0;
        model?.traverse?.((child) => {
          if (child.isMesh) meshCount += 1;
        });
        console.info("[CharacterStudio] Runtime asset loaded", {
          id: asset.id,
          hasScene: !!loaded?.scene,
          meshCount,
        });
        diagnostics?.events.push({ type: "asset-loaded", id: asset.id, hasScene: !!loaded?.scene, meshCount });
        return loaded;
      })
      .catch((error) => {
        console.error("[CharacterStudio] Runtime asset failed", { id: asset.id, path, error });
        diagnostics?.events.push({ type: "asset-failed", id: asset.id, path, message: error.message });
        throw error;
      });
  }
}

export { SUPPORTED_FORMATS };