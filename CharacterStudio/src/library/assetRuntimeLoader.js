import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader";

const SUPPORTED_FORMATS = new Set(["fbx", "glb", "gltf", "obj"]);

const describeObject = (object) => ({
  name: object.name || null,
  type: object.type || null,
  isSkinnedMesh: !!object.isSkinnedMesh,
  position: object.position?.toArray?.() || null,
  quaternion: object.quaternion?.toArray?.() || null,
  rotation: object.rotation?.toArray?.() || null,
  scale: object.scale?.toArray?.() || null,
  matrix: object.matrix?.elements?.slice() || null,
  matrixWorld: object.matrixWorld?.elements?.slice() || null,
  parent: object.parent?.name || null,
  children: object.children?.map((child) => child.name || child.type) || [],
  bindMode: object.bindMode || null,
  bindMatrix: object.bindMatrix?.elements?.slice() || null,
  bindMatrixInverse: object.bindMatrixInverse?.elements?.slice() || null,
  skeleton: object.skeleton ? {
    uuid: object.skeleton.uuid,
    boneCount: object.skeleton.bones.length,
    root: object.skeleton.bones[0]?.name || null,
    bones: object.skeleton.bones.map((bone) => ({
      name: bone.name,
      uuid: bone.uuid,
      position: bone.position.toArray(),
      quaternion: bone.quaternion.toArray(),
      rotation: bone.rotation.toArray(),
      scale: bone.scale.toArray(),
      matrix: bone.matrix.elements.slice(),
      matrixWorld: bone.matrixWorld.elements.slice(),
      parent: bone.parent?.name || null,
    })),
    boneInverses: object.skeleton.boneInverses.map((inverse) => inverse.elements.slice()),
  } : null,
  geometry: object.geometry ? {
    attributes: Object.fromEntries(Object.entries(object.geometry.attributes).map(([name, attribute]) => [name, {
      itemSize: attribute.itemSize,
      count: attribute.count,
      array: Array.from(attribute.array),
    }])),
    boundingBox: object.geometry.boundingBox ? {
      min: object.geometry.boundingBox.min.toArray(),
      max: object.geometry.boundingBox.max.toArray(),
    } : null,
    boundingSphere: object.geometry.boundingSphere ? {
      center: object.geometry.boundingSphere.center.toArray(),
      radius: object.geometry.boundingSphere.radius,
    } : null,
  } : null,
});

const describeHierarchy = (root) => {
  const hierarchy = [];
  root?.traverse?.((object) => hierarchy.push(describeObject(object)));
  return hierarchy;
};

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
        if (typeof window !== "undefined"
          && new URLSearchParams(window.location.search).has("DEBUG_GLTF_HIERARCHY")
          && asset.format === "gltf") {
          console.info("[CharacterStudio] GLTF hierarchy immediately after loader", {
            id: asset.id,
            hierarchy: describeHierarchy(model),
          });
        }
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