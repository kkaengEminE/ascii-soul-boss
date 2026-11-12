import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function setup() {
  let frame, hud, now=0;
  const context={fillRect(){},fillText(){},setTransform(){}};
  const sandbox={exports:{},Math,Float32Array,Uint8Array,Set,window:{devicePixelRatio:1,addEventListener(){},removeEventListener(){}},ResizeObserver:class{observe(){}disconnect(){}},requestAnimationFrame(fn){frame=fn;return 1;},cancelAnimationFrame(){}};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../app/souls-engine.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,sandbox);
  const game=sandbox.exports.createGame({getContext:()=>context,getBoundingClientRect:()=>({width:500,height:420})}, value=>hud=value);
  const step=(seconds)=>{for(let i=0;i<Math.ceil(seconds*60);i++){now+=1000/60;frame(now);}};
  const tap=(code)=>{game.input(code,true);game.input(code,false);};
  step(.1);return {game,step,tap,get hud(){return hud;}};
}
test('attack spends stamina, misses at distance, then hits after approach',()=>{
  const s=setup();s.tap('KeyJ');s.step(.5);assert.equal(s.hud.boss,100);assert.ok(s.hud.stamina<100);
  s.game.reset();s.game.input('KeyW',true);s.step(1.5);s.game.input('KeyW',false);s.tap('KeyJ');s.step(.5);assert.equal(s.hud.boss,92);
  s.game.reset();s.step(.1);assert.equal(s.hud.boss,100);assert.equal(s.hud.stamina,100);
});
test('lock toggle, roll cost, recovery and optional boss counterattack',()=>{
  const s=setup();s.tap('KeyQ');s.step(.1);assert.equal(s.hud.locked,false);s.tap('Space');s.step(.15);assert.ok(s.hud.stamina<=75);assert.equal(s.hud.action,'회피');
  s.step(2);assert.equal(s.hud.action,'대기');s.game.reset();s.game.input('KeyW',true);s.step(1.5);s.game.input('KeyW',false);s.game.combat(true);s.step(3);assert.equal(s.hud.hp,78);
  s.game.reset();s.step(.1);assert.equal(s.hud.hp,100);assert.equal(s.hud.locked,true);s.game.dispose();
});
