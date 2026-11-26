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

it('restores a backup from before watch purchases without changing its old payments', () => {
 const old = parseSave(JSON.stringify({version:1, progressionEconomy:2, gold:800, invested:24,
  upgrades:{attack:1}, upgradePayments:{attack:[24],hp:[],speed:[],gold:[]}}));
 const legacy = JSON.parse(encodeBackup(old));
 delete legacy.save.upgrades.timeStop;
 delete legacy.save.upgradePayments.timeStop;
 expect(decodeBackup(JSON.stringify(legacy))).toEqual(old);
});

it('preserves the chosen BGM while keeping backups without a choice valid', () => {
 for (const bgm of [1,2,3] as const) {
  const withChoice = { ...save, settings: { ...save.settings, bgm } };
  expect(decodeBackup(encodeBackup(withChoice))).toEqual(withChoice);
 }
 expect(decodeBackup(encodeBackup(save)).settings.bgm).toBeUndefined();
});
