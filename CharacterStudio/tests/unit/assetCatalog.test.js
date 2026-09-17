import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import {
    AssetCatalog,
  EDITOR_ASSET_CATEGORIES,
  getEditorAssetCategory,
  getEditorAssetSlots,
  getAssetsByCategory,
  isAssetCompatible,
  validateAssetCatalog,
} from '../../src/library/assetCatalog'
import { AssetAssemblyManager } from '../../src/library/assetAssemblyManager'
import { AssetRuntimeLoader } from '../../src/library/assetRuntimeLoader'
import { SceneContext } from '../../src/context/SceneContext'
import CatalogAssetPanel from '../../src/components/CatalogAssetPanel'
import catalog from '../../public/quaternius/catalog.json'

describe('asset catalog', () => {
  it('accepts the initial Quaternius source inventory', () => {
    expect(validateAssetCatalog(catalog)).toEqual([])
    expect(getAssetsByCategory(catalog, 'body')).toHaveLength(2)
    expect(getAssetsByCategory(catalog, 'hair')).toHaveLength(8)
    expect(getAssetsByCategory(catalog, 'clothing')).toHaveLength(24)
    expect(getAssetsByCategory(catalog, 'prop')).toHaveLength(106)
    expect(getAssetsByCategory(catalog, 'animation')).toHaveLength(4)
  })

  it('keeps wearables constrained to compatible bodies', () => {
    const clothing = getAssetsByCategory(catalog, 'clothing')[0]

    expect(isAssetCompatible(clothing, {
      bodyId: 'quaternius.body.superhero-female',
      rig: 'quaternius-standard',
    })).toBe(true)
    expect(isAssetCompatible(clothing, {
      bodyId: 'quaternius.body.superhero-male',
      rig: 'quaternius-standard',
    })).toBe(false)
  })

  it('maps the Quaternius inventory to editor categories using catalog metadata', () => {
    expect(EDITOR_ASSET_CATEGORIES.map(({ id }) => id)).toEqual([
      'body', 'hair', 'head', 'torso', 'arms', 'legs', 'feet',
      'shoulders', 'weapons', 'equipment', 'outfits',
    ])

    const editableAssets = catalog.assets.filter((asset) => asset.category !== 'animation')
    const categoryCounts = editableAssets.reduce((counts, asset) => {
      const category = getEditorAssetCategory(asset)
      counts[category] = (counts[category] || 0) + 1
      return counts
    }, {})

    expect(categoryCounts).toEqual({
      body: 2,
      hair: 8,
      torso: 4,
      arms: 4,
      legs: 4,
      feet: 4,
      head: 2,
      shoulders: 2,
      outfits: 4,
      weapons: 18,
      equipment: 88,
    })
    expect(getEditorAssetSlots('shoulders')).toEqual([
      'clothing-acc-pauldrons',
      'clothing-acc-pauldron',
    ])
    expect(editableAssets.every((asset) => getEditorAssetCategory(asset))).toBe(true)
  })

  it('requires attachment metadata for props and rig metadata for animations', () => {
    const invalidCatalog = {
      schemaVersion: '1.0',
      source: { id: 'test' },
      assets: [
        { id: 'prop', name: 'Prop', category: 'prop', source: 'test', format: 'obj', path: 'prop.obj' },
        { id: 'animation', name: 'Animation', category: 'animation', source: 'test', format: 'fbx', path: 'animation.fbx' },
      ],
    }

    expect(validateAssetCatalog(invalidCatalog)).toEqual([
      'assets[0]: prop assets require attachmentBone',
      'assets[1]: animation assets require a rig',
    ])
  })

  it('rejects duplicate ids', () => {
    const duplicate = {
      schemaVersion: '1.0',
      source: { id: 'test' },
      assets: [
        { id: 'same', name: 'One', category: 'body', source: 'test', format: 'gltf', path: 'one.gltf' },
        { id: 'same', name: 'Two', category: 'body', source: 'test', format: 'gltf', path: 'two.gltf' },
      ],
    }

    expect(validateAssetCatalog(duplicate)).toContain('assets[1]: duplicate asset id: same')
  })

  it('loads a runtime catalog through the injected fetch implementation', async () => {
    const service = new AssetCatalog()
    const fetchImplementation = async () => ({
      ok: true,
      json: async () => catalog,
    })

    await service.load('/quaternius/runtime-catalog.json', fetchImplementation)

    expect(service.isLoaded()).toBe(true)
    expect(service.getById('quaternius.prop.axe-double').attachmentBone).toBe('hand_r')
    expect(service.getCompatible('clothing', {
      bodyId: 'quaternius.body.superhero-male',
      rig: 'quaternius-standard',
    })).toHaveLength(12)
  })

  it('keeps every catalog entry backed by a normalized runtime file', () => {
    const runtimeCatalog = JSON.parse(
      require('node:fs').readFileSync('public/quaternius/runtime-catalog.json', 'utf8'),
    )
    expect(runtimeCatalog.assets).toHaveLength(catalog.assets.length)
    expect(runtimeCatalog.assets.every((asset) => asset.runtimeStatus === 'normalized-source')).toBe(true)
  })

  it('returns a useful error when the runtime catalog request fails', async () => {
    const service = new AssetCatalog()
    const fetchImplementation = async () => ({ ok: false, status: 404 })

    await expect(service.load('/missing.json', fetchImplementation)).rejects.toThrow(
      'Failed to load asset catalog. Status: 404',
    )
  })

  it('does not auto-select a body when the runtime catalog loads', async () => {
    const body = getAssetsByCategory(catalog, 'body')[0]
    const setAsset = vi.fn().mockResolvedValue({})
    const assetCatalog = {
      isLoaded: () => true,
      getByCategory: (category) => (category === 'body' ? [body] : []),
      getCompatible: (category, compatibility) => {
        if (category === 'body') return [body]
        return compatibility.bodyId === body.id ? [body] : []
      },
    }

    render(
      React.createElement(
        SceneContext.Provider,
        {
          value: {
            assetCatalog,
            assetCatalogLoading: false,
            assetCatalogError: null,
            assetAssemblyManager: { setAsset },
            characterManager: { removeCurrentCharacter: vi.fn() },
          },
        },
        React.createElement(CatalogAssetPanel),
      ),
    )

    await waitFor(() => {
      expect(setAsset).not.toHaveBeenCalled()
    })
  })

  it('normalizes loaded model transforms before attaching it to the scene root', async () => {
    const body = getAssetsByCategory(catalog, 'body')[0]
    const positionState = { x: 0, y: 0, z: 0 }
    const rotationState = { x: 0, y: 0, z: 0 }
    const child = { visible: false }
    const model = {
      name: 'stale-name',
      parent: null,
      position: { set(x, y, z) { positionState.x = x; positionState.y = y; positionState.z = z } },
      rotation: { set(x, y, z) { rotationState.x = x; rotationState.y = y; rotationState.z = z } },
      scale: { setScalar(value) { this.value = value } },
      traverse: (callback) => callback(child),
    }
    const root = {
      add(model) { model.parent = this },
      remove(model) { if (model.parent === this) model.parent = null },
      getObjectByName: () => ({ add(model) { model.parent = this } }),
    }
    const manager = new AssetAssemblyManager({
      root,
      loader: { loadAsync: async () => ({ scene: model }) },
    })

    await manager.setAsset('body', body, { bodyId: body.id, rig: 'quaternius-standard' })

    expect(model.name).toBe(body.name)
    expect(positionState).toEqual({ x: 0, y: 0, z: 0 })
    expect(rotationState).toEqual({ x: 0, y: 0, z: 0 })
    expect(model.scale.value).toBe(1)
    expect(child.visible).toBe(true)
  })

  it('replaces one assembly slot without disturbing another slot', async () => {
    const body = getAssetsByCategory(catalog, 'body')[0]
    const hair = getAssetsByCategory(catalog, 'hair')[0]
    const firstModel = { parent: null, traverse: () => {} }
    const secondModel = { parent: null, traverse: () => {} }
    const root = {
      add(model) { model.parent = this },
      remove(model) { if (model.parent === this) model.parent = null },
      getObjectByName: () => ({ add(model) { model.parent = this } }),
    }
    const manager = new AssetAssemblyManager({
      root,
      loader: { loadAsync: async (asset) => ({ scene: asset.category === 'hair' ? secondModel : firstModel }) },
    })

    await manager.setAsset('body', body, { bodyId: body.id, rig: 'quaternius-standard' })
    await manager.setAsset('hair', hair, { bodyId: body.id, rig: 'quaternius-standard' })

    expect(manager.getActiveSlots()).toEqual({ body: body.id, hair: hair.id })
    manager.removeAsset('hair')
    expect(manager.getActiveAsset('body').id).toBe(body.id)
    expect(manager.getActiveAsset('hair')).toBeNull()
  })

  it('rebinds skinned appearance meshes to the body skeleton', async () => {
    const body = getAssetsByCategory(catalog, 'body')[0]
    const hair = getAssetsByCategory(catalog, 'hair')[0]
    const bodyBones = [{ name: 'Head' }]
    const bodySkeleton = { bones: bodyBones, boneInverses: [{ clone: () => ({}) }] }
    const bodyMesh = { isSkinnedMesh: true, skeleton: bodySkeleton }
    const sourceInverse = { source: true }
    const appearanceMesh = {
      isSkinnedMesh: true,
      skeleton: { bones: [{ name: 'Head' }], boneInverses: [{ clone: () => sourceInverse }] },
      bindMatrix: { clone: () => ({}) },
      bind(skeleton) { this.skeleton = skeleton },
    }
    const root = {
      add(model) { model.parent = this },
      remove(model) { if (model.parent === this) model.parent = null },
      traverse(callback) { callback(bodyMesh) },
      getObjectByName: () => ({ add(model) { model.parent = this } }),
    }
    const model = { parent: null, traverse(callback) { callback(appearanceMesh) } }
    const manager = new AssetAssemblyManager({
      root,
      loader: { loadAsync: async () => ({ scene: model }) },
    })

    await manager.setAsset('hair', hair, { bodyId: body.id, rig: 'quaternius-standard' })

    expect(appearanceMesh.skeleton.bones[0]).toBe(bodyBones[0])
    expect(appearanceMesh.skeleton.boneInverses[0]).toBe(sourceInverse)
  })

  it('clears outfit slots when a modular clothing asset is selected', async () => {
    const body = getAssetsByCategory(catalog, 'body')[0]
    const outfit = catalog.assets.find((asset) => asset.slot === 'outfit' && asset.compatibleBodies.includes(body.id))
    const clothing = catalog.assets.find((asset) => asset.slot === 'clothing-body' && asset.compatibleBodies.includes(body.id))
    const root = {
      add(model) { model.parent = this },
      remove(model) { if (model.parent === this) model.parent = null },
      traverse: () => {},
      getObjectByName: () => ({ add(model) { model.parent = this } }),
    }
    const manager = new AssetAssemblyManager({
      root,
      loader: { loadAsync: async () => ({ scene: { parent: null, traverse: () => {} } }) },
    })

    await manager.setAsset('body', body, { bodyId: body.id, rig: 'quaternius-standard' })
    await manager.setAsset('clothing', outfit, { bodyId: body.id, rig: 'quaternius-standard' })
    await manager.setAsset('clothing', clothing, { bodyId: body.id, rig: 'quaternius-standard' })

    expect(manager.getActiveSlots()).toEqual({ body: body.id, [clothing.slot]: clothing.id })
  })

  it('removes models without crashing when a material uses a single texture map object', () => {
    const root = {
      add() {},
      remove() {},
      getObjectByName: () => ({ add() {} }),
    }
    const texture = { dispose: () => {} }
    const manager = new AssetAssemblyManager({ root, loader: { loadAsync: async () => ({ scene: {} }) } })
    const model = {
      parent: null,
      traverse: (callback) => callback({
        geometry: { dispose: () => {} },
        material: { map: texture, dispose: () => {} },
      }),
    }

    manager.activeAssets.set('hair', { asset: { id: 'hair' }, model })

    expect(() => manager.removeAsset('hair')).not.toThrow()
    expect(manager.getActiveAsset('hair')).toBeNull()
  })

  it('clears dependent slots when the active body changes', async () => {
    const bodies = getAssetsByCategory(catalog, 'body')
    const hair = getAssetsByCategory(catalog, 'hair')[0]
    const root = {
      add(model) { model.parent = this },
      remove(model) { if (model.parent === this) model.parent = null },
      getObjectByName: () => ({ add(model) { model.parent = this } }),
    }
    const manager = new AssetAssemblyManager({
      root,
      loader: { loadAsync: async () => ({ scene: { traverse: () => {} } }) },
    })

    await manager.setAsset('body', bodies[0], { bodyId: bodies[0].id, rig: 'quaternius-standard' })
    await manager.setAsset('hair', hair, { bodyId: bodies[0].id, rig: 'quaternius-standard' })
    await manager.setAsset('body', bodies[1], { bodyId: bodies[1].id, rig: 'quaternius-standard' })

    expect(manager.getActiveSlots()).toEqual({ body: bodies[1].id })
  })

  it('accepts modular clothing slots from the runtime catalog', async () => {
    const hood = catalog.assets.find((asset) => asset.slot === 'clothing-head-hood')
    const root = {
      add(model) { model.parent = this },
      remove(model) { if (model.parent === this) model.parent = null },
      getObjectByName: () => ({ add(model) { model.parent = this } }),
    }
    const manager = new AssetAssemblyManager({
      root,
      loader: { loadAsync: async () => ({ scene: { parent: null, traverse: () => {} } }) },
    })

    await expect(manager.setAsset('clothing', hood, {
      bodyId: 'quaternius.body.superhero-female',
      rig: 'quaternius-standard',
    })).resolves.toBeTruthy()
    expect(manager.getActiveSlots()).toEqual({ 'clothing-head-hood': hood.id })
  })

  it('dispatches normalized assets to the loader for their file format', async () => {
    const calls = []
    const loaders = Object.fromEntries(['gltf', 'fbx', 'obj'].map((format) => [format, {
      loadAsync: async (path) => {
        calls.push([format, path])
        return { scene: {} }
      },
    }]))
    const service = new AssetRuntimeLoader({
      baseURL: '/CharacterStudio/',
      gltfLoader: loaders.gltf,
      fbxLoader: loaders.fbx,
      objLoader: loaders.obj,
    })

    await service.loadAsync({ format: 'glb', path: '/body.glb' })
    await service.loadAsync({ format: 'fbx', path: '/animation.fbx' })
    await service.loadAsync({ format: 'obj', path: '/axe.obj' })

    expect(calls).toEqual([
      ['gltf', '/CharacterStudio/body.glb'],
      ['fbx', '/CharacterStudio/animation.fbx'],
      ['obj', '/CharacterStudio/axe.obj'],
    ])
  })

  it('verifies the runtime URL before loading the Quaternius body', async () => {
    const calls = []
    const loader = {
      loadAsync: async (path) => {
        calls.push(path)
        return { scene: { traverse: () => {} } }
      },
    }
    const service = new AssetRuntimeLoader({
      baseURL: '/CharacterStudio/',
      gltfLoader: loader,
      fbxLoader: loader,
      objLoader: loader,
    })
    const fetchImplementation = globalThis.fetch
    globalThis.fetch = async (path, options) => {
      expect(options).toEqual({ method: 'HEAD' })
      return { ok: true, status: 200 }
    }

    try {
      await service.loadAsync({
        id: 'quaternius.body.superhero-male',
        format: 'gltf',
        path: '/quaternius/normalized/body/quaternius-body-superhero-male/Superhero_Male_FullBody.gltf',
      })
    } finally {
      globalThis.fetch = fetchImplementation
    }

    expect(calls).toEqual([
      '/CharacterStudio/quaternius/normalized/body/quaternius-body-superhero-male/Superhero_Male_FullBody.gltf',
    ])
  })
})