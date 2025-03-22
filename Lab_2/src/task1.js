import * as THREE from "three";
import { ARButton } from "three/addons/webxr/ARButton.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

let camera, scene, renderer;
let dodecahedronMesh, ringMesh, tetrahedronMesh;
let controls;

let hue = 0; // для анімації кольорів

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

  // Об'єкт рендерингу
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

  // 1. Створюємо об'єкт Додекаедр (DodecahedronGeometry):
  const dodecahedronGeometry = new THREE.DodecahedronGeometry(0.6); // Радіус 0.6
  // Матеріал для першого об'єкту
  const dodecahedronMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x00ff00,
    transparent: true,
    opacity: 0.7,
    roughness: 0.5,
    metalness: 0.3,
    transmission: 0.6,
  });
  // Створюємо меш
  dodecahedronMesh = new THREE.Mesh(dodecahedronGeometry, dodecahedronMaterial);
  dodecahedronMesh.position.set(-1.5, 0, -8);
  scene.add(dodecahedronMesh);

  // 2. Створюємо об'єкт Кільце (RingGeometry):
  const ringGeometry = new THREE.RingGeometry(0.4, 0.15, 100, 16); // Внутрішній радіус 0.3, зовнішній 0.6, 32 сегменти
  // Матеріал для другого
  const ringMaterial = new THREE.MeshStandardMaterial({
    color: 0x0000ff,
    metalness: 0.8,
    roughness: 0.2,
  });
  // Створюємо наступний меш
  ringMesh = new THREE.Mesh(ringGeometry, ringMaterial);
  ringMesh.position.set(0, 0, -8);
  scene.add(ringMesh);

  // 3. Створюємо об'єкт Тетраедр (TetrahedronGeometry):
  const tetrahedronGeometry = new THREE.TetrahedronGeometry(0.6); // Радіус 0.6
  // Матеріал для третього
  const tetrahedronMaterial = new THREE.MeshStandardMaterial({
    color: 0xff0000,
    emissive: 0xff0000,
    emissiveIntensity: 1.5,
    metalness: 0.5,
    roughness: 0.4,
  });
  // Створюємо наступний меш
  tetrahedronMesh = new THREE.Mesh(tetrahedronGeometry, tetrahedronMaterial);
  tetrahedronMesh.position.set(1.5, 0, -8);
  scene.add(tetrahedronMesh);

  // Позиція для камери
  camera.position.z = 3;

  // Контролери для 360 огляду на вебсторінці, але не під час AR-сеансу
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  document.body.appendChild(ARButton.createButton(renderer));

  window.addEventListener("resize", onWindowResize, false);
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

function render() {
  rotateObjects();
  renderer.render(scene, camera);
}

function rotateObjects() {
  // Обертання додекаедра
  dodecahedronMesh.rotation.y -= 0.01;
  // Пульсація додекаедра (збільшення/зменшення)
  const scale = 1 + 0.2 * Math.sin(Date.now() * 0.002); // Масштаб змінюється від 0.8 до 1.2
  dodecahedronMesh.scale.set(scale, scale, scale);

  // Обертання кільця
  ringMesh.rotation.x -= 0.01;
  // Зміна кольору кільця (веселка)
  hue += 0.005; // Швидкість зміни кольору
  if (hue > 1) hue = 0; // Зациклення відтінку
  ringMesh.material.color.setHSL(hue, 1, 0.5); // HSL: відтінок, насиченість, яскравість

  // Обертання тетраедра
  tetrahedronMesh.rotation.x -= 0.01;
}
