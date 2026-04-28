import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useKeyboardControls } from '@react-three/drei'
import { RigidBody } from '@react-three/rapier'
import * as THREE from 'three'

export default function Player() {
  const rigidBodyRef = useRef()
  const [, getKeys] = useKeyboardControls()
  const cameraTarget = new THREE.Vector3()

  useFrame((state) => {
    if (!rigidBodyRef.current) return

    const keys = getKeys()
    const speed = 8

    // 1. Movimiento
    let moveX = 0
    let moveZ = 0

    if (keys.forward) moveZ -= speed
    if (keys.backward) moveZ += speed
    if (keys.left) moveX -= speed
    if (keys.right) moveX += speed

    rigidBodyRef.current.setLinvel({ x: moveX, y: 0, z: moveZ }, true)

    // 2. Cámara de seguimiento
    const currentTranslation = rigidBodyRef.current.translation()
    const playerPosition = new THREE.Vector3(
      currentTranslation.x, 
      currentTranslation.y, 
      currentTranslation.z
    )

    // Posicionamos la cámara detrás y arriba
    cameraTarget.set(playerPosition.x, playerPosition.y + 4, playerPosition.z + 8)
    state.camera.position.lerp(cameraTarget, 0.1)
    state.camera.lookAt(playerPosition)
  })

  return (
    <RigidBody 
      ref={rigidBodyRef} 
      position={[0, 1, 0]} // Empieza un poco arriba para que caiga al suelo
      lockRotations 
      name="player"
    >
      <mesh castShadow>
        <sphereGeometry args={[0.5, 32, 32]} />
        <meshStandardMaterial color="hotpink" />
      </mesh>
    </RigidBody>
  )
}