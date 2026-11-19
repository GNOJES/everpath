import { parseSave } from './save';
import type { SaveData } from './types';

export const backupLimit = 1024 * 1024;
export function encodeBackup(save: SaveData) {
 return JSON.stringify({ format: 'everpath-backup', version: 1, save }, null, 2);
}

// parseSave tolerates damaged local data at boot. A user-selected backup must
// survive that same decoder losslessly before it can replace a working save.
function canonical(value: unknown): string {
 return JSON.stringify(value, (_, v) => v && typeof v === 'object' && !Array.isArray(v)
  ? Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]])) : v);
}
export function decodeBackup(text: string): SaveData {
 if (text.length > backupLimit) throw new Error('백업 파일이 너무 큽니다.');
 const input = JSON.parse(text);
 if (input?.format !== 'everpath-backup' || input.version !== 1 || !input.save) throw new Error('지원하지 않는 백업입니다.');
 const { upgrades, upgradePayments } = input.save;
 if (upgrades && typeof upgrades === 'object' && !Array.isArray(upgrades) && !Object.hasOwn(upgrades, 'timeStop')) {
  upgrades.timeStop = 0;
  if (upgradePayments && typeof upgradePayments === 'object' && !Object.hasOwn(upgradePayments, 'timeStop')) upgradePayments.timeStop = [];
 }
 const data = parseSave(JSON.stringify(input.save));
 if (canonical(data) !== canonical(input.save)) throw new Error('저장 데이터가 손상되었습니다.');
 return data;
}
