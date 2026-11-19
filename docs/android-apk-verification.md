> 이 문서는 v0.1.0 최초 APK의 검증 기록입니다. 현재 v0.2.0 APK와 진단 모드 결과는 [진단 검증 기록](device-diagnostics-verification.md) 및 `artifacts/android/build-info.json`을 참고하세요.

# Android APK 검증 · 2026-11-18

## 산출물

- 파일: `artifacts/android/everpath-debug.apk`
- 패키지: `com.everpath.game`, 앱 이름: EVERPATH
- 버전: `0.1.0` / versionCode1, debug
- 크기: 4,609,205 bytes (약4.61MB)
- SHA-256: `e24a6fa0856f93bb0a5ddca45c1424534d9dce506abfaf3838dc60cb9b637e9d`
- APK Signature Scheme v2 검증 통과, 서명자1명. minSdk24이므로 v1 서명을 사용하지 않습니다.
- Android7(API24) 이상으로 manifest 설정, compileSdk/targetSdk36.

디버그 키는 로컬 Android 도구의 기본 키를 사용했습니다. 키 파일을 프로젝트나 전달 산출물에 복사하지 않았습니다. 이 APK는 폰에서 직접 설치하는 테스트용이며 스토어 배포/릴리스 서명은 수행하지 않았습니다.

## 사용한 빌드 환경

macOS arm64, Node26.0.0, npm11.12.1, Capacitor core/android/cli8.6.2, App8.1.2, JDK21.0.12.1, Gradle8.14.3, Android Gradle Plugin8.13.0, SDK36, Build Tools36.0.0.

`npm run android:apk`로 웹 타입 검사/빌드, Capacitor sync, Gradle assembleDebug, apksigner verify, APK 복사와 SHA-256 생성을 순서대로 실행했습니다. Gradle `BUILD SUCCESSFUL`, 서명 검증 `Verifies`를 확인했습니다.

## 수행한 검사

| 검사 | 결과 |
| --- | --- |
| `npm test` | 10개 파일, 56개 단위 테스트 통과 |
| 웹 브라우저 회귀 + 네이티브 콜백 UI 검사 | 6개 시나리오 통과 |
| `npm run build` | 타입 검사/Vite 빌드 성공 |
| `npm run android:doctor` | JDK21 / SDK36 정상 탐색 |
| `npm run android:apk` | APK 생성 및 서명 검증 성공 |
| `:app:connectedDebugAndroidTest` | 전용 Android16 에뮬레이터에서 패키지 ID 테스트1개 통과 |
| APK 내부 웹 파일 비교 | 현재 dist와 바이트 단위 일치 |
| APK 설정/테스트 코드 검사 | 원격 server.url 없음, e2e harness 포함 없음 |
| APK/SHA sidecar/build-info 비교 | SHA-256 및 크기 일치 |

Vite의 Phaser 포함 청크 크기 경고와 Capacitor Gradle 템플릿의 flatDir 경고는 남아 있지만 빌드는 성공했습니다.

## APK 자체 실행 검사

작업 전용 임시 AVD `everpath-api36`, Android16/API36, Android System WebView133.0.6943.137, 소프트웨어 GPU에서 실행했습니다. 연결된 실제 폰이나 기존 사용자 AVD는 검사 대상으로 사용하지 않았습니다.

- APK 설치 성공, `am start -W`의 Activity 실행 상태 `ok`.
- 에뮬레이터 Wi-Fi/모바일 데이터를 끄고 강제 종료 후 **오프라인 콜드 시작** 성공.
- 실제 네이티브 플랫폼 식별값 `android`, WebView origin `https://localhost` 확인.
- 타이틀의 픽셀 배경과 캐릭터 렌더링을 화면 캡처로 확인.
- native insets 처리와 `viewport-fit=contain`으로 상태/내비게이션 영역을 제외한 viewport393×778 확인.
- 궁수 선택 → 실제 전투 → 안드로이드 뒤로가기 키 → 일시정지 화면 확인.
- 전투 재개 → 홈 키 → Activity 복귀 시 정지 유지. 시간이 임의로 재개되지 않음.
- 원정 종료 후 강제 프로세스 종료/다시 시작 → 마지막 캐릭터 선택 저장 유지.
- 캐릭터 선택에서 뒤로가기 → 타이틀, 타이틀에서 뒤로가기 → Activity 최소화 확인.
- 해당 APK 검사 중 수집한 페이지 런타임 오류0.

원본은 `artifacts/android/validation/smoke-result.json`, 실제 시스템 화면은 `android-title.png`, WebView 정지 화면은 `android-pause-webview.png`에 보존했습니다.

Android WebView에서는 일반 데스크톱 CDP의 다운로드 컨텍스트 설정을 지원하지 않아 최초 진단 도구 연결이 실패했습니다. Playwright의 `connectOverCDP(..., { noDefaults: true })`로 불필요한 데스크톱 설정을 생략해 실제 APK 검사를 완료했습니다. 앱 코드 실패가 아니라 진단 연결 방식의 차이였으며 실패를 통과로 보고하지 않았습니다.

## 변경과 검토

- 네이티브 앱 이벤트를 UI/게임 시뮬레이션과 별도 모듈로 연결했습니다.
- `pause`/비활성 이벤트는 입력 초기화, 전투 정지, 저장, AudioContext 정지로 전달합니다.
- 활성 복귀가 전투를 자동 재개하지 않습니다. 사용자가 직접 재개합니다.
- 뒤로가기는 메뉴/일시정지를 처리하고 필수 레벨업을 넘기지 않습니다.
- 앱의 고유 벡터 아이콘, 어두운 시작 화면, 세로 방향 manifest를 설정했습니다.
- 빌드/설치 스크립트는 지정된 JAVA_HOME을 존중하며 JDK21이 아니면 원인을 표시합니다. 여러 기기/미승인 기기에 임의 설치하지 않습니다.
- 별도 읽기 전용 검토에서 발견한 생성 템플릿의 잘못된 패키지 테스트를 앱 ID에 맞는 실제 기기 테스트로 교체해 통과를 확인했습니다.

## 범위와 재현

실제 Android 폰의 FPS·발열·배터리·오디오 출력·기기별 터치 지연은 아직 측정하지 않았습니다. 이번 네이티브 검사는 에뮬레이터의 설치/시작/생명주기/저장 검사이며, 장기 실기기 성능 검증과 구분합니다. Windows 빌드/설치 분기는 정적으로 검토했으며 실행한 환경은 macOS입니다.

자세한 빌드·USB/파일 설치·업데이트·Android Studio 방법은 [README](../README.md#android-폰에서-테스트하기)에 있습니다. SDK와 JDK는 전역 설정을 바꾸지 않고 빌드 프로세스의 환경변수로 전달합니다. 임시 검사용 AVD는 검증 후 종료합니다.
