# EVERPATH 전투곡

이 곡은 EVERPATH용으로 편곡한 48마디 원곡입니다. 154 BPM으로 연주하며 현악과 피치카토, 호른과 트럼펫, 오보에와 플루트, 하프, 합창, 글로켄슈필, 브라스, 팀파니와 드럼을 스테레오로 섞습니다. 악기 음원은 S. Christian Collins의 [GeneralUser GS](https://www.schristiancollins.com/generaluser.php)를 사용합니다. 게임에는 렌더링한 곡을 포함합니다.

macOS에서 저장소 루트 기준으로 재생성할 수 있습니다. SoundFont 파일 경로는 내려받은 파일에 맞추세요.

```sh
python3 scripts/music/compose.py /tmp/everpath-score.json
swift scripts/music/render.swift /tmp/everpath-score.json /tmp/GeneralUser-GS.sf2 /tmp/everpath-battle.wav
afconvert -f m4af -d 'aac ' -b 144000 -q 127 /tmp/everpath-battle.wav public/audio/everpath-battle.m4a
```

모르바 전투의 전용곡은 166 BPM, 약 46초입니다. 같은 명령에서 작곡 단계의 마지막 인자로 `warden`을 주고 최종 파일명을 `public/audio/everpath-warden.m4a`로 지정하면 됩니다.
