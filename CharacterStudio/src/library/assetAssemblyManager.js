import * as THREE from "three";
import { isAssetCompatible } from "./assetCatalog";

const DEFAULT_SLOTS = {
  body: "body",
  hair: "hair",
  clothing: "clothing",
  outfit: "outfit",
  "clothing-body": "clothing-body",
  "clothing-arms": "clothing-arms",
  "clothing-feet": "clothing-feet",
  "clothing-legs": "clothing-legs",
  accessory: "accessory",
  prop: "prop",
};

const disposeObject = (object) => {
  object?.traverse?.((child) => {
    child.geometry?.dispose?.();

    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.filter(Boolean).forEach((material) => {
      const textureMap = material.map;
      if (textureMap && typeof textureMap.dispose === 'function') {
        textureMap.dispose();
      }

      if (Array.isArray(material.map)) {
        material.map.forEach((texture) => texture?.dispose?.());
      }

      material.dispose?.();
    });
  });
};

const findAttachmentTarget = (root, attachmentBone) => {
  const names = [attachmentBone, ...(attachmentBoneAliases(attachmentBone))]
    .filter(Boolean)
    .map((name) => name.toLowerCase());
  let target = null;
  root?.traverse?.((child) => {
    if (!target && names.includes(child.name?.toLowerCase())) target = child;
  });
  return target || root?.getObjectByName?.(attachmentBone) || null;
};

const attachmentBoneAliases = (attachmentBone) => ({
  head: ["Head"],
  rightHand: ["hand_r"],
  leftHand: ["hand_l"],
}[attachmentBone] || []);

const findSkinnedMesh = (root) => {
  let result = null;
  root?.traverse?.((child) => {
    if (!result && child.isSkinnedMesh && child.skeleton) result = child;
  });
  return result;
};

const findSkinnedMeshes = (root) => {
  const meshes = [];
  root?.traverse?.((child) => {
    if (child.isSkinnedMesh && child.skeleton) meshes.push(child);
  });
  return meshes;
};

const getGeometryAttribute = (geometry, ...names) => (
  names.map((name) => geometry?.getAttribute?.(name)).find(Boolean) || null
);

export const prepareSkinnedMeshInfluences = (mesh) => {
  const geometry = mesh?.geometry;
  const skinIndex = geometry?.getAttribute?.("skinIndex");
  const skinWeight = geometry?.getAttribute?.("skinWeight");
  const secondaryIndex = getGeometryAttribute(geometry, "joints_1", "JOINTS_1");
  const secondaryWeight = getGeometryAttribute(geometry, "weights_1", "WEIGHTS_1");

  if (!skinIndex || !skinWeight || !secondaryIndex || !secondaryWeight) return false;
  if (skinIndex.itemSize !== 4 || skinWeight.itemSize !== 4
    || secondaryIndex.itemSize !== 4 || secondaryWeight.itemSize !== 4) return false;

  const vertexCount = Math.min(
    skinIndex.count,
    skinWeight.count,
    secondaryIndex.count,
    secondaryWeight.count,
  );

  for (let vertex = 0; vertex < vertexCount; vertex += 1) {
    const influences = [];
    for (let component = 0; component < 4; component += 1) {
      influences.push({
        index: skinIndex.getComponent(vertex, component),
        weight: Number(skinWeight.getComponent(vertex, component)) || 0,
      });
      influences.push({
        index: secondaryIndex.getComponent(vertex, component),
        weight: Number(secondaryWeight.getComponent(vertex, component)) || 0,
      });
    }

    influences.sort((left, right) => right.weight - left.weight);
    const selected = influences.slice(0, 4);
    const totalWeight = selected.reduce((sum, influence) => sum + influence.weight, 0);

    for (let component = 0; component < 4; component += 1) {
      const influence = selected[component];
      skinIndex.setComponent(vertex, component, influence.index);
      skinWeight.setComponent(vertex, component, totalWeight > 0
        ? influence.weight / totalWeight
        : 0);
    }
  }

  skinIndex.needsUpdate = true;
  skinWeight.needsUpdate = true;
  return true;
};

const getMeshMaterials = (mesh) => (
  Array.isArray(mesh?.material) ? mesh.material : [mesh?.material]
).filter(Boolean);

const captureBodyDepthWriteState = (root) => {
  const bodyMesh = findSkinnedMesh(root);
  if (!bodyMesh) return null;

  return getMeshMaterials(bodyMesh).map((material) => ({
    material,
    depthWrite: material.depthWrite,
  }));
};

const setBodyDepthWrite = (state, depthWrite) => {
  state?.forEach(({ material }) => {
    material.depthWrite = depthWrite;
    material.needsUpdate = true;
  });
};

const restoreBodyDepthWrite = (state) => {
  state?.forEach(({ material, depthWrite }) => {
    material.depthWrite = depthWrite;
    material.needsUpdate = true;
  });
};

const describeRuntimeMeshes = (root) => {
  const meshes = [];
  root?.traverse?.((child) => {
    if (!child.isSkinnedMesh) return;

    const position = child.geometry?.getAttribute?.("position");
    const skinIndex = child.geometry?.getAttribute?.("skinIndex");
    const skinWeight = child.geometry?.getAttribute?.("skinWeight");
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    meshes.push({
      name: child.name || null,
      vertexCount: position?.count || 0,
      indexCount: child.geometry?.index?.count || 0,
      hasSkinIndex: !!skinIndex,
      hasSkinWeight: !!skinWeight,
      skinWeightMax: skinWeight ? Math.max(...skinWeight.array) : null,
      skeletonBoneCount: child.skeleton?.bones?.length || 0,
      skeletonBones: child.skeleton?.bones?.slice(0, 8).map((bone) => bone.name) || [],
      bindMatrix: child.bindMatrix?.elements?.slice() || null,
      materials: materials.map((material) => ({
        type: material?.type || null,
        map: material?.map?.name || material?.map?.image?.src || null,
        normalMap: material?.normalMap?.name || material?.normalMap?.image?.src || null,
        transparent: material?.transparent ?? null,
        depthWrite: material?.depthWrite ?? null,
        side: material?.side ?? null,
      })),
      visible: child.visible,
      frustumCulled: child.frustumCulled,
      renderOrder: child.renderOrder,
    });
  });
  return meshes;
};

const logClothingBoundary = (label, asset, model, manager = null) => {
  if (asset?.category !== "clothing") return;
  const poseBindingExists = !![...(manager?.poseBindings?.values?.() || [])]
    .find((poseBinding) => poseBinding.model === model);
  const event = {
    checkpoint: label,
    asset: asset.id,
    parent: model?.parent?.name || null,
    position: model?.position?.toArray?.() || null,
    scale: model?.scale?.toArray?.() || null,
    poseBindingExists,
  };
  console.info(`[CharacterStudio] ${label}`, {
    function: "AssetAssemblyManager.setAsset",
    ...event,
    modelQuaternion: model?.quaternion?.toArray?.() || null,
    modelMatrix: model?.matrix?.elements?.slice() || null,
    modelMatrixWorld: model?.matrixWorld?.elements?.slice() || null,
    meshes: describeRuntimeMeshes(model),
  });
  if (typeof window !== "undefined"
    && new URLSearchParams(window.location.search).get("DEBUG_CLOTHING_TRACE")?.toLowerCase() === "true") {
    const trace = window.__characterStudioClothingTrace ||= { events: [] };
    trace.events.push(event);
    window.dispatchEvent(new CustomEvent("characterStudio-clothing-trace", { detail: event }));
  }
};

const getBodySkeleton = (root) => {
  const bodyMesh = findSkinnedMesh(root);
  return bodyMesh?.skeleton || null;
};

const describeSkeletonBinding = (mesh) => ({
  mesh: mesh?.name || null,
  skeletonUUID: mesh?.skeleton?.uuid || null,
  rootBoneUUID: mesh?.skeleton?.bones?.[0]?.uuid || null,
  boneCount: mesh?.skeleton?.bones?.length || 0,
  boneNames: mesh?.skeleton?.bones?.map((bone) => bone.name) || [],
  firstBoneNames: mesh?.skeleton?.bones?.slice(0, 8).map((bone) => bone.name) || [],
  bindMatrix: mesh?.bindMatrix?.elements?.slice() || null,
  bindMatrixInverse: mesh?.bindMatrixInverse?.elements?.slice() || null,
  boneInverses: mesh?.skeleton?.boneInverses?.map((inverse) => inverse?.elements?.slice?.() || null) || [],
  skinIndex: mesh?.geometry?.getAttribute?.("skinIndex") ? {
    itemSize: mesh.geometry.getAttribute("skinIndex").itemSize,
    count: mesh.geometry.getAttribute("skinIndex").count,
    array: Array.from(mesh.geometry.getAttribute("skinIndex").array),
  } : null,
  skinWeight: mesh?.geometry?.getAttribute?.("skinWeight") ? {
    itemSize: mesh.geometry.getAttribute("skinWeight").itemSize,
    count: mesh.geometry.getAttribute("skinWeight").count,
    array: Array.from(mesh.geometry.getAttribute("skinWeight").array),
  } : null,
});

const getWorldMatrix = (object) => object?.matrixWorld?.clone?.() || new THREE.Matrix4();

const createPoseBinding = (model, bodySkeleton, bodyRestMatrices, assemblyRoot) => {
  const appearanceMeshes = findSkinnedMeshes(model);
  if (appearanceMeshes.length === 0 || !bodySkeleton) return null;

  const bodyBonesByName = new Map(
    bodySkeleton.bones.map((bone) => [bone.name.toLowerCase(), bone]),
  );
  const bindings = [];
  const skeletons = new Set();
  appearanceMeshes.forEach((appearanceMesh) => {
    skeletons.add(appearanceMesh.skeleton);
    appearanceMesh.skeleton.bones.forEach((appearanceBone) => {
      const bodyBone = bodyBonesByName.get(appearanceBone.name.toLowerCase());
      if (!bodyBone) {
        throw new Error(`Body skeleton is missing appearance bone ${appearanceBone.name}`);
      }
      appearanceBone.updateMatrixWorld(true);
      bindings.push({
        appearanceBone,
        bodyBone,
        appearanceRestRoot: getWorldMatrix(assemblyRoot).invert().multiply(appearanceBone.matrixWorld),
        inverseBodyRestWorld: bodyRestMatrices.get(bodyBone.name.toLowerCase())?.clone()
          ?.invert() || bodyBone.matrixWorld.clone().invert(),
        targetWorld: new THREE.Matrix4(),
        parentWorldInverse: new THREE.Matrix4(),
      });
    });
  });

  return { bindings, skeletons: [...skeletons], assemblyRoot, model };
};

const getBoneDepth = (bone) => {
  let depth = 0;
  for (let parent = bone.parent; parent?.isBone; parent = parent.parent) depth += 1;
  return depth;
};

const syncPoseBinding = (poseBinding) => {
  if (!poseBinding) return;

  const rootWorld = poseBinding.assemblyRoot.matrixWorld || new THREE.Matrix4();
  const rootWorldInverse = rootWorld.clone().invert();
  poseBinding.bindings
    .slice()
    .sort((left, right) => getBoneDepth(left.appearanceBone) - getBoneDepth(right.appearanceBone))
    .forEach(({ appearanceBone, bodyBone, appearanceRestRoot, inverseBodyRestWorld, targetWorld, parentWorldInverse }) => {
      bodyBone.updateMatrixWorld(true);
      const bodyCurrentRoot = rootWorldInverse.clone().multiply(bodyBone.matrixWorld);
      const targetRoot = bodyCurrentRoot
        .multiply(inverseBodyRestWorld)
        .multiply(appearanceRestRoot);
      targetWorld.multiplyMatrices(rootWorld, targetRoot);

      if (appearanceBone.parent) {
        appearanceBone.parent.updateMatrixWorld(true);
        parentWorldInverse.copy(appearanceBone.parent.matrixWorld).invert();
        appearanceBone.matrix.multiplyMatrices(parentWorldInverse, targetWorld);
      } else {
        appearanceBone.matrix.copy(targetWorld);
      }
      appearanceBone.matrix.decompose(appearanceBone.position, appearanceBone.quaternion, appearanceBone.scale);
      appearanceBone.updateMatrix();
    });

  poseBinding.bindings.forEach(({ appearanceBone }) => appearanceBone.updateMatrixWorld(true));
  poseBinding.skeletons.forEach((skeleton) => skeleton.update?.());
};

export class AssetAssemblyManager {
  constructor({ root, catalog, loader = null, slots = DEFAULT_SLOTS } = {}) {
    this.root = root || new THREE.Object3D();
    this.catalog = catalog;
    this.loader = loader;
    this.slots = { ...DEFAULT_SLOTS, ...slots };
    this.activeAssets = new Map();
    this.animationMixer = null;
    this.activeAnimation = null;
    this.bodySkeleton = null;
    this.bodyRestMatrices = new Map();
    this.poseBindings = new Map();
    this.bodyDepthWriteState = null;
    this.diagnosticCheckpointHandler = null;
    this.diagnosticPoseSyncPending = null;
    this.diagnosticPoseSyncAfterPending = null;
    this.diagnosticPoseSyncReady = false;
    this.diagnosticPoseSyncAfterReady = false;
    this.loggedPoseSyncBindings = new WeakSet();
    this.disableClothingPoseSync = typeof window !== "undefined"
      && new URLSearchParams(window.location.search).has("DEBUG_DISABLE_CLOTHING_POSE_SYNC");
  }

  setDiagnosticCheckpointHandler(handler = null) {
    this.diagnosticCheckpointHandler = typeof handler === "function" ? handler : null;
    this.diagnosticPoseSyncPending = null;
    this.diagnosticPoseSyncAfterPending = null;
    this.diagnosticPoseSyncReady = false;
    this.diagnosticPoseSyncAfterReady = false;
  }

  async waitForDiagnosticCheckpoint(name, context) {
    if (!this.diagnosticCheckpointHandler || context?.asset?.category !== "clothing") return;
    await this.diagnosticCheckpointHandler(name, context);
  }

  registerSlot(slot) {
    const normalized = typeof slot === "string" ? slot.trim() : "";
    if (!normalized) return null;
    this.slots[normalized] = normalized;
    return normalized;
  }

  resolveSlot(slot, asset = null) {
    const candidates = [];

    if (asset?.slot) {
      candidates.push(asset.slot);
    }
    if (slot) {
      candidates.push(slot);
    }

    for (const candidate of candidates) {
      const normalized = this.registerSlot(candidate);
      if (normalized) return normalized;
    }

    return null;
  }

  setCatalog(catalog) {
    this.catalog = catalog;
  }

  getActiveAsset(slot) {
    return this.activeAssets.get(slot)?.asset || null;
  }

  getActiveSlots() {
    return Object.fromEntries(
      [...this.activeAssets.entries()].map(([slot, entry]) => [slot, entry.asset.id]),
    );
  }

  canUse(asset, compatibility) {
    return !!asset && isAssetCompatible(asset, compatibility);
  }

  async setAsset(slot, asset, compatibility = {}) {
    const resolvedSlot = this.resolveSlot(slot, asset);
    if (!resolvedSlot) {
      throw new Error(`Unsupported assembly slot: ${slot}`);
    }
    if (!this.canUse(asset, compatibility)) {
      throw new Error(`Asset ${asset?.id || "unknown"} is incompatible with this character`);
    }
    if (!this.loader || typeof this.loader.loadAsync !== "function") {
      throw new Error("An asset loader is required to load assembly assets");
    }

    const targetSlot = resolvedSlot;
    if (!this.slots[targetSlot]) {
      throw new Error(`Unsupported assembly slot: ${targetSlot}`);
    }
    const loaded = await this.loader.loadAsync(asset);
    const model = loaded.scene || loaded;
    logClothingBoundary("clothing loaded", asset, model, this);
    await this.waitForDiagnosticCheckpoint("clothing-loaded", { asset, model, manager: this });
    const loadedClothingMeshes = asset.category === "clothing" ? findSkinnedMeshes(model) : [];
    if (this.disableClothingPoseSync && loadedClothingMeshes.length > 0) {
      console.info("[CharacterStudio] CLOTHING POSE SYNC DISABLED — ORIGINAL GLTF SKELETON UNTOUCHED", {
        id: asset.id,
        meshes: loadedClothingMeshes.map(describeSkeletonBinding),
      });
    }
    logClothingBoundary("before clothing processing", asset, model, this);
    model.traverse?.((child) => {
      child.visible = true;
      if (child.isSkinnedMesh) {
        if (!(this.disableClothingPoseSync && asset.category === "clothing")) {
          prepareSkinnedMeshInfluences(child);
        }
        child.frustumCulled = false;
      }
    });
    model.visible = true;
    model.name = asset.name || asset.id;
    model.position?.set?.(0, 0, 0);
    model.rotation?.set?.(0, 0, 0);
    model.scale?.setScalar?.(1);

    await this.waitForDiagnosticCheckpoint("after-clothing-processing", { asset, model, manager: this });
    logClothingBoundary("after clothing processing", asset, model, this);

    if (model.parent) {
      model.parent.remove(model);
    }

    await this.waitForDiagnosticCheckpoint("after-model-root-operations", { asset, model, manager: this });
    logClothingBoundary("before clothing attachment", asset, model, this);

    if (targetSlot === "body" && this.getActiveAsset("body")?.id !== asset.id) {
      this.animationMixer?.stopAllAction();
      this.animationMixer = null;
      this.activeAnimation = null;
      [...this.activeAssets.keys()]
        .filter((activeSlot) => activeSlot !== "body")
        .forEach((activeSlot) => this.removeAsset(activeSlot));
    }
    if (asset.category === "clothing") {
      const conflictingSlots = targetSlot === "outfit"
        ? [...this.activeAssets.keys()].filter((slot) => slot !== "body" && slot !== "hair")
        : ["outfit"];
      conflictingSlots.forEach((slot) => this.removeAsset(slot));
    }
    const previous = this.activeAssets.get(targetSlot);
    if (previous) {
      if (targetSlot === "body") {
        restoreBodyDepthWrite(this.bodyDepthWriteState);
        this.bodyDepthWriteState = null;
      }
      previous.model.parent?.remove?.(previous.model);
      this.root.remove(previous.model);
      disposeObject(previous.model);
      this.poseBindings.delete(targetSlot);
    }

    if (asset.attachmentBone && targetSlot !== "body" && !findSkinnedMesh(model)) {
      const attachmentTarget = findAttachmentTarget(this.root, asset.attachmentBone);
      if (!attachmentTarget) {
        disposeObject(model);
        throw new Error(`Attachment bone ${asset.attachmentBone} was not found for ${asset.id}`);
      }
      attachmentTarget.add(model);
    } else {
      this.root.add(model);
    }
    logClothingBoundary("after clothing attachment", asset, model, this);

    await this.waitForDiagnosticCheckpoint("after-attachment", { asset, model, manager: this });

    model.updateMatrixWorld?.(true);
    if (targetSlot === "body") {
      this.bodySkeleton = getBodySkeleton(model);
      this.bodyDepthWriteState = captureBodyDepthWriteState(model);
      const rootWorldInverse = getWorldMatrix(this.root).invert();
      this.bodyRestMatrices = new Map(
        this.bodySkeleton?.bones.map((bone) => [
          bone.name.toLowerCase(),
          rootWorldInverse.clone().multiply(bone.matrixWorld),
        ]) || [],
      );
      console.info("[CharacterStudio] Body skeleton binding", describeSkeletonBinding(findSkinnedMesh(model)));
    } else if (this.bodySkeleton && findSkinnedMeshes(model).length > 0 && !this.disableClothingPoseSync) {
      this.poseBindings.set(
        targetSlot,
        createPoseBinding(model, this.bodySkeleton, this.bodyRestMatrices, this.root),
      );
      logClothingBoundary("after pose-binding creation", asset, model, this);
      await this.waitForDiagnosticCheckpoint("after-pose-binding-creation", { asset, model, manager: this });
    }
    model.traverse?.((child) => {
      if (!child.isSkinnedMesh || !child.skeleton) return;
      const hasMatrixWorld = child.skeleton.bones?.every((bone) => bone.matrixWorld?.elements);
        if (hasMatrixWorld && !(this.disableClothingPoseSync && targetSlot !== "body")) {
          child.skeleton.update?.();
        }
      child.computeBoundingBox?.();
      child.computeBoundingSphere?.();
    });
    logClothingBoundary("after skeleton processing", asset, model, this);
    await this.waitForDiagnosticCheckpoint("after-skeleton-processing", { asset, model, manager: this });
    this.root.updateMatrixWorld?.(true);
    if (targetSlot !== "body" && findSkinnedMeshes(model).length > 0) {
      console.info("[CharacterStudio] Clothing skeleton binding", {
        id: asset.id,
        poseSyncDisabled: this.disableClothingPoseSync,
        meshes: findSkinnedMeshes(model).map(describeSkeletonBinding),
      });
    }

    this.activeAssets.set(targetSlot, { asset, model });
  if (targetSlot !== "body") setBodyDepthWrite(this.bodyDepthWriteState, false);
    const bounds = model?.isObject3D ? new THREE.Box3().setFromObject(model) : null;
    const size = bounds?.getSize(new THREE.Vector3()) || null;
    const diagnostics = typeof window !== "undefined"
      ? (window.__characterStudioDiagnostics ||= { events: [] })
      : null;
    const assemblyEvent = {
      type: "asset-attached",
      id: asset.id,
      slot: targetSlot,
      meshCount: (() => {
        let count = 0;
        model.traverse?.((child) => { if (child.isMesh) count += 1; });
        return count;
      })(),
      parent: model.parent?.name || null,
      visible: model.visible,
      position: model.position?.toArray?.() || null,
      rotation: model.rotation?.toArray?.() || null,
      scale: model.scale?.toArray?.() || null,
      bounds: bounds ? {
        min: bounds.min.toArray(),
        max: bounds.max.toArray(),
        size: size.toArray(),
      } : null,
      meshDiagnostics: targetSlot === "clothing-body" ? describeRuntimeMeshes(model) : undefined,
    };
    console.info("[CharacterStudio] Runtime asset attached", assemblyEvent);
    diagnostics?.events.push(assemblyEvent);
    logClothingBoundary("after final assembly", asset, model, this);
    await this.waitForDiagnosticCheckpoint("after-final-assembly", { asset, model, manager: this });
    return model;
  }

  async setAnimation(asset, { loop = true } = {}) {
    if (!this.getActiveAsset("body")) {
      throw new Error("Select a body before playing an animation");
    }
    if (!this.canUse(asset, { rig: "quaternius-standard" })) {
      throw new Error(`Animation ${asset?.id || "unknown"} is incompatible with this character`);
    }
    const loaded = await this.loader.loadAsync(asset);
    const clip = loaded.animations?.[0];
    if (!clip) throw new Error(`Animation ${asset.id} contains no animation clips`);

    this.animationMixer?.stopAllAction();
    this.animationMixer = this.animationMixer || new THREE.AnimationMixer(this.activeAssets.get("body").model);
    const action = this.animationMixer.clipAction(clip);
    action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
    action.reset().play();
    this.activeAnimation = asset;
    return clip;
  }

  update(deltaTime) {
    this.animationMixer?.update(deltaTime);
    if (!this.disableClothingPoseSync) {
      if (this.diagnosticCheckpointHandler && this.poseBindings.size > 0) {
        if (!this.diagnosticPoseSyncReady) {
          if (!this.diagnosticPoseSyncPending) {
            const entry = [...this.activeAssets.values()].find(({ asset }) => asset?.category === "clothing");
            this.diagnosticPoseSyncPending = this.waitForDiagnosticCheckpoint(
              "before-pose-sync",
              { asset: entry?.asset, model: entry?.model, manager: this },
            ).then(() => {
              this.diagnosticPoseSyncReady = true;
              this.diagnosticPoseSyncPending = null;
            });
          }
          return;
        }
        if (!this.diagnosticPoseSyncAfterReady) {
          syncPoseBinding([...this.poseBindings.values()][0]);
          if (!this.diagnosticPoseSyncAfterPending) {
            const entry = [...this.activeAssets.values()].find(({ asset }) => asset?.category === "clothing");
            this.diagnosticPoseSyncAfterPending = this.waitForDiagnosticCheckpoint(
              "after-pose-sync",
              { asset: entry?.asset, model: entry?.model, manager: this },
            ).then(() => {
              this.diagnosticPoseSyncAfterReady = true;
              this.diagnosticPoseSyncAfterPending = null;
            });
          }
          return;
        }
      }
      this.poseBindings.forEach((poseBinding) => {
        if (!this.loggedPoseSyncBindings.has(poseBinding)) {
          const model = poseBinding.model;
          const asset = [...this.activeAssets.values()].find((entry) => entry.model === model)?.asset;
          logClothingBoundary("before clothing pose synchronization", asset, model, this);
          syncPoseBinding(poseBinding);
          logClothingBoundary("after clothing pose synchronization", asset, model, this);
          this.loggedPoseSyncBindings.add(poseBinding);
          return;
        }
        syncPoseBinding(poseBinding);
      });
    }
  }

  removeAsset(slot) {
    const current = this.activeAssets.get(slot);
    if (!current) return false;

    this.root.remove(current.model);
    current.model.parent?.remove?.(current.model);
    disposeObject(current.model);
    this.poseBindings.delete(slot);
    if (slot === "body") {
      restoreBodyDepthWrite(this.bodyDepthWriteState);
      this.bodySkeleton = null;
      this.bodyRestMatrices.clear();
      this.bodyDepthWriteState = null;
    }
    this.activeAssets.delete(slot);
    if (slot !== "body" && ![...this.activeAssets.keys()].some((activeSlot) => activeSlot !== "body")) {
      restoreBodyDepthWrite(this.bodyDepthWriteState);
    }
    return true;
  }

  clear() {
    this.animationMixer?.stopAllAction();
    this.animationMixer = null;
    this.activeAnimation = null;
    this.bodySkeleton = null;
    this.bodyRestMatrices.clear();
    this.poseBindings.clear();
    this.setDiagnosticCheckpointHandler(null);
    restoreBodyDepthWrite(this.bodyDepthWriteState);
    this.bodyDepthWriteState = null;
    [...this.activeAssets.keys()].forEach((slot) => this.removeAsset(slot));
  }
}

export { DEFAULT_SLOTS };