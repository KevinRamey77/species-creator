import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { CharacterManager } from "./characterManager";

import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader';

export function sceneInitializer(canvasId) {
    const scene = new THREE.Scene()

    
    new RGBELoader().load(`${import.meta.env.BASE_URL}hdr/studio_small_09_2k.hdr`, (hdr_) => {
        hdr_.mapping = THREE.EquirectangularReflectionMapping;
        hdr_.colorSpace = THREE.LinearSRGBColorSpace
        scene.environment = hdr_;
    })
    scene.environmentIntensity = 0.5

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);

    // rotate the directional light to be a key light
    directionalLight.position.set(0, 1, 1);
    scene.add(directionalLight);

    const sceneElements = new THREE.Object3D();
    scene.add(sceneElements);

    const camera = new THREE.PerspectiveCamera(
        30,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    camera.position.set(0, 1.3, 2);


    const characterManager = new CharacterManager({parentModel: scene, createAnimationManager : true, renderCamera:camera})
    characterManager.addLookAtMouse(80,canvasId, camera, true);
   
    //"editor-scene"
    const canvasRef = document.getElementById(canvasId);
    const renderer = new THREE.WebGLRenderer({
        canvas: canvasRef,
        antialias: true,
        alpha: true,
        preserveDrawingBuffer: true,
    });

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableRotate = true;
    controls.enableZoom = true;
    controls.minDistance = 1;
    controls.maxDistance = 4;
    controls.maxPolarAngle = Math.PI / 2;
    controls.enablePan = true;
    controls.target = new THREE.Vector3(0, 1, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;

    const updateCharacterVerticalOffset = (delta) => {
        const currentOffset = characterManager?.getCharacterVerticalOffset?.() ?? 0;
        const nextOffset = Math.max(-1.5, Math.min(1.5, currentOffset + delta));
        characterManager?.setCharacterVerticalOffset?.(nextOffset);
    };

    const minPan = new THREE.Vector3(-0.5, 0, -0.5);
    const maxPan = new THREE.Vector3(0.5, 1.7, 0.5);

    const handleResize = () => {
        renderer.setSize(window.innerWidth, window.innerHeight);
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
    };

    window.addEventListener("resize", handleResize);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    console.info("[CharacterStudio] Three.js scene initialized", {
        sceneChildren: scene.children.length,
        camera: { position: camera.position.toArray(), near: camera.near, far: camera.far },
        renderer: { width: renderer.domElement.width, height: renderer.domElement.height },
        lights: scene.children.filter((child) => child.isLight).length,
    });

    const clock = new THREE.Clock();
    let firstRenderLogged = false;
    const animate = () => {
        requestAnimationFrame(animate);
        const delta = clock.getDelta();
        controls.target.clamp(minPan, maxPan);
        controls?.update();
        characterManager.update(delta);
        renderer.render(scene, camera);
        if (!firstRenderLogged) {
            firstRenderLogged = true;
            const gl = renderer.getContext();
            const diagnostics = typeof window !== "undefined"
                ? (window.__characterStudioDiagnostics ||= { events: [] })
                : null;
            const renderEvent = {
                type: "first-render",
                sceneChildren: scene.children.length,
                characterRootAttached: scene.getObjectById(characterManager.rootModel?.id) === characterManager.rootModel,
                characterModelAttached: scene.getObjectById(characterManager.characterModel?.id) === characterManager.characterModel,
                webglError: gl.getError(),
            };
            console.info("[CharacterStudio] First renderer.render completed", renderEvent);
            diagnostics?.events.push(renderEvent);
        }
    };


    animate();

    const handleMouseClick = (event) => {
        const isCtrlPressed = event.ctrlKey;
        const rect = canvasRef.getBoundingClientRect();
        const mousex = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        const mousey = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        characterManager.cameraRaycastCulling(mousex,mousey,isCtrlPressed);
    };

    const handleKeyDown = (event) => {
        if (!characterManager) return;

        if (event.key === "ArrowUp" || event.key === "w" || event.key === "W") {
            event.preventDefault();
            updateCharacterVerticalOffset(0.05);
        }

        if (event.key === "ArrowDown" || event.key === "s" || event.key === "S") {
            event.preventDefault();
            updateCharacterVerticalOffset(-0.05);
        }
    };


    async function fetchScene() {
        // // load environment
        // const modelPath = "./3d/Platform.glb"
      
        // const loader = new GLTFLoader()
        // // load the modelPath
        // const gltf = await loader.loadAsync(modelPath)
        // sceneElements.add(gltf.scene);
    }
    fetchScene();

    
    canvasRef.addEventListener("click", handleMouseClick);
    window.addEventListener("keydown", handleKeyDown);

    return {
        scene,
        camera,
        controls,
        characterManager,
        sceneElements,
        clock
    };
}
