// App.jsx
import Entorno3D from './components/Entorno3D' // Ajusta la ruta según tu proyecto
import { KeyboardControls } from '@react-three/drei'
import './App.css'

export default function App() {
  // Definimos los controles globalmente
  const keyboardMap = [
    { name: 'forward', keys: ['ArrowUp', 'KeyW'] },
    { name: 'backward', keys: ['ArrowDown', 'KeyS'] },
    { name: 'left', keys: ['ArrowLeft', 'KeyA'] },
    { name: 'right', keys: ['ArrowRight', 'KeyD'] },
  ]

  return (
    <KeyboardControls map={keyboardMap}>
      <Entorno3D />
    </KeyboardControls>
  )
}