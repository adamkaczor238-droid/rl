import * as THREE from 'three';

// --- Configuration ---
const FIELD_WIDTH = 1200;
const FIELD_LENGTH = 2000;
const WALL_HEIGHT = 800;
const GOAL_WIDTH = 300;
const GOAL_DEPTH = 100;

// --- Networking ---
// --- KONFIGURACJA POŁĄCZENIA ---
// Jeśli uruchamiasz serwer u siebie, zostaw "http://localhost:3000"
// Jeśli używasz Render.com, ngrok lub innego hostingu, wpisz tamten adres
const SERVER_URL = "http://localhost:3000";

// Automatyczny wybór połączenia
const socket = SERVER_URL.includes("localhost") ? io() : io(SERVER_URL);
let myRole = 'spectator';
const roleDisplay = document.getElementById('role-display');

// --- Setup Scene ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB); // Sky blue
scene.fog = new THREE.Fog(0x87CEEB, 500, 3000);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 5000);
camera.position.set(0, 800, 1200);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// --- Lights ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(1000, 2000, 1000);
dirLight.castShadow = true;
dirLight.shadow.camera.left = -1500;
dirLight.shadow.camera.right = 1500;
dirLight.shadow.camera.top = 1500;
dirLight.shadow.camera.bottom = -1500;
dirLight.shadow.mapSize.width = 4096;
dirLight.shadow.mapSize.height = 4096;
scene.add(dirLight);

// --- Helper Functions ---
function createMaterial(color) {
    return new THREE.MeshPhongMaterial({ color });
}

// --- Arena Construction ---
const fieldGroup = new THREE.Group();
scene.add(fieldGroup);

// Floor
const floorGeo = new THREE.PlaneGeometry(FIELD_WIDTH, FIELD_LENGTH);
const floorMat = new THREE.MeshPhongMaterial({ color: 0x3e8e41 });
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
fieldGroup.add(floor);

// Lines
const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 });
const centerLine = new THREE.Mesh(new THREE.PlaneGeometry(FIELD_WIDTH, 20), lineMat);
centerLine.rotation.x = -Math.PI / 2;
centerLine.position.y = 2;
fieldGroup.add(centerLine);

const centerCircle = new THREE.Mesh(new THREE.RingGeometry(180, 200, 64), lineMat);
centerCircle.rotation.x = -Math.PI / 2;
centerCircle.position.y = 2;
fieldGroup.add(centerCircle);

// Walls
const wallMat = new THREE.MeshPhongMaterial({ color: 0x555555, transparent: true, opacity: 0.3, side: THREE.DoubleSide });
const wallGeoLong = new THREE.BoxGeometry(20, WALL_HEIGHT, FIELD_LENGTH);
const wallGeoShort = new THREE.BoxGeometry(FIELD_WIDTH, WALL_HEIGHT, 20);

const leftWall = new THREE.Mesh(wallGeoLong, wallMat);
leftWall.position.set(-FIELD_WIDTH / 2, WALL_HEIGHT / 2, 0);
fieldGroup.add(leftWall);

const rightWall = new THREE.Mesh(wallGeoLong, wallMat);
rightWall.position.set(FIELD_WIDTH / 2, WALL_HEIGHT / 2, 0);
fieldGroup.add(rightWall);

// Goals
const goalWallWidth = (FIELD_WIDTH - GOAL_WIDTH) / 2;
const goalWallGeo = new THREE.BoxGeometry(goalWallWidth, WALL_HEIGHT, 20);

// Top Goal Walls (Far - P2 Side)
const tgw1 = new THREE.Mesh(goalWallGeo, wallMat);
tgw1.position.set(-FIELD_WIDTH/2 + goalWallWidth/2, WALL_HEIGHT/2, -FIELD_LENGTH/2);
fieldGroup.add(tgw1);
const tgw2 = new THREE.Mesh(goalWallGeo, wallMat);
tgw2.position.set(FIELD_WIDTH/2 - goalWallWidth/2, WALL_HEIGHT/2, -FIELD_LENGTH/2);
fieldGroup.add(tgw2);

// Bottom Goal Walls (Near - P1 Side)
const bgw1 = new THREE.Mesh(goalWallGeo, wallMat);
bgw1.position.set(-FIELD_WIDTH/2 + goalWallWidth/2, WALL_HEIGHT/2, FIELD_LENGTH/2);
fieldGroup.add(bgw1);
const bgw2 = new THREE.Mesh(goalWallGeo, wallMat);
bgw2.position.set(FIELD_WIDTH/2 - goalWallWidth/2, WALL_HEIGHT/2, FIELD_LENGTH/2);
fieldGroup.add(bgw2);

// Goal Boxes (Visual only, physics handled by server)
const goalHeight = 250;
const goalBoxGeo = new THREE.BoxGeometry(GOAL_WIDTH, goalHeight, GOAL_DEPTH);
const p2Goal = new THREE.Mesh(goalBoxGeo, new THREE.MeshPhongMaterial({ color: 0xffaaaa, transparent: true, opacity: 0.5 }));
p2Goal.position.set(0, goalHeight/2, -FIELD_LENGTH/2 - GOAL_DEPTH/2);
fieldGroup.add(p2Goal);

const p1Goal = new THREE.Mesh(goalBoxGeo, new THREE.MeshPhongMaterial({ color: 0xaaffaa, transparent: true, opacity: 0.5 }));
p1Goal.position.set(0, goalHeight/2, FIELD_LENGTH/2 + GOAL_DEPTH/2);
fieldGroup.add(p1Goal);

// Wall above goal
const goalUpperWallGeo = new THREE.BoxGeometry(GOAL_WIDTH, WALL_HEIGHT - goalHeight, 20);

const guw1 = new THREE.Mesh(goalUpperWallGeo, wallMat);
guw1.position.set(0, goalHeight + (WALL_HEIGHT - goalHeight)/2, -FIELD_LENGTH/2);
fieldGroup.add(guw1);

const guw2 = new THREE.Mesh(goalUpperWallGeo, wallMat);
guw2.position.set(0, goalHeight + (WALL_HEIGHT - goalHeight)/2, FIELD_LENGTH/2);
fieldGroup.add(guw2);

// Ceiling (Grid Helper style)
const ceilingGeo = new THREE.PlaneGeometry(FIELD_WIDTH, FIELD_LENGTH);
const ceilingMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.1, side: THREE.DoubleSide, wireframe: true });
const ceiling = new THREE.Mesh(ceilingGeo, ceilingMat);
ceiling.rotation.x = Math.PI / 2;
ceiling.position.y = WALL_HEIGHT;
fieldGroup.add(ceiling);

// --- Entities (Visuals Only) ---
class Car {
    constructor(color) {
        this.mesh = new THREE.Group();
        
        // Body
        const bodyGeo = new THREE.BoxGeometry(40, 20, 60);
        const bodyMat = createMaterial(color);
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 15;
        body.castShadow = true;
        this.mesh.add(body);

        // Roof
        const roofGeo = new THREE.BoxGeometry(30, 10, 30);
        const roof = new THREE.Mesh(roofGeo, new THREE.MeshPhongMaterial({color: 0x222222}));
        roof.position.y = 30;
        roof.position.z = -5;
        this.mesh.add(roof);

        // Wheels
        const wheelGeo = new THREE.CylinderGeometry(8, 8, 10, 16);
        const wheelMat = new THREE.MeshPhongMaterial({ color: 0x111111 });
        
        const positions = [
            [-22, 8, 18], [22, 8, 18],
            [-22, 8, -18], [22, 8, -18]
        ];

        positions.forEach(pos => {
            const wheel = new THREE.Mesh(wheelGeo, wheelMat);
            wheel.rotation.z = Math.PI / 2;
            wheel.position.set(...pos);
            this.mesh.add(wheel);
        });

        scene.add(this.mesh);
    }
    
    update(data) {
        this.mesh.position.set(data.x, data.y, data.z);
        // Use Euler rotation order YXZ to properly apply Yaw then Pitch/Roll
        this.mesh.rotation.order = 'YXZ'; 
        this.mesh.rotation.y = data.rotationY;
        this.mesh.rotation.x = data.pitch;
        this.mesh.rotation.z = data.roll;
    }
}

class Ball {
    constructor() {
        this.radius = 35;
        const geo = new THREE.SphereGeometry(this.radius, 32, 32);
        const mat = new THREE.MeshPhongMaterial({ color: 0xffffff, shininess: 100 });
        this.mesh = new THREE.Mesh(geo, mat);
        this.mesh.castShadow = true;
        scene.add(this.mesh);
    }

    update(data) {
        this.mesh.position.set(data.x, data.y, data.z);
    }
}

// Boost Pads Rendering
const padMeshes = [];
function updatePads(padsData) {
    if (padMeshes.length === 0) {
        // Initialize pads
        padsData.forEach(p => {
            const radius = p.type === 'full' ? 20 : 15;
            const geo = new THREE.CylinderGeometry(radius, radius, 5, 16);
            const mat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(p.x, 2.5, p.z);
            fieldGroup.add(mesh);
            padMeshes.push(mesh);
        });
    }

    // Update visibility
    padsData.forEach((p, i) => {
        if (padMeshes[i]) {
            padMeshes[i].visible = p.active;
        }
    });
}

const p1 = new Car(0x3498db); // Blue
const p2 = new Car(0xe74c3c); // Red
const ball = new Ball();

const scoreEl = document.getElementById('score');
const boostBar = document.getElementById('boost-bar');
const boostText = document.getElementById('boost-text');

// --- Start Screen Logic ---
const startScreen = document.getElementById('start-screen');
const startBtn = document.getElementById('start-btn');

startBtn.addEventListener('click', () => {
    startScreen.style.opacity = '0';
    setTimeout(() => {
        startScreen.style.display = 'none';
    }, 500);
});

// --- Input Handling ---
const keys = {
    up: false,
    down: false,
    left: false,
    right: false,
    jump: false,
    boost: false
};

window.addEventListener('keydown', e => {
    // Map keys to standard actions
    const code = e.code;
    let changed = false;

    if (code === 'KeyW' || code === 'ArrowUp') { keys.up = true; changed = true; }
    if (code === 'KeyS' || code === 'ArrowDown') { keys.down = true; changed = true; }
    if (code === 'KeyA' || code === 'ArrowLeft') { keys.left = true; changed = true; }
    if (code === 'KeyD' || code === 'ArrowRight') { keys.right = true; changed = true; }
    if (code === 'Space') { keys.jump = true; changed = true; }
    if (code === 'ShiftLeft' || code === 'ShiftRight') { keys.boost = true; changed = true; }

    if (changed) socket.emit('input', keys);

    if (code === 'KeyR') {
        socket.emit('resetRequest');
    }
});

window.addEventListener('keyup', e => {
    const code = e.code;
    let changed = false;

    if (code === 'KeyW' || code === 'ArrowUp') { keys.up = false; changed = true; }
    if (code === 'KeyS' || code === 'ArrowDown') { keys.down = false; changed = true; }
    if (code === 'KeyA' || code === 'ArrowLeft') { keys.left = false; changed = true; }
    if (code === 'KeyD' || code === 'ArrowRight') { keys.right = false; changed = true; }
    if (code === 'Space') { keys.jump = false; changed = true; }
    if (code === 'ShiftLeft' || code === 'ShiftRight') { keys.boost = false; changed = true; }

    if (changed) socket.emit('input', keys);
});

// --- Socket Events ---
socket.on('init', (data) => {
    myRole = data.role;
    let roleName = 'Obserwator';
    if (myRole === 'p1') roleName = 'Gracz 1 (Niebieski)';
    if (myRole === 'p2') roleName = 'Gracz 2 (Czerwony)';
    roleDisplay.innerText = `Jesteś: ${roleName}`;
    updateScore(data.score);
});

socket.on('gameState', (state) => {
    p1.update(state.p1);
    p2.update(state.p2);
    ball.update(state.ball);
    
    if (state.pads) updatePads(state.pads);

    // Update Boost UI
    let myBoost = 0;
    if (myRole === 'p1') myBoost = state.p1.boost;
    if (myRole === 'p2') myBoost = state.p2.boost;
    
    if (myRole !== 'spectator') {
        const boostPercent = Math.floor(myBoost);
        boostBar.style.width = `${boostPercent}%`;
        boostText.innerText = boostPercent;
    }

    updateCamera();
});

socket.on('scoreUpdate', (newScore) => {
    updateScore(newScore);
});

function updateScore(s) {
    scoreEl.innerText = `${s.p1} - ${s.p2}`;
}

// --- Camera Logic ---
function updateCamera() {
    let target = ball.mesh; // Default spectator target
    let offsetZ = 800;
    let offsetY = 600;

    if (myRole === 'p1') {
        target = p1.mesh;
        offsetZ = 400; // Behind P1 (initial z is positive, so +400 is behind if facing negative z?)
        // Wait, P1 starts at +800 facing PI (North/Negative Z?).
        // If rotation is PI, cos(PI) = -1, sin(PI) = 0.
        // We want camera 'behind' car.
    } else if (myRole === 'p2') {
        target = p2.mesh;
    }

    if (myRole !== 'spectator') {
        // Dynamic camera following car
        const dist = 500;
        const height = 300;
        
        // Calculate target position behind car
        // Car rotationY: 0 = facing +Z (South), PI = facing -Z (North)
        // Camera should be at -sin * dist, -cos * dist relative to car
        const targetX = target.position.x - Math.sin(target.rotation.y) * dist;
        const targetZ = target.position.z - Math.cos(target.rotation.y) * dist;
        const targetY = target.position.y + height;

        // Smooth lerp
        camera.position.x += (targetX - camera.position.x) * 0.1;
        camera.position.z += (targetZ - camera.position.z) * 0.1;
        camera.position.y += (targetY - camera.position.y) * 0.1;

        // Camera Collision / Clamping
        // Prevent camera from going outside the arena walls
        const buffer = 50; // Keep camera slightly inside
        const limitX = FIELD_WIDTH / 2 - buffer;
        const limitZ = FIELD_LENGTH / 2 - buffer;
        
        camera.position.x = Math.max(-limitX, Math.min(limitX, camera.position.x));
        camera.position.z = Math.max(-limitZ, Math.min(limitZ, camera.position.z));
        
        // Prevent going below ground or too high
        camera.position.y = Math.max(50, Math.min(WALL_HEIGHT - 50, camera.position.y));

        camera.lookAt(target.position.x, target.position.y + 50, target.position.z);
    } else {
        // Spectator view (High angle)
        camera.position.set(0, 1500, 0);
        camera.lookAt(0, 0, 0);
        // Maybe rotate slowly?
    }
}

// --- Render Loop ---
function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}

// Handle resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();
