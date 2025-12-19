import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.156.0/build/three.module.js';

let scene, camera, renderer;
// Add a currentSpeed property to the car 
let cars = { N: [], S: [], E: [], W: [] };
let lights = {};
let clock = new THREE.Clock();
let running = false;

const ROAD_LENGTH = 40;
const ROAD_WIDTH = 8;
const MAX_CAR_SPEED = 6; 
const LIGHT_INTERVAL = 5;
const LANE_OFFSET = 2;

// Dynamics Constants for Smoother Movement
const BRAKING_DISTANCE = 8; 
const ACCELERATION_RATE = 4; 
const DECELERATION_RATE = 8; 

// Define the stop line for cars approaching the intersection
const STOP_LINE_Z = ROAD_WIDTH / 2; 
const STOP_LINE_X = ROAD_WIDTH / 2; 
const CAR_BUFFER = 4; 

init();
animate();

function init() {
  const container = document.getElementById('rendererContainer');
  scene = new THREE.Scene();

  // Sky gradient using CubeTextureLoader (simple color sky)
  const loader = new THREE.CubeTextureLoader();
  const skyTexture = loader.load([
    'https://threejs.org/examples/textures/cube/skybox/px.jpg', // right
    'https://threejs.org/examples/textures/cube/skybox/nx.jpg', // left
    'https://threejs.org/examples/textures/cube/skybox/py.jpg', // top
    'https://threejs.org/examples/textures/cube/skybox/ny.jpg', // bottom
    'https://threejs.org/examples/textures/cube/skybox/pz.jpg', // front
    'https://threejs.org/examples/textures/cube/skybox/nz.jpg', // back
  ]);
  scene.background = skyTexture;

  camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 200);
  camera.position.set(30, 30, 30);
  camera.lookAt(0, 0, 0);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(renderer.domElement);

  // Lights
  scene.add(new THREE.AmbientLight(0xffffff, 0.7));
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(20, 20, 20);
  scene.add(dirLight);

  // Ground
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(100, 100),
    new THREE.MeshStandardMaterial({ color: 0x228b22 })
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  // Roads
  const roadMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 });
  const horizontal = new THREE.Mesh(new THREE.BoxGeometry(ROAD_LENGTH, 0.1, ROAD_WIDTH), roadMaterial);
  scene.add(horizontal);
  const vertical = new THREE.Mesh(new THREE.BoxGeometry(ROAD_WIDTH, 0.1, ROAD_LENGTH), roadMaterial);
  scene.add(vertical);

  // Trees
  const treeMaterial = new THREE.MeshStandardMaterial({ color: 0x006400 });
  const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x8b4513 });

  for (let x = -50; x <= 50; x += 10) {
    for (let z = -50; z <= 50; z += 10) {
      if (Math.abs(x) < ROAD_WIDTH && Math.abs(z) < ROAD_WIDTH) continue;

      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 2), trunkMaterial);
      trunk.position.set(x, 1, z);
      scene.add(trunk);

      const foliage = new THREE.Mesh(new THREE.ConeGeometry(1, 3, 8), treeMaterial);
      foliage.position.set(x, 3, z);
      scene.add(foliage);
    }
  }

  // Traffic lights
  const createLight = (x, z) => {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 3), new THREE.MeshStandardMaterial({ color: 0x8b4513 }));
    pole.position.set(x, 1.5, z);
    scene.add(pole);
    const light = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 16), new THREE.MeshBasicMaterial({ color: 0xff0000 }));
    light.position.set(x, 3, z);
    scene.add(light);
    return light;
  };

  lights.N = createLight(-LANE_OFFSET, -STOP_LINE_Z - 1.5);
  lights.S = createLight(LANE_OFFSET, STOP_LINE_Z + 1.5);
  lights.E = createLight(STOP_LINE_X + 1.5, -LANE_OFFSET);
  lights.W = createLight(-STOP_LINE_X - 1.5, LANE_OFFSET);

  // Cars
  const createCar = (color) => {
    const car = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.5, 3), new THREE.MeshStandardMaterial({ color }));
    car.currentSpeed = 0; // Initialize speed to zero
    return car;
  };

  for (let i = 0; i < 3; i++) {
    // Car from North 
    let carN = createCar(0xff4444);
    carN.position.set(-LANE_OFFSET, 0.25, -ROAD_LENGTH / 2 - 5 - i * CAR_BUFFER); 
    carN.rotation.y = 0;
    cars.N.push(carN);
    scene.add(carN); 

    // Car from South 
    let carS = createCar(0x66ff66);
    carS.position.set(LANE_OFFSET, 0.25, ROAD_LENGTH / 2 + 5 + i * CAR_BUFFER);
    carS.rotation.y = Math.PI;
    cars.S.push(carS);
    scene.add(carS); 

    // Car from East 
    let carE = createCar(0x4444ff);
    carE.position.set(ROAD_LENGTH / 2 + 5 + i * CAR_BUFFER, 0.25, -LANE_OFFSET);
    carE.rotation.y = Math.PI / 2;
    cars.E.push(carE);
    scene.add(carE); 

    // Car from West 
    let carW = createCar(0xffff44);
    carW.position.set(-ROAD_LENGTH / 2 - 5 - i * CAR_BUFFER, 0.25, LANE_OFFSET);
    carW.rotation.y = -Math.PI / 2;
    cars.W.push(carW);
    scene.add(carW); 
  }

  // Buttons 
  document.getElementById('startBtn').addEventListener('click', () => running = true);
  document.getElementById('pauseBtn').addEventListener('click', () => running = false);

  window.addEventListener('resize', () => {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  });
}

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();

  if (running) {
    const time = clock.getElapsedTime();
    const greenPhase = Math.floor(time / LIGHT_INTERVAL) % 2; 

    // Traffic lights
    const isNSGreen = greenPhase === 0;
    const isEWGreen = greenPhase === 1;
    
    lights.N.material.color.set(isNSGreen ? 0x00ff00 : 0xff0000);
    lights.S.material.color.set(isNSGreen ? 0x00ff00 : 0xff0000);
    lights.E.material.color.set(isEWGreen ? 0x00ff00 : 0xff0000);
    lights.W.material.color.set(isEWGreen ? 0x00ff00 : 0xff0000);

    // Move cars
    cars.N.forEach((car, i) => updateCarMovement(car, 'Z+', cars.N, i, isNSGreen, delta));
    cars.S.forEach((car, i) => updateCarMovement(car, 'Z-', cars.S, i, isNSGreen, delta));
    cars.E.forEach((car, i) => updateCarMovement(car, 'X-', cars.E, i, isEWGreen, delta));
    cars.W.forEach((car, i) => updateCarMovement(car, 'X+', cars.W, i, isEWGreen, delta));
  }

  renderer.render(scene, camera);
}

// 🚦 The New and Improved Movement Function! 🚦
function updateCarMovement(car, dir, lane, index, green, delta) {
  let targetSpeed = MAX_CAR_SPEED;
  let currentPos, frontPos, targetDistance;
  let stopLimit;

  // 1. Determine Stop Limit (Traffic Light or Car in Front)
  
  if (dir === 'Z+') { // Northbound (+Z movement)
    currentPos = car.position.z;
    stopLimit = -STOP_LINE_Z - 1.5;

    // Check Traffic Light (Red means stop)
    if (!green) {
      targetDistance = stopLimit - currentPos;
      // If within braking distance, calculate the target speed to stop at the limit
      if (targetDistance <= BRAKING_DISTANCE && targetDistance > 0) {
          targetSpeed = Math.min(targetSpeed, Math.sqrt(2 * DECELERATION_RATE * targetDistance));
      } else if (targetDistance <= 0) { 
          targetSpeed = 0;
      }
    }
    
    // Check Car in Front
    if (index > 0 && lane[index - 1].position.z > currentPos) {
      frontPos = lane[index - 1].position.z;
      let carDistance = frontPos - currentPos - CAR_BUFFER;
      
      // If car is closer than braking distance, reduce speed
      if (carDistance < BRAKING_DISTANCE && carDistance > 0) {
        targetSpeed = Math.min(targetSpeed, Math.sqrt(2 * DECELERATION_RATE * carDistance));
      } else if (carDistance <= 0) { // Too close (stop)
        targetSpeed = 0;
      }
    }

  } else if (dir === 'Z-') { 
    currentPos = car.position.z;
    stopLimit = STOP_LINE_Z + 1.5;

    if (!green) {
      targetDistance = currentPos - stopLimit; // Distance is positive when approaching
      if (targetDistance <= BRAKING_DISTANCE && targetDistance > 0) {
          targetSpeed = Math.min(targetSpeed, Math.sqrt(2 * DECELERATION_RATE * targetDistance));
      } else if (targetDistance <= 0) { 
          targetSpeed = 0;
      }
    }
    
    if (index > 0 && lane[index - 1].position.z < currentPos) {
      frontPos = lane[index - 1].position.z;
      let carDistance = currentPos - frontPos - CAR_BUFFER;
      
      if (carDistance < BRAKING_DISTANCE && carDistance > 0) {
        targetSpeed = Math.min(targetSpeed, Math.sqrt(2 * DECELERATION_RATE * carDistance));
      } else if (carDistance <= 0) { 
        targetSpeed = 0;
      }
    }

  } else if (dir === 'X+') { // Westbound 
    currentPos = car.position.x;
    stopLimit = -STOP_LINE_X - 1.5;

    if (!green) {
      targetDistance = stopLimit - currentPos;
      if (targetDistance <= BRAKING_DISTANCE && targetDistance > 0) {
          targetSpeed = Math.min(targetSpeed, Math.sqrt(2 * DECELERATION_RATE * targetDistance));
      } else if (targetDistance <= 0) {
          targetSpeed = 0;
      }
    }

    if (index > 0 && lane[index - 1].position.x > currentPos) {
      frontPos = lane[index - 1].position.x;
      let carDistance = frontPos - currentPos - CAR_BUFFER;
      
      if (carDistance < BRAKING_DISTANCE && carDistance > 0) {
        targetSpeed = Math.min(targetSpeed, Math.sqrt(2 * DECELERATION_RATE * carDistance));
      } else if (carDistance <= 0) {
        targetSpeed = 0;
      }
    }

  } else if (dir === 'X-') { // Eastbound 
    currentPos = car.position.x;
    stopLimit = STOP_LINE_X + 1.5;

    if (!green) {
      targetDistance = currentPos - stopLimit;
      if (targetDistance <= BRAKING_DISTANCE && targetDistance > 0) {
          targetSpeed = Math.min(targetSpeed, Math.sqrt(2 * DECELERATION_RATE * targetDistance));
      } else if (targetDistance <= 0) {
          targetSpeed = 0;
      }
    }
    
    if (index > 0 && lane[index - 1].position.x < currentPos) {
      frontPos = lane[index - 1].position.x;
      let carDistance = currentPos - frontPos - CAR_BUFFER;

      if (carDistance < BRAKING_DISTANCE && carDistance > 0) {
        targetSpeed = Math.min(targetSpeed, Math.sqrt(2 * DECELERATION_RATE * carDistance));
      } else if (carDistance <= 0) {
        targetSpeed = 0;
      }
    }
  }

  // 2. Adjust Car's Current Speed
  let acceleration;
  if (targetSpeed > car.currentSpeed) {
    acceleration = ACCELERATION_RATE;
  } else {
    acceleration = -DECELERATION_RATE;
  }
  
  // Update speed based on acceleration/deceleration
  car.currentSpeed += acceleration * delta;
  
  car.currentSpeed = Math.max(0, car.currentSpeed);
  car.currentSpeed = Math.min(MAX_CAR_SPEED, car.currentSpeed);
  car.currentSpeed = (acceleration > 0) ? Math.min(targetSpeed, car.currentSpeed) : Math.max(targetSpeed, car.currentSpeed);
  
  // Final movement for this frame
  const travelDistance = car.currentSpeed * delta;

  // 3. Apply Movement and Handle Wrap Around
  if (travelDistance > 0.001) { // Only move if speed is non-zero
    if (dir === 'Z+') {
      car.position.z += travelDistance;
      if (car.position.z > ROAD_LENGTH / 2 + CAR_BUFFER * 2) {
        car.position.z = lane[lane.length - 1].position.z - CAR_BUFFER; 
      }
    } else if (dir === 'Z-') {
      car.position.z -= travelDistance;
      if (car.position.z < -ROAD_LENGTH / 2 - CAR_BUFFER * 2) {
        car.position.z = lane[lane.length - 1].position.z + CAR_BUFFER;
      }
    } else if (dir === 'X+') {
      car.position.x += travelDistance;
      if (car.position.x > ROAD_LENGTH / 2 + CAR_BUFFER * 2) {
        car.position.x = lane[lane.length - 1].position.x - CAR_BUFFER;
      }
    } else if (dir === 'X-') {
      car.position.x -= travelDistance;
      if (car.position.x < -ROAD_LENGTH / 2 - CAR_BUFFER * 2) {
        car.position.x = lane[lane.length - 1].position.x + CAR_BUFFER;
      }
    }
  }
}
