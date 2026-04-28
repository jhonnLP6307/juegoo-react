import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import useGameStore, {
  ARENA_W, ARENA_H, TUNNEL_Z, OBS_COUNT, RESHUFFLE_MS,
} from './Movement';

// ─── Geometry factories (native Three.js only) ────────────────────────────────
const GEO_FACTORIES = [
  () => new THREE.BoxGeometry(2, 2, 2),
  () => new THREE.SphereGeometry(1.1, 16, 16),
  () => new THREE.CylinderGeometry(0, 1.3, 2.4, 6),      // cone
  () => new THREE.CylinderGeometry(0.8, 0.8, 2, 8),      // cylinder
  () => new THREE.TorusGeometry(1.0, 0.35, 12, 30),
  () => new THREE.DodecahedronGeometry(1.1),
  () => new THREE.IcosahedronGeometry(1.0),
  () => new THREE.OctahedronGeometry(1.2),
  () => new THREE.TetrahedronGeometry(1.3),
];

/**
 * Obstacles
 * ─────────
 * Owns obstacle mesh creation, rotation animation, and timed reshuffle.
 * Exposes `obstaclesRef` via `scene.userData.obstacles` so Player can
 * read them for collision detection without prop-drilling.
 *
 * Props:
 *   scene  {THREE.Scene}
 */
export default function Obstacles({ scene }) {
  const screen         = useGameStore((s) => s.screen);
  const obsGroupRef    = useRef(null);
  const obstaclesRef   = useRef([]);   // [{ mesh, rotSpeed, radius }]
  const reshuffleTimer = useRef(null);
  const rafRef         = useRef(null);

  // ── Build / clear obstacle meshes ─────────────────────────────────────────
  const buildObstacles = (group) => {
    // dispose old
    while (group.children.length) {
      const child = group.children[0];
      child.geometry?.dispose();
      child.material?.dispose();
      group.remove(child);
    }

    const zMin = -TUNNEL_Z / 2 + 14;
    const zMax =  TUNNEL_Z / 2 - 14;
    const result = [];

    for (let i = 0; i < OBS_COUNT; i++) {
      const geoFn    = GEO_FACTORIES[Math.floor(Math.random() * GEO_FACTORIES.length)];
      const geo      = geoFn();
      const isRed    = Math.random() > 0.5;
      const hue      = new THREE.Color(isRed ? 0xff2244 : 0xff7700);
      const wire     = Math.random() > 0.55;

      const mat = new THREE.MeshStandardMaterial({
        color:             hue,
        emissive:          hue,
        emissiveIntensity: wire ? 0.9 : 0.3,
        roughness:         0.4,
        metalness:         0.5,
        wireframe:         wire,
      });

      const mesh  = new THREE.Mesh(geo, mat);
      const scale = 0.85 + Math.random() * 1.0;
      mesh.position.set(
        (Math.random() - 0.5) * (ARENA_W - 4),
        (Math.random() - 0.5) * (ARENA_H - 3),
        zMin + Math.random() * (zMax - zMin),
      );
      mesh.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI,
      );
      mesh.scale.setScalar(scale);
      mesh.castShadow = true;

      const oLight = new THREE.PointLight(hue, 0.7, 7);
      mesh.add(oLight);
      group.add(mesh);

      result.push({
        mesh,
        rotSpeed: new THREE.Vector3(
          (Math.random() - 0.5) * 0.025,
          (Math.random() - 0.5) * 0.025,
          (Math.random() - 0.5) * 0.025,
        ),
        radius: scale * 1.2,
      });
    }

    obstaclesRef.current = result;
    // share via scene.userData so Player can read without props
    if (scene) scene.userData.obstacles = result;
    return result;
  };

  // ── Init group once scene is ready ────────────────────────────────────────
  useEffect(() => {
    if (!scene) return;
    const group = new THREE.Group();
    scene.add(group);
    obsGroupRef.current = group;

    // share rebuild function with Player (for post-collision reshuffle)
    scene.userData.reshuffleObstacles = () => {
      buildObstacles(group);
      startReshuffleTimer();
    };

    return () => {
      clearTimeout(reshuffleTimer.current);
      cancelAnimationFrame(rafRef.current);
      scene.remove(group);
    };
  }, [scene]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Start / stop rotation loop based on game screen ───────────────────────
  useEffect(() => {
    if (screen === 'playing') {
      const rotate = () => {
        rafRef.current = requestAnimationFrame(rotate);
        obstaclesRef.current.forEach((o) => {
          o.mesh.rotation.x += o.rotSpeed.x;
          o.mesh.rotation.y += o.rotSpeed.y;
          o.mesh.rotation.z += o.rotSpeed.z;
        });
      };
      rotate();
    } else {
      cancelAnimationFrame(rafRef.current);
    }
    return () => cancelAnimationFrame(rafRef.current);
  }, [screen]);

  // ── Spawn fresh obstacles when game starts ────────────────────────────────
  useEffect(() => {
    if (screen === 'playing' && obsGroupRef.current) {
      buildObstacles(obsGroupRef.current);
      startReshuffleTimer();
    }
    if (screen === 'menu' || screen === 'ended') {
      clearTimeout(reshuffleTimer.current);
    }
  }, [screen]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Timed reshuffle ───────────────────────────────────────────────────────
  const startReshuffleTimer = () => {
    clearTimeout(reshuffleTimer.current);
    reshuffleTimer.current = setTimeout(() => {
      if (obsGroupRef.current) {
        buildObstacles(obsGroupRef.current);
        startReshuffleTimer();          // reschedule
      }
    }, RESHUFFLE_MS);
  };

  return null;
}