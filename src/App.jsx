import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";

// ─── constants ────────────────────────────────────────────────────────────────
const ARENA_W = 36;
const ARENA_H = 16;
const TUNNEL_Z = 90;
const OBS_COUNT = 20;
const RESHUFFLE_MS = 30_000;
const PLAYER_SPEED = 8;
const PLAYER_R = 0.7;
const GOAL_R = 2.4;

// ─── helpers ──────────────────────────────────────────────────────────────────
function fmtTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function calcScore(hits, elapsed) {
  return Math.max(0, 10000 - hits * 400 - Math.floor(elapsed) * 8);
}

// ─── Three.js scene builder ───────────────────────────────────────────────────
function buildScene(canvas) {
  // renderer
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(canvas.clientWidth, canvas.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  // scene
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x04080f);
  scene.fog = new THREE.FogExp2(0x04080f, 0.018);

  // camera
  const camera = new THREE.PerspectiveCamera(60, canvas.clientWidth / canvas.clientHeight, 0.1, 300);
  camera.position.set(0, 5, TUNNEL_Z / 2 + 14);
  camera.lookAt(0, 0, 0);

  // ── lights ──
  scene.add(new THREE.AmbientLight(0x0a1a2f, 4));

  const sun = new THREE.DirectionalLight(0xffffff, 1.5);
  sun.position.set(10, 20, 30);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  scene.add(sun);

  const fillLight = new THREE.DirectionalLight(0x00d4ff, 0.6);
  fillLight.position.set(-10, -5, -20);
  scene.add(fillLight);

  // ── floor ──
  const floorGeo = new THREE.PlaneGeometry(ARENA_W, TUNNEL_Z, 18, 60);
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x06111f,
    roughness: 0.9,
    metalness: 0.1,
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -ARENA_H / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // grid helper on floor
  const grid = new THREE.GridHelper(Math.max(ARENA_W, TUNNEL_Z), 30, 0x0a3a5a, 0x061525);
  grid.position.y = -ARENA_H / 2 + 0.01;
  scene.add(grid);

  // ── ceiling grid ──
  const ceilGrid = new THREE.GridHelper(Math.max(ARENA_W, TUNNEL_Z), 30, 0x0a2030, 0x060e18);
  ceilGrid.position.y = ARENA_H / 2 - 0.01;
  scene.add(ceilGrid);

  // ── tunnel walls (wireframe boxes) ──
  function addWallLine(x1, y1, z1, x2, y2, z2) {
    const pts = [new THREE.Vector3(x1, y1, z1), new THREE.Vector3(x2, y2, z2)];
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({ color: 0x0a2540, transparent: true, opacity: 0.5 });
    scene.add(new THREE.Line(geo, mat));
  }
  // vertical pillars along the tunnel
  for (let z = -TUNNEL_Z / 2; z <= TUNNEL_Z / 2; z += 10) {
    addWallLine(-ARENA_W / 2, -ARENA_H / 2, z, -ARENA_W / 2, ARENA_H / 2, z);
    addWallLine(ARENA_W / 2, -ARENA_H / 2, z, ARENA_W / 2, ARENA_H / 2, z);
  }
  // horizontal rails
  addWallLine(-ARENA_W / 2, -ARENA_H / 2, -TUNNEL_Z / 2, -ARENA_W / 2, -ARENA_H / 2, TUNNEL_Z / 2);
  addWallLine(-ARENA_W / 2, ARENA_H / 2, -TUNNEL_Z / 2, -ARENA_W / 2, ARENA_H / 2, TUNNEL_Z / 2);
  addWallLine(ARENA_W / 2, -ARENA_H / 2, -TUNNEL_Z / 2, ARENA_W / 2, -ARENA_H / 2, TUNNEL_Z / 2);
  addWallLine(ARENA_W / 2, ARENA_H / 2, -TUNNEL_Z / 2, ARENA_W / 2, ARENA_H / 2, TUNNEL_Z / 2);

  // ── player (SphereGeometry) ──
  const playerGeo = new THREE.SphereGeometry(PLAYER_R, 32, 32);
  const playerMat = new THREE.MeshStandardMaterial({
    color: 0x00e5ff,
    emissive: 0x00a0cc,
    emissiveIntensity: 0.6,
    roughness: 0.2,
    metalness: 0.9,
  });
  const player = new THREE.Mesh(playerGeo, playerMat);
  player.castShadow = true;
  player.position.set(0, 0, TUNNEL_Z / 2 - 4);
  scene.add(player);

  // player halo ring
  const haloGeo = new THREE.TorusGeometry(PLAYER_R * 1.6, 0.06, 8, 40);
  const haloMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.4 });
  const halo = new THREE.Mesh(haloGeo, haloMat);
  player.add(halo);

  // player point light
  const playerLight = new THREE.PointLight(0x00e5ff, 3, 10);
  player.add(playerLight);

  // ── goal (TorusGeometry ring + glowing sphere) ──
  const goalGroup = new THREE.Group();
  goalGroup.position.set(0, 0, -TUNNEL_Z / 2 + 4);

  const outerRingGeo = new THREE.TorusGeometry(GOAL_R, 0.22, 16, 60);
  const outerRingMat = new THREE.MeshStandardMaterial({
    color: 0x00ff99,
    emissive: 0x00cc77,
    emissiveIntensity: 1.0,
    roughness: 0.1,
    metalness: 0.5,
  });
  const outerRing = new THREE.Mesh(outerRingGeo, outerRingMat);
  goalGroup.add(outerRing);

  const innerRingGeo = new THREE.TorusGeometry(GOAL_R * 0.6, 0.1, 16, 60);
  const innerRingMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0x00ff99,
    emissiveIntensity: 1.2,
    roughness: 0.05,
  });
  const innerRing = new THREE.Mesh(innerRingGeo, innerRingMat);
  goalGroup.add(innerRing);

  const beaconGeo = new THREE.SphereGeometry(0.6, 32, 32);
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const beacon = new THREE.Mesh(beaconGeo, beaconMat);
  goalGroup.add(beacon);

  const goalLight = new THREE.PointLight(0x00ff99, 6, 20);
  goalGroup.add(goalLight);

  scene.add(goalGroup);

  // ── star field ──
  const starPositions = [];
  for (let i = 0; i < 700; i++) {
    starPositions.push(
      (Math.random() - 0.5) * 300,
      (Math.random() - 0.5) * 300,
      (Math.random() - 0.5) * 300
    );
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute("position", new THREE.Float32BufferAttribute(starPositions, 3));
  const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.2, transparent: true, opacity: 0.5 });
  scene.add(new THREE.Points(starGeo, starMat));

  // ── obstacles builder ──
  const obsGroup = new THREE.Group();
  scene.add(obsGroup);

  // obstacle geometries pool (native Three.js only)
  const obsGeoFactories = [
    () => new THREE.BoxGeometry(2, 2, 2),
    () => new THREE.SphereGeometry(1.1, 16, 16),
    () => new THREE.CylinderGeometry(0, 1.3, 2.4, 6),   // cone
    () => new THREE.CylinderGeometry(0.8, 0.8, 2, 8),   // cylinder
    () => new THREE.TorusGeometry(1.0, 0.35, 12, 30),
    () => new THREE.DodecahedronGeometry(1.1),
    () => new THREE.IcosahedronGeometry(1.0),
    () => new THREE.OctahedronGeometry(1.2),
    () => new THREE.TetrahedronGeometry(1.3),
    () => new THREE.CapsuleGeometry ? new THREE.CapsuleGeometry(0.5, 1.2, 6, 12) : new THREE.CylinderGeometry(0.5, 0.5, 2, 10),
  ];

  function buildObstacles() {
    while (obsGroup.children.length) {
      const child = obsGroup.children[0];
      child.geometry?.dispose();
      child.material?.dispose();
      obsGroup.remove(child);
    }

    const zMin = -TUNNEL_Z / 2 + 12;
    const zMax = TUNNEL_Z / 2 - 12;
    const results = [];

    for (let i = 0; i < OBS_COUNT; i++) {
      const geoFn = obsGeoFactories[Math.floor(Math.random() * obsGeoFactories.length)];
      const geo = geoFn();
      const hue = Math.random() > 0.5 ? new THREE.Color(0xff2244) : new THREE.Color(0xff7700);
      const wireframe = Math.random() > 0.55;
      const mat = new THREE.MeshStandardMaterial({
        color: hue,
        emissive: hue,
        emissiveIntensity: wireframe ? 0.8 : 0.25,
        roughness: 0.4,
        metalness: 0.5,
        wireframe,
      });
      const mesh = new THREE.Mesh(geo, mat);
      const px = (Math.random() - 0.5) * (ARENA_W - 4);
      const py = (Math.random() - 0.5) * (ARENA_H - 3);
      const pz = zMin + Math.random() * (zMax - zMin);
      mesh.position.set(px, py, pz);
      mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      const scale = 0.8 + Math.random() * 1.0;
      mesh.scale.setScalar(scale);
      mesh.castShadow = true;

      // small light on each obstacle
      const oLight = new THREE.PointLight(hue, 0.6, 6);
      mesh.add(oLight);

      obsGroup.add(mesh);
      results.push({
        mesh,
        rotSpeed: new THREE.Vector3(
          (Math.random() - 0.5) * 0.025,
          (Math.random() - 0.5) * 0.025,
          (Math.random() - 0.5) * 0.025
        ),
        radius: scale * 1.15,
      });
    }
    return results;
  }

  return {
    renderer,
    scene,
    camera,
    player,
    halo,
    goalGroup,
    outerRing,
    innerRing,
    obsGroup,
    buildObstacles,
    goalPos: goalGroup.position.clone(),
    startPos: player.position.clone(),
  };
}

// ─── UI components ─────────────────────────────────────────────────────────────
const panelStyle = {
  background: "linear-gradient(135deg, rgba(4,16,32,0.97) 0%, rgba(2,8,18,0.99) 100%)",
  border: "1px solid rgba(0,229,255,0.25)",
  padding: "48px 52px",
  minWidth: 360,
  textAlign: "center",
  position: "relative",
  boxShadow: "0 0 80px rgba(0,229,255,0.08), inset 0 0 40px rgba(0,0,0,0.6)",
};

const Corner = ({ pos }) => {
  const base = { position: "absolute", width: 18, height: 18, borderColor: "#00e5ff", borderStyle: "solid" };
  const corners = {
    tl: { top: -1, left: -1, borderWidth: "2px 0 0 2px" },
    tr: { top: -1, right: -1, borderWidth: "2px 2px 0 0" },
    bl: { bottom: -1, left: -1, borderWidth: "0 0 2px 2px" },
    br: { bottom: -1, right: -1, borderWidth: "0 2px 2px 0" },
  };
  return <div style={{ ...base, ...corners[pos] }} />;
};

const Btn = ({ children, onClick, danger, small }) => (
  <button
    onClick={onClick}
    style={{
      display: "block",
      width: "100%",
      padding: small ? "10px 20px" : "13px 24px",
      margin: "9px 0",
      background: "transparent",
      border: `1px solid ${danger ? "rgba(255,36,68,0.5)" : "rgba(0,229,255,0.4)"}`,
      color: danger ? "#ff2444" : "#00e5ff",
      fontFamily: "'Orbitron', monospace",
      fontSize: small ? "0.65rem" : "0.72rem",
      fontWeight: 700,
      letterSpacing: "0.18em",
      textTransform: "uppercase",
      cursor: "pointer",
      transition: "all 0.18s",
    }}
    onMouseEnter={e => {
      e.currentTarget.style.background = danger ? "#ff2444" : "#00e5ff";
      e.currentTarget.style.color = "#000";
    }}
    onMouseLeave={e => {
      e.currentTarget.style.background = "transparent";
      e.currentTarget.style.color = danger ? "#ff2444" : "#00e5ff";
    }}
  >
    {children}
  </button>
);

const Overlay = ({ children, visible }) => (
  <div style={{
    position: "absolute", inset: 0,
    display: "flex", alignItems: "center", justifyContent: "center",
    background: "rgba(0,4,12,0.82)",
    backdropFilter: "blur(8px)",
    zIndex: 20,
    opacity: visible ? 1 : 0,
    pointerEvents: visible ? "all" : "none",
    transition: "opacity 0.35s",
  }}>
    {children}
  </div>
);

const Title = ({ children, sub }) => (
  <div style={{ marginBottom: 36 }}>
    <div style={{
      fontFamily: "'Orbitron', monospace",
      fontSize: "2rem",
      fontWeight: 900,
      letterSpacing: "0.12em",
      color: "#fff",
      textShadow: "0 0 24px #00e5ff, 0 0 60px rgba(0,229,255,0.3)",
      marginBottom: 8,
    }}>{children}</div>
    {sub && <div style={{ fontSize: "0.65rem", letterSpacing: "0.35em", color: "rgba(0,229,255,0.5)", textTransform: "uppercase" }}>{sub}</div>}
  </div>
);

const StatRow = ({ label, value, warn }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid rgba(0,229,255,0.08)" }}>
    <span style={{ fontSize: "0.62rem", letterSpacing: "0.25em", color: "rgba(0,229,255,0.5)", textTransform: "uppercase" }}>{label}</span>
    <span style={{
      fontFamily: "'Orbitron', monospace",
      fontSize: "1.5rem", fontWeight: 700,
      color: warn ? "#ff2444" : "#fff",
      textShadow: warn ? "0 0 12px #ff2444" : "0 0 12px #00e5ff",
    }}>{value}</span>
  </div>
);

// ─── HUD ──────────────────────────────────────────────────────────────────────
const HUD = ({ hits, elapsed, reshufflePct, visible }) => (
  <div style={{
    position: "absolute", top: 0, left: 0, right: 0,
    display: visible ? "flex" : "none",
    justifyContent: "space-between", alignItems: "flex-start",
    padding: "14px 20px",
    zIndex: 10,
    pointerEvents: "none",
  }}>
    {[
      { label: "COLLISIONS", value: hits, warn: hits > 0 },
      { label: "TIME", value: fmtTime(elapsed) },
    ].map(({ label, value, warn }) => (
      <div key={label} style={{
        background: "rgba(2,8,20,0.85)",
        border: "1px solid rgba(0,229,255,0.15)",
        padding: "8px 16px",
        minWidth: 90,
      }}>
        <div style={{ fontSize: "0.5rem", letterSpacing: "0.3em", color: "rgba(0,229,255,0.45)", marginBottom: 3 }}>{label}</div>
        <div style={{
          fontFamily: "'Orbitron', monospace", fontSize: "1.1rem", fontWeight: 700,
          color: warn ? "#ff2444" : "#00e5ff",
          textShadow: warn ? "0 0 8px #ff2444" : "0 0 8px #00e5ff",
        }}>{value}</div>
      </div>
    ))}
    {/* reshuffle bar */}
    <div style={{ position: "absolute", bottom: -28, left: "50%", transform: "translateX(-50%)", width: 180 }}>
      <div style={{ fontSize: "0.5rem", letterSpacing: "0.2em", color: "rgba(0,229,255,0.3)", textAlign: "center", marginBottom: 4 }}>RESHUFFLE</div>
      <div style={{ height: 2, background: "rgba(0,229,255,0.1)", position: "relative" }}>
        <div style={{
          position: "absolute", top: 0, left: 0, bottom: 0,
          width: `${reshufflePct * 100}%`,
          background: "linear-gradient(90deg, #00e5ff, #00ff99)",
          boxShadow: "0 0 6px #00e5ff",
          transition: "width 0.15s linear",
        }} />
      </div>
    </div>
  </div>
);

// ─── Main Game Component ───────────────────────────────────────────────────────
export default function Navigator3D() {
  const canvasRef = useRef(null);
  const threeRef = useRef(null);       // { renderer, scene, camera, ... }
  const stateRef = useRef("menu");     // "menu"|"playing"|"paused"|"ended"
  const gameDataRef = useRef({
    hits: 0, startTime: 0, elapsed: 0,
    obstacles: [],
    playerPos: new THREE.Vector3(),
    mouseX: 0, mouseY: 0,
    cooldown: 0,
    reshuffleAt: 0,
    raf: null,
    lastFrame: 0,
  });
  const [screen, setScreen] = useState("menu");
  const [hudData, setHudData] = useState({ hits: 0, elapsed: 0, reshufflePct: 1 });
  const [endData, setEndData] = useState({ hits: 0, elapsed: 0, score: 0 });
  const [flash, setFlash] = useState(false);

  // ── init three ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const t = buildScene(canvas);
    threeRef.current = t;
    gameDataRef.current.playerPos.copy(t.startPos);

    function onResize() {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      t.renderer.setSize(w, h);
      t.camera.aspect = w / h;
      t.camera.updateProjectionMatrix();
    }
    window.addEventListener("resize", onResize);

    // mouse
    function onMouseMove(e) {
      const rect = canvas.getBoundingClientRect();
      gameDataRef.current.mouseX = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      gameDataRef.current.mouseY = -((e.clientY - rect.top) / rect.height - 0.5) * 2;
    }
    window.addEventListener("mousemove", onMouseMove);

    // ── keyboard controls ──
    const keys = {
      up: false,
      down: false,
      left: false,
      right: false,
    };

    function onKeyDown(e) {
      if (e.key === "ArrowUp") keys.up = true;
      if (e.key === "ArrowDown") keys.down = true;
      if (e.key === "ArrowLeft") keys.left = true;
      if (e.key === "ArrowRight") keys.right = true;
    }

    function onKeyUp(e) {
      if (e.key === "ArrowUp") keys.up = false;
      if (e.key === "ArrowDown") keys.down = false;
      if (e.key === "ArrowLeft") keys.left = false;
      if (e.key === "ArrowRight") keys.right = false;
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    // render loop (always render so scene stays visible behind menus)
    let raf;
    function loop(ts) {
      raf = requestAnimationFrame(loop);
      const gd = gameDataRef.current;
      const dt = Math.min((ts - (gd.lastFrame || ts)) / 1000, 0.05);
      gd.lastFrame = ts;

      const s = stateRef.current;

      if (s === "playing") {
        gd.elapsed = (Date.now() - gd.startTime) / 1000;

        // ── MOVIMIENTO ──

        // teclado → Z (adelante / atrás) y opcional X
        let moveX = 0;
        let moveZ = 0;

        if (keys.left) moveX -= 1;
        if (keys.right) moveX += 1;
        if (keys.up) moveZ -= 1;     // adelante
        if (keys.down) moveZ += 1;   // atrás

        // normalizar
        if (moveX !== 0 || moveZ !== 0) {
          const len = Math.sqrt(moveX * moveX + moveZ * moveZ);
          moveX /= len;
          moveZ /= len;
        }

        // aplicar movimiento en X y Z
        gd.playerPos.x += moveX * PLAYER_SPEED * dt * 5;
        gd.playerPos.z += moveZ * PLAYER_SPEED * dt * 5;


        const targetY = gd.mouseY * (ARENA_H / 2 - 1);

        // suavizado (muy importante para que no sea brusco)
        gd.playerPos.y = THREE.MathUtils.lerp(
          gd.playerPos.y,
          targetY,
          0.08
        );
        gd.playerPos.x = THREE.MathUtils.clamp(gd.playerPos.x, -ARENA_W / 2 + 1, ARENA_W / 2 - 1);
        gd.playerPos.y = THREE.MathUtils.clamp(gd.playerPos.y, -ARENA_H / 2 + 1, ARENA_H / 2 - 1);
        gd.playerPos.z = THREE.MathUtils.clamp(
          gd.playerPos.z,
          -TUNNEL_Z / 2 + 2,
          TUNNEL_Z / 2 - 2
        );
        t.player.position.copy(gd.playerPos);

        // tilt
        t.player.rotation.z = -gd.mouseX * 0.35;
        t.player.rotation.x = gd.mouseY * 0.18;

        // halo spin
        t.halo.rotation.z += 0.03;
        t.halo.rotation.x += 0.01;

        // goal animation
        t.goalGroup.rotation.y += 0.012;
        t.outerRing.rotation.z += 0.008;
        t.innerRing.rotation.x += 0.015;

        // obstacle rotation
        gd.obstacles.forEach(o => {
          o.mesh.rotation.x += o.rotSpeed.x;
          o.mesh.rotation.y += o.rotSpeed.y;
          o.mesh.rotation.z += o.rotSpeed.z;
        });

        // cooldown
        if (gd.cooldown > 0) gd.cooldown -= dt;

        // collision: obstacles
        if (gd.cooldown <= 0) {
          for (const o of gd.obstacles) {
            const d = gd.playerPos.distanceTo(o.mesh.position);
            if (d < o.radius + PLAYER_R) {
              gd.hits++;
              gd.cooldown = 1.2;
              setFlash(true);
              setTimeout(() => setFlash(false), 130);
              const newObs = t.buildObstacles();
              gd.obstacles = newObs;
              gd.reshuffleAt = Date.now() + RESHUFFLE_MS;
              break;
            }
          }
        }

        // collision: goal
        const dGoal = gd.playerPos.distanceTo(t.goalPos);
        if (dGoal < GOAL_R + PLAYER_R - 0.5) {
          doEndGame();
          return;
        }

        // timed reshuffle
        if (Date.now() > gd.reshuffleAt) {
          const newObs = t.buildObstacles();
          gd.obstacles = newObs;
          gd.reshuffleAt = Date.now() + RESHUFFLE_MS;
        }

        // hud update (throttle with frame)
        const reshufflePct = Math.max(0, (gd.reshuffleAt - Date.now()) / RESHUFFLE_MS);
        setHudData({ hits: gd.hits, elapsed: gd.elapsed, reshufflePct });
      }

      // camera smooth follow
      const pp = t.player.position;
      const camTarget = new THREE.Vector3(pp.x * 0.25, pp.y * 0.25 + 5, pp.z + 13);
      t.camera.position.lerp(camTarget, 0.06);
      t.camera.lookAt(pp.x * 0.1, pp.y * 0.1, pp.z - 5);

      t.renderer.render(t.scene, t.camera);
    }
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      t.renderer.dispose();
    };
  }, []);

  const doStartGame = useCallback(() => {
    const t = threeRef.current;
    const gd = gameDataRef.current;
    if (!t) return;

    gd.hits = 0;
    gd.elapsed = 0;
    gd.startTime = Date.now();
    gd.cooldown = 0;
    gd.mouseX = 0;
    gd.mouseY = 0;

    // reset player
    gd.playerPos.copy(t.startPos);
    t.player.position.copy(t.startPos);

    // spawn obstacles
    gd.obstacles = t.buildObstacles();
    gd.reshuffleAt = Date.now() + RESHUFFLE_MS;

    stateRef.current = "playing";
    setScreen("playing");
    setHudData({ hits: 0, elapsed: 0, reshufflePct: 1 });
  }, []);

  const doPause = useCallback(() => {
    if (stateRef.current !== "playing") return;
    stateRef.current = "paused";
    setScreen("paused");
  }, []);

  const doResume = useCallback(() => {
    if (stateRef.current !== "paused") return;
    const gd = gameDataRef.current;
    gd.startTime = Date.now() - gd.elapsed * 1000;
    stateRef.current = "playing";
    setScreen("playing");
  }, []);

  const doEndGame = useCallback(() => {
    const gd = gameDataRef.current;
    stateRef.current = "ended";
    const score = calcScore(gd.hits, gd.elapsed);
    setEndData({ hits: gd.hits, elapsed: gd.elapsed, score });
    setScreen("ended");
  }, []);

  const doMenu = useCallback(() => {
    stateRef.current = "menu";
    setScreen("menu");
  }, []);

  return (
    <div style={{ width: "100%", height: "100%", position: "relative", background: "#04080f", fontFamily: "'Share Tech Mono', monospace", overflow: "hidden" }}>
      {/* Google Fonts */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Share+Tech+Mono&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
      `}</style>

      {/* Canvas */}
      <canvas ref={canvasRef} style={{ display: "block", width: "100%", height: "100%" }} />

      {/* Flash */}
      <div style={{
        position: "absolute", inset: 0,
        background: "rgba(255,36,68,0.45)",
        opacity: flash ? 1 : 0,
        transition: "opacity 0.1s",
        pointerEvents: "none",
        zIndex: 99,
      }} />

      {/* HUD */}
      <HUD hits={hudData.hits} elapsed={hudData.elapsed} reshufflePct={hudData.reshufflePct} visible={screen === "playing"} />

      {/* Pause button */}
      {screen === "playing" && (
        <button onClick={doPause} style={{
          position: "absolute", top: 14, right: 18, zIndex: 15,
          background: "rgba(2,8,20,0.8)",
          border: "1px solid rgba(0,229,255,0.2)",
          color: "#00e5ff",
          fontFamily: "'Orbitron', monospace",
          fontSize: "0.6rem", fontWeight: 700,
          letterSpacing: "0.15em",
          padding: "9px 14px",
          cursor: "pointer",
        }}>⏸ PAUSE</button>
      )}

      {/* ── START MENU ── */}
      <Overlay visible={screen === "menu"}>
        <div style={panelStyle}>
          {["tl","tr","bl","br"].map(p => <Corner key={p} pos={p} />)}
          <Title sub="3D obstacle navigator">NAVIGATOR</Title>
          <Btn onClick={doStartGame}>▶ INICAR</Btn>
          <div style={{ marginTop: 28, fontSize: "0.62rem", color: "rgba(0,229,255,0.35)", lineHeight: 2.2, letterSpacing: "0.05em" }}>
            MOVER MOUSE → altura de la nave<br />
            EVADE los objetos chistosos<br />
            ALCANZA el obstaculo verdesinho<br />
            Los obstaculos se randomizaran cada 30 segundos
          </div>
        </div>
      </Overlay>

      {/* ── PAUSE MENU ── */}
      <Overlay visible={screen === "paused"}>
        <div style={panelStyle}>
          {["tl","tr","bl","br"].map(p => <Corner key={p} pos={p} />)}
          <Title sub="mission suspended">PAUSA</Title>
          <StatRow label="Collisions so far" value={hudData.hits} warn={hudData.hits > 0} />
          <StatRow label="Time elapsed" value={fmtTime(hudData.elapsed)} />
          <div style={{ marginTop: 24 }}>
            <Btn onClick={doResume}>▶ CONTINUAR</Btn>
            <Btn onClick={doStartGame}>↺ REINICIAR</Btn>
            <Btn onClick={doMenu} danger>✕ REGRESAR AL MENU</Btn>
          </div>
        </div>
      </Overlay>

      {/* ── END MENU ── */}
      <Overlay visible={screen === "ended"}>
        <div style={panelStyle}>
          {["tl","tr","bl","br"].map(p => <Corner key={p} pos={p} />)}
          <Title sub="beacon reached">MISION COMPLETA</Title>
          <StatRow label="Collisions" value={endData.hits} warn={endData.hits > 0} />
          <StatRow label="Time" value={fmtTime(endData.elapsed)} />
          <div style={{
            margin: "24px 0",
            padding: "20px 24px",
            border: "1px solid rgba(0,229,255,0.2)",
            background: "rgba(0,229,255,0.04)",
          }}>
            <div style={{ fontSize: "0.55rem", letterSpacing: "0.3em", color: "rgba(0,229,255,0.4)", marginBottom: 10, textTransform: "uppercase" }}>Final Score</div>
            <div style={{
              fontFamily: "'Orbitron', monospace",
              fontSize: "3rem", fontWeight: 900,
              color: "#00e5ff",
              textShadow: "0 0 30px #00e5ff",
            }}>{endData.score.toLocaleString()}</div>
          </div>
          <Btn onClick={doStartGame}>↺ JUGAR OTRA VEZ</Btn>
          <Btn onClick={doMenu} danger>⌂ MENU</Btn>
        </div>
      </Overlay>
    </div>
  );
}