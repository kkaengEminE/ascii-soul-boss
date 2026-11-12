"use client";

import { useEffect, useRef, useState } from "react";
import { createGame, type GameHandle } from "./souls-engine";

const names = ["재의 기사", "철벽의 파수꾼", "가시 왕"];
export default function Home() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const game = useRef<GameHandle | null>(null);
  const [model, setModel] = useState(0);
  const [combat, setCombat] = useState(false);
  const [hud, setHud] = useState({ hp:100, stamina:100, boss:100, locked:true, message:"보스에게 다가가 검을 휘둘러 보세요", action:"대기" });
  useEffect(() => {
    if (!canvas.current) return;
    game.current = createGame(canvas.current, setHud);
    return () => game.current?.dispose();
  }, []);
  return <main className="shell">
    <header><div><span className="eyebrow">ASCII SOULS / COMBAT STUDY</span><h1>재의 안뜰 <small>01</small></h1></div><button onClick={() => game.current?.reset()}>↺ 정면 초기화 · R</button></header>
    <nav aria-label="보스 선택">{names.map((name,i) => <button key={name} aria-pressed={model===i} className={model===i?"selected":""} onClick={() => {setModel(i);game.current?.model(i);}}><small>0{i+1}</small> {name}</button>)}<button className="combat-toggle" aria-pressed={combat} onClick={() => {setCombat(!combat);game.current?.combat(!combat);}}>{combat?"반격 켜짐":"연습 모드 · 반격 꺼짐"}</button></nav>
    <section className="game" aria-label="3D ASCII 전투 연습장">
      <canvas ref={canvas} aria-label="WASD 이동, J 공격, K 강공격, 스페이스 회피, Q 락온" />
      <div className="vignette" />
      <div className="player-hud"><span className="sigil">♜</span><div><label>HP <meter min="0" max="100" value={hud.hp}/></label><label>ST <meter className="stamina" min="0" max="100" value={hud.stamina}/></label></div></div>
      <div className="mode">{hud.locked?"◈ LOCKED ON":"◇ FREE MOVE"}<small>{hud.action}</small></div>
      <div className="message" role="status">{hud.message}</div>
      <div className="boss-hud"><div><span>{names[model]}</span><small>{combat?"COMBAT":"TRAINING"} / {Math.ceil(hud.boss)} HP</small></div><div className="boss-track"><i style={{width:`${hud.boss}%`}}/></div></div>
    </section>
    <footer><div><kbd>W A S D</kbd><span>이동 / 락온 중 선회</span></div><div><kbd>J</kbd><span>약공격 · 두 번 눌러 연계</span></div><div><kbd>K</kbd><span>강공격</span></div><div><kbd>SPACE</kbd><span>방향 회피</span></div><div><kbd>Q</kbd><span>락온 전환</span></div></footer>
    <div className="touch" aria-label="터치 조작">{[["↑","KeyW"],["←","KeyA"],["↓","KeyS"],["→","KeyD"],["공격","KeyJ"],["강공격","KeyK"],["회피","Space"],["초점","KeyQ"]].map(([label,code])=><button key={code} onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);game.current?.input(code,true);}} onPointerUp={()=>game.current?.input(code,false)} onPointerCancel={()=>game.current?.input(code,false)}>{label}</button>)}</div>
    <p className="note">검이 닿는 거리에서 공격하세요. 회피 초반에는 무적, 공격 회복 중에는 이동이 느려집니다. 반격을 켜면 보스의 붉은 준비 동작을 보고 피할 수 있습니다.</p>
  </main>;
}
