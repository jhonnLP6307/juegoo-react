import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { ARENA_W, ARENA_H, TUNNEL_Z } from './Movement';

export default function Ground({ scene }) {
  const builtRef = useRef(false);

  useEffect(() => {
    if (!scene || builtRef.current) return;
    builtRef.current = true;

    const ambient = new THREE.AmbientLight(0x0a1a2f, 4);
    scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xffffff, 1.8);
    sun.position.set(10, 20, 30);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    scene.add(sun);

    const fill = new THREE.DirectionalLight(0x00d4ff, 0.7);
    fill.position.set(-10, -5, -20);
    scene.add(fill);

    const floorGeo = new THREE.PlaneGeometry(ARENA_W, TUNNEL_Z, 18, 60);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x06111f,      roughness: 0.9,
      metalness: 0.1,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -ARENA_H / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const gridFloor = new THREE.GridHelper(
      Math.max(ARENA_W, TUNNEL_Z), 30, 0x0a3a5a, 0x061525
    );
    gridFloor.position.y = -ARENA_H / 2 + 0.02;
    scene.add(gridFloor);

    const gridCeil = new THREE.GridHelper(
      Math.max(ARENA_W, TUNNEL_Z), 30, 0x0a2030, 0x060e18
    );
    gridCeil.position.y = ARENA_H / 2 - 0.02;
    scene.add(gridCeil);

    const lineMat = () =>
      new THREE.LineBasicMaterial({ color: 0x0a2540, transparent: true, opacity: 0.45 });

    const addLine = (p1, p2) => {
      const geo = new THREE.BufferGeometry().setFromPoints([p1, p2]);
      scene.add(new THREE.Line(geo, lineMat()));
    };

    const hW = ARENA_W / 2, hH = ARENA_H / 2, hZ = TUNNEL_Z / 2;

    for (let z = -hZ; z <= hZ; z += 10) {
      addLine(new THREE.Vector3(-hW, -hH, z), new THREE.Vector3(-hW, hH, z));
      addLine(new THREE.Vector3(hW, -hH, z),  new THREE.Vector3(hW, hH, z));
    }
    
    [
      [new THREE.Vector3(-hW, -hH, -hZ), new THREE.Vector3(-hW, -hH, hZ)],
      [new THREE.Vector3(-hW,  hH, -hZ), new THREE.Vector3(-hW,  hH, hZ)],
      [new THREE.Vector3( hW, -hH, -hZ), new THREE.Vector3( hW, -hH, hZ)],
      [new THREE.Vector3( hW,  hH, -hZ), new THREE.Vector3( hW,  hH, hZ)],
    ].forEach(([a, b]) => addLine(a, b));

    const positions = [];
    for (let i = 0; i < 700; i++) {
      positions.push(
        (Math.random() - 0.5) * 300,
        (Math.random() - 0.5) * 300,
        (Math.random() - 0.5) * 300,
      );
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0xffffff, size: 0.2, transparent: true, opacity: 0.45,
    });
    scene.add(new THREE.Points(starGeo, starMat));

    const goalGroup = new THREE.Group();
    goalGroup.position.set(0, 0, -TUNNEL_Z / 2 + 4);

    const outerGeo = new THREE.TorusGeometry(2.4, 0.22, 16, 60);
    const outerMat = new THREE.MeshStandardMaterial({
      color: 0x00ff99, emissive: 0x00cc77, emissiveIntensity: 1.0,
      roughness: 0.1, metalness: 0.5,
    });
    const outerRing = new THREE.Mesh(outerGeo, outerMat);
    goalGroup.add(outerRing);

    const innerGeo = new THREE.TorusGeometry(2.4 * 0.55, 0.1, 16, 60);
    const innerMat = new THREE.MeshStandardMaterial({
      color: 0xffffff, emissive: 0x00ff99, emissiveIntensity: 1.3, roughness: 0.05,
    });
    const innerRing = new THREE.Mesh(innerGeo, innerMat);
    goalGroup.add(innerRing);

    const beaconGeo = new THREE.SphereGeometry(0.55, 32, 32);
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    goalGroup.add(new THREE.Mesh(beaconGeo, beaconMat));

    goalGroup.add(new THREE.PointLight(0x00ff99, 6, 22));
    scene.add(goalGroup);

    goalGroup.userData.outerRing = outerRing;
    goalGroup.userData.innerRing = innerRing;

    scene.userData.goalGroup = goalGroup;

    let rafId;
    const animateGoal = () => {
      rafId = requestAnimationFrame(animateGoal);
      goalGroup.rotation.y += 0.012;
      outerRing.rotation.z += 0.008;
      innerRing.rotation.x += 0.016;
    };
    animateGoal();

    return () => cancelAnimationFrame(rafId);
  }, [scene]);

  return null; // purely imperative – no DOM output
}