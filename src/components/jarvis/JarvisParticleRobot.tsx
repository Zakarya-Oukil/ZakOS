import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';

interface JarvisParticleRobotProps {
  isSpeaking?: boolean;
  isListening?: boolean;
  isModalOpen?: boolean;
  onHoverStateChange?: (isHovered: boolean) => void;
  className?: string;
}

const TOTAL_PARTICLES = 55000;

export const JarvisParticleRobot: React.FC<JarvisParticleRobotProps> = ({
  isSpeaking = false,
  isListening = false,
  isModalOpen = false,
  onHoverStateChange,
  className = ''
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);

  // References for render loop & physics
  const isSpeakingRef = useRef(isSpeaking);
  const isListeningRef = useRef(isListening);
  const isModalOpenRef = useRef(isModalOpen);

  isSpeakingRef.current = isSpeaking;
  isListeningRef.current = isListening;
  isModalOpenRef.current = isModalOpen;

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let animationFrameId: number;
    let width = container.clientWidth || window.innerWidth;
    let height = container.clientHeight || window.innerHeight;

    // 1. Scene & Camera Setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 0, 18);

    // 2. High-Performance WebGL Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    // 3. Generate Soft Circular Particle Glow Texture (Additive Glow)
    const createGlowTexture = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext('2d')!;
      const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
      grad.addColorStop(0.2, 'rgba(0, 240, 255, 0.95)');
      grad.addColorStop(0.5, 'rgba(6, 182, 212, 0.45)');
      grad.addColorStop(0.8, 'rgba(2, 132, 199, 0.18)');
      grad.addColorStop(1.0, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(32, 32, 32, 0, Math.PI * 2);
      ctx.fill();

      const tex = new THREE.CanvasTexture(canvas);
      tex.needsUpdate = true;
      return tex;
    };

    const particleTexture = createGlowTexture();

    // 4. Arrays for 55,000+ Coordinates & Physics
    const positions = new Float32Array(TOTAL_PARTICLES * 3);
    const homePositions = new Float32Array(TOTAL_PARTICLES * 3);
    const modalPositions = new Float32Array(TOTAL_PARTICLES * 3);
    const velocities = new Float32Array(TOTAL_PARTICLES * 3);
    const colors = new Float32Array(TOTAL_PARTICLES * 3);
    const originalColors = new Float32Array(TOTAL_PARTICLES * 3);
    const sizes = new Float32Array(TOTAL_PARTICLES);
    const isEye = new Float32Array(TOTAL_PARTICLES);
    const randomPhases = new Float32Array(TOTAL_PARTICLES);

    // Color Palette
    const cyanColor = new THREE.Color('#00f0ff');
    const deepBlueColor = new THREE.Color('#0284c7');
    const electricSkyColor = new THREE.Color('#38bdf8');
    const whiteHotColor = new THREE.Color('#ffffff');
    const darkTealColor = new THREE.Color('#0f766e');

    let pIdx = 0;

    // Helper: Add Particle
    const addParticle = (
      hx: number, hy: number, hz: number,
      mx: number, my: number, mz: number,
      color: THREE.Color,
      size: number,
      eyeFlag: number = 0
    ) => {
      if (pIdx >= TOTAL_PARTICLES) return;
      const i3 = pIdx * 3;

      // Start initial position with slight dispersal
      positions[i3] = hx + (Math.random() - 0.5) * 4;
      positions[i3 + 1] = hy + (Math.random() - 0.5) * 4;
      positions[i3 + 2] = hz + (Math.random() - 0.5) * 4;

      homePositions[i3] = hx;
      homePositions[i3 + 1] = hy;
      homePositions[i3 + 2] = hz;

      modalPositions[i3] = mx;
      modalPositions[i3 + 1] = my;
      modalPositions[i3 + 2] = mz;

      velocities[i3] = 0;
      velocities[i3 + 1] = 0;
      velocities[i3 + 2] = 0;

      colors[i3] = color.r;
      colors[i3 + 1] = color.g;
      colors[i3 + 2] = color.b;

      originalColors[i3] = color.r;
      originalColors[i3 + 1] = color.g;
      originalColors[i3 + 2] = color.b;

      sizes[pIdx] = size;
      isEye[pIdx] = eyeFlag;
      randomPhases[pIdx] = Math.random() * Math.PI * 2;

      pIdx++;
    };

    // --- GEOMETRY GENERATOR: 3D CYBERNETIC ROBOT HEAD & TORSO ---

    // 1. Helmet Cranium & Crown (Curved Ellipsoid) ~ 12,000 particles
    const craniumCount = 12000;
    for (let i = 0; i < craniumCount; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);

      // Scale to robot head proportions (slightly tapered chin)
      const r = 2.4 + (Math.random() - 0.5) * 0.15;
      let x = r * Math.sin(phi) * Math.cos(theta);
      let y = r * Math.cos(phi) * 1.15 + 0.6; // elevated head
      let z = r * Math.sin(phi) * Math.sin(theta) * 0.95;

      // Only top/sides/back of head
      if (y < 0.2 && z > 0.8) continue; // carve face cavity

      // Modal coordinate: outer frame perimeter
      const side = Math.floor(Math.random() * 4);
      let mx = 0, my = 0, mz = -2 + (Math.random() - 0.5) * 0.5;
      const spread = (Math.random() - 0.5) * 16;
      if (side === 0) { mx = spread; my = 6.5; } // top edge
      else if (side === 1) { mx = spread; my = -6.5; } // bottom edge
      else if (side === 2) { mx = -8.5; my = spread * 0.8; } // left edge
      else { mx = 8.5; my = spread * 0.8; } // right edge

      const col = Math.random() > 0.7 ? cyanColor : (Math.random() > 0.4 ? electricSkyColor : deepBlueColor);
      addParticle(x, y, z, mx, my, mz, col, 2.2 + Math.random() * 1.5, 0);
    }

    // 2. Visor Faceplate & Cheek Geometry ~ 10,000 particles
    const visorCount = 10000;
    for (let i = 0; i < visorCount; i++) {
      const u = (Math.random() - 0.5) * 2; // -1 to 1
      const v = (Math.random() - 0.5) * 2; // -1 to 1

      // Visor curve
      const x = u * 1.7;
      const y = 0.8 + v * 1.1;
      const z = Math.sqrt(Math.max(0, 3.2 - (x * x * 0.85) - (v * v * 0.5))) + 0.4;

      // Modal position: Window Scanlines & Holographic Grid
      const mx = (Math.random() - 0.5) * 16;
      const my = (Math.random() - 0.5) * 12;
      const mz = -1.5;

      const col = Math.random() > 0.5 ? cyanColor : whiteHotColor;
      addParticle(x, y, z, mx, my, mz, col, 2.0 + Math.random() * 1.8, 0);
    }

    // 3. Dense Ocular Eye Slits (The Talking Eyes!) ~ 3,000 particles
    const eyeCount = 1500;
    // Left Eye
    for (let i = 0; i < eyeCount; i++) {
      const ex = -0.7 + (Math.random() - 0.5) * 0.75;
      const ey = 0.95 + (Math.random() - 0.5) * 0.22 - (ex * 0.15); // aggressive slant
      const ez = 2.05 + (Math.random() - 0.5) * 0.15;

      // Modal position: Top-Left Floating AI Core Orb
      const angle = Math.random() * Math.PI * 2;
      const orbR = Math.random() * 0.9;
      const mx = -7.5 + Math.cos(angle) * orbR;
      const my = 5.8 + Math.sin(angle) * orbR;
      const mz = 0.5;

      addParticle(ex, ey, ez, mx, my, mz, cyanColor, 3.5 + Math.random() * 1.5, 1);
    }
    // Right Eye
    for (let i = 0; i < eyeCount; i++) {
      const ex = 0.7 + (Math.random() - 0.5) * 0.75;
      const ey = 0.95 + (Math.random() - 0.5) * 0.22 + (ex * 0.15); // aggressive slant
      const ez = 2.05 + (Math.random() - 0.5) * 0.15;

      // Modal position: Top-Right Floating Reticle
      const angle = Math.random() * Math.PI * 2;
      const orbR = Math.random() * 0.9;
      const mx = 7.5 + Math.cos(angle) * orbR;
      const my = 5.8 + Math.sin(angle) * orbR;
      const mz = 0.5;

      addParticle(ex, ey, ez, mx, my, mz, cyanColor, 3.5 + Math.random() * 1.5, 1);
    }

    // 4. Jawline, Chin & Tech Mouth Sensor ~ 5,000 particles
    const jawCount = 5000;
    for (let i = 0; i < jawCount; i++) {
      const t = Math.random();
      const angle = (t - 0.5) * Math.PI * 0.9;
      const r = 1.6 - Math.abs(t - 0.5) * 0.5;
      const x = Math.sin(angle) * r;
      const y = -0.5 - Math.cos(angle) * 0.8 + (Math.random() - 0.5) * 0.2;
      const z = Math.cos(angle) * 1.4 + 0.3;

      const mx = (Math.random() - 0.5) * 14;
      const my = -6.2;
      const mz = -1.0;

      addParticle(x, y, z, mx, my, mz, deepBlueColor, 1.8 + Math.random() * 1.2, 0);
    }

    // 5. Cranial Lateral Ear Nodes & Tech Disks ~ 4,000 particles
    const earCount = 2000;
    // Left Ear Node
    for (let i = 0; i < earCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const rad = 0.65 * Math.sqrt(Math.random());
      const x = -2.35 - (Math.random() * 0.2);
      const y = 0.7 + Math.cos(theta) * rad;
      const z = Math.sin(theta) * rad;

      const mx = -8.5;
      const my = (Math.random() - 0.5) * 8;
      const mz = -1.0;

      addParticle(x, y, z, mx, my, mz, cyanColor, 2.5 + Math.random() * 1.0, 0);
    }
    // Right Ear Node
    for (let i = 0; i < earCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const rad = 0.65 * Math.sqrt(Math.random());
      const x = 2.35 + (Math.random() * 0.2);
      const y = 0.7 + Math.cos(theta) * rad;
      const z = Math.sin(theta) * rad;

      const mx = 8.5;
      const my = (Math.random() - 0.5) * 8;
      const mz = -1.0;

      addParticle(x, y, z, mx, my, mz, cyanColor, 2.5 + Math.random() * 1.0, 0);
    }

    // 6. Cybernetic Spine, Neck Hydraulics & Trapezius ~ 8,000 particles
    const neckCount = 8000;
    for (let i = 0; i < neckCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const rad = 0.95 + (Math.random() - 0.5) * 0.2;
      const height = -0.6 - Math.random() * 1.5;
      const x = Math.sin(angle) * rad;
      const y = height;
      const z = Math.cos(angle) * rad * 0.85;

      const mx = (Math.random() - 0.5) * 16;
      const my = (Math.random() - 0.5) * 12;
      const mz = -2.0;

      const col = Math.random() > 0.5 ? deepBlueColor : darkTealColor;
      addParticle(x, y, z, mx, my, mz, col, 1.8 + Math.random() * 1.2, 0);
    }

    // 7. Chassis, Pauldrons & Arc-Reactor Core ~ 13,000 particles
    const torsoCount = 13000;
    for (let i = 0; i < torsoCount; i++) {
      const isCore = i < 3500;
      let x = 0, y = 0, z = 0;
      let col = deepBlueColor;
      let s = 2.0;

      if (isCore) {
        // Concentric Arc-Reactor Orbital Rings
        const angle = Math.random() * Math.PI * 2;
        const ring = Math.random() > 0.5 ? 0.7 : 1.2;
        const r = ring + (Math.random() - 0.5) * 0.15;
        x = Math.sin(angle) * r;
        y = -3.2 + Math.cos(angle) * r;
        z = 1.35 + (Math.random() - 0.5) * 0.1;
        col = Math.random() > 0.4 ? cyanColor : whiteHotColor;
        s = 3.2;
      } else {
        // Broad Cyber Shoulders and Chest Plates
        const sx = (Math.random() - 0.5) * 8.5;
        const sy = -2.2 - Math.random() * 2.5;
        const sz = Math.cos((sx / 8.5) * Math.PI * 0.5) * 2.0 - 0.5 + (Math.random() - 0.5) * 0.4;
        x = sx;
        y = sy;
        z = sz;
        col = Math.random() > 0.6 ? electricSkyColor : deepBlueColor;
        s = 2.2 + Math.random() * 1.2;
      }

      // Modal position: bottom deck & outer frame
      const mx = (Math.random() - 0.5) * 17;
      const my = -6.5 + (Math.random() - 0.5) * 0.6;
      const mz = -1.0;

      addParticle(x, y, z, mx, my, mz, col, s, 0);
    }

    // Fill any remainder
    while (pIdx < TOTAL_PARTICLES) {
      addParticle(
        (Math.random() - 0.5) * 4,
        (Math.random() - 0.5) * 4,
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 16,
        (Math.random() - 0.5) * 12,
        -1,
        deepBlueColor,
        1.5,
        0
      );
    }

    // 5. Construct Three.js BufferGeometry
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    // Custom Shaders & Additive Blending Material
    const material = new THREE.PointsMaterial({
      size: 0.16,
      map: particleTexture,
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true
    });

    const particleSystem = new THREE.Points(geometry, material);
    particleSystem.position.y = 0.5; // Centered on screen
    scene.add(particleSystem);

    // 6. Interactive Physics & Cursor Tracking
    const mouse = new THREE.Vector2(-999, -999);
    const targetGroupRotation = new THREE.Vector2(0, 0);
    const raycaster = new THREE.Raycaster();
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const planeIntersect = new THREE.Vector3();

    let isMouseOver = false;

    const onPointerMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      // 3D Head look-at target
      targetGroupRotation.y = mouse.x * 0.42;
      targetGroupRotation.x = -mouse.y * 0.32;

      // Hover check
      raycaster.setFromCamera(mouse, camera);
      raycaster.ray.intersectPlane(plane, planeIntersect);

      const distToCenter = Math.hypot(planeIntersect.x, planeIntersect.y - 0.5);
      const hovered = distToCenter < 4.2;
      if (hovered !== isMouseOver) {
        isMouseOver = hovered;
        if (onHoverStateChange) onHoverStateChange(hovered);
      }
    };

    const onPointerLeave = () => {
      mouse.x = -999;
      mouse.y = -999;
      targetGroupRotation.set(0, 0);
      if (isMouseOver) {
        isMouseOver = false;
        if (onHoverStateChange) onHoverStateChange(false);
      }
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerleave', onPointerLeave);

    // Resize Handler
    const onResize = () => {
      if (!container) return;
      width = container.clientWidth || window.innerWidth;
      height = container.clientHeight || window.innerHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    window.addEventListener('resize', onResize);

    // 7. Master GPU Physics & Render Loop (Butter-Smooth 60-120 FPS)
    const clock = new THREE.Clock();
    let currentMorph = 0.0; // 0 = Robot, 1 = Modal

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      const dt = Math.min(clock.getDelta(), 0.1);
      const time = clock.getElapsedTime();

      // Smooth Group Look-At Rotation
      particleSystem.rotation.y += (targetGroupRotation.y - particleSystem.rotation.y) * 0.07;
      particleSystem.rotation.x += (targetGroupRotation.x - particleSystem.rotation.x) * 0.07;

      // Smooth Morph Interpolation between Robot & Modal Frame
      const targetMorph = isModalOpenRef.current ? 1.0 : 0.0;
      currentMorph += (targetMorph - currentMorph) * 0.08;

      // Raycast cursor interaction point in local space
      const inverseMatrix = particleSystem.matrixWorld.clone().invert();
      const localCursor = planeIntersect.clone().applyMatrix4(inverseMatrix);

      const posAttr = geometry.attributes.position as THREE.BufferAttribute;
      const colAttr = geometry.attributes.color as THREE.BufferAttribute;
      const sizeAttr = geometry.attributes.size as THREE.BufferAttribute;

      const pArr = posAttr.array as Float32Array;
      const cArr = colAttr.array as Float32Array;
      const sArr = sizeAttr.array as Float32Array;

      const speaking = isSpeakingRef.current;
      const listening = isListeningRef.current;

      // Physics constants
      const springK = 0.065;
      const damping = 0.88;
      const repelRadius = 3.2;
      const repelStrength = 1.35;

      for (let i = 0; i < TOTAL_PARTICLES; i++) {
        const i3 = i * 3;

        // Current target (blended between Robot and Modal target)
        const hx = homePositions[i3];
        const hy = homePositions[i3 + 1];
        const hz = homePositions[i3 + 2];

        const mx = modalPositions[i3];
        const my = modalPositions[i3 + 1];
        const mz = modalPositions[i3 + 2];

        // Linear interpolation of target position
        let tx = hx + (mx - hx) * currentMorph;
        let ty = hy + (my - hy) * currentMorph;
        let tz = hz + (mz - hz) * currentMorph;

        // Subtle ambient zero-gravity float
        const phase = randomPhases[i];
        tx += Math.sin(time * 1.5 + phase) * 0.04;
        ty += Math.cos(time * 1.2 + phase) * 0.04;

        // Current Particle Position
        let px = pArr[i3];
        let py = pArr[i3 + 1];
        let pz = pArr[i3 + 2];

        let vx = velocities[i3];
        let vy = velocities[i3 + 1];
        let vz = velocities[i3 + 2];

        // --- 1. HOVER DISMEMBERMENT & MAGNETIC REPULSION ---
        if (!isModalOpenRef.current && isMouseOver) {
          const dx = px - localCursor.x;
          const dy = py - localCursor.y;
          const dz = pz - localCursor.z;
          const distSq = dx * dx + dy * dy + dz * dz;

          if (distSq < repelRadius * repelRadius && distSq > 0.0001) {
            const dist = Math.sqrt(distSq);
            const force = (1.0 - dist / repelRadius) * repelStrength;

            // Outward repulsion vector
            const normX = dx / dist;
            const normY = dy / dist;
            const normZ = dz / dist;

            // Tangential curl-noise vortex swirl
            const swirlX = -normY * 0.45;
            const swirlY = normX * 0.45;

            vx += (normX + swirlX) * force * 1.2;
            vy += (normY + swirlY) * force * 1.2;
            vz += (normZ + (Math.random() - 0.5) * 0.6) * force * 1.4;
          }
        }

        // --- 2. SPRING-DAMPER MAGNETIC RECONSTITUTION ---
        const fx = (tx - px) * springK;
        const fy = (ty - py) * springK;
        const fz = (tz - pz) * springK;

        vx = (vx + fx) * damping;
        vy = (vy + fy) * damping;
        vz = (vz + fz) * damping;

        // Update Position
        pArr[i3] = px + vx;
        pArr[i3 + 1] = py + vy;
        pArr[i3 + 2] = pz + vz;

        // --- 3. VOICE-REACTIVE OCULAR EYE SHADING & BLUE PULSE ---
        const isEyeParticle = isEye[i] > 0.5;

        if (isEyeParticle) {
          if (speaking) {
            // High-intensity white-hot electric blue ocular glow!
            cArr[i3] = 0.45;     // R
            cArr[i3 + 1] = 0.98; // G
            cArr[i3 + 2] = 1.0;  // B (hyper cyan-blue)
            sArr[i] = 4.8 + Math.sin(time * 20 + phase) * 1.5;
          } else if (listening) {
            // Emerald listening pulse
            cArr[i3] = 0.1;
            cArr[i3 + 1] = 0.95;
            cArr[i3 + 2] = 0.5;
            sArr[i] = 3.6 + Math.sin(time * 12 + phase) * 1.0;
          } else {
            // Calm cyan standby
            cArr[i3] = originalColors[i3];
            cArr[i3 + 1] = originalColors[i3 + 1];
            cArr[i3 + 2] = originalColors[i3 + 2];
            sArr[i] = sizes[i];
          }
        } else if (speaking) {
          // Acoustic sine ripples traveling through face
          const distFromMouth = Math.hypot(px, py - (-0.5));
          const wave = Math.sin(time * 16 - distFromMouth * 3.5);
          if (wave > 0.7) {
            cArr[i3] = 0.2;
            cArr[i3 + 1] = 0.95;
            cArr[i3 + 2] = 1.0;
          } else {
            cArr[i3] = originalColors[i3];
            cArr[i3 + 1] = originalColors[i3 + 1];
            cArr[i3 + 2] = originalColors[i3 + 2];
          }
        }
      }

      posAttr.needsUpdate = true;
      colAttr.needsUpdate = true;
      sizeAttr.needsUpdate = true;

      renderer.render(scene, camera);
    };

    animate();
    setIsReady(true);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerleave', onPointerLeave);
      window.removeEventListener('resize', onResize);
      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
      geometry.dispose();
      material.dispose();
      particleTexture.dispose();
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className={`absolute inset-0 z-1 pointer-events-auto cursor-crosshair overflow-hidden ${className}`}
    >
      {!isReady && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#040711]">
          <div className="h-9 w-9 rounded-full border-2 border-cyan-500/20 border-t-cyan-400 animate-spin" />
          <span className="font-mono text-[10px] tracking-widest text-cyan-400/80 uppercase">
            Synthesizing 55,000 Nanotech Data Points...
          </span>
        </div>
      )}
    </div>
  );
};
