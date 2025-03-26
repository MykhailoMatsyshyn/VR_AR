import * as THREE from "three";
import { ARButton } from "three/addons/webxr/ARButton.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

let camera, scene, renderer;
let loader;
let model;
let reticle;
let hitTestSource = null;
let hitTestSourceRequested = false;
let modelPlaced = false;

// Освітлення
let sceneAmbientLight, modelLight;
let sceneLightEnabled = true;
let modelLightEnabled = true;
let modelLightType = "point";
let modelLightIntensity = 5;
let modelLightColor = 0xffffff;

// Стани
let rotationEnabled = true;
let rotationAxis = "y";
let originalMaterials = new Map();
let materials = {};
let currentMaterial = "original";
let controlsVisible = false;

const modelUrl =
  "https://low-poly-building.s3.eu-north-1.amazonaws.com/scene.gltf";

init();
animate();

function init() {
  const container = document.createElement("div");
  document.body.appendChild(container);

  // Сцена
  scene = new THREE.Scene();

  // Камера
  camera = new THREE.PerspectiveCamera(
    70,
    window.innerWidth / window.innerHeight,
    0.01,
    40
  );

  // Рендеринг
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;
  container.appendChild(renderer.domElement);

  // Освітлення для сцени
  sceneAmbientLight = new THREE.AmbientLight(0xffffff, 1.5);
  scene.add(sceneAmbientLight);

  // Початкове освітлення для моделі (PointLight)
  modelLight = new THREE.PointLight(0xffffff, modelLightIntensity, 10);
  scene.add(modelLight);

  // Мітка для Hit Test
  const reticleGeometry = new THREE.RingGeometry(0.15, 0.2, 32);
  const reticleMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.5,
  });
  reticle = new THREE.Mesh(reticleGeometry, reticleMaterial);
  reticle.matrixAutoUpdate = false;
  reticle.visible = false;
  scene.add(reticle);

  // Завантаження моделі
  loadModel(modelUrl);

  // Налаштування AR-режиму з Hit Test
  const button = ARButton.createButton(renderer, {
    requiredFeatures: ["hit-test"],
    onSessionStarted: async (session) => {
      renderer.domElement.style.background = "transparent";
      document.getElementById("controls").style.display = "flex";
      session.addEventListener("end", () => {
        document.getElementById("controls").style.display = "flex";
        modelPlaced = false;
        reticle.visible = false;
        if (model) model.visible = false;
      });

      // Ініціалізація Hit Test
      const viewerReferenceSpace = await session.requestReferenceSpace(
        "viewer"
      );
      hitTestSource = await session.requestHitTestSource({
        space: viewerReferenceSpace,
      });
      hitTestSourceRequested = true;
    },
    onSessionEnded: () => {
      document.getElementById("controls").style.display = "flex";
      hitTestSourceRequested = false;
      hitTestSource = null;
    },
  });
  document.body.appendChild(button);
  renderer.domElement.style.display = "block";

  // Додаємо слухачі для кнопок
  document.getElementById("backBtn").addEventListener("click", () => {
    window.location.href = "../index.html";
  });
  document
    .getElementById("toggleRotationBtn")
    .addEventListener("click", toggleRotation);
  document.getElementById("rotationAxis").addEventListener("change", (e) => {
    rotationAxis = e.target.value;
  });
  document.getElementById("materialSelect").addEventListener("change", (e) => {
    setMaterial(e.target.value);
  });
  document
    .getElementById("toggleSceneLightBtn")
    .addEventListener("click", toggleSceneLight);
  document
    .getElementById("toggleModelLightBtn")
    .addEventListener("click", toggleModelLight);
  document.getElementById("modelLightType").addEventListener("change", (e) => {
    modelLightType = e.target.value;
    updateModelLight();
  });
  document
    .getElementById("modelLightIntensity")
    .addEventListener("input", (e) => {
      modelLightIntensity = parseFloat(e.target.value);
      updateModelLight();
    });
  document.getElementById("modelLightColor").addEventListener("input", (e) => {
    modelLightColor = parseInt(e.target.value.replace("#", "0x"), 16);
    updateModelLight();
  });

  // Додаємо слухач для кнопки згортання/розгортання
  document
    .getElementById("toggleControlsBtn")
    .addEventListener("click", toggleControls);

  window.addEventListener("resize", onWindowResize, false);
}

function toggleControls() {
  controlsVisible = !controlsVisible;
  const controls = document.getElementById("controls");
  const toggleBtn = document.getElementById("toggleControlsBtn");
  if (controlsVisible) {
    controls.classList.add("expanded");
    toggleBtn.textContent = "Hide Controls";
  } else {
    controls.classList.remove("expanded");
    toggleBtn.textContent = "Show Controls";
  }
}

function loadModel(url) {
  if (model) {
    scene.remove(model);
    originalMaterials.clear();
  }

  loader = new GLTFLoader();
  loader.load(
    url,
    function (gltf) {
      model = gltf.scene;
      model.position.z = -15;
      model.position.y = -5;
      scene.add(model);

      // Зберігаємо оригінальні матеріали
      model.traverse((child) => {
        if (child.isMesh) {
          originalMaterials.set(child, child.material);
          if (child.material) {
            child.material.side = THREE.DoubleSide;
            child.material.needsUpdate = true;
            if (child.material.map) {
              child.material.map.encoding = THREE.sRGBEncoding;
              child.material.map.flipY = false;
            }
            if (child.material.normalMap) {
              child.material.normalMap.encoding = THREE.LinearEncoding;
            }
            if (child.material.roughnessMap) {
              child.material.roughnessMap.encoding = THREE.LinearEncoding;
            }
            if (child.material.metalnessMap) {
              child.material.metalnessMap.encoding = THREE.LinearEncoding;
            }
          }
        }
      });

      // Ініціалізуємо матеріали
      materials.gold = new THREE.MeshStandardMaterial({
        color: 0xffd700,
        metalness: 1,
        roughness: 0.1,
      });
      materials.silver = new THREE.MeshStandardMaterial({
        color: 0xc0c0c0,
        metalness: 1,
        roughness: 0.2,
      });
      materials.emerald = new THREE.MeshStandardMaterial({
        color: 0x50c878,
        metalness: 0.3,
        roughness: 0.5,
      });
      materials.glass = new THREE.MeshPhysicalMaterial({
        color: 0x88ccff,
        transparent: true,
        opacity: 0.7,
        roughness: 0,
        metalness: 0.1,
        transmission: 0.9,
      });

      // Повертаємо поточний матеріал після завантаження
      setMaterial(currentMaterial);
      console.log("Model added to scene:", url);
    },
    function (xhr) {
      console.log((xhr.loaded / xhr.total) * 100 + "% loaded");
    },
    function (error) {
      console.error("Error loading model:", error);
    }
  );
}

function toggleRotation() {
  rotationEnabled = !rotationEnabled;
  document.getElementById("toggleRotationBtn").textContent = rotationEnabled
    ? "Disable Rotation"
    : "Enable Rotation";
}

function setMaterial(type) {
  if (!model) return;
  currentMaterial = type;
  model.traverse((child) => {
    if (child.isMesh) {
      if (type === "original") {
        child.material = originalMaterials.get(child);
      } else {
        child.material = materials[type];
      }
      child.material.needsUpdate = true;
    }
  });
  document.getElementById("materialSelect").value = currentMaterial;
}

function toggleSceneLight() {
  sceneLightEnabled = !sceneLightEnabled;
  sceneAmbientLight.visible = sceneLightEnabled;
  document.getElementById("toggleSceneLightBtn").textContent = sceneLightEnabled
    ? "Scene Light: On"
    : "Scene Light: Off";
}

function toggleModelLight() {
  modelLightEnabled = !modelLightEnabled;
  modelLight.visible = modelLightEnabled;
  document.getElementById("toggleModelLightBtn").textContent = modelLightEnabled
    ? "Model Light: On"
    : "Model Light: Off";
}

function updateModelLight() {
  scene.remove(modelLight);
  if (modelLightType === "point") {
    modelLight = new THREE.PointLight(modelLightColor, modelLightIntensity, 10);
  } else if (modelLightType === "spot") {
    modelLight = new THREE.SpotLight(
      modelLightColor,
      modelLightIntensity,
      10,
      Math.PI / 4,
      0.5
    );
    modelLight.target = model;
  } else if (modelLightType === "directional") {
    modelLight = new THREE.DirectionalLight(
      modelLightColor,
      modelLightIntensity
    );
    modelLight.position.set(5, 5, 5);
  }
  modelLight.visible = modelLightEnabled;
  scene.add(modelLight);
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  renderer.setAnimationLoop(render);
}

function render() {
  if (renderer.xr.isPresenting && hitTestSourceRequested && hitTestSource) {
    const frame = renderer.xr.getFrame();
    const hitTestResults = frame.getHitTestResults(hitTestSource);
    if (hitTestResults.length > 0 && !modelPlaced) {
      const hit = hitTestResults[0];
      const hitPose = hit.getPose(renderer.xr.getReferenceSpace());
      reticle.visible = true;
      reticle.matrix.fromArray(hitPose.transform.matrix);

      // Розміщення моделі при натисканні
      renderer.domElement.addEventListener("click", placeModel, { once: true });
    } else {
      reticle.visible = false;
    }
  }

  rotateModel();
  updateModelLightPosition();
  renderer.render(scene, camera);
}

function placeModel() {
  if (reticle.visible && model) {
    model.matrixAutoUpdate = true;
    model.position.setFromMatrixPosition(reticle.matrix);
    model.rotation.setFromRotationMatrix(reticle.matrix);
    model.visible = true;
    modelPlaced = true;
    reticle.visible = false;
  }
}

function updateModelLightPosition() {
  if (model && modelLight && modelLightType !== "directional") {
    const modelPosition = new THREE.Vector3();
    model.getWorldPosition(modelPosition);
    modelLight.position.set(
      modelPosition.x + 2,
      modelPosition.y + 2,
      modelPosition.z + 2
    );
    if (modelLightType === "spot") {
      modelLight.target = model;
    }
  }
}

let degrees = 0;

function rotateModel() {
  if (model && rotationEnabled) {
    degrees += 0.2;
    const rad = THREE.MathUtils.degToRad(degrees);
    if (rotationAxis === "x") {
      model.rotation.x = rad;
    } else if (rotationAxis === "y") {
      model.rotation.y = rad;
    } else if (rotationAxis === "z") {
      model.rotation.z = rad;
    }
  }
}
