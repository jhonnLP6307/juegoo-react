import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { useKeyboardControls } from '@react-three/drei'
import { RigidBody } from '@react-three/rapier'
import * as THREE from 'three'

export default function Player() {
  const rigidBodyRef = useRef()
  const [, getKeys] = useKeyboardControls()
  
  // Optimizamos creando los objetos matemáticos una sola vez
  const cameraTarget = new THREE.Vector3()
  const groundPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0.5), [])
  const raycaster = useMemo(() => new THREE.Raycaster(), [])
  const intersectionPoint = new THREE.Vector3()

  useFrame((state) => {
    if (!rigidBodyRef.current) return

    const keys = getKeys()
    const speed = 10
    const currentTranslation = rigidBodyRef.current.translation()
    const playerPosition = new THREE.Vector3(currentTranslation.x, currentTranslation.y, currentTranslation.z)

    // 1. PRIORIDAD: MOVIMIENTO CON TECLADO (WASD)
    let velX = 0
    let velZ = 0

    if (keys.forward) velZ -= speed
    if (keys.backward) velZ += speed
    if (keys.left) velX -= speed
    if (keys.right) velX += speed

    // 2. SI NO HAY TECLAS, USAMOS EL RATÓN
    if (velX === 0 && velZ === 0) {
      // Lanzamos un rayo desde la cámara pasando por el puntero del ratón
      raycaster.setFromCamera(state.pointer, state.camera)
      
      // Calculamos dónde choca ese rayo con el plano del suelo (y = -0.5)
      if (raycaster.ray.intersectPlane(groundPlane, intersectionPoint)) {
        // Vector desde la pelota hacia el punto del ratón
        const direction = new THREE.Vector3().subVectors(intersectionPoint, playerPosition)
        direction.y = 0 // Ignoramos el eje Y para que no intente "volar"

        // Si estamos lejos del punto, nos movemos hacia él
        if (direction.length() > 0.2) {
          direction.normalize().multiplyScalar(speed)
          velX = direction.x
          velZ = direction.z
        }
      }
    }

    // Aplicamos la velocidad final al motor de físicas
    rigidBodyRef.current.setLinvel({ x: velX, y: rigidBodyRef.current.linvel().y, z: velZ }, true)

    // 3. SEGUIMIENTO DE CÁMARA (Suave)
    cameraTarget.set(playerPosition.x, playerPosition.y + 4, playerPosition.z + 6)
    state.camera.position.lerp(cameraTarget, 0.1)
    state.camera.lookAt(playerPosition)
  })

  return (
    <RigidBody 
      ref={rigidBodyRef} 
      position={[0, 1, 0]} 
      enabledRotations={[false, false, false]} // Bloquea rotaciones para que no ruede como loca
      name="player"
    >
      <mesh castShadow>
        <sphereGeometry args={[0.5, 32, 32]} />
        <meshStandardMaterial 
          color="#ff007f" 
          emissive="#ff007f" 
          emissiveIntensity={0.5} 
          roughness={0.2}
        />
      </mesh>
    </RigidBody>
  )
}