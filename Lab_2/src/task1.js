import * as THREE from "three";
import { ARButton } from "three/addons/webxr/ARButton.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

let camera, scene, renderer;
let dodecahedronMesh, ringMesh, tetrahedronMesh;
let controls;
let particles;
let hue = 0;

// Стани анімацій
let rotationEnabled = true;
let pulseMoveEnabled = true;
let colorEmitEnabled = true;
let speedMode = "normal";
let texturesEnabled = true;
let rotationDirection = 1; // 1: вперед, -1: назад
let specialEffectActive = false;
let specialEffectTimer = 0;

// Матеріали з текстурами та без
let dodecahedronMaterial, dodecahedronMaterialNoTexture;
let ringMaterial, ringMaterialNoTexture;
let tetrahedronMaterial, tetrahedronMaterialNoTexture;

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
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;
  container.appendChild(renderer.domElement);

  // Світло
  const directionalLight = new THREE.DirectionalLight(0xffffff, 4);
  directionalLight.position.set(3, 3, 3);
  scene.add(directionalLight);

  const pointLight = new THREE.PointLight(0xffffff, 10, 10);
  pointLight.position.set(-2, 2, 2);
  scene.add(pointLight);

  const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
  scene.add(ambientLight);

  // Завантаження текстур
  const textureLoader = new THREE.TextureLoader();
  const glassTexture = textureLoader.load(
    "https://as1.ftcdn.net/v2/jpg/01/61/23/82/1000_F_161238202_GbkRIC1lSjG7lZCLLPfQ7wAaEQyw9UsG.jpg"
  );
  const metalTexture = textureLoader.load(
    "https://images.unsplash.com/photo-1501166222995-ff31c7e93cef?fm=jpg&q=60&w=3000&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8bWV0YWwlMjB0ZXh0dXJlc3xlbnwwfHwwfHx8MA%3D%3D"
  );
  const lavaTexture = textureLoader.load(
    "https://t4.ftcdn.net/jpg/01/83/14/47/360_F_183144766_dbGaN37u6a4VCliXQ6wcarerpYmuLAto.jpg"
  );

  // 1. Додекаедр (DodecahedronGeometry)
  const dodecahedronGeometry = new THREE.DodecahedronGeometry(0.6);
  dodecahedronMaterial = new THREE.MeshPhysicalMaterial({
    map: glassTexture,
    transparent: true,
    opacity: 0.7,
    roughness: 0.5,
    metalness: 0.3,
    transmission: 0.6,
  });
  dodecahedronMaterialNoTexture = new THREE.MeshPhysicalMaterial({
    color: 0x00ff00,
    transparent: true,
    opacity: 0.7,
    roughness: 0.5,
    metalness: 0.3,
    transmission: 0.6,
  });
  dodecahedronMesh = new THREE.Mesh(dodecahedronGeometry, dodecahedronMaterial);
  dodecahedronMesh.position.set(-1.5, 0, -8);
  scene.add(dodecahedronMesh);

  // 2. Кільце (RingGeometry)
  const ringGeometry = new THREE.RingGeometry(0.4, 0.6, 32);
  ringMaterial = new THREE.MeshStandardMaterial({
    map: metalTexture,
    metalness: 0.8,
    roughness: 0.2,
  });
  ringMaterialNoTexture = new THREE.MeshStandardMaterial({
    color: 0x0000ff,
    metalness: 0.8,
    roughness: 0.2,
  });
  ringMesh = new THREE.Mesh(ringGeometry, ringMaterial);
  ringMesh.position.set(0, 0, -8);
  scene.add(ringMesh);

  // 3. Тетраедр (TetrahedronGeometry)
  const tetrahedronGeometry = new THREE.TetrahedronGeometry(0.6);
  tetrahedronMaterial = new THREE.MeshStandardMaterial({
    map: lavaTexture,
    emissive: 0xff0000,
    emissiveIntensity: 1.5,
    metalness: 0.5,
    roughness: 0.4,
  });
  tetrahedronMaterialNoTexture = new THREE.MeshStandardMaterial({
    color: 0xff0000,
    emissive: 0xff0000,
    emissiveIntensity: 1.5,
    metalness: 0.5,
    roughness: 0.4,
  });
  tetrahedronMesh = new THREE.Mesh(tetrahedronGeometry, tetrahedronMaterial);
  tetrahedronMesh.position.set(1.5, 0, -8);
  scene.add(tetrahedronMesh);

  // Частинки для спеціального ефекту
  createParticles();

  // Позиція камери
  camera.position.z = 3;

  // Контролери для 360 огляду на вебсторінці
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  // Налаштування AR-режиму
  const button = ARButton.createButton(renderer, {
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
    .getElementById("toggleRotationBtn")
    .addEventListener("click", toggleRotation);
  document
    .getElementById("togglePulseBtn")
    .addEventListener("click", togglePulseMove);
  document
    .getElementById("toggleColorBtn")
    .addEventListener("click", toggleColorEmit);
  document
    .getElementById("toggleSpeedBtn")
    .addEventListener("click", toggleSpeed);
  document
    .getElementById("toggleTexturesBtn")
    .addEventListener("click", toggleTextures);
  document
    .getElementById("toggleDirectionBtn")
    .addEventListener("click", toggleDirection);
  document
    .getElementById("specialEffectBtn")
    .addEventListener("click", triggerSpecialEffect);

  window.addEventListener("resize", onWindowResize, false);
}

function createParticles() {
  const particleGeometry = new THREE.BufferGeometry();
  const particleCount = 300;
  const positions = new Float32Array(particleCount * 3);
  const colors = new Float32Array(particleCount * 3);

  for (let i = 0; i < particleCount; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 10;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 10;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 10 - 8;

    colors[i * 3] = Math.random();
    colors[i * 3 + 1] = Math.random();
    colors[i * 3 + 2] = Math.random();
  }

  particleGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(positions, 3)
  );
  particleGeometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  const particleMaterial = new THREE.PointsMaterial({
    size: 0.1,
    vertexColors: true,
    transparent: true,
    opacity: 0,
  });

  particles = new THREE.Points(particleGeometry, particleMaterial);
  scene.add(particles);
}

function toggleRotation() {
  rotationEnabled = !rotationEnabled;
  document.getElementById("toggleRotationBtn").textContent = rotationEnabled
    ? "Disable Rotation"
    : "Enable Rotation";
}

function togglePulseMove() {
  pulseMoveEnabled = !pulseMoveEnabled;
  document.getElementById("togglePulseBtn").textContent = pulseMoveEnabled
    ? "Disable Pulse/Move"
    : "Enable Pulse/Move";
}

function toggleColorEmit() {
  colorEmitEnabled = !colorEmitEnabled;
  document.getElementById("toggleColorBtn").textContent = colorEmitEnabled
    ? "Disable Color/Emit"
    : "Enable Color/Emit";
}

function toggleSpeed() {
  speedMode = speedMode === "normal" ? "fast" : "normal";
  document.getElementById("toggleSpeedBtn").textContent = `Speed: ${
    speedMode.charAt(0).toUpperCase() + speedMode.slice(1)
  }`;
}

function toggleTextures() {
  texturesEnabled = !texturesEnabled;
  document.getElementById("toggleTexturesBtn").textContent = texturesEnabled
    ? "Disable Textures"
    : "Enable Textures";

  dodecahedronMesh.material = texturesEnabled
    ? dodecahedronMaterial
    : dodecahedronMaterialNoTexture;
  ringMesh.material = texturesEnabled ? ringMaterial : ringMaterialNoTexture;
  tetrahedronMesh.material = texturesEnabled
    ? tetrahedronMaterial
    : tetrahedronMaterialNoTexture;

  dodecahedronMesh.material.needsUpdate = true;
  ringMesh.material.needsUpdate = true;
  tetrahedronMesh.material.needsUpdate = true;
}

function toggleDirection() {
  rotationDirection *= -1;
  document.getElementById("toggleDirectionBtn").textContent =
    rotationDirection === 1 ? "Direction: Forward" : "Direction: Backward";
}

function triggerSpecialEffect() {
  specialEffectActive = true;
  specialEffectTimer = 0;
  particles.material.opacity = 1;
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  renderer.setAnimationLoop(render);
  controls.update();
}

function render(timestamp) {
  animateObjects(timestamp);
  renderer.render(scene, camera);
}

function animateObjects(timestamp) {
  const speed = speedMode === "normal" ? 1 : 2;
  const specialSpeed = specialEffectActive ? 3 : 1;

  // Анімація додекаедра
  if (rotationEnabled) {
    dodecahedronMesh.rotation.y -=
      0.01 * speed * rotationDirection * specialSpeed;
  }
  if (pulseMoveEnabled) {
    const scale = 1 + 0.2 * Math.sin(timestamp * 0.002 * speed * specialSpeed);
    dodecahedronMesh.scale.set(scale, scale, scale);
    dodecahedronMesh.position.y =
      0.5 * Math.sin(timestamp * 0.002 * speed * specialSpeed);
    dodecahedronMesh.material.opacity =
      0.5 + 0.2 * Math.sin(timestamp * 0.003 * speed * specialSpeed);
  }

  // Анімація кільця
  if (rotationEnabled) {
    ringMesh.rotation.x -= 0.01 * speed * rotationDirection * specialSpeed;
  }
  if (pulseMoveEnabled) {
    const innerRadius =
      0.4 + 0.1 * Math.sin(timestamp * 0.002 * speed * specialSpeed);
    const outerRadius =
      0.6 + 0.1 * Math.sin(timestamp * 0.002 * speed * specialSpeed);
    ringMesh.geometry = new THREE.RingGeometry(innerRadius, outerRadius, 32);
  }
  if (colorEmitEnabled) {
    hue += 0.005 * speed * specialSpeed;
    if (hue > 1) hue = 0;
    ringMesh.material.color.setHSL(hue, 1, 0.5);
  }

  // Анімація тетраедра
  if (rotationEnabled) {
    tetrahedronMesh.rotation.x -=
      0.01 * speed * rotationDirection * specialSpeed;
    tetrahedronMesh.rotation.y -=
      0.01 * speed * rotationDirection * specialSpeed;
  }
  if (pulseMoveEnabled) {
    const jump =
      Math.abs(Math.sin(timestamp * 0.005 * speed * specialSpeed)) * 0.5;
    tetrahedronMesh.position.y = jump;
  }
  if (colorEmitEnabled) {
    tetrahedronMesh.material.emissiveIntensity =
      1.5 + Math.sin(timestamp * 0.003 * speed * specialSpeed);
  }

  // Анімація частинок
  if (specialEffectActive) {
    specialEffectTimer += 0.1 * speed * specialSpeed;
    particles.material.opacity = Math.max(0, 1 - specialEffectTimer / 5);
    if (specialEffectTimer >= 5) {
      specialEffectActive = false;
      particles.material.opacity = 0;
    }
  }
}
