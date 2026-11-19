# EVERPATH 전투곡

이 곡은 EVERPATH용으로 편곡한 32마디 원곡입니다. 138 BPM으로 연주하며 현악 오스티나토, 호른 주제, 트럼펫, 목관, 하프, 팀파니와 드럼을 스테레오로 섞습니다. 악기 음원은 S. Christian Collins의 [GeneralUser GS](https://www.schristiancollins.com/generaluser.php)를 사용합니다. 게임에는 렌더링한 곡을 포함합니다.

macOS에서 저장소 루트 기준으로 재생성할 수 있습니다. SoundFont 파일 경로는 내려받은 파일에 맞추세요.

```sh
python3 scripts/music/compose.py /tmp/everpath-score.json
swift scripts/music/render.swift /tmp/everpath-score.json /tmp/GeneralUser-GS.sf2 /tmp/everpath-battle.wav
afconvert -f m4af -d 'aac ' -b 144000 -q 127 /tmp/everpath-battle.wav public/audio/everpath-battle.m4a
```
