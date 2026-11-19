# Android 진단 모드 검증 · 2026-11-18

## 결과와 범위

v0.2.0 / versionCode2 / `com.everpath.game`에 선택형 진단 화면과 전투 HUD, JSON 파일 내보내기를 추가했다. 기본 수집은 꺼져 있고 켜기 설정만 별도 localStorage 키로 보관한다. 게임 저장 스키마와 패키지 ID는 유지했다.

실제 폰은 연결되지 않았다. Android16/API36 ARM64 에뮬레이터와 Chrome 모바일 뷰포트로 기능을 검증했다. 에뮬레이터의 SwiftShader 렌더링 수치는 폰의 성능·발열·배터리 결과로 해석하지 않는다. 실제 폰에서는 README 순서대로 진단을 켜고 영웅별 5~10분 로그를 내보내 비교할 수 있다.

## 측정 계약

- 별도 requestAnimationFrame 수집기로 원시 콜백 간격을 측정한다. 게임 시뮬레이션의 50ms 제한과 Phaser FPS 보정값을 사용하지 않는다. 최근 약1초의 FPS·평균·p95·최대, 33.3/50/100ms 초과 횟수와 엔티티 수/영웅/전투 경과를 기록한다. 전체/전투 진행 중 누적 통계는 분리한다. 누적 p95를 창별 p95의 평균으로 계산하지 않는다.
- 입력 대기는 수락한 이동 이벤트 타임스탬프부터 다음 실행 중 시뮬레이션 갱신까지 측정한다. 일시정지·메뉴 입력/보조 손가락은 타이밍에서 제외한다. 전투 상태 전환과 포커스/백그라운드 시 미처리 입력을 비운다. 물리적 접촉/디스플레이 표시 지연은 계측하지 않는다.
- 보조 손가락의 거부 이벤트와 손가락 수는 남긴다. 주 손가락만 떼면 남아 있는 손가락 수는 유지하되 이동을 인계하지 않는다. 취소·캡처 해제·blur·resize·일시정지 초기화를 기록한다. 메모 입력에서 게임 이동 키를 처리하지 않는다.
- foreground/native/focus/visibility 중 하나라도 비활성이면 수집을 멈춘다. 복귀 시 새 프레임 기준점을 잡고 백그라운드 시간을 통계에서 제외한다. 전투는 사용자가 직접 재개한다.
- 구간 요약1,800개와 이벤트4,000개를 원형 버퍼에 보관하고 이동 로그는5Hz, 입력 타이밍 큐는32개로 제한한다. 한도 초과 수와 총 누적 통계는 별도 보관한다. HUD 갱신은 최대4Hz이며 전체 로그를 매 프레임 복사하지 않는다.
- 앱/기기 메타데이터는 모델·제조사·OS/SDK/WebView 버전과 화면 정보로 한정한다. 고유 기기 ID·기기 이름·전체 세이브·임의 키 입력 문자는 저장하지 않는다. JSON은 로컬 생성하며 외부 전송은 사용자가 공유 앱을 선택할 때만 발생한다.

## 자동 검사

`npm test`: **65개 / 11파일 통과**. 원시80ms 프레임이 제한되지 않고 p95/최대에 반영되는지, 배경9,980ms가 제외되는지, 전투/메뉴 통계 분리, 입력 수락/거부/정지, 큐와 원형 버퍼 한도, 스냅샷 독립성, 비정상 타임스탬프를 검사했다. 두 손가락 중 주 손가락만 해제하는 관측 테스트와 native resume 후 전투 정지 유지 테스트를 추가했다.

`PLAYWRIGHT_CHANNEL=chrome npm run test:e2e`: **8개 통과**. 새2개 시나리오는 기본 꺼짐→켜기→궁수 전투→실제 브라우저 touch start/move/cancel→HUD→일시정지→메모/JSON 다운로드→기록 중단 후 보존→새 기록 초기화→켜기 설정 재실행 유지, 320×568 세로 스크롤/내보내기를 검사했다. 일시정지 중 WASD 입력과1.3초 대기가 재개 후 입력 대기 스파이크로 섞이지 않는지도 확인했다. 기존 전투·세 영웅·저장·상점·터치·native shell 시나리오도 통과했다.

## Android APK 기능 검사

작업 전용 Pixel5 프로필/API36 에뮬레이터에 APK를 설치했다. 개인 폰을 선택하거나 조작하지 않았다. Wi-Fi와 데이터를 끈 채 내장 WebView `https://localhost`에서 실행했다.

- 설정에서 진단을 켜고 정상 궁수 전투에서 FPS·프레임 간격·입력 대기와 DRAG/IDLE 표시를 확인했다.
- 홈으로 보낸 뒤 복귀하면 전투는 일시정지 상태를 유지하고 백그라운드 시간이 별도로 집계됐다.
- Filesystem의 앱 캐시에 UTF-8 JSON 파일이 생성되고 Android 시스템 ChooserActivity가 열렸다. 파일 URI는 FileProvider의 content URI로 공유되며 파일 읽기 권한을 전달한다. 저장소 권한 다이얼로그가 필요하지 않았다.
- `run-as`로 작업용 debug 앱 캐시의 JSON을 읽어 앱 버전0.2.0/build2, Android16/SDK36, WebView 버전, 가상 기기 표시, 전투 프레임/입력 타이밍/제외 시간, 오류 이벤트 부재를 검사했다.
- 공유 화면을 취소하고6회 내보낸 뒤 캐시가 최근5개 파일로 제한되는지 확인했다. 공유 대상 앱에 파일을 전송하지 않았다. 사용자가 저장을 완료했다고 오인하지 않도록 공유 화면 종료와 저장 완료를 구분한다.

원본은 `artifacts/android/validation/diagnostics-native-export.json`, `diagnostics-result.json`, `diagnostics-share-activity.txt`, `diagnostics-android-hud.png`, `diagnostics-android-panel.png`에 보관한다. 검증 스크립트는 같은 폴더의 `diagnostics-smoke.mjs`이며 작업용 에뮬레이터만 대상으로 한다. 산출물 폴더는 gitignore 대상이다.

## 빌드 및 전달

`npm run android:apk`로 TypeScript 검사, Vite 프로덕션 빌드, Capacitor sync, Gradle assembleDebug 및 apksigner 검증을 실행했다. 공식 App/Device/Filesystem/Share 플러그인4개를 포함한다. 최종 APK와 SHA-256은 `artifacts/android/everpath-debug.apk`, `.apk.sha256`, `build-info.json`에서 확인한다. 폰 설치·업데이트·재빌드·진단 사용법은 README에 정리했다.

Vite의500KB 청크 경고와 Gradle flatDir 경고는 기존 도구 구성 경고이며 빌드는 성공했다. 스토어 배포용 서명과 실제 폰 성능 계측은 이번 검증 범위에 포함하지 않았다.

최종 전달 파일: **4,756,572 bytes**, SHA-256 **`55b8e837f3258d19ce7e1080dc010087cac84915298c5486b6cd9038b1a4ecda`**. APK 내부 모든 `assets/public` 파일이 현재 `dist` 산출물과 바이트 단위로 일치함을 검사했다.

최종 APK 재설치 후 네이티브 검증 재실행: 전투 프레임 121개와 입력 타이밍 관측, 백그라운드 2,374ms 제외, 공유 화면 열기/취소 및 캐시5개 유지, 런타임 오류0개를 확인했다. 작업용 에뮬레이터는 검증 후 종료했다.
