const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('.'));

// --- Game Configuration ---
const FIELD_WIDTH = 1200;
const FIELD_LENGTH = 2000;
const WALL_HEIGHT = 800; // Increased height for aerials
const GOAL_WIDTH = 300;
const GOAL_DEPTH = 100;

// Physics Constants
const GRAVITY = 0.35; // Lower gravity for better "float"
const FRICTION = 0.98;
const CAR_ACCEL = 1.0;
const CAR_MAX_SPEED = 25; // Slightly faster cars
const CAR_TURN_SPEED = 0.05;
const BALL_BOUNCE = 0.85; // Bouncier ball
const BALL_FRICTION = 0.99;
const CAR_RADIUS = 35;
const BALL_RADIUS = 35;
const BOOST_FORCE = 1.5;
const JUMP_FORCE = 12;
const MAX_BOOST = 100;

// Boost Pads Configuration
const boostPads = [
    // Corners (Full Boost)
    { x: -500, z: -800, type: 'full', active: true, cooldown: 0 },
    { x: 500, z: -800, type: 'full', active: true, cooldown: 0 },
    { x: -500, z: 800, type: 'full', active: true, cooldown: 0 },
    { x: 500, z: 800, type: 'full', active: true, cooldown: 0 },
    // Mid-field (Small Boost)
    { x: -500, z: 0, type: 'small', active: true, cooldown: 0 },
    { x: 500, z: 0, type: 'small', active: true, cooldown: 0 },
    { x: 0, z: -400, type: 'small', active: true, cooldown: 0 },
    { x: 0, z: 400, type: 'small', active: true, cooldown: 0 }
];

// --- Game State ---
let players = {
    p1: {
        id: null,
        x: 0, y: 0, z: 800, 
        rotationY: Math.PI, pitch: 0, roll: 0,
        velocity: 0, vy: 0,
        boost: 33,
        isGrounded: true,
        keys: {}
    },
    p2: {
        id: null,
        x: 0, y: 0, z: -800, 
        rotationY: 0, pitch: 0, roll: 0,
        velocity: 0, vy: 0,
        boost: 33,
        isGrounded: true,
        keys: {}
    }
};

let ball = {
    x: 0, y: 300, z: 0,
    vx: 0, vy: 0, vz: 0
};

let score = { p1: 0, p2: 0 };

// --- Physics Engine (Server Side) ---
function resetGame() {
    ball.x = 0; ball.y = 300; ball.z = 0;
    ball.vx = 0; ball.vy = 0; ball.vz = 0;

    players.p1.x = 0; players.p1.y = 0; players.p1.z = 800;
    players.p1.rotationY = Math.PI; players.p1.pitch = 0; players.p1.roll = 0;
    players.p1.velocity = 0; players.p1.vy = 0; players.p1.boost = 33;

    players.p2.x = 0; players.p2.y = 0; players.p2.z = -800;
    players.p2.rotationY = 0; players.p2.pitch = 0; players.p2.roll = 0;
    players.p2.velocity = 0; players.p2.vy = 0; players.p2.boost = 33;
    
    // Reset pads
    boostPads.forEach(pad => { pad.active = true; pad.cooldown = 0; });

    io.emit('scoreUpdate', score);
    io.emit('gameReset');
}

function updatePhysics() {
    // Process Inputs & Move Cars
    ['p1', 'p2'].forEach(pid => {
        const p = players[pid];
        const k = p.keys;

        // Ground/Air Logic
        if (p.y <= 0) {
            p.y = 0;
            p.vy = 0;
            p.isGrounded = true;
            p.pitch = 0;
            p.roll = 0;
        } else {
            p.isGrounded = false;
            p.vy -= GRAVITY;
        }

        // --- Controls ---
        // Ground: WASD = Drive/Steer
        // Air: W/S = Pitch, A/D = Yaw (Steer), Shift = Boost
        
        if (p.isGrounded) {
            if (k.up) p.velocity += CAR_ACCEL;
            if (k.down) p.velocity -= CAR_ACCEL;
            
            if (Math.abs(p.velocity) > 0.1) {
                if (k.left) p.rotationY += CAR_TURN_SPEED * Math.sign(p.velocity);
                if (k.right) p.rotationY -= CAR_TURN_SPEED * Math.sign(p.velocity);
            }
            
            // Jump
            if (k.jump) {
                p.vy = JUMP_FORCE;
                p.isGrounded = false;
            }
        } else {
            // Aerial Control
            const AIR_TURN_SPEED = 0.03;
            const PITCH_SPEED = 0.03;

            if (k.left) p.rotationY += AIR_TURN_SPEED;
            if (k.right) p.rotationY -= AIR_TURN_SPEED;
            
            if (k.up) p.pitch = Math.min(p.pitch + PITCH_SPEED, Math.PI/2);
            if (k.down) p.pitch = Math.max(p.pitch - PITCH_SPEED, -Math.PI/2);
        }

        // Boost Logic
        if (k.boost && p.boost > 0) {
            p.boost -= 0.5; // Consume boost
            
            // Apply force vector based on car orientation
            // Forward vector in 3D:
            // x = sin(yaw) * cos(pitch)
            // z = cos(yaw) * cos(pitch)
            // y = sin(pitch)
            
            const thrust = BOOST_FORCE;
            const fx = Math.sin(p.rotationY) * Math.cos(p.pitch) * thrust;
            const fz = Math.cos(p.rotationY) * Math.cos(p.pitch) * thrust;
            const fy = Math.sin(p.pitch) * thrust;
            
            // If grounded, boost just adds to velocity (simple approximation)
            // If in air, boost adds to x/z/y momentum
            
            if (p.isGrounded) {
                p.velocity += CAR_ACCEL * 1.5; // Extra acceleration on ground
            } else {
                // Apply force to position directly (simplified air physics)
                // In a real physics engine we'd add force to velocity vector.
                // Here we have 'velocity' (forward speed) and 'vy' (vertical).
                // Let's mix them.
                
                p.x += fx * 2; // Multiplier for air speed
                p.z += fz * 2;
                p.vy += fy * 0.5; // Vertical boost component
            }
        }

        // Apply Velocity (Ground Movement)
        p.velocity *= FRICTION;
        p.velocity = Math.max(Math.min(p.velocity, CAR_MAX_SPEED), -CAR_MAX_SPEED);

        // Move car based on velocity (Ground) or Momentum (Air - simplified)
        // Note: For true aerials, we should separate velocity into vx, vy, vz.
        // Current system: 'velocity' is scalar forward speed along rotationY.
        // We'll stick to this for ground, but for air it's tricky.
        // FIX: While in air, continue moving by 'velocity' but also allow 'boost' to push us.
        
        p.x += Math.sin(p.rotationY) * p.velocity;
        p.z += Math.cos(p.rotationY) * p.velocity;
        p.y += p.vy;

        // Ceiling collision for car
        if (p.y > WALL_HEIGHT - 20) {
            p.y = WALL_HEIGHT - 20;
            p.vy = 0;
        }

        // Car Wall Collisions
        const limitX = FIELD_WIDTH / 2 - CAR_RADIUS;
        const limitZ = FIELD_LENGTH / 2 - CAR_RADIUS;

        if (p.x > limitX) { p.x = limitX; p.velocity *= 0.5; }
        if (p.x < -limitX) { p.x = -limitX; p.velocity *= 0.5; }
        if (p.z > limitZ) { p.z = limitZ; p.velocity *= 0.5; }
        if (p.z < -limitZ) { p.z = -limitZ; p.velocity *= 0.5; }
        
        // Boost Pad Collisions
        boostPads.forEach(pad => {
            if (pad.active) {
                const dist = Math.sqrt((p.x - pad.x)**2 + (p.z - pad.z)**2);
                if (dist < 50) { // Pickup radius
                    pad.active = false;
                    pad.cooldown = pad.type === 'full' ? 600 : 240; // 10s or 4s at 60fps
                    p.boost = Math.min(MAX_BOOST, p.boost + (pad.type === 'full' ? 100 : 12));
                }
            } else {
                pad.cooldown--;
                if (pad.cooldown <= 0) pad.active = true;
            }
        });
    });

    // Update Ball
    ball.vy -= GRAVITY;
    ball.x += ball.vx;
    ball.y += ball.vy;
    ball.z += ball.vz;

    // Floor Bounce
    if (ball.y < BALL_RADIUS) {
        ball.y = BALL_RADIUS;
        ball.vy *= -BALL_BOUNCE;
        ball.vx *= BALL_FRICTION;
        ball.vz *= BALL_FRICTION;
    }

    // Ceiling Bounce
    const ceilingHeight = WALL_HEIGHT;
    if (ball.y > ceilingHeight - BALL_RADIUS) {
        ball.y = ceilingHeight - BALL_RADIUS;
        ball.vy *= -BALL_BOUNCE;
    }

    // Wall Bounce
    const bLimitX = FIELD_WIDTH / 2 - BALL_RADIUS;
    const bLimitZ = FIELD_LENGTH / 2 - BALL_RADIUS;

    if (ball.x > bLimitX) { ball.x = bLimitX; ball.vx *= -BALL_BOUNCE; }
    if (ball.x < -bLimitX) { ball.x = -bLimitX; ball.vx *= -BALL_BOUNCE; }

    // End Walls & Goals
    if (ball.z > bLimitZ) {
        if (Math.abs(ball.x) < GOAL_WIDTH / 2 && ball.y < 250) { // Goal height check (approx)
            score.p2++;
            resetGame();
        } else {
            ball.z = bLimitZ;
            ball.vz *= -BALL_BOUNCE;
        }
    }
    if (ball.z < -bLimitZ) {
        if (Math.abs(ball.x) < GOAL_WIDTH / 2 && ball.y < 250) {
            score.p1++;
            resetGame();
        } else {
            ball.z = -bLimitZ;
            ball.vz *= -BALL_BOUNCE;
        }
    }

    // Car-Ball Collisions
    ['p1', 'p2'].forEach(pid => {
        const p = players[pid];
        
        // Transform ball position to car local space
        const dx = ball.x - p.x;
        const dz = ball.z - p.z;
        
        const sin = Math.sin(p.rotationY);
        const cos = Math.cos(p.rotationY);

        // Local Z is forward, Local X is Right
        // Forward vector: (sin, cos)
        // Right vector: (-cos, sin)
        
        const localZ = dx * sin + dz * cos;
        const localX = -dx * cos + dz * sin;

        // Car dimensions (half-extents)
        const halfW = 20; // Width 40
        const halfL = 30; // Length 60
        
        // Find closest point on the OBB to the circle center
        const closestX = Math.max(-halfW, Math.min(halfW, localX));
        const closestZ = Math.max(-halfL, Math.min(halfL, localZ));
        
        // Vector from closest point to ball center
        const distLocalX = localX - closestX;
        const distLocalZ = localZ - closestZ;
        const distSq = distLocalX * distLocalX + distLocalZ * distLocalZ;
        
        if (distSq < BALL_RADIUS * BALL_RADIUS) {
            const dist = Math.sqrt(distSq);
            
            // Normal in local space
            let normalLocalX = 0;
            let normalLocalZ = 0;
            
            if (dist > 0.001) {
                normalLocalX = distLocalX / dist;
                normalLocalZ = distLocalZ / dist;
            } else {
                // Ball center is inside the car OBB
                // Push out along the nearest axis
                // (Simple heuristic: push forward or backward depending on Z)
                normalLocalZ = (localZ > 0) ? 1 : -1;
            }
            
            // Transform normal back to world space
            // worldN = normalLocalZ * Forward + normalLocalX * Right
            const worldNx = normalLocalZ * sin - normalLocalX * cos;
            const worldNz = normalLocalZ * cos + normalLocalX * sin;
            
            // Resolve Collision
            const force = 3.0;
            const overlap = BALL_RADIUS - dist;
            
            // Push ball out
            ball.x += worldNx * overlap;
            ball.z += worldNz * overlap;
            
            // Add velocity
            // Combine normal bounce + car velocity transfer
            const velocityTransfer = 0.8;
            ball.vx += worldNx * force + (Math.sin(p.rotationY) * p.velocity * velocityTransfer);
            ball.vz += worldNz * force + (Math.cos(p.rotationY) * p.velocity * velocityTransfer);
            ball.vy += 8; // Kick up slightly
            
            // Damping on car
            p.velocity *= 0.8;
        }
    });
}

// Game Loop
setInterval(() => {
    updatePhysics();
    io.emit('gameState', {
        p1: { x: players.p1.x, y: players.p1.y, z: players.p1.z, rotationY: players.p1.rotationY, pitch: players.p1.pitch, roll: players.p1.roll, boost: players.p1.boost },
        p2: { x: players.p2.x, y: players.p2.y, z: players.p2.z, rotationY: players.p2.rotationY, pitch: players.p2.pitch, roll: players.p2.roll, boost: players.p2.boost },
        ball: { x: ball.x, y: ball.y, z: ball.z },
        pads: boostPads.map(p => ({ x: p.x, z: p.z, active: p.active, type: p.type }))
    });
}, 1000 / 60);

// --- Socket.IO Handling ---
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);
    let assignedRole = null;

    if (!players.p1.id) {
        players.p1.id = socket.id;
        assignedRole = 'p1';
    } else if (!players.p2.id) {
        players.p2.id = socket.id;
        assignedRole = 'p2';
    } else {
        assignedRole = 'spectator';
    }

    socket.emit('init', { role: assignedRole, score: score });
    console.log(`User ${socket.id} assigned role: ${assignedRole}`);

    socket.on('input', (inputData) => {
        if (assignedRole === 'p1' || assignedRole === 'p2') {
            players[assignedRole].keys = inputData;
        }
    });

    socket.on('resetRequest', () => {
         // Allow any player to reset for now, or maybe just restrict to players
         if (assignedRole === 'p1' || assignedRole === 'p2') {
             resetGame();
         }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        if (players.p1.id === socket.id) players.p1.id = null;
        if (players.p2.id === socket.id) players.p2.id = null;
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
