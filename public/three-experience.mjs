import * as THREE from "/vendor/three.module.js";

const canvas = document.querySelector("[data-community-map]");
const stage = document.querySelector("[data-map-stage]");

if (canvas && stage && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  initCommunityMap(canvas, stage);
}

function initCommunityMap(targetCanvas, targetStage) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(0, 8.2, 12.8);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({
    canvas: targetCanvas,
    alpha: true,
    antialias: true,
    preserveDrawingBuffer: true,
    powerPreference: "high-performance"
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  scene.add(new THREE.AmbientLight(0xfbf4e8, 0.48));

  const keyLight = new THREE.DirectionalLight(0xf0d79c, 3.3);
  keyLight.position.set(-5, 9, 8);
  scene.add(keyLight);

  const rimLight = new THREE.PointLight(0x76b8a6, 5, 26);
  rimLight.position.set(6, 4, -3);
  scene.add(rimLight);

  const mapGroup = new THREE.Group();
  mapGroup.position.set(2.75, -0.5, 0);
  mapGroup.rotation.x = -0.26;
  mapGroup.rotation.z = -0.08;
  mapGroup.scale.setScalar(1.18);
  scene.add(mapGroup);
  mapGroup.userData.baseRotationX = -0.26;
  mapGroup.userData.baseRotationZ = -0.08;
  mapGroup.userData.isMobile = false;

  const baseMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x173c35,
    metalness: 0.18,
    roughness: 0.38,
    clearcoat: 0.55,
    clearcoatRoughness: 0.35,
    emissive: 0x071612,
    emissiveIntensity: 0.18
  });

  const edgeMaterial = new THREE.LineBasicMaterial({
    color: 0xe7d2a5,
    transparent: true,
    opacity: 0.72
  });

  const lowerPeninsula = createShape([
    [-0.6, 3.4], [0.6, 3.1], [1.35, 2.3], [1.18, 1.2], [1.55, 0.25],
    [1.0, -0.95], [0.42, -2.18], [0.28, -3.28], [-0.38, -3.75],
    [-1.08, -2.88], [-1.42, -1.86], [-1.18, -0.74], [-1.56, 0.15],
    [-1.28, 1.26], [-1.38, 2.38]
  ]);
  const upperPeninsula = createShape([
    [-5.4, 2.8], [-4.5, 3.45], [-3.08, 3.32], [-1.55, 3.72],
    [-0.48, 3.34], [-1.1, 2.88], [-2.46, 2.48], [-3.78, 2.16],
    [-4.82, 2.24]
  ]);

  addLandmass(lowerPeninsula, mapGroup, baseMaterial, edgeMaterial);
  addLandmass(upperPeninsula, mapGroup, baseMaterial, edgeMaterial);

  addWaterLines(mapGroup);
  addPins(mapGroup);
  addParticles(scene);

  let pointerX = 0;
  let pointerY = 0;
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  targetStage.addEventListener("pointermove", (event) => {
    const rect = targetStage.getBoundingClientRect();
    pointerX = (event.clientX - rect.left) / rect.width - 0.5;
    pointerY = (event.clientY - rect.top) / rect.height - 0.5;
  });
  targetStage.addEventListener("pointerdown", (event) => {
    const rect = targetStage.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
    raycaster.setFromCamera(pointer, camera);
    const pin = raycaster
      .intersectObjects(mapGroup.children, true)
      .map((hit) => findPinAncestor(hit.object))
      .find(Boolean);
    if (!pin) return;
    window.dispatchEvent(new CustomEvent("community-map-select", {
      detail: {
        city: pin.name,
        communityName: pin.userData.communityName
      }
    }));
  });

  const clock = new THREE.Clock();

  function resize() {
    const rect = targetStage.getBoundingClientRect();
    renderer.setSize(rect.width, rect.height, false);
    camera.aspect = rect.width / rect.height;
    const isMobile = rect.width < 680;

    camera.fov = isMobile ? 31 : 38;
    camera.position.set(0, isMobile ? 11.4 : 8.2, isMobile ? 13.7 : 12.8);
    camera.lookAt(0, isMobile ? -0.15 : 0, 0);

    mapGroup.userData.isMobile = isMobile;
    mapGroup.userData.baseRotationX = isMobile ? -0.72 : -0.26;
    mapGroup.userData.baseRotationZ = isMobile ? -0.04 : -0.08;
    mapGroup.rotation.x = mapGroup.userData.baseRotationX;
    mapGroup.rotation.z = mapGroup.userData.baseRotationZ;
    mapGroup.position.x = rect.width < 760 ? 0 : 2.75;
    mapGroup.position.y = isMobile ? -0.95 : -0.5;
    mapGroup.scale.setScalar(isMobile ? 1.22 : 1.18);

    mapGroup.traverse((child) => {
      if (child.userData.pin) {
        child.scale.setScalar(isMobile ? 0.58 : 1);
      }
    });

    camera.updateProjectionMatrix();
  }

  function animate() {
    const elapsed = clock.getElapsedTime();
    const mobileMotion = mapGroup.userData.isMobile ? 0.45 : 1;
    mapGroup.rotation.z = mapGroup.userData.baseRotationZ + Math.sin(elapsed * 0.28) * 0.035 * mobileMotion + pointerX * 0.08 * mobileMotion;
    mapGroup.rotation.x = mapGroup.userData.baseRotationX + pointerY * 0.04 * mobileMotion;
    scene.children.forEach((child) => {
      if (child.userData.isParticleField) {
        child.rotation.y = elapsed * 0.035;
      }
    });
    mapGroup.traverse((child) => {
      if (child.userData.pin) {
        const floatHeight = mapGroup.userData.isMobile ? 0.035 : 0.08;
        child.position.y = child.userData.baseY + Math.sin(elapsed * 1.8 + child.userData.phase) * floatHeight;
        child.rotation.y = elapsed * 0.8;
      }
      if (child.userData.pulse) {
        const pulseAmount = mapGroup.userData.isMobile ? 0.1 : 0.18;
        const scale = 1 + Math.sin(elapsed * 2 + child.userData.phase) * pulseAmount;
        child.scale.setScalar(scale);
        child.material.opacity = 0.2 + Math.sin(elapsed * 2 + child.userData.phase) * 0.08;
      }
    });
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }

  resize();
  window.addEventListener("resize", resize);
  animate();
  targetStage.classList.add("is-ready");
}

function createShape(points) {
  const shape = new THREE.Shape();
  points.forEach(([x, y], index) => {
    if (index === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  });
  shape.closePath();
  return shape;
}

function addLandmass(shape, group, material, edgeMaterial) {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.22,
    bevelEnabled: true,
    bevelThickness: 0.06,
    bevelSize: 0.08,
    bevelSegments: 5
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = Math.PI / 2;
  group.add(mesh);

  const points = shape.getPoints(80).map((point) => new THREE.Vector3(point.x, 0.18, point.y));
  const edge = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points), edgeMaterial);
  group.add(edge);
}

function addWaterLines(group) {
  const material = new THREE.LineBasicMaterial({ color: 0x9fd4c5, transparent: true, opacity: 0.18 });
  for (let i = 0; i < 11; i++) {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-5.8 + i * 0.42, -0.08, -4.3),
      new THREE.Vector3(-4.2 + i * 0.36, -0.06, -0.4),
      new THREE.Vector3(-3.1 + i * 0.22, -0.08, 4.2)
    ]);
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(80)), material));
  }
}

function addPins(group) {
  const pins = [
    ["Gaylord", -0.18, 2.25, "August Haus Comfort Care"],
    ["Bridgeport", 0.8, -0.18, "Bavarian Comfort Care"],
    ["Bay City", 0.98, 0.08, "Bay City Comfort Care"],
    ["Big Rapids", -0.72, -0.48, "Big Rapids Fields Comfort Care"],
    ["Chesaning", 0.24, -0.38, "Chesaning Comfort Care"],
    ["Livonia", 0.72, -2.48, "Livonia Comfort Care"],
    ["Marshall", -0.34, -2.82, "Marshall Comfort Care"],
    ["Brighton", 0.52, -2.62, "Brighton Comfort Care"],
    ["Mt Pleasant", -0.18, 0.22, "Mount Pleasant Comfort Care"],
    ["Reed City", -0.86, -0.18, "Reed City Fields Comfort Care"],
    ["Saginaw", 0.52, -0.1, "Shields Comfort Care"],
    ["Shelby", 1.0, -2.26, "Shelby Comfort Care"],
    ["Vassar", 1.06, -0.48, "Vassar Comfort Care"]
  ];

  pins.forEach(([name, x, z, communityName], index) => {
    const pin = new THREE.Group();
    pin.position.set(x, 0.28, z);
    pin.userData = { pin: true, baseY: 0.28, phase: index * 0.65, communityName };

    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.024, 0.72, 14),
      new THREE.MeshStandardMaterial({ color: 0xe7d2a5, emissive: 0xbd9557, emissiveIntensity: 0.5 })
    );
    stem.position.y = 0.36;

    const globe = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 24, 24),
      new THREE.MeshPhysicalMaterial({
        color: 0xf0d79c,
        emissive: 0xbd9557,
        emissiveIntensity: 0.9,
        metalness: 0.18,
        roughness: 0.24,
        clearcoat: 0.8
      })
    );
    globe.position.y = 0.78;

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.22, 0.01, 8, 48),
      new THREE.MeshBasicMaterial({ color: 0xf0d79c, transparent: true, opacity: 0.28 })
    );
    ring.rotation.x = Math.PI / 2;
    ring.userData = { pulse: true, phase: index * 0.55 };

    pin.add(stem, globe, ring);
    pin.name = name;
    group.add(pin);
  });
}

function findPinAncestor(object) {
  let current = object;
  while (current) {
    if (current.userData?.pin) return current;
    current = current.parent;
  }
  return null;
}

function addParticles(scene) {
  const count = 150;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 18;
    positions[i * 3 + 1] = Math.random() * 7 - 1.4;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 11;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: 0xe7d2a5,
    size: 0.035,
    transparent: true,
    opacity: 0.44,
    depthWrite: false
  });
  const points = new THREE.Points(geometry, material);
  points.userData.isParticleField = true;
  scene.add(points);
}
