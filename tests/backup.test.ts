import { expect, it } from 'vitest';
import { decodeBackup, encodeBackup } from '../src/game/backup';
import { parseSave } from '../src/game/save';

const save = parseSave(JSON.stringify({ version: 1, progressionEconomy: 2, gold: 286, upgrades: { attack: 2, speed: 1 }, history: [{ runId: 'one', hero: 'mage', time: 618, kills: 1312 }] }));
it('round trips the full JSON save, including an older expedition without combat statistics', () => {
 expect(decodeBackup(encodeBackup(save))).toEqual(save);
});
it.each(['{}', '{bad', JSON.stringify({ format: 'everpath-backup', version: 2, save }),
 encodeBackup(save).replace('"gold": 286','"gold": -1'), encodeBackup(save).replace('"hero": "mage"','"hero": "other"')])('rejects incomplete, damaged or unsupported data %#', input => {
 expect(() => decodeBackup(input)).toThrow();
});
