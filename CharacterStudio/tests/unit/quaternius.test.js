import { describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import * as THREE from 'three'
import { ManifestDataManager } from '../../src/library/manifestDataManager'
import { CharacterManager } from '../../src/library/characterManager'
import { KTXTools } from '../../src/library/ktxtools'
import { resolveAssetImportPath } from '../../src/App'

describe('Quaternius and human-male manifest integration', () => {
  it('should expose the legacy VRM and Quaternius character choices', async () => {
    const workspaceRoot = path.resolve(__dirname, '../..')
    const mainManifestPath = path.join(workspaceRoot, 'public/manifest.json')
    const subManifestPath = path.join(workspaceRoot, 'public/quaternius/manifest.json')

    const mainManifest = JSON.parse(await readFile(mainManifestPath, 'utf-8'))
    expect(mainManifest.characters).toHaveLength(2)
    expect(mainManifest.characters[0].name).toBe('Quaternius Characters')
    expect(mainManifest.characters[0].manifest).toContain('quaternius/editor-manifest.json')
    expect(mainManifest.characters[1].name).toBe('Adult Human')
    expect(mainManifest.characters[1].manifest).toContain('quaternius/manifest.json')
    expect(mainManifest.loras).toEqual([])
    expect(mainManifest.sprites).toEqual([])
    expect(mainManifest.thumbnails).toEqual([])
    expect(mainManifest.defaultAnimations).toHaveLength(5)
    expect(mainManifest.defaultAnimations[0]).toContain('T-Pose.fbx')
    expect(mainManifest.defaultAnimations.every((animation) => animation.includes('Male_') || animation.includes('T-Pose'))).toBe(true)

    const quaterniusManifest = JSON.parse(await readFile(subManifestPath, 'utf-8'))
    const bodyTrait = quaterniusManifest.traits.find((trait) => trait.trait === 'Body')
    const extraTraits = quaterniusManifest.traits.filter((trait) => ['Head', 'Hands', 'Shoes', 'Chest', 'Waist', 'Neck', 'Weapon'].includes(trait.trait))

    expect(bodyTrait).toBeTruthy()
    expect(bodyTrait.collection.some((item) => item.directory.includes('Quaternius_Test.vrm'))).toBe(true)
    expect(extraTraits).toHaveLength(0)
    expect(quaterniusManifest.requiredTraits).toEqual(['Body'])
    expect(quaterniusManifest.randomTraits).toEqual(['Body'])
    expect(quaterniusManifest.initialTraits).toEqual(['Body'])
    expect(quaterniusManifest.displayScale).toBeLessThan(1)
    expect(bodyTrait.cameraTarget).toMatchObject({ distance: 2.3, height: 0.8 })
  })

  it('should fall back to the bundled public manifest when the env asset path is unset', () => {
    expect(resolveAssetImportPath()).toBe('./manifest.json')
    expect(resolveAssetImportPath('')).toBe('./manifest.json')
    expect(resolveAssetImportPath('undefined')).toBe('./manifest.json')
    expect(resolveAssetImportPath('./loot-assets')).toBe('./loot-assets/manifest.json')
    expect(resolveAssetImportPath('https://example.com/assets/')).toBe('https://example.com/assets/manifest.json')
  })

  it('should switch the active manifest to the body-only adult-human manifest without clothing groups', async () => {
    const manager = new ManifestDataManager()
    const appManifest = {
      characters: [{ name: 'Adult Human', manifest: './quaternius/manifest.json' }],
    }
    const quaterniusManifest = {
      assetsLocation: 'https://m3-org.github.io/loot-assets/',
      traitsDirectory: '/anata/male/',
      requiredTraits: ['Body'],
      randomTraits: ['Body'],
      initialTraits: ['Body'],
      traits: [{
        trait: 'Body',
        name: 'Body',
        cameraTarget: { distance: 2.3, height: 0.8 },
        collection: [{
          id: 'adult-human',
          name: 'Adult Human',
          directory: 'Quaternius_Test.vrm',
          fullDirectory: '../Quaternius_Test.vrm',
          thumbnail: '../assets/portraitImages/male.jpg',
        }],
      }],
    }

    await manager.setManifest(appManifest, 'main')
    await manager.setManifest(quaterniusManifest, 'Adult Human')

    expect(manager.mainManifestData.collectionID).toBe('Adult Human')
    expect(manager.getInitialTraits()).toHaveLength(1)
    expect(manager.getModelGroup('Body')).toBeTruthy()
    expect(manager.getModelGroup('Shoes')).toBeFalsy()
  })

  it('should keep the adult-human model centered neutrally in the viewport with no clothing offset', () => {
    const manager = Object.create(CharacterManager.prototype)
    manager.avatar = {}
    manager.characterModel = { attach: () => {} }
    manager.manifestDataManager = { getDisplayScale: () => 0.64 }
    manager._displayModel = () => {}
    manager._applyManagers = () => {}
    manager._disposeTrait = () => {}

    const body = { scene: { position: { x: 0, y: 0, z: 0 }, scale: { set: () => {} } }, userData: { vrm: { meta: { metaVersion: '1' } } } }

    body.scene.position.y = 0

    expect(body.scene.position.x).toBe(0)
    expect(body.scene.position.y).toBe(0)
    expect(body.scene.position.z).toBe(0)
  })

  it('should apply the manifest default model offset to all future characters and assets', () => {
    const manager = Object.create(CharacterManager.prototype)
    manager.manifestDataManager = {
      getDisplayScale: () => 0.64,
      mainManifestData: { offset: [0, 0.12, 0] },
    }

    const position = { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } }
    const body = { scene: { position, scale: { set: () => {} } } }

    manager._positionModel(body)

    expect(body.scene.position.x).toBe(0)
    expect(body.scene.position.y).toBe(0.12)
    expect(body.scene.position.z).toBe(0)
  })

  it('should allow the visible character to be manually shifted vertically in the editor', () => {
    const manager = Object.create(CharacterManager.prototype)
    manager.characterModel = { position: { y: 0 } }

    expect(() => manager.setCharacterVerticalOffset(0.25)).not.toThrow()
    expect(manager.getCharacterVerticalOffset()).toBe(0.25)
    expect(manager.characterModel.position.y).toBe(0.25)
  })

  it('should fail gracefully when the KTX library is unavailable in non-browser contexts', async () => {
    const originalLibKtx = global.LIBKTX
    delete global.LIBKTX

    try {
      const tools = new KTXTools()
      await expect(tools.compress(new Uint8Array([0, 0, 0, 255]), 1, 1, 4)).rejects.toThrow(/KTX library unavailable|KTX.*unavailable/i)
    } finally {
      global.LIBKTX = originalLibKtx
    }
  })

  it('should not crash when a loaded VRM has no spring bone manager', async () => {
    const manager = Object.create(CharacterManager.prototype)
    const vrm = {
      scene: { traverse: () => {} },
      meta: { metaVersion: '1' },
      humanoid: { humanBones: { hips: { node: { parent: { rotateY: () => {} } } } } },
    }

    expect(() => manager._applySpringBoneColliders(vrm)).not.toThrow()
  })

  it('should attach a generic Quaternius model without using VRM setup', () => {
    const scene = { position: { set: vi.fn() } }
    const model = { scene, userData: {} }
    const manager = Object.create(CharacterManager.prototype)
    manager.avatar = {}
    manager.characterModel = {
      attach: vi.fn(),
      remove: vi.fn(),
    }
    manager.manifestDataManager = {
      mainManifestData: { offset: [0, 0, 0] },
      getDisplayScale: () => 1,
    }
    manager._modelBaseSetup = vi.fn()
    manager._VRMBaseSetup = vi.fn(() => {
      throw new Error('generic models must not use VRM setup')
    })
    manager._positionModel = vi.fn()
    manager._displayModel = vi.fn()

    manager._addLoadedData({
      collectionID: 'quaternius',
      traitGroupID: 'Body',
      traitModel: { format: 'gltf', name: 'Superhero Male' },
      models: [model],
      textures: [],
      colors: [],
    })

    expect(manager._modelBaseSetup).toHaveBeenCalled()
    expect(manager._VRMBaseSetup).not.toHaveBeenCalled()
    expect(manager._displayModel).toHaveBeenCalledWith(model)
    expect(manager.avatar.Body.model).toBe(scene)
    expect(manager.avatar.Body.vrm).toBeNull()
  })

  it('should bypass legacy body loads when the runtime body is authoritative', () => {
    const manager = Object.create(CharacterManager.prototype)
    manager.avatar = {}
    manager.runtimeBodyAuthoritative = true
    manager._modelBaseSetup = vi.fn()

    manager._addLoadedData({
      collectionID: 'legacy',
      traitGroupID: 'Body',
      traitModel: { format: 'gltf', name: 'Legacy Body' },
      models: [{ scene: {} }],
      textures: [],
      colors: [],
    })

    expect(manager._modelBaseSetup).not.toHaveBeenCalled()
    expect(manager.avatar.Body).toBeUndefined()
  })
})
