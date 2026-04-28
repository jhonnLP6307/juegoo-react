import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Physics, RigidBody } from "@react-three/rapier"; // IMPORTAMOS FÍSICAS
import * as THREE from "three";
import Player from "./Player"; // IMPORTA TU JUGADOR AQUÍ

function Camino() {
  return (
    // El suelo es fijo, no se cae por la gravedad
    <RigidBody type="fixed">
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]} receiveShadow>
        <planeGeometry args={[6, 200]} />
        <meshStandardMaterial color="#1a1a2e" roughness={0.9} />
      </mesh>
    </RigidBody>
  );
}

function Obstaculo({ posicionInicial, velocidad, amplitud, tipo }) {
  const rigidBodyRef = useRef();
  const offset = useRef(Math.random() * Math.PI * 2);

  useFrame(({ clock }) => {
    if (!rigidBodyRef.current) return;
    const t = clock.getElapsedTime() + offset.current;
    
    // Obtenemos la posición inicial como base
    const basePos = new THREE.Vector3(...posicionInicial);

    // Movimiento Cinemático (Le decimos a Rapier dónde poner el objeto)
    if (tipo === "lateral") {
      basePos.x = Math.sin(t * velocidad) * amplitud;
      rigidBodyRef.current.setNextKinematicTranslation(basePos);
    } else if (tipo === "vertical") {
      basePos.y = 0.5 + Math.abs(Math.sin(t * velocidad)) * amplitud;
      rigidBodyRef.current.setNextKinematicTranslation(basePos);
    } else if (tipo === "rotacion") {
      // Mantenemos la posición, pero calculamos una nueva rotación
      rigidBodyRef.current.setNextKinematicTranslation(basePos);
      const euler = new THREE.Euler(t, t * 0.8, 0);
      const quaternion = new THREE.Quaternion().setFromEuler(euler);
      rigidBodyRef.current.setNextKinematicRotation(quaternion);
    }
  });

  const color = tipo === "lateral" ? "#e94560" : tipo === "vertical" ? "#f5a623" : "#7b2fff";
  
  return (
    // type="kinematicPosition" permite animarlos sin que la gravedad los tire
    <RigidBody ref={rigidBodyRef} type="kinematicPosition" position={posicionInicial}>
      <mesh castShadow>
        {tipo === "lateral" && <cylinderGeometry args={[0.6, 0.6, 2, 8]} />}
        {tipo === "vertical" && <boxGeometry args={[1.5, 1.5, 1.5]} />}
        {tipo === "rotacion" && <torusGeometry args={[0.7, 0.25, 8, 16]} />}
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} roughness={0.3} metalness={0.6} />
      </mesh>
    </RigidBody>
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
        <RigidBody key={i} type="fixed">
          <mesh position={[x, 1, 0]}>
            <boxGeometry args={[0.2, 3, 200]} />
            <meshStandardMaterial color="#0f3460" emissive="#16213e" emissiveIntensity={0.5} />
          </mesh>
        </RigidBody>
      ))}
    </>
  );
}

function Techo() {
  return (
    <RigidBody type="fixed">
      <mesh position={[0, 2.5, 0]}>
        <planeGeometry args={[6, 200]} />
        <meshStandardMaterial color="#0f3460" side={THREE.BackSide} />
      </mesh>
    </RigidBody>
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
  // ELIMINÉ LA CÁMARA ESTÁTICA DE TU COMPAÑERO AQUÍ
  // Tu Player.jsx ya tiene el código para que la cámara lo persiga.
  // Si dejábamos ambas, el juego iba a tener un error visual.

  return (
    <>
      <fog attach="fog" args={["#0a0a1a", 15, 80]} />
      <ambientLight intensity={0.3} />
      <LucesDecorativas />
      
      {/* Todo lo que colisiona va dentro de Physics */}
      <Physics>
        <Player /> {/* INYECTAMOS TU PERSONAJE AQUÍ */}
        <Camino />
        <Paredes />
        <Techo />
        <Obstaculos />
      </Physics>
    </>
  );
}

export default function Entorno3D() {
  return (
    <div style={{ width: "100vw", height: "100vh", background: "#0a0a1a" }}>
      <Canvas shadows><Escena /></Canvas>
      {/* Punto de mira (Retícula) para el Mouse */}
      <div style={{ position: "absolute", top: "50%", left: "50%",
        transform: "translate(-50%,-50%)", width: 4, height: 4,
        background: "white", borderRadius: "50%", pointerEvents: "none" }} />
    </div>
  );
}