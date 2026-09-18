import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { AssetAssemblyManager } from '../../src/library/assetAssemblyManager'

const BONE_COUNT = 65

const createModel = ({ offset, bindTranslation = 0, label }) => {
  const model = new THREE.Group()
  model.name = label
  const bones = []

  for (let index = 0; index < BONE_COUNT; index += 1) {
    const bone = new THREE.Bone()
    bone.name = index === 0 ? 'root' : `bone_${index}`
    bone.position.x = index === 1 ? offset : 0
    if (bones[index - 1]) bones[index - 1].add(bone)
    else model.add(bone)
    bones.push(bone)
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 1, 0], 3))
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute([0, 0, 0, 0, 1, 1, 1, 1], 4))
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0], 4))
  const mesh = new THREE.SkinnedMesh(geometry, new THREE.MeshBasicMaterial())
  mesh.name = `${label}-mesh`
  const skeleton = new THREE.Skeleton(bones)
  mesh.bind(skeleton, new THREE.Matrix4().makeTranslation(bindTranslation, 0, 0))
  mesh.bindMode = THREE.DetachedBindMode
  model.add(mesh)
  return { model, mesh, bones }
}

const createAsset = (id, category, slot, compatibleBodies) => ({
  id,
  name: id,
  category,
  slot,
  source: 'test',
  format: 'gltf',
  path: `${id}.gltf`,
  compatibleBodies,
  compatibleRigs: ['quaternius-standard'],
})

describe('AssetAssemblyManager pose retargeting', () => {
  it('preserves independent clothing bind data and transfers only the body pose delta', async () => {
    const body = createModel({ offset: 1, bindTranslation: 3, label: 'body' })
    const clothing = createModel({ offset: 2, bindTranslation: 7, label: 'clothing' })
    const originalSkeleton = clothing.mesh.skeleton
    const originalInverses = originalSkeleton.boneInverses.map((inverse) => inverse.clone())
    const originalBindMatrix = clothing.mesh.bindMatrix.clone()
    const originalBindMatrixInverse = clothing.mesh.bindMatrixInverse.clone()
    const originalSkinIndex = [...clothing.mesh.geometry.getAttribute('skinIndex').array]
    const originalSkinWeight = [...clothing.mesh.geometry.getAttribute('skinWeight').array]
    const loader = {
      loadAsync: vi.fn(async (asset) => ({ scene: asset.id === 'body' ? body.model : clothing.model })),
    }
    const manager = new AssetAssemblyManager({ loader })
    const bodyAsset = createAsset('body', 'body', 'body')
    const clothingAsset = createAsset('clothing', 'clothing', 'clothing-feet', ['body'])

    await manager.setAsset('body', bodyAsset, { rig: 'quaternius-standard' })
    await manager.setAsset('clothing-feet', clothingAsset, { bodyId: 'body', rig: 'quaternius-standard' })

    manager.update(0)
    const bodyRestWorld = body.bones[1].matrixWorld.clone()
    const clothingRestWorld = clothing.bones[1].matrixWorld.clone()
    expect(clothing.mesh.skeleton).toBe(originalSkeleton)
    expect(clothing.mesh.bindMatrix.elements).toEqual(originalBindMatrix.elements)
    expect(clothing.mesh.bindMatrixInverse.elements).toEqual(originalBindMatrixInverse.elements)
    expect(originalSkeleton.boneInverses.map((inverse) => inverse.elements)).toEqual(originalInverses.map((inverse) => inverse.elements))
    expect([...clothing.mesh.geometry.getAttribute('skinIndex').array]).toEqual(originalSkinIndex)
    expect([...clothing.mesh.geometry.getAttribute('skinWeight').array]).toEqual(originalSkinWeight)
    expect(clothing.bones[1].matrixWorld.elements).toEqual(clothingRestWorld.elements)

    body.bones[1].rotation.z = Math.PI / 2
    body.bones[1].updateMatrix()
    manager.update(0)
    const clothingWorld = clothing.bones[1].matrixWorld.clone()
    const expectedWorld = body.bones[1].matrixWorld.clone()
      .multiply(bodyRestWorld.clone().invert())
      .multiply(clothingRestWorld)
    expect(clothingWorld.elements).toEqual(expectedWorld.elements)
    expect(clothingWorld.elements).not.toEqual(body.bones[1].matrixWorld.elements)
  })

  it('keeps multiple clothing skeletons independent and leaves the body skeleton on removal', async () => {
    const body = createModel({ offset: 1, label: 'body' })
    const boots = createModel({ offset: 2, label: 'boots' })
    const torso = createModel({ offset: 3, label: 'torso' })
    const loader = {
      loadAsync: vi.fn(async (asset) => ({
        scene: { body: body.model, boots: boots.model, torso: torso.model }[asset.id],
      })),
    }
    const manager = new AssetAssemblyManager({ loader })
    const bodyAsset = createAsset('body', 'body', 'body')
    await manager.setAsset('body', bodyAsset, { rig: 'quaternius-standard' })
    await manager.setAsset('boots', createAsset('boots', 'clothing', 'clothing-feet', ['body']), { bodyId: 'body', rig: 'quaternius-standard' })
    await manager.setAsset('torso', createAsset('torso', 'clothing', 'clothing-body', ['body']), { bodyId: 'body', rig: 'quaternius-standard' })

    expect(boots.mesh.skeleton).not.toBe(torso.mesh.skeleton)
    expect(manager.bodySkeleton).toBe(body.mesh.skeleton)
    manager.removeAsset('boots')
    expect(manager.bodySkeleton).toBe(body.mesh.skeleton)
    expect(torso.mesh.skeleton.bones).toHaveLength(BONE_COUNT)
  })
})
