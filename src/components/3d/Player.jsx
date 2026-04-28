import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useKeyboardControls } from '@react-three/drei'
import { RigidBody } from '@react-three/rapier'
import * as THREE from 'three'

export default function Player() {
  const rigidBodyRef = useRef()
  const [, getKeys] = useKeyboardControls()
  
  // Creamos un vector fuera del loop para optimizar la memoria de la cámara
  const cameraTarget = new THREE.Vector3()

  useFrame((state) => {
    if (!rigidBodyRef.current) return

    const keys = getKeys()
    const speed = 10 // Subí un poco la velocidad para que recorras el mapa más rápido

    // --- 1. LÓGICA DE MOVIMIENTO (La que ya teníamos) ---
    let moveX = 0
    let moveZ = 0

    if (keys.forward) moveZ -= speed
    if (keys.backward) moveZ += speed
    if (keys.left) moveX -= speed
    if (keys.right) moveX += speed

    if (moveX !== 0 || moveZ !== 0) {
      rigidBodyRef.current.setLinvel({ x: moveX, y: 0, z: moveZ }, true)
    } else {
      const target = new THREE.Vector3()
      target.set(state.pointer.x, state.pointer.y, 0).unproject(state.camera)
      const dir = target.sub(state.camera.position).normalize()
      const distance = -state.camera.position.y / dir.y
      const pos = state.camera.position.clone().add(dir.multiplyScalar(distance))

      const currentPos = rigidBodyRef.current.translation()
      const playerPos = new THREE.Vector3(currentPos.x, 0, currentPos.z)
      const moveDirection = pos.sub(playerPos)
      
      if (moveDirection.length() > 0.5) {
        moveDirection.normalize().multiplyScalar(speed)
        rigidBodyRef.current.setLinvel({ x: moveDirection.x, y: 0, z: moveDirection.z }, true)
      } else {
        rigidBodyRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true)
      }
    }

    // --- 2. LÓGICA DE LA CÁMARA (NUEVO) ---
    
    // A. Obtenemos la posición exacta de la pelota en este frame
    const currentTranslation = rigidBodyRef.current.translation()
    const playerPosition = new THREE.Vector3(
      currentTranslation.x, 
      currentTranslation.y, 
      currentTranslation.z
    )

    // B. Definimos el "Offset" (El desfase de la cámara respecto a la pelota)
    // Aquí le decimos que esté 5 unidades arriba (y) y 10 unidades atrás (z)
    cameraTarget.set(playerPosition.x, playerPosition.y + 5, playerPosition.z + 10)

    // C. Movemos la cámara suavemente hacia ese Offset usando LERP (Interpolación Lineal)
    // El '0.1' es el factor de suavidad. Si pones 1, la cámara será rígida.
    state.camera.position.lerp(cameraTarget, 0.1)

    // D. Obligamos a la cámara a mirar siempre hacia el centro de la pelota
    state.camera.lookAt(playerPosition)
  })

  return (
    <RigidBody 
      ref={rigidBodyRef} 
      position={[0, 0, 0]} 
      lockRotations 
      name="player"
    >
      <mesh>
        <sphereGeometry args={[0.5, 32, 32]} />
        <meshStandardMaterial color="hotpink" />
      </mesh>
    </RigidBody>
  )
}