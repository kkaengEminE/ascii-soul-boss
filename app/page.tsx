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

type Point = { x: number; y: number };
type Held = Record<string, boolean>;

export default function Home() {
  const [player, setPlayer] = useState<Point>({ x: 50, y: 82 });
  const playerRef = useRef(player);
  const [stamina, setStamina] = useState(100);
  const staminaRef = useRef(stamina);
  const [rolling, setRolling] = useState(false);
  const rollingRef = useRef(false);
  const [facing, setFacing] = useState("^");
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
      move(direction.current.x, direction.current.y, 3.1);
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
  }, [move]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)) e.preventDefault();
      held.current[key] = true;
      if (key === " ") roll();
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
        if (dx || dy) move(dx, dy, 0.48 * dt);
      }
      if (!rollingRef.current && staminaRef.current < 100) {
        staminaRef.current = Math.min(100, staminaRef.current + 0.22 * dt);
        setStamina(staminaRef.current);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, [move, roll]);

  const press = (key: string, active: boolean) => {
    held.current[key] = active;
    if (key === " " && active) roll();
  };

  return (
    <main className="shell">
      <header className="topbar">
        <div><span className="rune">[ ASCII SOULS ]</span><h1>움직임 튜토리얼</h1></div>
        <div className="hint"><kbd>WASD</kbd> 이동 <kbd>SPACE</kbd> 구르기</div>
      </header>

      <section className="game" aria-label="ASCII 소울라이크 이동 연습장">
        <div className="grain" />
        <div className="boss-ui">
          <span>THE ASHEN KNIGHT</span>
          <div className="bar bossbar"><i /></div>
        </div>
        <div className="arena-lines" aria-hidden="true">
          <span className="ring r1"/><span className="ring r2"/><span className="ring r3"/>
          <span className="floor f1">.  ,   .   '  .   ,    .   '   .   ,  .</span>
          <span className="floor f2">___..-----''---.....----''----.....---''-----..___</span>
        </div>
        <pre className="boss" aria-label="고정된 보스">{BOSS}</pre>
        <span className="trail" style={{ left: player.x + "%", top: player.y + "%", opacity: rolling ? .35 : 0 }}>{"."}</span>
        <div className={rolling ? "player rolling" : "player"} style={{ left: player.x + "%", top: player.y + "%" }}>
          <span className="weapon">/</span><b>@</b><span className="face">{facing}</span>
        </div>
        <div className="status-message">{rolling ? "[ INVINCIBLE ]" : message}</div>
        <div className="hud">
          <div className="hudrow"><span>HP</span><div className="bar hp"><i /></div></div>
          <div className="hudrow"><span>ST</span><div className="bar stamina"><i style={{ width: stamina + "%" }} /></div></div>
        </div>
      </section>

      <section className="lesson">
        <div><span>01</span><b>이동</b><small>보스 주변을 자유롭게 돌아보세요.</small></div>
        <div><span>02</span><b>거리 유지</b><small>보스 몸에는 부딪힐 수 없습니다.</small></div>
        <div><span>03</span><b>구르기</b><small>이동 중 Space. 스태미나 28 소모.</small></div>
      </section>

      <div className="touch" aria-label="터치 조작 버튼">
        <div className="dpad">
          <button className="up" onPointerDown={() => press("w", true)} onPointerUp={() => press("w", false)}>^</button>
          <button className="left" onPointerDown={() => press("a", true)} onPointerUp={() => press("a", false)}>&lt;</button>
          <button className="down" onPointerDown={() => press("s", true)} onPointerUp={() => press("s", false)}>v</button>
          <button className="right" onPointerDown={() => press("d", true)} onPointerUp={() => press("d", false)}>&gt;</button>
        </div>
        <button className="rollbtn" onPointerDown={() => press(" ", true)} onPointerUp={() => press(" ", false)}>ROLL<br/><small>SPACE</small></button>
      </div>
    </main>
  );
}
