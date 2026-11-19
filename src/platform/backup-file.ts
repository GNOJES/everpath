import { Capacitor, registerPlugin } from '@capacitor/core';

const documents = registerPlugin<{ create(options: { filename: string; text: string }): Promise<{ saved: boolean }> }>('BackupDocument');

export async function exportBackupFile(text: string) {
 const filename = 'everpath-backup-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json';
 if (Capacitor.getPlatform() === 'android') {
  const { saved } = await documents.create({ filename, text });
  return saved ? '선택한 위치에 백업 파일을 저장했습니다.' : '백업을 취소했습니다.';
 }
 const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
 const link = document.createElement('a');
 link.href = url;
 link.download = filename;
 document.body.append(link);
 link.click();
 link.remove();
 setTimeout(() => URL.revokeObjectURL(url), 30000);
 return 'JSON 백업 파일 다운로드를 요청했습니다.';
}
