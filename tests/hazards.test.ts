import { it, expect } from 'vitest';
import { GameSimulation } from '../src/game/simulation';
import { parseSave } from '../src/game/save';
it('stops delayed attacks after a fatal slam instead of awarding post-death XP and healing', () => {
 const sim = new GameSimulation('warrior', parseSave(null), () => .5); const p = sim.state.player; p.hp = 1; sim.state.xp = 14;
 const enemy = sim.spawnEnemy('slime', p.x + 80, p.y)!; enemy.hp = 1; enemy.speed = 0;
 sim.state.hazards.push(
  { id: 1000, x: p.x, y: p.y, radius: 94, delay: 0, life: .5, damage: 99, owner: 'enemy', kind: 'slam', fired: false },
  { id: 1001, x: enemy.x, y: enemy.y, radius: 50, delay: 0, life: .5, damage: 99, owner: 'player', kind: 'rain', fired: false },
 );
 sim.update(.05); expect(sim.state.status).toBe('gameover'); expect(p.hp).toBe(0); expect(sim.state.kills).toBe(0);
});
