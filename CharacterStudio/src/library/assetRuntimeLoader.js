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
    return this.getLoader(asset.format).loadAsync(path);
  }
}

export { SUPPORTED_FORMATS };