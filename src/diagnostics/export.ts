import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

export async function exportDiagnosticLog(report: unknown): Promise<string> {
 const data = JSON.stringify(report, null, 2);
 const filename = `everpath-diagnostics-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
 if (Capacitor.isNativePlatform()) {
  const folder = 'everpath-diagnostics', path = `${folder}/${filename}`;
  const written = await Filesystem.writeFile({ path, directory: Directory.Cache, data, encoding: Encoding.UTF8, recursive: true });
  // Only our own cache exports are pruned; saves and user-selected copies are untouched.
  const entries = (await Filesystem.readdir({ path: folder, directory: Directory.Cache })).files
   .map(file => file.name).filter(name => /^everpath-diagnostics-.*\.json$/.test(name)).sort();
  await Promise.all(entries.slice(0, Math.max(0, entries.length - 5)).map(name => Filesystem.deleteFile({ path: `${folder}/${name}`, directory: Directory.Cache })));
  await Share.share({ title: 'EVERPATH 진단 로그', dialogTitle: '테스트 로그 저장 또는 공유', files: [written.uri] });
  return '공유 화면을 닫았습니다. 저장·전송 결과는 선택한 앱에서 확인하세요.';
 }
 const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
 const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; document.body.append(anchor); anchor.click(); anchor.remove();
 setTimeout(() => URL.revokeObjectURL(url), 30000);
 return 'JSON 다운로드를 요청했습니다.';
}
