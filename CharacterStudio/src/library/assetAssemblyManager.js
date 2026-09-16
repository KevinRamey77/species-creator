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
    model.visible = true;
    model.name = asset.name || asset.id;
    model.position?.set?.(0, 0, 0);
    model.rotation?.set?.(0, 0, 0);
    model.scale?.setScalar?.(1);

    if (model.parent) {
      model.parent.remove(model);
    }

    if (targetSlot === "body" && this.getActiveAsset("body")?.id !== asset.id) {
      this.animationMixer?.stopAllAction();
      this.animationMixer = null;
      this.activeAnimation = null;
      [...this.activeAssets.keys()]
        .filter((activeSlot) => activeSlot !== "body")
        .forEach((activeSlot) => this.removeAsset(activeSlot));
    }
    const previous = this.activeAssets.get(targetSlot);
    if (previous) {
      previous.model.parent?.remove?.(previous.model);
      this.root.remove(previous.model);
      disposeObject(previous.model);
    }

    if (asset.attachmentBone) {
      const attachmentTarget = findAttachmentTarget(this.root, asset.attachmentBone);
      if (!attachmentTarget) {
        disposeObject(model);
        throw new Error(`Attachment bone ${asset.attachmentBone} was not found for ${asset.id}`);
      }
      attachmentTarget.add(model);
    } else {
      this.root.add(model);
    }

    this.activeAssets.set(targetSlot, { asset, model });
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