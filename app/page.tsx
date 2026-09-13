"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const BOSS = String.raw`          .-^^^^-.
         /  .--.  \
        |  /____\  |
     ___| |[o  o]| |___
   .'   | |  /\  | |   '.
  /     |  \_==_/  |     \
 /     /|___/||\___|\     \
      /  /   ||   \  \
     /__/    ||    \__\
        |____||____|
        /    /\    \
       /____/  \____\ `;

const BOSS_SIDE = String.raw`       .-^^^^-.
      /  .--.  |
     |  / o  \ |
  ___| |   > | |____
.'   |  \_==/  |    '---
     |___/||\__|=====>
       /  ||  \
      /___||___\
         /||\
        /_||_\ `;

const BOSS_BACK = String.raw`          .-^^^^-.
         / ////// \
        | |######| |
     ___| |######| |___
   .'   \ |######| /   '.
  /      \|######|/      \
 /        |######|        \
          |##||##|
          |##||##|
         /___||___\
        /____/\____\ `;

type Point = { x: number; y: number };
type Held = Record<string, boolean>;
type Point3 = { x: number; y: number; z: number; nx: number; ny: number; nz: number };

const BOSS_POINTS: Point3[] = [];

function surface(x: number, y: number, z: number, nx: number, ny: number, nz: number) {
  BOSS_POINTS.push({ x, y, z, nx, ny, nz });
}

function sphere(cx: number, cy: number, cz: number, rx: number, ry: number, rz: number) {
  for (let p = 0.12; p < Math.PI; p += 0.13) for (let t = 0; t < Math.PI * 2; t += 0.11) {
    const sp = Math.sin(p), cp = Math.cos(p), st = Math.sin(t), ct = Math.cos(t);
    surface(cx + rx * sp * ct, cy + ry * cp, cz + rz * sp * st, sp * ct, cp, sp * st);
  }
}

function cylinder(cx: number, y0: number, y1: number, cz: number, rx: number, rz: number, taper = 0) {
  for (let y = y0; y <= y1; y += 0.11) for (let t = 0; t < Math.PI * 2; t += 0.105) {
    const k = 1 + taper * ((y - y0) / (y1 - y0) - .5);
    surface(cx + rx * k * Math.cos(t), y, cz + rz * k * Math.sin(t), Math.cos(t), 0, Math.sin(t));
  }
}

function limb(ax: number, ay: number, az: number, bx: number, by: number, bz: number, radius: number) {
  const steps = 42;
  for (let i = 0; i <= steps; i++) {
    const q = i / steps;
    const x = ax + (bx - ax) * q, y = ay + (by - ay) * q, z = az + (bz - az) * q;
    for (let t = 0; t < Math.PI * 2; t += .32) surface(x + radius * Math.cos(t), y, z + radius * Math.sin(t), Math.cos(t), 0, Math.sin(t));
  }
}

sphere(0, 2.65, 0, .92, 1.05, .86);
cylinder(0, -.25, 1.8, 0, 1.42, .72, -.28);
cylinder(0, 1.72, 2.05, 0, 1.72, .68);
limb(-1.42, 1.55, 0, -1.7, -.7, .05, .28);
limb(1.42, 1.55, 0, 1.68, -.65, .05, .28);
limb(-.62, -.2, 0, -.72, -3.1, .05, .34);
limb(.62, -.2, 0, .72, -3.1, .05, .34);
limb(1.68, -.5, .05, 2.55, -2.75, .05, .1);
// Cape: narrower than the torso and slightly recessed, so the back keeps the
// same skeletal proportions as the front instead of becoming a broad slab.
for (let y = -.95; y < 1.35; y += .14) for (let x = -.92; x < .92; x += .13) {
  const shoulderTaper = 1 - Math.max(0, y - .35) * .24;
  if (Math.abs(x) < .92 * shoulderTaper && (Math.round((x + y) * 20) % 3 !== 0)) {
    surface(x, y, -.61 - .045 * Math.cos(x * 4), 0, .1, -1);
  }
}

function renderAsciiBoss(angleDeg: number, distance: number, variant: number) {
  const cols = 69, rows = 31;
  const pixels = Array(cols * rows).fill(" ");
  const parts = Array(cols * rows).fill("body");
  const depth = Array(cols * rows).fill(-Infinity);
  const occupied = Array(cols * rows).fill(false);
  const a = angleDeg * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
  const zoom = 49 / Math.max(21, distance);
  const chars = "  .:-=+*#%@";
  const plot = (source: Point3) => {
    let px = source.x, py = source.y, pz = source.z;
    if (variant === 1) { px *= py > .7 ? 1.28 : 1.08; py *= .94; pz *= 1.08; }
    if (variant === 2) { px *= .76; py *= 1.13; pz *= .82; }
    const x = px * ca - pz * sa;
    const z = px * sa + pz * ca;
    const nx = source.nx * ca - source.nz * sa;
    const nz = source.nx * sa + source.nz * ca;
    const perspective = 1 / (7.2 - z);
    const sx = Math.round(cols / 2 + x * 49 * perspective * zoom);
    const sy = Math.round(rows / 2 - (py - .05) * 22 * perspective * zoom);
    if (sx < 0 || sx >= cols || sy < 0 || sy >= rows) return;
    const index = sy * cols + sx;
    if (z <= depth[index]) return;
    depth[index] = z;
    occupied[index] = true;
    parts[index] = Math.abs(px) > 1.78 ? "weapon" : py > 2.05 ? "head" : py < -.35 ? "legs" : Math.abs(px) > 1.05 ? "arms" : pz < -.57 && Math.abs(px) < 1 ? "cape" : "armor";
    const light = Math.max(0, nx * -.35 + source.ny * .25 + nz * .9);
    const rim = Math.pow(1 - Math.abs(nz), 2) * .45;
    const shade = Math.min(1, .16 + light * .72 + rim);
    const stipple = Math.abs((sx * 17 + sy * 31 + Math.round(z * 13))) % 11;
    if (rim < .12 && shade < .42 && stipple > 5) return;
    pixels[index] = chars[Math.min(chars.length - 1, Math.floor(shade * chars.length))];
  };
  for (const p of BOSS_POINTS) plot(p);
  if (variant === 1) {
    // Large shield on the left: useful for checking left/right orientation.
    for (let y = -.9; y < 1.75; y += .09) for (let z = -.65; z < .72; z += .09) {
      const curve = .12 * Math.cos(z * 3);
      plot({ x: -2.02 - curve, y, z, nx: -1, ny: 0, nz: 0 });
    }
    limbPoints(-2.02, 1.5, 0, -2.4, 2.45, 0, .12).forEach(plot);
  }
  if (variant === 2) {
    // Uneven horns and a long rear tail make every viewing angle distinct.
    limbPoints(-.55, 3.42, 0, -1.35, 4.15, -.15, .11).forEach(plot);
    limbPoints(.5, 3.42, 0, 1.05, 3.9, .18, .11).forEach(plot);
    limbPoints(0, -.8, -.72, .55, -3.6, -1.1, .14).forEach(plot);
  }
  const feature = (px: number, py: number, pz: number, mark: string) => {
    const x = px * ca - pz * sa, z = px * sa + pz * ca;
    const perspective = 1 / (7.2 - z);
    const sx = Math.round(cols / 2 + x * 49 * perspective * zoom);
    const sy = Math.round(rows / 2 - (py - .05) * 22 * perspective * zoom);
    if (sx >= 0 && sx < cols && sy >= 0 && sy < rows && z >= depth[sy * cols + sx] - .18) {
      pixels[sy * cols + sx] = mark;
      parts[sy * cols + sx] = "face";
    }
  };
  // Facial landmarks exist in 3D, so they disappear naturally on the back view.
  if (Math.cos(a) > .22) {
    feature(-.29, 2.82, .83, "o");
    feature(.29, 2.82, .83, "o");
    feature(0, 2.57, .93, "/");
    feature(0, 2.32, .84, "_");
  }
  // Silhouette and depth discontinuities are emphasized like a mesh rasterizer.
  const outlined = pixels.slice();
  for (let y = 1; y < rows - 1; y++) for (let x = 1; x < cols - 1; x++) {
    const i = y * cols + x;
    if (!occupied[i]) continue;
    const neighbors = [i - 1, i + 1, i - cols, i + cols];
    const edge = neighbors.some((n) => !occupied[n]);
    const crease = neighbors.some((n) => occupied[n] && Math.abs(depth[i] - depth[n]) > .5);
    if (edge) outlined[i] = x < cols / 2 ? "/" : "\\";
    else if (crease && outlined[i] === " ") outlined[i] = ":";
  }
  const output = [];
  for (let y = 0; y < rows; y++) {
    const runs = [];
    let start = y * cols, current = parts[start], text = "";
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x;
      if (parts[i] !== current) {
        runs.push(<span key={x + "-" + current} className={"part-" + current}>{text}</span>);
        current = parts[i]; text = "";
      }
      text += outlined[i];
    }
    runs.push(<span key={"end-" + current} className={"part-" + current}>{text.trimEnd()}</span>);
    output.push(<span key={"line-" + y}>{runs}{y < rows - 1 ? "\n" : ""}</span>);
  }
  return output;
}

function limbPoints(ax: number, ay: number, az: number, bx: number, by: number, bz: number, radius: number) {
  const result: Point3[] = [];
  for (let i = 0; i <= 32; i++) {
    const q = i / 32, x = ax + (bx - ax) * q, y = ay + (by - ay) * q, z = az + (bz - az) * q;
    for (let t = 0; t < Math.PI * 2; t += .38) result.push({ x: x + radius * Math.cos(t), y, z: z + radius * Math.sin(t), nx: Math.cos(t), ny: 0, nz: Math.sin(t) });
  }
  return result;
}

export default function Home() {
  const [player, setPlayer] = useState<Point>({ x: 50, y: 82 });
  const playerRef = useRef(player);
  const [stamina, setStamina] = useState(100);
  const staminaRef = useRef(stamina);
  const [rolling, setRolling] = useState(false);
  const rollingRef = useRef(false);
  const [attackPhase, setAttackPhase] = useState(0);
  const attackingRef = useRef(false);
  const [bossHp, setBossHp] = useState(100);
  const [hitFlash, setHitFlash] = useState(false);
  const [moving, setMoving] = useState(false);
  const [walkFrame, setWalkFrame] = useState(false);
  const [facing, setFacing] = useState("^");
  const [locked, setLocked] = useState(true);
  const lockedRef = useRef(true);
  const [orbitAngle, setOrbitAngle] = useState(0);
  const orbitAngleRef = useRef(0);
  const [bossDistance, setBossDistance] = useState(34);
  const bossDistanceRef = useRef(34);
  const [bossType, setBossType] = useState(0);
  const [screenPlayer, setScreenPlayer] = useState<Point>({ x: 46, y: 82 });
  const orbitIntent = useRef({ side: 1, radial: 0 });
  const [message, setMessage] = useState("보스에게 다가가 보세요");
  const held = useRef<Held>({});
  const direction = useRef<Point>({ x: 0, y: -1 });
  const trail = useRef<Point[]>([]);
  const [trailTick, setTrailTick] = useState(0);

  const move = useCallback((dx: number, dy: number, amount: number) => {
    if (dx || dy) {
      const len = Math.hypot(dx, dy) || 1;
      direction.current = { x: dx / len, y: dy / len };
      if (Math.abs(dx) > Math.abs(dy)) setFacing(dx > 0 ? ">" : "<");
      else setFacing(dy > 0 ? "v" : "^");
    }
    setPlayer((old) => {
      let x = Math.max(7, Math.min(93, old.x + dx * amount));
      let y = Math.max(26, Math.min(91, old.y + dy * amount));
      const bx = 50, by = 48;
      const vx = x - bx, vy = y - by;
      const dist = Math.hypot(vx, vy);
      if (dist < 14) {
        x = bx + (vx / (dist || 1)) * 14;
        y = by + (vy / (dist || 1)) * 14;
      }
      const next = { x, y };
      playerRef.current = next;
      const angle = Math.atan2(y - by, x - bx) * 180 / Math.PI;
      if (y < 49) setMessage("등 뒤를 잡았습니다 — 공격 기회!");
      else if (Math.abs(angle) < 45 || Math.abs(angle) > 135) setMessage("보스의 측면입니다");
      else setMessage(dist < 28 ? "공격 범위 — 구를 준비하세요" : "보스에게 다가가 보세요");
      return next;
    });
  }, []);

  const orbit = useCallback((side: number, radial: number, amount: number) => {
    orbitIntent.current = { side: side || orbitIntent.current.side, radial };
    if (side) {
      let nextAngle = orbitAngleRef.current - side * amount * 1.65;
      if (nextAngle > 180) nextAngle -= 360;
      if (nextAngle < -180) nextAngle += 360;
      orbitAngleRef.current = nextAngle;
      setOrbitAngle(nextAngle);
    }
    if (radial) {
      bossDistanceRef.current = Math.max(18, Math.min(44, bossDistanceRef.current + radial * amount));
      setBossDistance(bossDistanceRef.current);
    }
    const rear = Math.abs(orbitAngleRef.current) > 135;
    const sideView = Math.abs(orbitAngleRef.current) > 45;
    setFacing("^");
    setMessage(rear ? "LOCK-ON · 보스의 뒤를 보고 있습니다" : sideView ? "LOCK-ON · 보스의 옆을 보고 있습니다" : "LOCK-ON · 보스의 정면");
  }, []);

  const toggleLock = useCallback(() => {
    lockedRef.current = !lockedRef.current;
    setLocked(lockedRef.current);
    setMessage(lockedRef.current ? "초점 고정 — 좌우로 보스 주위를 도세요" : "초점 해제 — 화면 방향으로 자유 이동");
  }, []);

  const resetEncounter = useCallback(() => {
    orbitAngleRef.current = 0;
    bossDistanceRef.current = 34;
    playerRef.current = { x: 50, y: 82 };
    lockedRef.current = true;
    staminaRef.current = 100;
    setOrbitAngle(0);
    setBossDistance(34);
    setPlayer({ x: 50, y: 82 });
    setScreenPlayer({ x: 46, y: 82 });
    setFacing("^");
    setLocked(true);
    setStamina(100);
    setBossHp(100);
    setAttackPhase(0);
    setMoving(false);
    attackingRef.current = false;
    setMessage("정면 대치 상태로 초기화했습니다");
  }, []);

  const attack = useCallback(() => {
    if (attackingRef.current || rollingRef.current || staminaRef.current < 18) return;
    attackingRef.current = true;
    staminaRef.current -= 18;
    setStamina(staminaRef.current);
    setAttackPhase(1);
    setMessage("공격 준비");
    window.setTimeout(() => {
      setAttackPhase(2);
      const inRange = lockedRef.current ? bossDistanceRef.current <= 32 : Math.hypot(playerRef.current.x - 50, playerRef.current.y - 48) <= 28;
      if (inRange) {
        setBossHp((hp) => Math.max(0, hp - 9));
        setHitFlash(true);
        setMessage("HIT · 9 DAMAGE");
        window.setTimeout(() => setHitFlash(false), 120);
      } else setMessage("공격이 닿지 않았습니다");
    }, 105);
    window.setTimeout(() => setAttackPhase(3), 220);
    window.setTimeout(() => { setAttackPhase(0); attackingRef.current = false; }, 390);
  }, []);

  const roll = useCallback(() => {
    if (rollingRef.current || staminaRef.current < 28) return;
    rollingRef.current = true;
    setRolling(true);
    staminaRef.current -= 28;
    setStamina(staminaRef.current);
    const start = playerRef.current;
    trail.current = [start];
    let frames = 0;
    const timer = window.setInterval(() => {
      frames += 1;
      trail.current = [...trail.current.slice(-3), playerRef.current];
      if (lockedRef.current) orbit(orbitIntent.current.side, orbitIntent.current.radial, 2.3);
      else move(direction.current.x, direction.current.y, 3.1);
      setTrailTick((n) => n + 1);
      if (frames >= 8) {
        window.clearInterval(timer);
        window.setTimeout(() => {
          rollingRef.current = false;
          setRolling(false);
          trail.current = [];
          setTrailTick((n) => n + 1);
        }, 100);
      }
    }, 22);
  }, [move, orbit]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (["w", "a", "s", "d", "q", "j", "arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)) e.preventDefault();
      held.current[key] = true;
      if (key === " ") roll();
      if (key === "q" && !e.repeat) toggleLock();
      if (key === "j" && !e.repeat) attack();
    };
    const up = (e: KeyboardEvent) => { held.current[e.key.toLowerCase()] = false; };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    let last = performance.now();
    let raf = 0;
    const loop = (now: number) => {
      const dt = Math.min(2, (now - last) / 16.67); last = now;
      if (!rollingRef.current) {
        const h = held.current;
        const dx = (h.d || h.arrowright ? 1 : 0) - (h.a || h.arrowleft ? 1 : 0);
        const dy = (h.s || h.arrowdown ? 1 : 0) - (h.w || h.arrowup ? 1 : 0);
        setMoving(Boolean(dx || dy));
        if ((dx || dy) && Math.floor(now / 150) % 2 === 0) setWalkFrame(true);
        else setWalkFrame(false);
        if (dx || dy) {
          const speed = attackingRef.current ? .22 : .48;
          if (lockedRef.current) orbit(dx, dy, speed * dt);
          else move(dx, dy, speed * dt);
        }
        if (lockedRef.current) {
          const targetX = 46 + dx * 10;
          const targetY = 82 + Math.max(-1, Math.min(1, dy)) * 4;
          setScreenPlayer((old) => ({ x: old.x + (targetX - old.x) * .1 * dt, y: old.y + (targetY - old.y) * .1 * dt }));
        }
      }
      if (!rollingRef.current && staminaRef.current < 100) {
        staminaRef.current = Math.min(100, staminaRef.current + 0.22 * dt);
        setStamina(staminaRef.current);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, [attack, move, orbit, roll, toggleLock]);

  const press = (key: string, active: boolean) => {
    held.current[key] = active;
    if (key === " " && active) roll();
    if (key === "q" && active) toggleLock();
    if (key === "j" && active) attack();
  };

  const absoluteAngle = Math.abs(orbitAngle);
  const bossArt = renderAsciiBoss(orbitAngle, bossDistance, bossType);
  const shownPlayer = locked ? screenPlayer : player;
  const idleArt = ["    /\\", "   /[]\\", "  /|..|\\", " /_|==|_\\", "   /||\\", "  /_||_\\"].join("\n");
  const walkA = ["    /\\", "   /[]\\", " _/|..|\\", "   |==|_\\", "   /| \\", "  /_\\  \\"].join("\n");
  const walkB = ["    /\\", "   /[]\\", " /_|..|\\_", "   |==|", "   / |\\", "  /  /_\\"].join("\n");
  const attackArts = [idleArt,
    ["      /|", "    /[]|", "   /|..|", "  /_|==|", "    /||\\", "   /_||_\\"].join("\n"),
    ["  ---------->", "     /\\", "    /[]\\__", "  _/|..|/", "    |==|", "    /  \\"].join("\n"),
    [" \\", "  \\  /\\", "   \\/[]\\", "    |..|\\", "    |==| \\", "    /  \\"].join("\n")
  ];
  const playerArt = attackPhase ? attackArts[attackPhase] : moving ? (walkFrame ? walkA : walkB) : idleArt;

  return (
    <main className="shell">
      <header className="topbar">
        <div><span className="rune">[ ASCII SOULS ]</span><h1>움직임 튜토리얼</h1></div>
        <div className="header-actions"><div className="hint"><kbd>Q</kbd> 초점 <kbd>J</kbd> 공격 <kbd>SPACE</kbd> 구르기</div><button className="reset" onClick={resetEncounter}>↺ 정면 초기화</button></div>
      </header>

      <nav className="boss-picker" aria-label="보스 모양 선택">
        <span>TEST MODEL</span>
        {["01 KNIGHT", "02 BULWARK", "03 WRAITH"].map((name, index) => <button key={name} className={bossType === index ? "selected" : ""} onClick={() => { setBossType(index); resetEncounter(); }}>{name}</button>)}
      </nav>

      <section className="game" aria-label="ASCII 소울라이크 이동 연습장">
        <div className="grain" />
        <div className="boss-ui">
          <span>{["THE ASHEN KNIGHT", "THE IRON BULWARK", "THE HOLLOW WRAITH"][bossType]} · LIVE ASCII 3D</span>
          <div className="bar bossbar"><i style={{ width: bossHp + "%" }} /></div>
        </div>
        <div className="arena-lines" aria-hidden="true">
          <span className="ring r1"/><span className="ring r2"/><span className="ring r3"/>
          <span className="floor f1">.  ,   .   '  .   ,    .   '   .   ,  .</span>
          <span className="floor f2">___..-----''---.....----''----.....---''-----..___</span>
        </div>
        <pre className={`boss boss-3d boss-color-${bossType}${hitFlash ? " boss-hit" : ""}`} aria-label="실시간 3D ASCII 보스">{bossArt}</pre>
        {locked && <><span className="lock-corner tl">+</span><span className="lock-corner tr">+</span><span className="lock-corner bl">+</span><span className="lock-corner br">+</span></>}
        <span className="trail" style={{ left: shownPlayer.x + "%", top: shownPlayer.y + "%", opacity: rolling ? .35 : 0 }}>{"."}</span>
        <pre className={rolling ? "player rolling" : attackPhase ? "player attacking" : "player"} style={{ left: shownPlayer.x + "%", top: shownPlayer.y + "%" }}>{playerArt}</pre>
        <div className="status-message">{rolling ? "[ INVINCIBLE ]" : message}</div>
        <button className={locked ? "lock-button active" : "lock-button"} onClick={toggleLock}>[Q] {locked ? "TARGET LOCKED" : "FREE CAMERA"}</button>
        {locked && <div className="orbit-readout">ORBIT {Math.round(orbitAngle)}° · {absoluteAngle > 135 ? "BACK" : absoluteAngle > 45 ? "SIDE" : "FRONT"}</div>}
        <div className="hud">
          <div className="hudrow"><span>HP</span><div className="bar hp"><i /></div></div>
          <div className="hudrow"><span>ST</span><div className="bar stamina"><i style={{ width: stamina + "%" }} /></div></div>
        </div>
      </section>

      <section className="lesson">
        <div><span>01</span><b>초점 전환</b><small>Q를 눌러 보스 초점을 켜거나 끕니다.</small></div>
        <div><span>02</span><b>보스 선회</b><small>초점 중 A/D는 보스 주위를 돕니다.</small></div>
        <div><span>03</span><b>공격과 구르기</b><small>J로 공격, Space로 구릅니다.</small></div>
      </section>

      <div className="touch" aria-label="터치 조작 버튼">
        <div className="dpad">
          <button className="up" onPointerDown={() => press("w", true)} onPointerUp={() => press("w", false)}>^</button>
          <button className="left" onPointerDown={() => press("a", true)} onPointerUp={() => press("a", false)}>&lt;</button>
          <button className="down" onPointerDown={() => press("s", true)} onPointerUp={() => press("s", false)}>v</button>
          <button className="right" onPointerDown={() => press("d", true)} onPointerUp={() => press("d", false)}>&gt;</button>
        </div>
        <button className="focusbtn" onPointerDown={() => press("q", true)}>FOCUS<br/><small>Q</small></button>
        <button className="attackbtn" onPointerDown={() => press("j", true)}>ATTACK<br/><small>J</small></button>
        <button className="rollbtn" onPointerDown={() => press(" ", true)} onPointerUp={() => press(" ", false)}>ROLL<br/><small>SPACE</small></button>
      </div>
    </main>
  );
}
