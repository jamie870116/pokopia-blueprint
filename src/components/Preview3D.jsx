import React, { useRef, useEffect, useMemo, useState } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import * as THREE from 'three';
import useBlueprintStore from '../store/useBlueprintStore';
import { MATERIALS, GRID } from '../constants/materials';

const INIT_POS = [GRID * 0.8, GRID * 0.6, GRID * 0.8];
const INIT_TARGET = [GRID / 2, 5, GRID / 2];
const MIN_DIST = 8;
const MAX_DIST = 380;
const MIN_CAPACITY = 4096;

const HEX_MAP = new Map(MATERIALS.map((m) => [m.id, m.hex]));

// ── All blocks in one InstancedMesh (per-instance color) ──
// Only the blocks that actually exist are written — a few thousand matrix
// writes per edit instead of the old 7 × 200,000 hidden-matrix loop.
function Blocks() {
  const meshRef = useRef();
  const layers = useBlueprintStore((s) => s.layers);
  const displayUpToLayer = useBlueprintStore((s) => s.displayUpToLayer);

  const blocks = useMemo(() => {
    const list = [];
    Object.entries(layers).forEach(([y, cells]) => {
      const yNum = parseInt(y);
      if (yNum > displayUpToLayer) return;
      Object.entries(cells).forEach(([ck, matId]) => {
        const [x, z] = ck.split(',').map(Number);
        list.push({ x, y: yNum, z, matId });
      });
    });
    return list;
  }, [layers, displayUpToLayer]);

  // High-water-mark capacity: only grows (powers of two) so the mesh is rarely recreated
  const [capacity, setCapacity] = useState(MIN_CAPACITY);
  if (blocks.length > capacity) {
    setCapacity(2 ** Math.ceil(Math.log2(blocks.length)));
  }

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    blocks.forEach((b, i) => {
      dummy.position.set(b.x + 0.5, b.y - 0.5, b.z + 0.5);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, color.setHex(HEX_MAP.get(b.matId) ?? 0x888888));
    });
    mesh.count = blocks.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [blocks, capacity]);

  return (
    <instancedMesh
      key={capacity}
      ref={meshRef}
      args={[null, null, capacity]}
      frustumCulled={false}
      castShadow
      receiveShadow
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshLambertMaterial color="#ffffff" />
    </instancedMesh>
  );
}

// ── Camera controller (zoom / reset buttons) ───
function CameraController({ actionRef }) {
  const { camera } = useThree();
  const controlsRef = useRef(null);
  const targetRef = useRef(new THREE.Vector3(...INIT_TARGET));

  // Keep the camera distance inside a safe range every frame
  useFrame(() => {
    const dist = camera.position.distanceTo(targetRef.current);
    if (dist < MIN_DIST || dist > MAX_DIST) {
      const dir = camera.position.clone().sub(targetRef.current).normalize();
      const safeDist = Math.max(MIN_DIST, Math.min(MAX_DIST, dist));
      camera.position.copy(targetRef.current.clone().addScaledVector(dir, safeDist));
    }
  });

  // Expose actions to the buttons outside the canvas
  useEffect(() => {
    actionRef.current = {
      zoom: (factor) => {
        const target = targetRef.current.clone();
        const dir = camera.position.clone().sub(target);
        const next = Math.max(MIN_DIST, Math.min(MAX_DIST, dir.length() * factor));
        dir.setLength(next);
        camera.position.copy(target.clone().add(dir));
        if (controlsRef.current) {
          controlsRef.current.target.copy(targetRef.current);
          controlsRef.current.update();
        }
      },
      reset: () => {
        camera.position.set(...INIT_POS);
        targetRef.current.set(...INIT_TARGET);
        if (controlsRef.current) {
          controlsRef.current.target.copy(targetRef.current);
          controlsRef.current.update();
        }
      },
      setControls: (ctrl) => {
        controlsRef.current = ctrl;
        if (ctrl) {
          ctrl.target.copy(targetRef.current);
          ctrl.addEventListener('change', () => {
            targetRef.current.copy(ctrl.target);
          });
        }
      },
    };
  }, [camera, actionRef]);

  return null;
}

function Controls({ actionRef }) {
  const { camera, gl } = useThree();
  const ref = useRef();

  useEffect(() => {
    if (ref.current) actionRef.current?.setControls?.(ref.current);
  }, [actionRef]);

  return (
    <OrbitControls
      ref={ref}
      args={[camera, gl.domElement]}
      makeDefault
      enableZoom={false}
      enableDamping
      dampingFactor={0.12}
      maxPolarAngle={Math.PI / 2 - 0.02}
      mouseButtons={{
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN,
      }}
    />
  );
}

// ── Scene ──────────────────────────────────────
function SceneContent({ actionRef }) {
  return (
    <>
      <hemisphereLight args={['#ffffff', '#cde3b6', 0.7]} />
      <directionalLight
        position={[60, 100, 40]}
        intensity={1.1}
        color="#fff6e0"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-70}
        shadow-camera-right={70}
        shadow-camera-top={70}
        shadow-camera-bottom={-70}
        shadow-camera-far={250}
      />

      {/* Ground */}
      <mesh position={[GRID / 2, -0.02, GRID / 2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[GRID, GRID]} />
        <meshLambertMaterial color="#dcedc8" />
      </mesh>

      <Grid
        position={[GRID / 2, 0.01, GRID / 2]}
        args={[GRID, GRID]}
        cellSize={1}
        cellThickness={0.3}
        cellColor="#aac896"
        sectionSize={10}
        sectionThickness={0.7}
        sectionColor="#86ab6e"
        fadeDistance={220}
        infiniteGrid={false}
      />

      <Blocks />

      <Controls actionRef={actionRef} />
      <CameraController actionRef={actionRef} />
    </>
  );
}

export default function Preview3D() {
  const actionRef = useRef({});

  return (
    <div className="panel">
      <div className="panel-head">
        <span className="panel-title">3D 預覽</span>
        <span className="panel-hint">左鍵旋轉 · 右鍵平移</span>
        <div className="zoom-bar">
          <button className="zoom-btn" onClick={() => actionRef.current.zoom?.(1.4)} title="縮小">−</button>
          <button className="zoom-btn zoom-reset" onClick={() => actionRef.current.reset?.()}>重設</button>
          <button className="zoom-btn" onClick={() => actionRef.current.zoom?.(1 / 1.4)} title="放大">+</button>
        </div>
      </div>

      <div className="canvas-wrap">
        <Canvas
          shadows
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
          camera={{ position: INIT_POS, fov: 45, near: 0.1, far: 600 }}
          gl={{ antialias: true }}
        >
          <color attach="background" args={['#cfe8f7']} />
          <fog attach="fog" args={['#cfe8f7', 180, 450]} />
          <SceneContent actionRef={actionRef} />
        </Canvas>
      </div>
    </div>
  );
}
