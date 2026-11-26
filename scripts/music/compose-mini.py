"""EVERPATH Mini World score in two movements for the existing orchestral renderer."""
import json
import sys
from pathlib import Path

warden = sys.argv[2] == 'warden'
tempo, beats, bars = (156, 6, 20) if warden else (144, 4, 40)
events = []
STRINGS, CELLO, HORNS, TRUMPET, OBOE, TIMPANI, HARP, FLUTE, PIZZ, CHOIR, BELLS, BRASS, VIOLA, CLARINET, BASSOON, CELESTA, KIT = range(17)


def play(part, beat, duration, midi, velocity):
    seconds = 60 / tempo
    events.append((part, beat * seconds, duration * seconds, midi, velocity))


forest_harmony = [
    (43, 55, 59, 62), (50, 54, 57, 62), (40, 55, 59, 64), (48, 55, 60, 64),
    (43, 55, 59, 62), (45, 57, 60, 64), (48, 55, 60, 64), (50, 54, 57, 60),
]
forest_theme = [
    (67, 71, 74, 76, 74), (69, 74, 78, 76, 74), (71, 76, 79, 78, 76), (72, 67, 76, 74, 72),
    (74, 71, 67, 69, 71), (72, 76, 81, 79, 76), (79, 76, 74, 72, 69), (74, 69, 66, 69, 74),
]
warden_harmony = [
    (38, 53, 57, 62), (36, 52, 55, 62), (34, 53, 58, 62), (33, 49, 55, 64),
    (43, 50, 55, 58), (39, 55, 58, 63), (38, 53, 57, 62), (33, 49, 57, 64),
    (34, 53, 58, 65), (33, 49, 55, 64),
]
for bar in range(bars):
    beat = bar * beats
    if warden:
        root, third, fifth, top = warden_harmony[bar % len(warden_harmony)]
        response = 7 <= bar % 10 <= 9
        for i, note in enumerate((root, root + 12, root, fifth - 12, root, root + 12)):
            play(CELLO, beat + i, .59, note, 106 if i in (0, 3) else 80)
        for i, note in enumerate((third, top, fifth, top + 12, third + 12, fifth)):
            play(STRINGS, beat + i + .45, .42, note, 84 + (i % 3 == 0) * 13)
        for at, length, note in ((0, 1.65, top), (2, .72, fifth), (3, 1.35, third), (4.5, .8, top + 12)):
            play(TRUMPET if bar >= 10 else HORNS, beat + at, length, note, 97 if not response else 84)
        for note in (third, fifth, top):
            play(CHOIR, beat + .05, 5.56, note, 64 if bar >= 10 else 53)
        for at, note in ((0, 36), (2.5, 43), (3, 38), (5, 41)):
            play(KIT, beat + at, .21, note, 109 if at in (0, 3) else 82)
        play(TIMPANI, beat, .55, root + 12, 106)
        play(BASSOON, beat + 3.5, .8, root + 12, 85)
        if response or bar >= 14:
            for at, note in ((1, top + 12), (2.5, fifth + 12), (4, third + 12)):
                play(BELLS if response else FLUTE, beat + at, .36, note, 73)
        if bar in (0, 5, 10, 15):
            play(KIT, beat, .9, 49, 104)
        continue

    section, phrase = divmod(bar, 8)
    root, low, mid, high = forest_harmony[phrase if section != 2 else (phrase + 4) % 8]
    full = section in (1, 3, 4)
    lead = (FLUTE, HORNS, CLARINET, OBOE, TRUMPET)[section]
    notes = forest_theme[phrase if section != 2 else (phrase + 4) % 8]
    for (at, length), note in zip(((0, .67), (.75, .62), (1.5, .43), (2, .88), (3, .71)), notes):
        play(lead, beat + at, length, note, 97 if full else 89)
    for i, note in enumerate((low, high, mid, high, low + 12, mid, high + 12, mid + 12)):
        play(PIZZ if section == 2 else STRINGS, beat + i * .5, .3, note, 73 + 11 * (i % 3 == 0))
        if full and i in (1, 3, 5, 7):
            play(HARP, beat + i * .5 + .12, .37, note + 12, 72)
    for at, note in ((0, root), (1.5, root + 12), (2, root), (3.25, root + 7)):
        play(CELLO, beat + at, .47, note, 93 if at in (0, 2) else 79)
    if section in (0, 2, 3, 4):
        ornament = CELESTA if section == 2 else CLARINET if section == 0 else FLUTE
        for at, note in ((1.05, high + 12), (2.55, low + 12), (3.45, mid + 12)):
            play(ornament, beat + at, .35, note, 78)
    if full:
        for at in (0, 2.75):
            for note in (low, mid, high):
                play(VIOLA if section != 4 else BRASS, beat + at, .41, note, 80)
        play(TIMPANI, beat, .38, root + 12, 89)
    for at, note, intensity in ((0, 36, 102), (.5, 42, 65), (1, 38, 83), (2, 36, 93), (2.5, 42, 70), (3, 38, 89)):
        play(KIT, beat + at, .17, note, intensity - (14 if section == 2 else 0))
    if phrase in (3, 7):
        for i, note in enumerate((high + 12, mid + 12, high + 24)):
            play(BELLS, beat + 2.9 + i * .31, .2, note, 70)

Path(sys.argv[1]).write_text(json.dumps({'duration': bars * beats * 60 / tempo, 'events': events}))
