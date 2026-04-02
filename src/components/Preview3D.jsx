import React, { useRef, useEffect } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import * as THREE from 'three';
import useBlueprintStore from '../store/useBlueprintStore';
import { MATERIALS, GRID, MAX_LAYERS } from '../constants/materials';

const INIT_POS    = [GRID * 0.8, GRID * 0.6, GRID * 0.8];
const INIT_TARGET = [GRID / 2, 5, GRID / 2];
const MIN_DIST    = 8;
const MAX_DIST    = 380;

// ── 每種材質一個 InstancedMesh ─────────────────
function MaterialInstances({ matDef }) {
  const meshRef = useRef();
  const { layers, displayUpToLayer } = useBlueprintStore();
  const maxCount = GRID * GRID * MAX_LAYERS;

  useEffect(() => {
    if (!meshRef.current) return;
    const mesh   = meshRef.current;
    const dummy  = new THREE.Object3D();
    const hidden = new THREE.Matrix4().makeScale(0, 0, 0);

    for (let i = 0; i < maxCount; i++) mesh.setMatrixAt(i, hidden);

    let idx = 0;
    Object.entries(layers).forEach(([y, cells]) => {
      const yNum = parseInt(y);
      if (yNum > displayUpToLayer) return;
      Object.entries(cells).forEach(([ck, matId]) => {
        if (matId !== matDef.id) return;
        const [x, z] = ck.split(',').map(Number);
        dummy.position.set(x + 0.5, yNum - 0.5, z + 0.5);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        mesh.setMatrixAt(idx++, dummy.matrix);
      });
    });

    mesh.count = idx;
    mesh.instanceMatrix.needsUpdate = true;
  }, [layers, displayUpToLayer, matDef.id, maxCount]);

  return (
    <instancedMesh ref={meshRef} args={[null, null, maxCount]} castShadow receiveShadow>
      <boxGeometry args={[1, 1, 1]} />
      <meshLambertMaterial color={matDef.hex} />
    </instancedMesh>
  );
}

// ── 攝影機控制器 ───────────────────────────────
function CameraController({ actionRef }) {
  const { camera } = useThree();
  const controlsRef = useRef(null);
  const targetRef   = useRef(new THREE.Vector3(...INIT_TARGET));

  // 每幀確保攝影機距離在安全範圍內
  useFrame(() => {
    const dist = camera.position.distanceTo(targetRef.current);
    if (dist < MIN_DIST || dist > MAX_DIST) {
      const dir = camera.position.clone().sub(targetRef.current).normalize();
      const safeDist = Math.max(MIN_DIST, Math.min(MAX_DIST, dist));
      camera.position.copy(targetRef.current.clone().addScaledVector(dir, safeDist));
    }
  });

  // 把操作函式暴露給外層按鈕
  useEffect(() => {
    actionRef.current = {
      zoom: (factor) => {
        const target = targetRef.current.clone();
        const dir    = camera.position.clone().sub(target);
        const cur    = dir.length();
        const next   = Math.max(MIN_DIST, Math.min(MAX_DIST, cur * factor));
        dir.setLength(next);
        camera.position.copy(target.clone().add(dir));

        // 同步給 OrbitControls
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
      // OrbitControls 掛載後注入 ref
      setControls: (ctrl) => {
        controlsRef.current = ctrl;
        if (ctrl) {
          ctrl.target.copy(targetRef.current);
          // 監聽 OrbitControls 的 target 變化，同步到 targetRef
          ctrl.addEventListener('change', () => {
            targetRef.current.copy(ctrl.target);
          });
        }
      },
    };
  }, [camera, actionRef]);

  return null;
}

// ── OrbitControls wrapper（掛載後回報給 CameraController）
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
      enableDamping={false}
      maxPolarAngle={Math.PI / 2 - 0.02}
      mouseButtons={{
        LEFT:   THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT:  THREE.MOUSE.PAN,
      }}
    />
  );
}

// ── 場景內容 ───────────────────────────────────
function SceneContent({ actionRef }) {
  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight position={[60, 100, 40]} intensity={0.85} castShadow />
      <directionalLight position={[-40, 20, -60]} intensity={0.25} color="#8ab4f8" />

      <Grid
        position={[GRID / 2, 0, GRID / 2]}
        args={[GRID, GRID]}
        cellSize={1}
        cellThickness={0.3}
        cellColor="#1e2a3a"
        sectionSize={10}
        sectionThickness={0.5}
        sectionColor="#2a3f55"
        fadeDistance={180}
        infiniteGrid={false}
      />

      {MATERIALS.map((m) => (
        <MaterialInstances key={m.id} matDef={m} />
      ))}

      <Controls actionRef={actionRef} />
      <CameraController actionRef={actionRef} />
    </>
  );
}

// ── 外層元件 ───────────────────────────────────
export default function Preview3D() {
  const actionRef = useRef({});

  return (
    <div className="panel right-panel">
      <div className="panel-info">
        3D 預覽 ｜ 左鍵旋轉 · 右鍵平移
      </div>

      <div className="zoom-bar">
        <button className="zoom-btn" onClick={() => actionRef.current.zoom?.(1.4)}>−</button>
        <button className="zoom-btn zoom-reset" onClick={() => actionRef.current.reset?.()}>重設</button>
        <button className="zoom-btn" onClick={() => actionRef.current.zoom?.(1 / 1.4)}>+</button>
      </div>

      <div className="canvas-wrap">
        <Canvas
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
          camera={{ position: INIT_POS, fov: 45, near: 0.1, far: 600 }}
          gl={{ antialias: true }}
        >
          <color attach="background" args={['#090d12']} />
          <fog attach="fog" args={['#090d12', 150, 400]} />
          <SceneContent actionRef={actionRef} />
        </Canvas>
      </div>
    </div>
  );
}
