import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";

function Camino() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]} receiveShadow>
      <planeGeometry args={[6, 200]} />
      <meshStandardMaterial color="#1a1a2e" roughness={0.9} />
    </mesh>
  );
}

function Obstaculo({ posicionInicial, velocidad, amplitud, tipo }) {
  const ref = useRef();
  const offset = useRef(Math.random() * Math.PI * 2);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() + offset.current;
    if (!ref.current) return;
    if (tipo === "lateral") ref.current.position.x = Math.sin(t * velocidad) * amplitud;
    else if (tipo === "vertical") ref.current.position.y = 0.5 + Math.abs(Math.sin(t * velocidad)) * amplitud;
    else { ref.current.rotation.x += 0.03; ref.current.rotation.y += 0.02; }
  });

  const color = tipo === "lateral" ? "#e94560" : tipo === "vertical" ? "#f5a623" : "#7b2fff";
  return (
    <mesh ref={ref} position={posicionInicial} castShadow>
      {tipo === "lateral" && <cylinderGeometry args={[0.6, 0.6, 2, 8]} />}
      {tipo === "vertical" && <boxGeometry args={[1.5, 1.5, 1.5]} />}
      {tipo === "rotacion" && <torusGeometry args={[0.7, 0.25, 8, 16]} />}
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} roughness={0.3} metalness={0.6} />
    </mesh>
  );
}

function Obstaculos() {
  const tipos = ["lateral", "vertical", "rotacion"];
  return (
    <>
      {Array.from({ length: 20 }, (_, i) => (
        <Obstaculo key={i} posicionInicial={[0, 0.5, -5 - i * 9]}
          velocidad={0.8 + (i % 3) * 0.4} amplitud={tipos[i % 3] === "lateral" ? 1.8 : 1.2}
          tipo={tipos[i % 3]} />
      ))}
    </>
  );
}

function Paredes() {
  return (
    <>
      {[-3.3, 3.3].map((x, i) => (
        <mesh key={i} position={[x, 1, 0]}>
          <boxGeometry args={[0.2, 3, 200]} />
          <meshStandardMaterial color="#0f3460" emissive="#16213e" emissiveIntensity={0.5} />
        </mesh>
      ))}
    </>
  );
}

function Techo() {
  return (
    <mesh position={[0, 2.5, 0]}>
      <planeGeometry args={[6, 200]} />
      <meshStandardMaterial color="#0f3460" side={THREE.BackSide} />
    </mesh>
  );
}

function LucesDecorativas() {
  return (
    <>
      {Array.from({ length: 15 }, (_, i) => (
        <pointLight key={i} position={[0, 2, -i * 12]} intensity={2} distance={10}
          color={i % 2 === 0 ? "#e94560" : "#7b2fff"} />
      ))}
    </>
  );
}

function Escena() {
  const camaraRef = useRef();
  useFrame(({ clock }) => {
    if (camaraRef.current)
      camaraRef.current.position.y = 0.8 + Math.sin(clock.getElapsedTime() * 2) * 0.04;
  });
  return (
    <>
      <PerspectiveCamera ref={camaraRef} makeDefault fov={80} position={[0, 0.8, 5]} />
      <fog attach="fog" args={["#0a0a1a", 15, 80]} />
      <ambientLight intensity={0.3} />
      <LucesDecorativas />
      <Camino />
      <Paredes />
      <Techo />
      <Obstaculos />
    </>
  );
}

export default function Entorno3D() {
  return (
    <div style={{ width: "100vw", height: "100vh", background: "#0a0a1a" }}>
      <Canvas shadows><Escena /></Canvas>
      <div style={{ position: "absolute", top: "50%", left: "50%",
        transform: "translate(-50%,-50%)", width: 4, height: 4,
        background: "white", borderRadius: "50%", pointerEvents: "none" }} />
    </div>
  );
}