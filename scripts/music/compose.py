"""Original EVERPATH battle score in D minor. Emits notes for render.swift."""
import json
import sys
from pathlib import Path

TEMPO = 138
BAR_COUNT = 32
events = []
# Note order follows the sampler program order in render.swift.
STRINGS, LOW_STRINGS, HORNS, TRUMPETS, WOODS, TIMPANI, HARP, KIT = range(8)
chords = [
    (38, 50, 53, 57), (34, 50, 53, 58), (41, 48, 53, 57), (36, 48, 52, 55),
    (38, 50, 53, 57), (34, 50, 53, 58), (31, 50, 55, 58), (33, 49, 52, 57),
]
# Four-beat phrases, written as (beat, length, MIDI note).
themes = [
    [(0, 1.5, 62), (1.5, .5, 65), (2, 1, 69), (3, .5, 72), (3.5, .5, 69)],
    [(0, 1, 70), (1, .5, 69), (1.5, .5, 65), (2, 1.5, 62), (3.5, .5, 65)],
    [(0, 1.5, 69), (1.5, .5, 72), (2, 1, 77), (3, .5, 76), (3.5, .5, 72)],
    [(0, 1, 67), (1, 1, 72), (2, .75, 76), (2.75, .75, 74), (3.5, .5, 72)],
    [(0, 1.5, 74), (1.5, .5, 72), (2, 1, 69), (3, .5, 65), (3.5, .5, 69)],
    [(0, 1, 70), (1, .5, 72), (1.5, .5, 74), (2, 1.5, 77), (3.5, .5, 74)],
    [(0, 1.5, 79), (1.5, .5, 77), (2, .75, 74), (2.75, .75, 70), (3.5, .5, 67)],
    [(0, 1, 69), (1, .5, 73), (1.5, .5, 76), (2, 1.65, 69)],
]

def play(part, beat, length, pitch, velocity):
    events.append([part, beat * 60 / TEMPO, length * 60 / TEMPO, pitch, velocity])

for bar in range(BAR_COUNT):
    section, phrase = divmod(bar, 8)
    start = bar * 4
    root, low, mid, high = chords[phrase]
    bright = section in (1, 3)
    contrast = section == 2
    for beat, pitch in [(0, root), (1, root+12), (1.5, root), (2, root), (3, root+7), (3.5, root)]:
        play(LOW_STRINGS, start+beat, .28 if beat % 1 else .6, pitch, 82 if beat in (0, 2) else 69)
    arp = [low, high, mid, high+12, low+12, high, mid+12, high]
    for i, pitch in enumerate(arp):
        play(STRINGS, start+i*.5, .34, pitch, (79 if bright else 70) + (9 if i % 4 == 0 else 0))
    for beat, length, pitch in themes[phrase]:
        play(WOODS if contrast else HORNS, start+beat, length*.89, pitch+(12 if contrast else 0), 91 if bright else 84)
        if bright and length > .7:
            play(TRUMPETS, start+beat, length*.82, pitch, 81)
    for beat in ([0, 2, 3.5] if bright else [0, 2]):
        play(TIMPANI, start+beat, .42, root+5, 103 if beat == 0 else 84)
    for beat, key, velocity in [(0, 36, 110), (1, 40, 74), (2, 36, 92), (3, 40, 84)]:
        play(KIT, start+beat, .21, key, velocity if not contrast else velocity-14)
    if bar % 4 == 0:
        play(KIT, start, 1.25, 49, 88)
    if phrase in (3, 7):
        for i in range(4):
            play(KIT, start+3+i*.25, .15, 40, 53+i*11)
    if contrast or phrase in (1, 5):
        for i, pitch in enumerate([low+12, mid+12, high+12, high+24]):
            play(HARP, start+.5+i*.5, .72, pitch, 73)

Path(sys.argv[1]).write_text(json.dumps({"duration": BAR_COUNT * 4 * 60 / TEMPO, "events": events}))
