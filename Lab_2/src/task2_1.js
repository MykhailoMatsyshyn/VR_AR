import * as THREE from "three";
import { ARButton } from "three/addons/webxr/ARButton.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

let camera, scene, renderer;
let loader;
let model;
let controls;

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
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; // Покращує кольори
  renderer.toneMappingExposure = 1.5; // Збільшуємо експозицію
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;
  container.appendChild(renderer.domElement);

  // Світло
  const directionalLight = new THREE.DirectionalLight(0xffffff, 4);
  directionalLight.position.set(5, 5, 5);
  scene.add(directionalLight);

  const pointLight = new THREE.PointLight(0xffffff, 5, 10);
  pointLight.position.set(-2, 2, 2);
  scene.add(pointLight);

  const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
  scene.add(ambientLight);

  // Додаємо GLTF модель на сцену
  const modelUrl =
    "https://my-gltf-model-bucket-2025.s3.eu-north-1.amazonaws.com/scene.gltf";

  // Створюємо завантажувач
  loader = new GLTFLoader();
  loader.load(
    modelUrl,
    function (gltf) {
      model = gltf.scene;
      model.position.set(0, 0, -1);
      model.scale.set(0.05, 0.05, 0.05);
      scene.add(model);

      // Перевіряємо, чи є матеріали
      let hasMaterials = false;
      model.traverse((child) => {
        if (child.isMesh && child.material) {
          hasMaterials = true;
        }
      });

      // Якщо матеріалів немає, додаємо базовий
      if (!hasMaterials) {
        const defaultMaterial = new THREE.MeshStandardMaterial({
          color: 0x00ff00, // Зелений колір
          metalness: 0.5,
          roughness: 0.5,
        });
        model.traverse((child) => {
          if (child.isMesh) {
            child.material = defaultMaterial;
          }
        });
      }

      console.log("Model added to scene");
    },
    function (xhr) {
      console.log((xhr.loaded / xhr.total) * 100 + "% loaded");
    },
    function (error) {
      console.error("Error loading model:", error);
    }
  );

  // Позиція для камери (для перегляду на комп’ютері)
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
  renderer.render(scene, camera); // Прибираємо анімацію
}
