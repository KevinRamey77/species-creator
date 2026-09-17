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

const rebindToBodySkeleton = (model, root) => {
  const bodyMesh = findSkinnedMesh(root);
  if (!bodyMesh) return false;

  const bodySkeleton = bodyMesh.skeleton;
  const bodyBonesByName = new Map(
    bodySkeleton.bones.map((bone) => [bone.name.toLowerCase(), bone]),
  );
  let rebound = false;

  model.traverse?.((child) => {
    if (!child.isSkinnedMesh || !child.skeleton) return;

    const bones = child.skeleton.bones.map((bone) => bodyBonesByName.get(bone.name.toLowerCase()));
    const missingBone = child.skeleton.bones.find((bone, index) => !bones[index]);
    if (missingBone) {
      throw new Error(`Body skeleton is missing appearance bone ${missingBone.name}`);
    }

    const boneInverses = child.skeleton.boneInverses?.length === bones.length
      ? child.skeleton.boneInverses.map((inverse) => inverse.clone())
      : bones.map((bone) => {
        const bodyBoneIndex = bodySkeleton.bones.indexOf(bone);
        return bodySkeleton.boneInverses[bodyBoneIndex].clone();
      });
    child.bind(new THREE.Skeleton(bones, boneInverses), child.bindMatrix.clone());
    rebound = true;
  });

  return rebound;
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
    model.traverse?.((child) => {
      child.visible = true;
      if (child.isSkinnedMesh) child.frustumCulled = false;
    });
    model.visible = true;
    model.name = asset.name || asset.id;
    model.position?.set?.(0, 0, 0);
    model.rotation?.set?.(0, 0, 0);
    model.scale?.setScalar?.(1);

    if (model.parent) {
      model.parent.remove(model);
    }

    const usesBodySkeleton = targetSlot !== "body"
      && targetSlot !== "outfit"
      && rebindToBodySkeleton(model, this.root);

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
      previous.model.parent?.remove?.(previous.model);
      this.root.remove(previous.model);
      disposeObject(previous.model);
    }

    if (asset.attachmentBone && !usesBodySkeleton) {
      const attachmentTarget = findAttachmentTarget(this.root, asset.attachmentBone);
      if (!attachmentTarget) {
        disposeObject(model);
        throw new Error(`Attachment bone ${asset.attachmentBone} was not found for ${asset.id}`);
      }
      attachmentTarget.add(model);
    } else {
      this.root.add(model);
    }

    model.updateMatrixWorld?.(true);
    model.traverse?.((child) => {
      if (!child.isSkinnedMesh || !child.skeleton) return;
      const hasMatrixWorld = child.skeleton.bones?.every((bone) => bone.matrixWorld?.elements);
      if (hasMatrixWorld) child.skeleton.update?.();
      child.computeBoundingBox?.();
      child.computeBoundingSphere?.();
    });
    this.root.updateMatrixWorld?.(true);

    this.activeAssets.set(targetSlot, { asset, model });
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
    };
    console.info("[CharacterStudio] Runtime asset attached", assemblyEvent);
    diagnostics?.events.push(assemblyEvent);
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
  }

  removeAsset(slot) {
    const current = this.activeAssets.get(slot);
    if (!current) return false;

    this.root.remove(current.model);
    current.model.parent?.remove?.(current.model);
    disposeObject(current.model);
    this.activeAssets.delete(slot);
    return true;
  }

  clear() {
    this.animationMixer?.stopAllAction();
    this.animationMixer = null;
    this.activeAnimation = null;
    [...this.activeAssets.keys()].forEach((slot) => this.removeAsset(slot));
  }
}

export { DEFAULT_SLOTS };