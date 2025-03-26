import * as THREE from "three";
import { ARButton } from "three/addons/webxr/ARButton.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

let container;
let camera, scene, renderer;
let reticle;
let controller;
let models = [];
let directionalLightEnabled = true;
let jumpEnabled = true;
let rotationEnabled = true;
let directionalLight;
let lightIntensity = 3;
let lightColors = [0xffffff, 0xffaaaa, 0xaaffaa, 0xaaaaff]; // Білий, червоний, зелений, синій
let currentLightColorIndex = 0;

// Масив стилів матеріалів (оновлені для чіткості)
const materials = {
  realistic: null, // Реалістичний (з текстурами моделі)
  gold: new THREE.MeshStandardMaterial({
    color: 0xffd700, // Золотий колір
    metalness: 0.9, // Збільшуємо для чіткіших відблисків
    roughness: 0.1,
  }),
  glow: new THREE.MeshStandardMaterial({
    color: 0x00ff00, // Зелений сяючий
    emissive: 0x00ff00,
    emissiveIntensity: 1.5, // Зменшуємо, щоб не перекривати деталі
    metalness: 0.3,
    roughness: 0.3, // Зменшуємо для чіткості
  }),
  glass: new THREE.MeshPhysicalMaterial({
    transparent: true,
    opacity: 0.5, // Збільшуємо для чіткості
    metalness: 0.2,
    roughness: 0.05, // Зменшуємо для чіткіших відблисків
    transmission: 0.9,
    thickness: 0.5,
  }),
  chrome: new THREE.MeshStandardMaterial({
    color: 0xffffff, // Білий для хромового ефекту
    metalness: 1, // Максимальна відбивна здатність
    roughness: 0.02, // Мінімальна шорсткість для чіткості
  }),
};

// Зберігаємо оригінальні матеріали для кожної моделі
const originalMaterials = new Map();
let currentMaterial = "realistic";

init();
animate();

function init() {
  container = document.createElement("div");
  document.body.appendChild(container);

  // Сцена
  scene = new THREE.Scene();

  // Камера
  camera = new THREE.PerspectiveCamera(
    70,
    window.innerWidth / window.innerHeight,
    0.01,
    20
  );

  // Рендеринг
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;
  renderer.shadowMap.enabled = true; // Увімкнемо тіні
  renderer.shadowMap.type = THREE.PCFSoftShadowMap; // М'які тіні
  container.appendChild(renderer.domElement);

  // Світло
  directionalLight = new THREE.DirectionalLight(0xffffff, lightIntensity);
  directionalLight.position.set(2, 3, 2); // Змінимо позицію для чіткіших тіней
  directionalLight.castShadow = true; // Увімкнемо тіні
  directionalLight.shadow.mapSize.width = 1024; // Якість тіней
  directionalLight.shadow.mapSize.height = 1024;
  directionalLight.shadow.camera.near = 0.5;
  directionalLight.shadow.camera.far = 50;
  scene.add(directionalLight);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5); // Зменшуємо інтенсивність
  scene.add(ambientLight);

  const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 0.5); // Додаємо HemisphereLight
  hemisphereLight.position.set(0, 1, 0);
  scene.add(hemisphereLight);

  // Контролер для додавання об’єктів
  controller = renderer.xr.getController(0);
  controller.addEventListener("select", onSelect);
  scene.add(controller);

  // Додаємо мітку поверхні
  addReticleToScene();

  // Налаштування AR-режиму з hit-test
  const button = ARButton.createButton(renderer, {
    requiredFeatures: ["hit-test"],
    onSessionStarted: () => {
      renderer.domElement.style.background = "transparent";
      document.getElementById("controls").style.display = "flex";
    },
    onSessionEnded: () => {
      document.getElementById("controls").style.display = "flex";
    },
  });
  document.body.appendChild(button);
  renderer.domElement.style.display = "block";

  // Додаємо слухачі для кнопок
  document
    .getElementById("materialRealisticBtn")
    .addEventListener("click", () => setMaterial("realistic"));
  document
    .getElementById("materialGoldBtn")
    .addEventListener("click", () => setMaterial("gold"));
  document
    .getElementById("materialGlowBtn")
    .addEventListener("click", () => setMaterial("glow"));
  document
    .getElementById("materialGlassBtn")
    .addEventListener("click", () => setMaterial("glass"));
  document
    .getElementById("materialChromeBtn")
    .addEventListener("click", () => setMaterial("chrome"));
  document
    .getElementById("toggleDirectionalLightBtn")
    .addEventListener("click", toggleDirectionalLight);
  document
    .getElementById("increaseLightIntensityBtn")
    .addEventListener("click", increaseLightIntensity);
  document
    .getElementById("decreaseLightIntensityBtn")
    .addEventListener("click", decreaseLightIntensity);
  document
    .getElementById("changeLightColorBtn")
    .addEventListener("click", changeLightColor);
  document
    .getElementById("toggleJumpBtn")
    .addEventListener("click", toggleJump);
  document
    .getElementById("toggleRotationBtn")
    .addEventListener("click", toggleRotation);

  window.addEventListener("resize", onWindowResize, false);
}

function addReticleToScene() {
  const geometry = new THREE.RingGeometry(0.15, 0.2, 32).rotateX(-Math.PI / 2);
  const material = new THREE.MeshBasicMaterial({
    color: 0x00ff00,
    transparent: true,
    opacity: 0.7,
  });

  reticle = new THREE.Mesh(geometry, material);
  reticle.matrixAutoUpdate = false;
  reticle.visible = false;
  scene.add(reticle);

  reticle.add(new THREE.AxesHelper(0.5));
}

function onSelect() {
  if (reticle.visible) {
    console.log("onSelect triggered, reticle is visible at", reticle.position);

    const loader = new GLTFLoader();
    loader.load(
      "https://ar-dinosaur-model.s3.eu-north-1.amazonaws.com/scene.gltf",
      (gltf) => {
        const model = gltf.scene;

        model.position.setFromMatrixPosition(reticle.matrix);
        model.quaternion.setFromRotationMatrix(reticle.matrix);
        model.scale.set(0.5, 0.5, 0.5);

        // Зберігаємо базову позицію для анімації стрибків
        model.userData.basePosition = model.position.clone();
        model.userData.rotationSpeed = 0.02;

        // Налаштування моделі для тіней і матеріалів
        model.traverse((child) => {
          if (child.isMesh) {
            console.log("Mesh found:", child.name, "Material:", child.material);
            originalMaterials.set(child, child.material);
            child.castShadow = true; // Модель відкидає тіні
            child.receiveShadow = true; // Модель приймає тіні
            if (child.material) {
              child.material.side = THREE.DoubleSide;
              child.material.needsUpdate = true;
              // Налаштування для чіткості
              child.material.metalness = child.material.metalness || 0.5; // Збільшуємо для відблисків
              child.material.roughness = child.material.roughness || 0.3; // Зменшуємо для чіткості
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

        // Застосовуємо поточний стиль
        if (materials[currentMaterial]) {
          model.traverse((child) => {
            if (child.isMesh) {
              child.material = materials[currentMaterial].clone();
              child.material.needsUpdate = true;
            }
          });
        }

        models.push(model);
        scene.add(model);

        console.log("Model added to scene at", model.position);

        // Відтворюємо звук
        const placeSound = document.getElementById("placeSound");
        if (placeSound) {
          placeSound.currentTime = 0;
          placeSound.play();
        }
      },
      (xhr) => {
        console.log((xhr.loaded / xhr.total) * 100 + "% loaded");
      },
      (error) => {
        console.error("Error loading model:", error);
      }
    );
  } else {
    console.warn("onSelect triggered, but reticle is not visible");
  }
}

function setMaterial(type) {
  currentMaterial = type;
  models.forEach((model) => {
    if (materials[type]) {
      model.traverse((child) => {
        if (child.isMesh) {
          child.material = materials[type].clone();
          child.material.needsUpdate = true;
        }
      });
    } else {
      // Повертаємо оригінальні матеріали
      model.traverse((child) => {
        if (child.isMesh) {
          const originalMaterial = originalMaterials.get(child);
          if (originalMaterial) {
            child.material = originalMaterial;
            child.material.needsUpdate = true;
          }
        }
      });
    }
  });

  // Оновлюємо текст кнопок
  document.getElementById("materialRealisticBtn").textContent =
    currentMaterial === "realistic"
      ? "Material: Realistic (Active)"
      : "Material: Realistic";
  document.getElementById("materialGoldBtn").textContent =
    currentMaterial === "gold" ? "Material: Gold (Active)" : "Material: Gold";
  document.getElementById("materialGlowBtn").textContent =
    currentMaterial === "glow" ? "Material: Glow (Active)" : "Material: Glow";
  document.getElementById("materialGlassBtn").textContent =
    currentMaterial === "glass"
      ? "Material: Glass (Active)"
      : "Material: Glass";
  document.getElementById("materialChromeBtn").textContent =
    currentMaterial === "chrome"
      ? "Material: Chrome (Active)"
      : "Material: Chrome";
}

function toggleDirectionalLight() {
  directionalLightEnabled = !directionalLightEnabled;
  directionalLight.visible = directionalLightEnabled;
  document.getElementById("toggleDirectionalLightBtn").textContent =
    directionalLightEnabled
      ? "Directional Light: On"
      : "Directional Light: Off";
}

function increaseLightIntensity() {
  lightIntensity = Math.min(lightIntensity + 0.5, 5); // Максимум 5
  directionalLight.intensity = lightIntensity;
  console.log("Light intensity increased to", lightIntensity);
}

function decreaseLightIntensity() {
  lightIntensity = Math.max(lightIntensity - 0.5, 0); // Мінімум 0
  directionalLight.intensity = lightIntensity;
  console.log("Light intensity decreased to", lightIntensity);
}

function changeLightColor() {
  currentLightColorIndex = (currentLightColorIndex + 1) % lightColors.length;
  directionalLight.color.setHex(lightColors[currentLightColorIndex]);
  const colorNames = ["White", "Red", "Green", "Blue"];
  document.getElementById(
    "changeLightColorBtn"
  ).textContent = `Light Color: ${colorNames[currentLightColorIndex]}`;
}

function toggleJump() {
  jumpEnabled = !jumpEnabled;
  document.getElementById("toggleJumpBtn").textContent = jumpEnabled
    ? "Jump: On"
    : "Jump: Off";
}

function toggleRotation() {
  rotationEnabled = !rotationEnabled;
  document.getElementById("toggleRotationBtn").textContent = rotationEnabled
    ? "Rotation: On"
    : "Rotation: Off";
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  renderer.setAnimationLoop(render);
}

let hitTestSource = null;
let localSpace = null;
let hitTestSourceInitialized = false;

async function initializeHitTestSource() {
  const session = renderer.xr.getSession();
  const viewerSpace = await session.requestReferenceSpace("viewer");
  hitTestSource = await session.requestHitTestSource({ space: viewerSpace });
  localSpace = await session.requestReferenceSpace("local");

  hitTestSourceInitialized = true;

  session.addEventListener("end", () => {
    hitTestSourceInitialized = false;
    hitTestSource = null;
  });
}

function render(timestamp, frame) {
  if (frame) {
    if (!hitTestSourceInitialized) {
      initializeHitTestSource();
    }

    if (hitTestSourceInitialized) {
      const hitTestResults = frame.getHitTestResults(hitTestSource);
      if (hitTestResults.length > 0) {
        const hit = hitTestResults[0];
        const pose = hit.getPose(localSpace);

        reticle.visible = true;
        reticle.matrix.fromArray(pose.transform.matrix);

        reticle.material.opacity = 0.7 + 0.3 * Math.sin(timestamp * 0.005);
        reticle.material.color.setHSL((timestamp * 0.0005) % 1, 0.7, 0.5);
      } else {
        reticle.visible = false;
      }
    }

    // Анімації для кожної моделі
    models.forEach((model) => {
      // Анімація стрибків
      if (jumpEnabled) {
        const jumpHeight = 0.1;
        const jumpSpeed = 0.005;
        const offsetY = Math.sin(timestamp * jumpSpeed) * jumpHeight;
        model.position.y = model.userData.basePosition.y + offsetY;
      } else {
        model.position.y = model.userData.basePosition.y;
      }

      // Анімація обертання
      if (rotationEnabled) {
        model.rotation.y += model.userData.rotationSpeed;
      }
    });

    renderer.render(scene, camera);
  }
}
