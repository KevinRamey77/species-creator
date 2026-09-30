import { describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
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

const createOcclusionModel = (name = 'SuperHero_Male') => {
  const model = new THREE.Group()
  const bones = []
  for (let index = 0; index < BONE_COUNT; index += 1) {
    const bone = new THREE.Bone()
    bone.name = index === 0 ? 'root' : `bone_${index}`
    if (bones[index - 1]) bones[index - 1].add(bone)
    else model.add(bone)
    bones.push(bone)
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    -0.2, 0.2, 0, 0.2, 0.2, 0, 0, 0.6, 0,
    -0.2, 1, 0, 0.2, 1, 0, 0, 1.4, 0,
    0.7, 1, 0, 1.1, 1, 0, 0.9, 1.4, 0,
    -0.2, 1.8, 0, 0.2, 1.8, 0, 0, 2.2, 0,
  ], 3))
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Array(48).fill(0), 4))
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(
    Array.from({ length: 48 }, (_, index) => index % 4 === 0 ? 1 : 0), 4,
  ))
  geometry.setIndex([0, 1, 2, 3, 4, 5, 6, 8, 7, 9, 10, 11])
  const mesh = new THREE.SkinnedMesh(geometry, new THREE.MeshBasicMaterial())
  mesh.name = name
  mesh.bind(new THREE.Skeleton(bones))
  model.add(mesh)
  return { model, mesh, bones }
}

const loadNormalizedGltf = async (relativePath) => {
  const gltfPath = path.resolve(process.cwd(), 'public', `${relativePath}.gltf`)
  const binaryPath = path.resolve(process.cwd(), 'public', `${relativePath}.bin`)
  const json = JSON.parse(await readFile(gltfPath, 'utf8'))
  const binary = await readFile(binaryPath)
  delete json.buffers[0].uri
  delete json.images
  delete json.textures
  delete json.samplers
  json.materials?.forEach((material) => {
    delete material.normalTexture
    delete material.pbrMetallicRoughness?.baseColorTexture
    delete material.pbrMetallicRoughness?.metallicRoughnessTexture
  })
  const jsonBytes = new TextEncoder().encode(JSON.stringify(json))
  const jsonLength = Math.ceil(jsonBytes.length / 4) * 4
  const binaryLength = Math.ceil(binary.length / 4) * 4
  const glb = new ArrayBuffer(12 + 8 + jsonLength + 8 + binaryLength)
  const view = new DataView(glb)
  view.setUint32(0, 0x46546c67, true)
  view.setUint32(4, 2, true)
  view.setUint32(8, glb.byteLength, true)
  view.setUint32(12, jsonLength, true)
  view.setUint32(16, 0x4e4f534a, true)
  new Uint8Array(glb, 20, jsonLength).fill(0x20)
  new Uint8Array(glb, 20, jsonBytes.length).set(jsonBytes)
  const binaryOffset = 20 + jsonLength
  view.setUint32(binaryOffset, binaryLength, true)
  view.setUint32(binaryOffset + 4, 0x004e4942, true)
  new Uint8Array(glb, binaryOffset + 8, binary.length).set(binary)
  return (await new GLTFLoader().parseAsync(glb, '')).scene
}

const getSkinnedWorldBounds = (root, meshName, includePoint = () => true) => {
  const bounds = new THREE.Box3()
  const position = new THREE.Vector3()
  let foundMesh = false
  root.updateMatrixWorld(true)
  root.traverse((child) => {
    if (!child.isSkinnedMesh || child.name !== meshName) return
    foundMesh = true
    const vertexCount = child.geometry.getAttribute('position').count
    for (let vertex = 0; vertex < vertexCount; vertex += 1) {
      child.getVertexPosition(vertex, position)
      child.localToWorld(position)
      if (includePoint(position)) bounds.expandByPoint(position)
    }
  })
  return foundMesh ? bounds : null
}

const countTrianglesInRegion = (mesh, includePoint) => {
  const geometry = mesh.geometry
  const index = geometry.index
  if (!index) return 0
  const vertices = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]
  let count = 0
  mesh.updateMatrixWorld(true)
  for (let offset = 0; offset + 2 < index.count; offset += 3) {
    vertices.forEach((vertex, corner) => {
      mesh.getVertexPosition(index.getX(offset + corner), vertex)
      mesh.localToWorld(vertex)
    })
    const centroid = vertices[0].clone().add(vertices[1]).add(vertices[2]).multiplyScalar(1 / 3)
    if (includePoint(centroid)) count += 1
  }
  return count
}

const countHandWeightedTriangles = (mesh) => {
  const index = mesh.geometry.index
  const skinIndex = mesh.geometry.getAttribute('skinIndex')
  const skinWeight = mesh.geometry.getAttribute('skinWeight')
  const protectedBoneIndices = new Set(mesh.skeleton.bones
    .map((bone, boneIndex) => /hand|wrist|finger|thumb|index|middle|ring|pinky/i.test(bone.name || '') ? boneIndex : -1)
    .filter((boneIndex) => boneIndex >= 0))
  const vertices = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]
  let count = 0
  mesh.updateMatrixWorld(true)
  for (let offset = 0; offset + 2 < index.count; offset += 3) {
    const triangleVertices = [0, 1, 2].map((corner) => index.getX(offset + corner))
    vertices.forEach((vertex, corner) => {
      mesh.getVertexPosition(triangleVertices[corner], vertex)
      mesh.localToWorld(vertex)
    })
    const isProtected = triangleVertices.every((vertex) => {
      let protectedWeight = 0
      for (let component = 0; component < Math.min(skinIndex.itemSize, skinWeight.itemSize); component += 1) {
        if (protectedBoneIndices.has(skinIndex.getComponent(vertex, component))) {
          protectedWeight += skinWeight.getComponent(vertex, component)
        }
      }
      return protectedWeight >= 0.95
    })
    if (isProtected) count += 1
  }
  return count
}

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

  it('hides only body faces covered by active clothing and restores the original mesh', async () => {
    const body = createOcclusionModel()
    const shirt = new THREE.Group()
    const shirtMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.55, 0.02),
      new THREE.MeshBasicMaterial(),
    )
    shirtMesh.position.set(0, 1.2, 0.03)
    shirt.add(shirtMesh)
    const trousers = new THREE.Group()
    const trousersMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.55, 0.02),
      new THREE.MeshBasicMaterial(),
    )
    trousersMesh.position.set(0, 0.4, 0.03)
    trousers.add(trousersMesh)
    const armGuards = new THREE.Group()
    const armGuardMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.55, 0.02),
      new THREE.MeshBasicMaterial(),
    )
    armGuardMesh.position.set(0.9, 1.2, -0.03)
    armGuards.add(armGuardMesh)
    const originalGeometry = body.mesh.geometry
    const originalIndices = [...originalGeometry.index.array]
    const originalSkinIndices = [...originalGeometry.getAttribute('skinIndex').array]
    const originalSkinWeights = [...originalGeometry.getAttribute('skinWeight').array]
    const originalSkeleton = body.mesh.skeleton
    const loader = {
      loadAsync: vi.fn(async (asset) => ({
        scene: asset.id === 'body'
          ? body.model
          : asset.id === 'shirt'
            ? shirt
            : asset.id === 'arm-guards'
              ? armGuards
              : trousers,
      })),
    }
    const manager = new AssetAssemblyManager({ loader })
    const bodyAsset = createAsset('body', 'body', 'body')

    await manager.setAsset('body', bodyAsset, { rig: 'quaternius-standard' })
    await manager.setAsset('shirt', createAsset('shirt', 'clothing', 'clothing-body', ['body']), {
      bodyId: 'body',
      rig: 'quaternius-standard',
    })
    await manager.setAsset('arm-guards', createAsset('arm-guards', 'clothing', 'clothing-arms', ['body']), {
      bodyId: 'body',
      rig: 'quaternius-standard',
    })
    await manager.setAsset('trousers', createAsset('trousers', 'clothing', 'clothing-legs', ['body']), {
      bodyId: 'body',
      rig: 'quaternius-standard',
    })

    expect(body.mesh.geometry).not.toBe(originalGeometry)
    expect([...body.mesh.geometry.index.array]).toEqual([9, 10, 11])
    expect([...body.mesh.geometry.getAttribute('skinIndex').array]).toEqual(originalSkinIndices)
    expect([...body.mesh.geometry.getAttribute('skinWeight').array]).toEqual(originalSkinWeights)
    expect(body.mesh.skeleton).toBe(originalSkeleton)
    expect(body.mesh.skeleton.bones).toHaveLength(BONE_COUNT)

    manager.removeAsset('clothing-body')
    expect(body.mesh.geometry).not.toBe(originalGeometry)
    expect([...body.mesh.geometry.index.array]).toEqual([3, 4, 5, 9, 10, 11])

    manager.removeAsset('clothing-arms')
    expect([...body.mesh.geometry.index.array]).toEqual([3, 4, 5, 6, 8, 7, 9, 10, 11])

    manager.removeAsset('clothing-legs')

    expect(body.mesh.geometry).toBe(originalGeometry)
    expect([...body.mesh.geometry.index.array]).toEqual(originalIndices)
  })

  it('hides underside skin near an open garment surface when normal rays miss', async () => {
    const body = createOcclusionModel()
    body.mesh.geometry.setAttribute('position', new THREE.Float32BufferAttribute([
      0, 0, 0,
      0.05, 0, 0,
      0, 0.05, 0,
    ], 3))
    body.mesh.geometry.setIndex([0, 1, 2])
    const garment = new THREE.Group()
    const panel = new THREE.Mesh(
      new THREE.BoxGeometry(0.02, 0.08, 0.08),
      new THREE.MeshBasicMaterial(),
    )
    panel.position.set(0.03, 0.025, 0.04)
    garment.add(panel)
    const manager = new AssetAssemblyManager({
      loader: {
        loadAsync: vi.fn(async (asset) => ({ scene: asset.id === 'body' ? body.model : garment })),
      },
    })

    await manager.setAsset('body', createAsset('body', 'body', 'body'), { rig: 'quaternius-standard' })
    await manager.setAsset('sleeve', createAsset('sleeve', 'clothing', 'clothing-arms', ['body']), {
      bodyId: 'body',
      rig: 'quaternius-standard',
    })

    expect(body.mesh.geometry.index.count).toBe(0)
  })

  it('loads long hair by itself and applies the selected hair color', async () => {
    const body = createOcclusionModel('SuperHero_Male')
    const eyebrows = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial())
    eyebrows.name = 'Eyebrows'
    body.model.add(eyebrows)
    const longHair = createOcclusionModel('Hair_Long')
    const longHairAsset = {
      ...createAsset('long-hair', 'hair', 'hair', ['body']),
      id: 'quaternius.hair.hair-long',
    }
    const loader = {
      loadAsync: vi.fn(async (asset) => ({ scene: asset.id === 'body' ? body.model : longHair.model })),
    }
    const manager = new AssetAssemblyManager({ loader })

    await manager.setAsset('body', createAsset('body', 'body', 'body'), { rig: 'quaternius-standard' })
    await manager.setAsset('hair', longHairAsset, { bodyId: 'body', rig: 'quaternius-standard' })

    const hairMeshes = []
    manager.activeAssets.get('hair').model.traverse((child) => {
      if (child.isSkinnedMesh) hairMeshes.push(child)
    })
    expect(hairMeshes.map((mesh) => mesh.name)).toEqual(['Hair_Long'])

    manager.setHairColor('#315f9a')

    hairMeshes.forEach((mesh) => {
      expect(mesh.material.color.getHexString()).toBe('315f9a')
    })
    expect(eyebrows.material.color.getHexString()).toBe('315f9a')
  })

  it('culls real body triangles under the ranger arm asset', async () => {
    const bodyModel = await loadNormalizedGltf(
      'quaternius/normalized/body/quaternius-body-superhero-male/Superhero_Male_FullBody',
    )
    const armsModel = await loadNormalizedGltf(
      'quaternius/normalized/clothing/quaternius-clothing-male-ranger-arms/Male_Ranger_Arms',
    )
    const longHairModel = await loadNormalizedGltf(
      'quaternius/normalized/hair/quaternius-hair-hair-long/Hair_Long',
    )
    const hairBunsModel = await loadNormalizedGltf(
      'quaternius/normalized/hair/quaternius-hair-hair-buns/Hair_Buns',
    )
    const bodyAsset = createAsset('body', 'body', 'body')
    const armsAsset = createAsset('ranger-arms', 'clothing', 'clothing-arms', ['body'])
    const longHairAsset = {
      ...createAsset('long-hair', 'hair', 'hair', ['body']),
      id: 'quaternius.hair.hair-long',
    }
    const manager = new AssetAssemblyManager({
      loader: {
        loadAsync: vi.fn(async (asset) => ({
          scene: asset.id === bodyAsset.id
            ? bodyModel
            : asset.id === armsAsset.id
              ? armsModel
              : asset.id === longHairAsset.id
                ? longHairModel
                : asset.id === 'quaternius.hair.hair-buns'
                  ? hairBunsModel
                  : longHairModel,
        })),
      },
    })
    let bodyMesh
    bodyModel.traverse((child) => {
      if (child.isSkinnedMesh && child.name === 'SuperHero_Male') bodyMesh = child
    })
    const originalIndexCount = bodyMesh.geometry.index.count

    await manager.setAsset('body', bodyAsset, { rig: 'quaternius-standard' })
    await manager.setAsset('clothing-arms', armsAsset, { bodyId: 'body', rig: 'quaternius-standard' })

    expect(bodyMesh.geometry.index.count).toBeLessThan(originalIndexCount)
    const bodyIndexCountWithArms = bodyMesh.geometry.index.count

    await manager.setAsset('hair', longHairAsset, { bodyId: 'body', rig: 'quaternius-standard' })
    manager.update(0)
    const bodyHeadBounds = getSkinnedWorldBounds(
      bodyModel,
      'SuperHero_Male',
      (point) => point.y > 1.65 && Math.abs(point.x) < 0.25,
    )
    const longHairBounds = getSkinnedWorldBounds(manager.activeAssets.get('hair').model, 'Hair_Long')
    expect(longHairBounds.max.y).toBeGreaterThan(bodyHeadBounds.max.y)
    expect(bodyMesh.geometry.index.count).toBe(bodyIndexCountWithArms)
    const hairMeshes = []
    manager.activeAssets.get('hair').model.traverse((child) => {
      if (child.isSkinnedMesh) hairMeshes.push(child)
    })
    expect(hairMeshes.map((mesh) => mesh.name)).toEqual(['Hair_Long'])

    const bodyEyebrows = []
    bodyModel.traverse((child) => {
      if (child.isSkinnedMesh && child.name === 'Eyebrows') bodyEyebrows.push(child)
    })
    expect(bodyEyebrows[0].material.color.getHexString()).toBe('4a382b')
    manager.setHairColor('#315f9a')
    expect(bodyEyebrows[0].material.color.getHexString()).toBe('315f9a')

    const bunsAsset = {
      ...createAsset('hair-buns', 'hair', 'hair', ['body']),
      id: 'quaternius.hair.hair-buns',
    }
    await manager.setAsset('hair', bunsAsset, { bodyId: 'body', rig: 'quaternius-standard' })
    manager.update(0)
    const bunsBounds = getSkinnedWorldBounds(manager.activeAssets.get('hair').model, 'Hair_Buns')
    expect(bunsBounds.max.y).toBeGreaterThan(bodyHeadBounds.max.y)
  })

  it('preserves the neck and face while culling torso skin under clothing and outfits', async () => {
    const bodyModel = await loadNormalizedGltf(
      'quaternius/normalized/body/quaternius-body-superhero-male/Superhero_Male_FullBody',
    )
    const torsoModel = await loadNormalizedGltf(
      'quaternius/normalized/clothing/quaternius-clothing-male-peasant-body/Male_Peasant_Body',
    )
    const hoodModel = await loadNormalizedGltf(
      'quaternius/normalized/clothing/quaternius-clothing-male-ranger-head-hood/Male_Ranger_Head_Hood',
    )
    const rangerOutfitModel = await loadNormalizedGltf(
      'quaternius/normalized/clothing/quaternius-clothing-male-ranger/Male_Ranger',
    )
    const bodyAsset = createAsset('body', 'body', 'body')
    const torsoAsset = createAsset('peasant-torso', 'clothing', 'clothing-body', ['body'])
    const hoodAsset = createAsset('ranger-hood', 'clothing', 'clothing-head-hood', ['body'])
    const rangerOutfitAsset = createAsset('ranger-outfit', 'clothing', 'outfit', ['body'])
    const manager = new AssetAssemblyManager({
      loader: {
        loadAsync: vi.fn(async (asset) => ({
          scene: asset.id === bodyAsset.id
            ? bodyModel
            : asset.id === torsoAsset.id
              ? torsoModel
              : asset.id === hoodAsset.id
                ? hoodModel
                  : rangerOutfitModel,
        })),
      },
    })
    let bodyMesh
    bodyModel.traverse((child) => {
      if (child.isSkinnedMesh && child.name === 'SuperHero_Male') bodyMesh = child
    })
    const originalHandTriangleCount = countHandWeightedTriangles(bodyMesh)
    expect(originalHandTriangleCount).toBeGreaterThan(0)
    const upperBodyBands = [1.65, 1.8, 1.95]
    const originalTriangleCounts = upperBodyBands.map((minimumY) => countTrianglesInRegion(
      bodyMesh,
      (point) => point.y > minimumY && Math.abs(point.x) < 0.25,
    ))
    const torsoSides = [-1, 1]
    const originalTorsoSideCounts = torsoSides.map((side) => countTrianglesInRegion(
      bodyMesh,
      (point) => point.y > 0.8 && point.y < 1.65 && Math.abs(point.x) < 0.25 && point.z * side > 0,
    ))

    await manager.setAsset('body', bodyAsset, { rig: 'quaternius-standard' })
    await manager.setAsset('clothing-body', torsoAsset, { bodyId: 'body', rig: 'quaternius-standard' })
    expect(countHandWeightedTriangles(bodyMesh)).toBe(originalHandTriangleCount)
    const getUpperBodyTriangleCounts = () => upperBodyBands.map((minimumY) => countTrianglesInRegion(
      bodyMesh,
      (point) => point.y > minimumY && Math.abs(point.x) < 0.25,
    ))
    expect(getUpperBodyTriangleCounts()).toEqual(originalTriangleCounts)
    const remainingTorsoSideCounts = torsoSides.map((side) => countTrianglesInRegion(
      bodyMesh,
      (point) => point.y > 0.8 && point.y < 1.65 && Math.abs(point.x) < 0.25 && point.z * side > 0,
    ))
    expect(remainingTorsoSideCounts.every((count, index) => count < originalTorsoSideCounts[index])).toBe(true)

    await manager.setAsset('clothing-head-hood', hoodAsset, { bodyId: 'body', rig: 'quaternius-standard' })
    expect(getUpperBodyTriangleCounts()).toEqual(originalTriangleCounts)
    expect(countHandWeightedTriangles(bodyMesh)).toBe(originalHandTriangleCount)

    await manager.setAsset('outfit', rangerOutfitAsset, { bodyId: 'body', rig: 'quaternius-standard' })
    expect(getUpperBodyTriangleCounts()).toEqual(originalTriangleCounts)
    expect(countHandWeightedTriangles(bodyMesh)).toBe(originalHandTriangleCount)
    const rangerTorsoSideCounts = torsoSides.map((side) => countTrianglesInRegion(
      bodyMesh,
      (point) => point.y > 0.8 && point.y < 1.65 && Math.abs(point.x) < 0.25 && point.z * side > 0,
    ))
    const rangerTorsoRemainingFractions = rangerTorsoSideCounts.map((count, index) => (
      Number((count / originalTorsoSideCounts[index]).toFixed(2))
    ))
    expect(rangerTorsoSideCounts.every((count, index) => count < originalTorsoSideCounts[index])).toBe(true)
  }, 15000)

  it('keeps female Long and Buns hair aligned to the female head', async () => {
    const bodyModel = await loadNormalizedGltf(
      'quaternius/normalized/body/quaternius-body-superhero-female/Superhero_Female_FullBody',
    )
    const longHairModel = await loadNormalizedGltf(
      'quaternius/normalized/hair/quaternius-hair-hair-long/Hair_Long',
    )
    const hairBunsModel = await loadNormalizedGltf(
      'quaternius/normalized/hair/quaternius-hair-hair-buns/Hair_Buns',
    )
    const bodyAsset = createAsset('quaternius.body.superhero-female', 'body', 'body')
    const longHairAsset = createAsset('quaternius.hair.hair-long', 'hair', 'hair', [bodyAsset.id])
    const bunsAsset = createAsset('quaternius.hair.hair-buns', 'hair', 'hair', [bodyAsset.id])
    const manager = new AssetAssemblyManager({
      loader: {
        loadAsync: vi.fn(async (asset) => ({
          scene: asset.id === bodyAsset.id
            ? bodyModel
            : asset.id === longHairAsset.id
              ? longHairModel
              : asset.id === bunsAsset.id
                ? hairBunsModel
                : longHairModel,
        })),
      },
    })

    await manager.setAsset('body', bodyAsset, { rig: 'quaternius-standard' })
    await manager.setAsset('hair', longHairAsset, { bodyId: bodyAsset.id, rig: 'quaternius-standard' })
    manager.update(0)

    const bodyHeadBounds = getSkinnedWorldBounds(
      bodyModel,
      'Superhero_Female',
      (point) => point.y > 1.6 && Math.abs(point.x) < 0.25,
    )
    const longHairBounds = getSkinnedWorldBounds(manager.activeAssets.get('hair').model, 'Hair_Long')
    expect(manager.activeAssets.get('hair').model.scale.x).toBe(1)
    expect(longHairBounds.max.y).toBeGreaterThan(bodyHeadBounds.max.y)

    await manager.setAsset('hair', bunsAsset, { bodyId: bodyAsset.id, rig: 'quaternius-standard' })
    manager.update(0)
    const bunsBounds = getSkinnedWorldBounds(manager.activeAssets.get('hair').model, 'Hair_Buns')
    expect(manager.activeAssets.get('hair').model.scale.x).toBe(1)
    expect(bunsBounds.max.y).toBeGreaterThan(bodyHeadBounds.max.y)
  })
})
