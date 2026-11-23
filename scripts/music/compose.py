"""Original EVERPATH battle score in D minor. Emits notes for render.swift."""
import json
import sys
from pathlib import Path

warden = len(sys.argv) > 2 and sys.argv[2] == "warden"
TEMPO = 166 if warden else 154
BAR_COUNT = 32 if warden else 48
events = []
# Note order follows the sampler program order in render.swift.
STRINGS, LOW_STRINGS, HORNS, TRUMPETS, WOODS, TIMPANI, HARP, FLUTE, PIZZ, CHOIR, BELLS, BRASS, VIOLA, CLARINET, BASSOON, CELESTA, KIT = range(17)
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

if warden:
    progression = [(38, 53, 57, 62), (34, 53, 58, 65), (39, 55, 58, 63), (33, 52, 55, 61),
                   (38, 53, 57, 62), (31, 50, 58, 67), (34, 53, 58, 65), (33, 49, 55, 61)]
    for bar in range(BAR_COUNT):
        section, phrase = divmod(bar, 8)
        start = 4 * bar
        root, third, fifth, octave = progression[phrase]
        for i in range(8):
            play(LOW_STRINGS, start+i*.5, .31, root if i % 3 else root+12, 106 if i in (0,3,6) else 78)
            if section != 2 or i % 2 == 0:
                play(STRINGS, start+i*.5, .31, (third,fifth,octave,fifth+12)[i%4], 81 + (12 if i%3==0 else 0))
        for beat,pitch,length in [(0, octave-12, 1.27), (1.5,fifth,.36), (2,third,.73), (3.1,octave, .67)]:
            lead = HORNS if section in (0, 2) else TRUMPETS
            play(lead, start+beat, length, pitch, 93 if section != 2 else 79)
            if section in (1, 3) and beat in (0,2):
                play(BRASS, start+beat, .43, third-12, 91)
                play(BRASS, start+beat, .40, fifth-12, 86)
        for pitch in (third, fifth, octave):
            play(CHOIR, start+.04, 3.7, pitch, 68 if section in (1, 3) else 55)
        for beat, key, velocity in [(0,36,117),(.75,43,85),(1.5,38,107),(2,36,109),(2.75,43,98),(3.5,40,110)]:
            play(KIT, start+beat, .22, key, velocity)
        for beat in (0, 1.5, 3.0):
            play(TIMPANI, start+beat, .43, root+12, 102 if beat == 0 else 89)
        if phrase in (0,4,7):
            play(KIT, start, 1.1, 49, 100)
        if section >= 2:
            for i,pitch in enumerate((octave, fifth+12, third+12, octave+12)):
                play(BELLS if section == 2 else FLUTE, start+.25+i*.75, .43, pitch, 74)
        if section in (0, 3):
            for beat, pitch, length in ((.5, root+12, .44), (2.25, fifth-12, .54), (3.25, third-12, .39)):
                play(BASSOON, start+beat, length, pitch, 82)
        if section == 2:
            play(VIOLA, start+.1, 1.6, fifth-12, 79)
            play(VIOLA, start+2, 1.58, third, 73)
            for i, pitch in enumerate((third, fifth, octave, fifth+12)):
                play(CELESTA, start+.62+i*.75, .34, pitch, 67)
        if section in (1, 3) and phrase in (2, 3, 6, 7):
            play(CLARINET, start+2.65, .65, octave, 75)
            play(CLARINET, start+3.35, .53, fifth, 70)
    Path(sys.argv[1]).write_text(json.dumps({"duration": BAR_COUNT * 4 * 60 / TEMPO, "events": events}))
    sys.exit()

# Give the middle section a different harmonic direction and melody.
bridge_chords = [chords[i] for i in [1, 2, 5, 3, 4, 6, 1, 7]]
bridge_tunes = [
    [(0, .75, 77), (1, .5, 74), (1.5, .5, 70), (2.25, .75, 65), (3.5, .5, 74)],
    [(0, 1.25, 72), (1.5, .5, 69), (2, .5, 65), (2.5, .5, 69), (3, 1, 77)],
    [(0, .75, 79), (1, .5, 74), (1.5, .5, 70), (2, .5, 74), (2.5, .5, 79), (3, .75, 82)],
    [(0, 1, 79), (1, 1, 76), (2, .5, 72), (2.5, .5, 67), (3, 1, 72)],
    [(0, .5, 74), (1, .5, 77), (1.5, .5, 81), (2, 1.25, 74), (3.5, .5, 69)],
    [(0, 1, 79), (1.25, .5, 77), (2, .75, 74), (3, 1, 70)],
    [(0, 1, 77), (1, .5, 81), (1.5, .5, 82), (2, 1.5, 77)],
    [(0, .5, 76), (1, .5, 73), (1.5, .5, 69), (2, 1, 76), (3.25, .5, 73)],
]
for bar in range(BAR_COUNT):
    section, phrase = divmod(bar, 8)
    start = bar * 4
    bridge = section in (2, 3)
    sparse = section == 2
    full = section in (1, 4, 5)
    root, low, mid, high = (bridge_chords if bridge else chords)[phrase]
    harmony = (low + 12, mid + 12, high + 12)
    bass_steps = [(0, root), (1.5, root+12), (2, root), (2.75, root+7), (3.5, root+12)]
    for beat, pitch in bass_steps if not sparse else [(0,root),(2,root+12)]:
        play(LOW_STRINGS, start+beat, .53 if beat % 1 == 0 else .20, pitch, 90 if beat == 0 else 74)
    arpeggio = [low, high, mid, low+12, high, mid+12, high+12, mid+12]
    if sparse:
        for i, pitch in enumerate(arpeggio):
            play(PIZZ, start+i*.5, .22, pitch, 82 if i % 4 == 0 else 71)
    else:
        for i, pitch in enumerate(arpeggio):
            play(STRINGS, start+i*.5, .37, pitch, (80 if full else 73) + (12 if i in (0,3,6) else 0))
            if full and i in (1,3,5,6,7):
                play(PIZZ, start+i*.5+.25, .16, pitch+12, 64+i*2)
    lead = FLUTE if sparse else WOODS if section == 3 else TRUMPETS if section == 4 else HORNS
    for j, (beat, length, pitch) in enumerate((bridge_tunes if bridge else themes)[phrase]):
        play(lead, start+beat, length*.88, pitch, 94 if full else 86)
        if section in (1, 5) and length >= .75:
            play(TRUMPETS, start+beat, length*.79, pitch+12, 85 if section == 5 else 76)
        if section in (3, 4, 5) and j % 2 == 0:
            play(FLUTE, start+beat+.18, min(.48, length*.55), pitch+12, 77)
    if full:
        for pitch in harmony[:2]:
            play(CHOIR, start+.06, 3.63, pitch, 61 if section != 1 else 48)
        for beat in (0, 2.75) if phrase % 2 == 0 else (1.5, 3):
            for pitch in (low, mid, high):
                play(BRASS, start+beat, .25, pitch, 82 if beat == 0 else 72)
    if bridge or phrase in (1, 3, 5, 7):
        for i, pitch in enumerate(harmony + (high+24,)):
            play(HARP, start+.25+i*.5, .62, pitch, 77 if sparse else 69)
    if section >= 3 and phrase in (1, 5, 7):
        for i, pitch in enumerate(harmony[::-1]):
            play(BELLS, start+2.8+i*.3, .22, pitch+12, 69)
    for beat, pitch, velocity in [(0, root+12, 103), (2.75, root+5, 83)] if not sparse else [(0, root+12, 77)]:
        play(TIMPANI, start+beat, .33, pitch, velocity)
    for beat, key, velocity in [(0,36,112),(1,38,89),(1.75,36,76),(2.5,36,97),(3,40,91)]:
        if not sparse or beat in (0, 3):
            play(KIT, start+beat, .2, key, velocity if not sparse else velocity-23)
    if not sparse:
        for i in range(8):
            play(KIT, start+i*.5, .12, 42 if i not in (3,7) else 46, 54 + (i % 2)*8)
    if phrase in (0, 4) and not sparse:
        play(KIT, start, 1.17, 49 if phrase == 0 else 57, 94 if full else 80)
    if phrase in (3, 7):
        for i, key in enumerate([41, 45, 47, 38, 38, 40]):
            play(KIT, start+2.5+i*.25, .13, key, 55+i*7)
    if section == 5 and phrase >= 4:
        for i, pitch in enumerate([high+12, mid+12, low+12, mid+12]):
            play(WOODS, start+1.75+i*.5, .30, pitch, 80)

    # Answers enter behind the lead, then trade places between sections.
    if section in (0, 1, 4):
        play(VIOLA, start+.12, 1.62, mid, 75 if section == 0 else 82)
        play(VIOLA, start+2.1, 1.44, high, 74)
    if section in (0, 3, 5):
        for beat, length, pitch in ((.75, .55, high+12), (2.25, .70, mid+12), (3.25, .53, low+12)):
            play(CLARINET, start+beat, length, pitch, (81 if section == 0 else 74) - (3 if beat > 3 else 0))
    if section in (1, 3, 4):
        for beat, length, pitch in ((.5, .55, root+12), (1.75, .32, low), (2.5, .63, high-12)):
            play(BASSOON, start+beat, length, pitch, 72 if section == 3 else 82)
    if section in (2, 5):
        for i, pitch in enumerate((mid+12, high+12, low+24, high+24)):
            play(CELESTA, start+.375+i*.75, .38, pitch, 75 if sparse else 68)
    if section == 5 and phrase in (0, 4):
        for pitch in (mid, high, high+12):
            play(VIOLA, start+.06, 2.55, pitch, 83)

Path(sys.argv[1]).write_text(json.dumps({"duration": BAR_COUNT * 4 * 60 / TEMPO, "events": events}))
