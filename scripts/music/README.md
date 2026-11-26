# EVERPATH 전투곡

이 곡은 EVERPATH용으로 편곡한 48마디 원곡입니다. 154 BPM으로 연주합니다. 호른과 트럼펫이 주선율을 맡고, 구간마다 비올라의 화음과 클라리넷의 응답, 바순의 낮은 리듬, 첼레스타의 분산화음이 들어옵니다. 현악과 피치카토, 오보에와 플루트, 하프, 합창, 글로켄슈필, 브라스, 팀파니와 드럼도 스테레오로 섞습니다. 악기 음원은 S. Christian Collins의 [GeneralUser GS](https://www.schristiancollins.com/generaluser.php)를 사용합니다. 게임에는 렌더링한 곡을 포함합니다.

macOS에서 저장소 루트 기준으로 재생성할 수 있습니다. SoundFont 파일 경로는 내려받은 파일에 맞추세요.

```sh
python3 scripts/music/compose.py /tmp/everpath-score.json
swift scripts/music/render.swift /tmp/everpath-score.json /tmp/GeneralUser-GS.sf2 /tmp/everpath-battle.wav
afconvert -f m4af -d 'aac ' -b 144000 -q 127 /tmp/everpath-battle.wav public/audio/everpath-battle.m4a
```

모르바 전투의 전용곡은 166 BPM, 약 46초입니다. 낮은 바순 리듬과 후반의 클라리넷 응답, 중간 구간의 비올라·첼레스타를 추가했습니다. 같은 명령에서 작곡 단계의 마지막 인자로 `warden`을 주고 최종 파일명을 `public/audio/everpath-warden.m4a`로 지정하면 됩니다.

## 미니 월드 로컬 시안

`compose-mini.py`는 144 BPM의 숲 탐험곡과 6박 단위의 모르바전 음악을 만듭니다. 기존과 같은 GeneralUser GS 샘플러를 사용합니다. 제작자 사이트와 라이선스는 위 링크에서 확인할 수 있습니다.

```sh
python3 scripts/music/compose-mini.py /tmp/everpath-mini-score.json battle
swift scripts/music/render.swift /tmp/everpath-mini-score.json /tmp/GeneralUser-GS.sf2 /tmp/everpath-mini.wav
afconvert -f m4af -d 'aac ' -b 144000 -q 127 /tmp/everpath-mini.wav public/audio/everpath-mini-battle.m4a
```

모르바 곡은 작곡 인자를 `warden`으로, 파일명을 `everpath-mini-warden.m4a`로 바꿉니다. 개발 서버 `/dev/mini-sound.html`에서 기존 곡과 시안을 비교합니다.

작곡 인자 `reprise`로 기존 탐험곡의 8마디 주선율과 화성이 약 13초 지점에 나오는 80초 편곡을 만들 수 있습니다. 공통 악보는 `classic_theme.py`에 있습니다. 렌더링한 파일명은 `everpath-mini-reprise.m4a`입니다. 게임 설정에서 BGM 1(미니 월드), BGM 2(후렴 편곡), BGM 3(예전 원곡)을 선택할 수 있습니다. BGM 3은 기존 `everpath-battle.m4a`를 재생합니다. 선택은 저장되며 모르바전에서는 전용곡이 재생됩니다.
