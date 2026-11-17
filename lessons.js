'use strict';
// Pads on the roll-up kit, in the left-to-right order used for the falling-note lanes.
const PADS = [
  { id: 'crash',   name: 'Crash',  color: '#f2c94c', key: 'q', keyLabel: 'Q' },
  { id: 'hihat',   name: 'Hi-Hat', color: '#56ccf2', key: 'a', keyLabel: 'A' },
  { id: 'snare',   name: 'Snare',  color: '#eb5757', key: 's', keyLabel: 'S' },
  { id: 'tom1',    name: 'High Tom',  color: '#bb6bd9', key: 'e', keyLabel: 'E' },
  { id: 'tom2',    name: 'Low Tom',  color: '#9b7bf0', key: 'd', keyLabel: 'D' },
  { id: 'tom3',    name: 'Floor Tom',  color: '#6f8cf5', key: 'f', keyLabel: 'F' },
  { id: 'ride',    name: 'Ride',   color: '#f2994a', key: 'r', keyLabel: 'R' },
  { id: 'kick',    name: 'Kick',   color: '#6fcf97', key: ' ', keyLabel: 'Space' },
  { id: 'hhpedal', name: 'Hi-Hat Pedal', color: '#8fa3b0', key: 'z', keyLabel: 'Z' }
];
const PAD = {};
PADS.forEach(p => { PAD[p.id] = p; });

// Each bar is 4 beats. "div" = steps per beat (1 = quarter notes, 2 = eighth notes).
// In a pattern string, "x" = hit and "-" = rest; one character per step.
const ROCK = { hihat: 'xxxxxxxx', snare: '--x---x-', kick: 'x---x---' };
const CRASH_ROCK = { crash: 'x-------', hihat: '-xxxxxxx', snare: '--x---x-', kick: 'x---x---' };
const BUSY = { hihat: 'xxxxxxxx', snare: '--x---x-', kick: 'x---xx--' };
const TOM_FILL = { snare: 'xx------', tom1: '--xx----', tom2: '----xx--', tom3: '------xx' };
const HALF_FILL = { hihat: 'xxxx----', kick: 'x-------', snare: '--x-xxxx' };
const BEAT_Q = { hihat: 'xxxx', snare: '-x-x', kick: 'x-x-' };          // quarter-note version of the beat
const CRASH_Q = { crash: 'x---', hihat: '-xxx', snare: '-x-x', kick: 'x-x-' };
const KICK_A = { hihat: 'xxxxxxxx', snare: '--x---x-', kick: 'xx--x---' };
const KICK_B = { hihat: 'xxxxxxxx', snare: '--x---x-', kick: 'x--x-x--' };
const KICK_C = { hihat: 'xxxxxxxx', snare: '--x---x-', kick: 'x---x--x' };
const DANCE = { hihat: 'xxxxxxxx', snare: '--x---x-', kick: 'x-x-x-x-' };
const RIDE = { ride: 'xxxxxxxx', snare: '--x---x-', kick: 'x---x---' };
const CRASH_RIDE = { crash: 'x-------', ride: '-xxxxxxx', snare: '--x---x-', kick: 'x---x---' };
const HALF_TIME = { hihat: 'xxxxxxxx', kick: 'x-------', snare: '----x---' };
const ROCK16 = { hihat: 'x-x-x-x-x-x-x-x-', snare: '----x-------x---', kick: 'x-------x-------' };   // the rock beat written four steps to a beat
const BLUES = { hihat: 'xxxxxxxxxxxx', kick: 'x-----x-----', snare: '---x-----x--' };              // three steps to a beat
const FUNK_A = { hihat: 'x-x-x-x-x-x-x-x-', snare: '----x-------x---', kick: 'x--x----x-x-----' };
const FUNK_B = { hihat: 'x-x-x-x-x-x-x-x-', snare: '----x-------x---', kick: 'x--x--x---x-----' };
const SIXTEEN = { hihat: 'xxxx-xxxxxxx-xxx', snare: '----x-------x---', kick: 'x-------x-x-----' };              // both hands share the 16ths
const SIX8 = { hihat: 'xxxxxx', kick: 'x-----', snare: '---x--' };                                               // two beats of three
const FIVE4 = { hihat: 'xxxxxxxxxx', kick: 'x-----x---', snare: '--x-x---x-' };                                  // five beats, two steps each
const SHUF = { hihat: 'x-xx-xx-xx-x', kick: 'x-----x-----', snare: '---x-----x--' };
const ROCK6 = { hihat: 'x--x--x--x--x--x--x--x--', snare: '------x-----------x-----', kick: 'x-----------x-----------' };   // the rock beat written six steps to a beat
// n bars of the same pattern, with some bars swapped out: barsOf(8, ROCK, { 7: TOM_FILL })
function barsOf(n, base, special) {
  const out = [];
  for (let i = 0; i < n; i++) out.push((special && special[i]) || base);
  return out;
}
const LESSON_BANK = [
  { id: 'l1', title: 'Snare: steady beats', bpm: 60, div: 1, reps: 4,
    level: ['Level 1: First hits', 'One hit per click, one pad at a time, then your first beat.'],
    goal: 'Hit the snare once on every click.',
    tip: 'Count "1, 2, 3, 4" out loud. Let the stick bounce; do not press it into the pad.',
    bars: [{ snare: 'xxxx' }] },
  { id: 'l2', title: 'Kick: steady beats', bpm: 60, div: 1, reps: 4,
    goal: 'Press the kick pedal once on every click.',
    tip: 'Keep your heel down and tap with the ball of your foot.',
    bars: [{ kick: 'xxxx' }] },
  { id: 'l3', title: 'Hi-hat: steady beats', bpm: 60, div: 1, reps: 4,
    goal: 'Hit the hi-hat once on every click.',
    tip: 'Keep the hi-hat pedal pressed down with the foot that is not on the kick, so the hi-hat sounds short. Use your right hand (left if you are left-handed).',
    bars: [{ hihat: 'xxxx' }] },
  { id: 'l4', title: 'Kick and snare take turns', bpm: 60, div: 1, reps: 4,
    goal: 'Kick on 1 and 3, snare on 2 and 4.',
    tip: 'Say "boom, tap, boom, tap". This is the backbone of most songs.',
    bars: [{ kick: 'x-x-', snare: '-x-x' }] },
  { id: 'l5', title: 'Hi-hat: twice as fast', bpm: 60, div: 2, reps: 4,
    goal: 'Two hi-hat hits per click.',
    tip: 'Count "1 and 2 and 3 and 4 and". Keep the hi-hat pedal pressed down, or the hits will blur together.',
    bars: [{ hihat: 'xxxxxxxx' }] },
  { id: 'l6', title: 'Hi-hat with kick', bpm: 60, div: 1, reps: 4,
    goal: 'Hi-hat on every click; add the kick on 1 and 3.',
    tip: 'First time using a hand and a foot together. Hand and foot should land at the same moment.',
    bars: [{ hihat: 'xxxx', kick: 'x-x-' }] },
  { id: 'l7', title: 'Hi-hat with snare', bpm: 60, div: 1, reps: 4,
    goal: 'Hi-hat on every click; add the snare on 2 and 4.',
    tip: 'Both hands land together on 2 and 4.',
    bars: [{ hihat: 'xxxx', snare: '-x-x' }] },
  { id: 'l8', title: 'Your first beat', bpm: 60, div: 1, reps: 4,
    goal: 'Hi-hat on every click, kick on 1 and 3, snare on 2 and 4.',
    tip: 'If it falls apart, switch on Wait mode and learn the order first.',
    bars: [{ hihat: 'xxxx', snare: '-x-x', kick: 'x-x-' }] },
  { id: 'l9', title: 'The rock beat', bpm: 70, div: 2, reps: 4,
    level: ['Level 2: The rock beat and fills', 'Two hi-hat hits per click, the toms, the crash and your first fills.'],
    goal: 'Hi-hat twice per click, kick on 1 and 3, snare on 2 and 4.',
    tip: 'The most used drum beat there is. Start slow with the tempo slider.',
    bars: [ROCK] },
  { id: 'l10', title: 'Rock beat with a busier kick', bpm: 70, div: 2, reps: 4,
    goal: 'Same beat, with one extra kick after beat 3.',
    tip: 'The extra kick falls on the "and" of 3, together with a hi-hat.',
    bars: [{ hihat: 'xxxxxxxx', snare: '--x---x-', kick: 'x---xx--' }] },
  { id: 'l11', title: 'Around the toms', bpm: 60, div: 2, reps: 4,
    goal: 'Two hits each: snare, High Tom, Low Tom, Floor Tom.',
    tip: 'Alternate hands: right, left, right, left. Move your arms, not your whole body.',
    bars: [{ snare: 'xx------', tom1: '--xx----', tom2: '----xx--', tom3: '------xx' }] },
  { id: 'l12', title: 'Beat plus fill', bpm: 70, div: 2, reps: 2,
    goal: 'Three bars of rock beat, then a fill around the toms. Crash on the first beat.',
    tip: 'Keep counting through the fill so you land back on beat 1.',
    bars: [
      { crash: 'x-------', hihat: '-xxxxxxx', snare: '--x---x-', kick: 'x---x---' },
      ROCK, ROCK,
      { snare: 'xx------', tom1: '--xx----', tom2: '----xx--', tom3: '------xx' }
    ] },
  { id: 'l13', title: 'Ride beat', bpm: 75, div: 2, reps: 4,
    goal: 'The rock beat, with your right hand on the ride instead of the hi-hat.',
    tip: 'Same pattern, different sound. Used in choruses to open the song up.',
    bars: [{ ride: 'xxxxxxxx', snare: '--x---x-', kick: 'x---x---' }] },
  { id: 'l14', title: 'Snare: both hands', bpm: 60, div: 2, reps: 4,
    goal: 'Two snare hits per click, one hand after the other.',
    tip: 'Right, left, right, left. Try to make both hands sound the same.',
    bars: [{ snare: 'xxxxxxxx' }] },
  { id: 'l15', title: 'Boom, boom, clap', bpm: 80, div: 2, reps: 4,
    goal: 'Two quick kicks, then one snare. Twice in every bar.',
    tip: 'Say it out loud: "boom boom CLAP". Leave the gap after the clap empty.',
    bars: [{ kick: 'xx--xx--', snare: '--x---x-' }] },
  { id: 'l16', title: 'Crash on one', bpm: 70, div: 2, reps: 4,
    goal: 'Rock beat, with a crash on the very first beat of every second bar.',
    tip: 'Hit the crash and the kick together, then go straight back to the hi-hat.',
    bars: [CRASH_ROCK, ROCK] },
  { id: 'l17', title: 'Kick on the "and"', bpm: 70, div: 2, reps: 4,
    goal: 'Rock beat with a kick just before beat 3.',
    tip: 'Count "1 and 2 AND 3 and 4 and". The new kick lands on the loud AND.',
    bars: [{ hihat: 'xxxxxxxx', snare: '--x---x-', kick: 'x--xx---' }] },
  { id: 'l18', title: 'Dance beat', bpm: 80, div: 2, reps: 4,
    goal: 'Kick on every click, snare on 2 and 4, hi-hat twice per click.',
    tip: 'Your foot is the metronome here. Keep it even, like marching.',
    bars: [{ hihat: 'xxxxxxxx', snare: '--x---x-', kick: 'x-x-x-x-' }] },
  { id: 'l19', title: 'Two-bar beat', bpm: 70, div: 2, reps: 4,
    goal: 'Plain rock beat in bar one, the busier kick in bar two.',
    tip: 'Beats that change from bar to bar make a song feel alive.',
    bars: [ROCK, { hihat: 'xxxxxxxx', snare: '--x---x-', kick: 'x---xx--' }] },
  { id: 'l20', title: 'Snare fill', bpm: 70, div: 2, reps: 2,
    goal: 'Three bars of rock beat, then eight fast snare hits. Crash when it comes back round.',
    tip: 'Start the fill quietly and get louder towards the crash.',
    bars: [CRASH_ROCK, ROCK, ROCK, { snare: 'xxxxxxxx' }] },

  // ---------- Level 3: the rock beat with harder kick and snare patterns ----------
  { id: 'l23', title: 'Kick: two at the start', bpm: 70, div: 2, reps: 4,
    level: ['Level 3: More kick patterns', 'The hands keep playing the rock beat while the kick moves around.'],
    goal: 'Rock beat with a second kick straight after beat 1.',
    tip: 'Count "1 AND 2 and 3 and 4 and". The new kick lands on the first "and", together with a hi-hat.',
    bars: [KICK_A] },
  { id: 'l24', title: 'Kick: three in the bar', bpm: 70, div: 2, reps: 4,
    goal: 'Kicks on 1, on the "and" of 2 and on the "and" of 3.',
    tip: 'There is no kick on beat 3 itself. Switch on Wait mode first to learn where the three kicks fall.',
    bars: [KICK_B] },
  { id: 'l25', title: 'Kick: pushing into the next bar', bpm: 70, div: 2, reps: 4,
    goal: 'Rock beat with a kick on the very last "and" of the bar.',
    tip: 'The last kick and the first kick of the next bar come close together: "boom-BOOM".',
    bars: [KICK_C] },
  { id: 'l26', title: 'Extra snare', bpm: 70, div: 2, reps: 4,
    goal: 'Rock beat with a second snare hit straight after beat 4.',
    tip: 'Two quick snare hits at the end of the bar: "tap-tap". The hi-hat hand does not stop.',
    bars: [{ hihat: 'xxxxxxxx', snare: '--x---xx', kick: 'x---x---' }] },
  { id: 'l27', title: 'Question and answer', bpm: 70, div: 2, reps: 4,
    goal: 'Two different kick patterns, one bar each, over and over.',
    tip: 'Bar one is "Kick: two at the start", bar two is "Kick: three in the bar". Think of them as a question and its answer.',
    bars: [KICK_A, KICK_B] },
  { id: 'l28', title: 'Four-bar phrase', bpm: 70, div: 2, reps: 2,
    goal: 'Four different bars in a row: crash, two kick patterns, then a short snare fill.',
    tip: 'Songs are built from four-bar phrases like this one. Keep counting so you always know which bar you are in.',
    bars: [CRASH_ROCK, KICK_A, KICK_B, HALF_FILL] },

  // ---------- Level 4: 16 beat ----------
  { id: 'l21', title: '16 beat: four hits per click', bpm: 50, div: 4, reps: 4,
    level: ['Level 4: 16 beat', 'Four hits on every click. Slow tempos, both hands taking turns.'],
    goal: 'Four hi-hat hits on every click, one hand after the other.',
    tip: 'Count "1 e and a, 2 e and a". Both hands take turns on the hi-hat: right, left, right, left.',
    bars: [{ hihat: 'xxxxxxxxxxxxxxxx' }] },
  { id: 'l22', title: '16 beat with kick and snare', bpm: 50, div: 4, reps: 4,
    goal: 'Hands keep taking turns on the hi-hat. The right hand moves to the snare on 2 and 4. Kick on 1 and 3.',
    tip: 'Your hands never stop going right, left, right, left. Only the place the right hand lands changes.',
    bars: [{ hihat: 'xxxx-xxxxxxx-xxx', snare: '----x-------x---', kick: 'x-------x-------' }] },
  { id: 'l29', title: '16 beat with a busier kick', bpm: 50, div: 4, reps: 4,
    goal: 'The 16 beat, with one extra kick on the "and" of 3.',
    tip: 'The extra kick lands together with a hi-hat hit. The hands must not slow down for it.',
    bars: [{ hihat: 'xxxx-xxxxxxx-xxx', snare: '----x-------x---', kick: 'x-------x-x-----' }] },
  { id: 'l30', title: 'Snare: four hits per click', bpm: 50, div: 4, reps: 4,
    goal: 'Four snare hits on every click, one hand after the other.',
    tip: 'This is the roll used in fast fills. Keep the sticks low and both hands the same loudness.',
    bars: [{ snare: 'xxxxxxxxxxxxxxxx' }] },
  { id: 'l31', title: 'Fast trip around the toms', bpm: 50, div: 4, reps: 4,
    goal: 'Four quick hits each: snare, High Tom, Low Tom, Floor Tom.',
    tip: 'Every drum starts with the same hand. Move to the next drum on the click.',
    bars: [{ snare: 'xxxx------------', tom1: '----xxxx--------', tom2: '--------xxxx----', tom3: '------------xxxx' }] },
  { id: 'l32', title: 'Quick double kick', bpm: 60, div: 4, reps: 4,
    goal: 'Rock beat with a very quick kick just before beat 3.',
    tip: 'The quick kick falls on its own, between two hi-hat hits. Count "2 e and A 3": it lands on the "A".',
    bars: [{ hihat: 'x-x-x-x-x-x-x-x-', snare: '----x-------x---', kick: 'x------xx-------' }] },
  { id: 'l33', title: 'Rock beat with a fast fill', bpm: 60, div: 4, reps: 2,
    goal: 'Three bars of rock beat, then half a bar of beat and a fast fill: snare, High Tom, Floor Tom.',
    tip: 'The fill is twice as fast as the hi-hat. Keep counting "3 e and a 4 e and a" through it.',
    bars: [
      { crash: 'x---------------', hihat: '--x-x-x-x-x-x-x-', snare: '----x-------x---', kick: 'x-------x-------' },
      ROCK16, ROCK16,
      { hihat: 'x-x-x-x---------', kick: 'x---------------', snare: '----x---xxxx----', tom1: '------------xx--', tom3: '--------------xx' }
    ] },

  // ---------- Level 5: the other foot, and beats that are not the rock beat ----------
  { id: 'l34', title: 'Other foot: hi-hat pedal', bpm: 60, div: 1, reps: 4,
    level: ['Level 5: Both feet and new beats', 'The second pedal joins in, and beats that feel different from the rock beat.'],
    goal: 'Press the hi-hat pedal once on every click.',
    tip: 'This is the foot that is not on the kick. Heel down, tap with the ball of the foot. The pedal makes a short "chick".',
    bars: [{ hhpedal: 'xxxx' }] },
  { id: 'l35', title: 'Both feet take turns', bpm: 60, div: 1, reps: 4,
    goal: 'Kick on 1 and 3, hi-hat pedal on 2 and 4.',
    tip: 'Like walking on the spot: one foot, then the other. Hands rest on your knees.',
    bars: [{ kick: 'x-x-', hhpedal: '-x-x' }] },
  { id: 'l36', title: 'Ride beat with the hi-hat pedal', bpm: 65, div: 2, reps: 4,
    goal: 'The ride beat, with the hi-hat pedal on 2 and 4 together with the snare.',
    tip: 'Both hands and both feet are working now. Learn it in Wait mode before you try it in time.',
    bars: [{ ride: 'xxxxxxxx', snare: '--x---x-', kick: 'x---x---', hhpedal: '--x---x-' }] },
  { id: 'l37', title: 'Half-time beat', bpm: 80, div: 2, reps: 4,
    goal: 'Hi-hat twice per click, one kick on 1 and one snare on 3.',
    tip: 'The hi-hat stays the same but the beat feels half as fast. Used in slow, heavy parts of songs.',
    bars: [HALF_TIME] },
  { id: 'l38', title: 'Half-time with a second kick', bpm: 80, div: 2, reps: 4,
    goal: 'The half-time beat, with a second kick on the "and" of 2.',
    tip: 'The second kick leads into the snare: "boom ... boom TAP".',
    bars: [{ hihat: 'xxxxxxxx', kick: 'x--x----', snare: '----x---' }] },
  { id: 'l39', title: 'Tom beat', bpm: 70, div: 2, reps: 4,
    goal: 'A beat played on Floor Tom instead of the hi-hat, with the snare on 2 and 4.',
    tip: 'Hands take turns all the way through. Follow the R and L in the notes.',
    bars: [{ tom3: 'xx-xxx-x', snare: '--x---x-', kick: 'x---x---' }] },
  { id: 'l40', title: 'Off-beat hi-hat', bpm: 80, div: 2, reps: 4,
    goal: 'Kick on every click, hi-hat in the gaps between the clicks, snare on 2 and 4.',
    tip: 'Foot, hand, foot, hand: "boom, tss, boom, tss". The snare joins the kick on 2 and 4. This is the disco beat.',
    bars: [{ hihat: '-x-x-x-x', kick: 'x-x-x-x-', snare: '--x---x-' }] },

  // ---------- Level 6: three hits per click ----------
  { id: 'l41', title: 'Triplets: three hits per click', bpm: 60, div: 3, reps: 4,
    level: ['Level 6: Shuffle and triplets', 'Three hits on every click. The feel behind blues, swing and many slow songs.'],
    goal: 'Three snare hits on every click, one hand after the other.',
    tip: 'Count "1 trip let, 2 trip let". Each new click starts on the other hand.',
    bars: [{ snare: 'xxxxxxxxxxxx' }] },
  { id: 'l42', title: 'Shuffle on the hi-hat', bpm: 70, div: 3, reps: 4,
    goal: 'Play the first and the last of every three and leave the middle one out.',
    tip: 'Long, short, long, short. It sounds like a horse trotting: "dum, da-dum, da-dum".',
    bars: [{ hihat: 'x-xx-xx-xx-x' }] },
  { id: 'l43', title: 'Shuffle beat', bpm: 70, div: 3, reps: 4,
    goal: 'The shuffle on the hi-hat, with kick on 1 and 3 and snare on 2 and 4.',
    tip: 'Kick and snare land on the clicks, exactly as in the rock beat. Only the hi-hat has changed.',
    bars: [{ hihat: 'x-xx-xx-xx-x', kick: 'x-----x-----', snare: '---x-----x--' }] },
  { id: 'l44', title: 'Slow blues', bpm: 60, div: 3, reps: 4,
    goal: 'Three hi-hat hits on every click, kick on 1 and 3, snare on 2 and 4.',
    tip: 'One hand plays all the hi-hats. Lean a little on the first of each three.',
    bars: [BLUES] },
  { id: 'l45', title: 'Slow blues with a fill', bpm: 60, div: 3, reps: 2,
    goal: 'Three bars of slow blues, then three hits each on snare, High Tom, Low Tom and Floor Tom.',
    tip: 'Because there are three hits per drum, each drum starts on the other hand. Follow the R and L.',
    bars: [
      { crash: 'x-----------', hihat: '-xxxxxxxxxxx', kick: 'x-----x-----', snare: '---x-----x--' },
      BLUES, BLUES,
      { snare: 'xxx---------', tom1: '---xxx------', tom2: '------xxx---', tom3: '---------xxx' }
    ] },

  // ---------- Level 7: long forms that are shaped like real songs ----------
  { id: 'l46', title: 'Verse and chorus', bpm: 80, div: 2, reps: 2,
    level: ['Level 7: Play it like a song', 'Long pieces with sections, fills and endings, the way a real song is built.'],
    goal: 'Four bars on the hi-hat (the verse), then four bars on the ride (the chorus), with a fill before each change.',
    tip: 'A fill tells the band a new section is coming. Crash on the first beat after every fill.',
    bars: barsOf(8, ROCK, { 0: CRASH_ROCK, 3: HALF_FILL, 4: CRASH_RIDE, 5: RIDE, 6: RIDE, 7: TOM_FILL }) },
  { id: 'l47', title: 'The kick keeps changing', bpm: 80, div: 2, reps: 2,
    goal: 'Eight bars where the kick pattern changes every bar, ending with a snare fill.',
    tip: 'Every bar here is one you have already learned. Read ahead: look at the notes above the line, not at the line.',
    bars: [CRASH_ROCK, KICK_A, ROCK, KICK_B, CRASH_ROCK, BUSY, KICK_C, { snare: 'xxxxxxxx' }] },
  { id: 'l48', title: 'The full song', bpm: 85, div: 2, reps: 1,
    goal: 'Sixteen bars: verse, chorus on the ride, a half-time section, a dance-beat finish and one last crash.',
    tip: 'Verse, chorus, slow section, big finish. Slow the tempo down until you can get through without stopping.',
    bars: [
      CRASH_ROCK, ROCK, ROCK, HALF_FILL,
      CRASH_RIDE, RIDE, RIDE, TOM_FILL,
      { crash: 'x-------', hihat: '-xxxxxxx', kick: 'x-------', snare: '----x---' }, HALF_TIME, HALF_TIME, { snare: 'xxxxxxxx' },
      { crash: 'x-------', hihat: '-xxxxxxx', snare: '--x---x-', kick: 'x-x-x-x-' }, DANCE, DANCE, { crash: 'x-------', kick: 'x-------' }
    ] },

  // ---------- Stick control (rudiments): which hand plays is the whole point, so each lesson fixes the sticking ----------
  { id: 'r1', title: 'Double strokes', bpm: 60, div: 2, reps: 4, sticking: 'RRLL',
    goal: 'Two hits with each hand: right, right, left, left.',
    tip: 'Let the stick bounce for the second hit instead of pushing it down twice. All four hits the same loudness.',
    bars: [{ snare: 'xxxxxxxx' }] },
  { id: 'r2', title: 'Single paradiddle', bpm: 60, div: 2, reps: 4, sticking: 'RLRRLRLL',
    goal: 'Right, left, right, right, then left, right, left, left.',
    tip: 'Say it while you play: "pa-ra-did-dle". The pattern swaps the leading hand every time round.',
    bars: [{ snare: 'xxxxxxxx' }] },
  { id: 'r3', title: 'Three stickings in a row', bpm: 60, div: 2, reps: 3, sticking: ['RLRLRLRL', 'RRLLRRLL', 'RLRRLRLL'],
    goal: 'One bar of single strokes, one of double strokes, one of paradiddles.',
    tip: 'It should sound exactly the same in all three bars. Only your hands know the difference.',
    bars: [{ snare: 'xxxxxxxx' }, { snare: 'xxxxxxxx' }, { snare: 'xxxxxxxx' }] },
  { id: 'r4', title: 'Paradiddle on two drums', bpm: 60, div: 2, reps: 4, sticking: 'RLRRLRLL',
    goal: 'The paradiddle with the right hand on the Floor Tom and the left hand on the snare.',
    tip: 'Each hand stays on its own drum. The paradiddle turns into a little tune.',
    bars: [{ tom3: 'x-xx-x--', snare: '-x--x-xx' }] },
  { id: 'r5', title: 'Double strokes at 16', bpm: 50, div: 4, reps: 4, sticking: 'RRLL',
    goal: 'Four hits per click as double strokes: right, right, left, left.',
    tip: 'This is the start of a drum roll. Keep the sticks low and let them bounce.',
    bars: [{ snare: 'xxxxxxxxxxxxxxxx' }] },
  { id: 'r6', title: 'Paradiddle at 16', bpm: 50, div: 4, reps: 4, sticking: 'RLRRLRLL',
    goal: 'Four hits per click as paradiddles.',
    tip: 'Every paradiddle starts on a click, and the leading hand swaps each time: right on 1, left on 2.',
    bars: [{ snare: 'xxxxxxxxxxxxxxxx' }] },
  { id: 'r7', title: 'Paradiddle beat', bpm: 50, div: 4, reps: 4, sticking: 'RLRRLRLL',
    goal: 'The paradiddle with the right hand on the hi-hat and the left on the snare, kick on 1 and 3.',
    tip: 'A classic funk trick: a rudiment turned into a beat. Learn the hands first, then add the kick.',
    bars: [{ hihat: 'x-xx-x--x-xx-x--', snare: '-x--x-xx-x--x-xx', kick: 'x-------x-------' }] },
  { id: 'r8', title: 'Double paradiddle', bpm: 60, div: 3, reps: 4, sticking: 'RLRLRRLRLRLL',
    goal: 'Six hits starting right (R L R L R R), then six starting left (L R L R L L).',
    tip: 'It fits triplets exactly: one group of six for every two clicks.',
    bars: [{ snare: 'xxxxxxxxxxxx' }] },
  { id: 'r9', title: 'Paradiddle-diddle', bpm: 60, div: 3, reps: 4, sticking: 'RLRRLL',
    goal: 'Right, left, right, right, left, left, over and over.',
    tip: 'Unlike the paradiddle, this one always starts on the same hand. Jazz drummers use it on the ride.',
    bars: [{ snare: 'xxxxxxxxxxxx' }] },
  { id: 'r10', title: 'Six-stroke roll', bpm: 60, div: 3, reps: 4, sticking: 'RLLRRL',
    goal: 'Right, left, left, right, right, left.',
    tip: 'Single hits at both ends, doubles in the middle. A favourite for fast fills.',
    bars: [{ snare: 'xxxxxxxxxxxx' }] },
  { id: 'r11', title: 'Sextuplets: six hits per click', bpm: 45, div: 6, reps: 4,
    goal: 'Six snare hits on every click, one hand after the other.',
    tip: 'Count "1-2-3-4-5-6" evenly inside each click. Start very slowly: this is the fastest thing in the course.',
    bars: [{ snare: 'xxxxxxxxxxxxxxxxxxxxxxxx' }] },

  // ---------- More styles for the intermediate levels ----------
  { id: 'w1', title: 'Reggae: one drop', bpm: 75, div: 2, reps: 4,
    goal: 'Hi-hat twice per click. Kick and snare together on beat 3 only.',
    tip: 'Beat 1 is left empty on purpose: that is the "drop". Resist the urge to play it.',
    bars: [{ hihat: 'xxxxxxxx', kick: '----x---', snare: '----x---' }] },
  { id: 'w2', title: 'Four on the snare', bpm: 80, div: 2, reps: 4,
    goal: 'Snare on every click, kick on 1 and 3, hi-hat twice per click.',
    tip: 'The driving beat of many 1960s soul songs. Kick and snare land together on 1 and 3.',
    bars: [{ hihat: 'xxxxxxxx', snare: 'x-x-x-x-', kick: 'x---x---' }] },
  { id: 'j1', title: 'Half-time shuffle', bpm: 70, div: 3, reps: 4,
    goal: 'Shuffle on the hi-hat, one snare on beat 3, kick on 1 and just before 3.',
    tip: 'Slow and heavy. The second kick is the short note right before beat 3.',
    bars: [{ hihat: 'x-xx-xx-xx-x', kick: 'x----x------', snare: '------x-----' }] },
  { id: 'j2', title: 'Jazz ride pattern', bpm: 80, div: 3, reps: 4,
    goal: 'On the ride: "ding, ding-a-ding, ding, ding-a-ding".',
    tip: 'Beats 1 and 3 get one hit. Beats 2 and 4 get a long and a short one. This is the heartbeat of swing.',
    bars: [{ ride: 'x--x-xx--x-x' }] },
  { id: 'j3', title: 'Swing: ride and hi-hat pedal', bpm: 80, div: 3, reps: 4,
    goal: 'The jazz ride pattern, with the hi-hat pedal on 2 and 4.',
    tip: 'The pedal "chick" on 2 and 4 is what makes people snap their fingers.',
    bars: [{ ride: 'x--x-xx--x-x', hhpedal: '---x-----x--' }] },
  { id: 'j4', title: 'Swing with kick and snare', bpm: 80, div: 3, reps: 4,
    goal: 'Ride pattern and hi-hat pedal, a kick on 1 and a snare just before beat 4.',
    tip: 'In jazz the snare and kick comment on the music instead of keeping the beat. Play them lightly.',
    bars: [{ ride: 'x--x-xx--x-x', hhpedal: '---x-----x--', kick: 'x-----------', snare: '--------x---' }] },

  // ---------- Funk: sixteenth-note grooves ----------
  { id: 'f1', title: 'One hand plays every 16th', bpm: 50, div: 4, reps: 4, sticking: 'R',
    goal: 'The right hand plays all four hi-hat hits per click. Left hand on the snare on 2 and 4, kick on 1 and 3.',
    tip: 'Use your wrist, not your arm. If the hand tires, drop the tempo: speed comes later.',
    bars: [{ hihat: 'xxxxxxxxxxxxxxxx', snare: '----x-------x---', kick: 'x-------x-------' }] },
  { id: 'f2', title: 'Funk kick 1', bpm: 60, div: 4, reps: 4,
    goal: 'Rock beat hands. Kicks on 1, the "a" of 1, 3 and the "and" of 3.',
    tip: 'The kick on the "a" falls on its own, between two hi-hat hits. That gap is where funk lives.',
    bars: [FUNK_A] },
  { id: 'f3', title: 'Funk kick 2', bpm: 60, div: 4, reps: 4,
    goal: 'Kicks on 1, the "a" of 1, the "and" of 2 and the "and" of 3.',
    tip: 'No kick on beat 3 this time. Count all the sixteenths out loud: "1 e and a 2 e and a".',
    bars: [FUNK_B] },
  { id: 'f4', title: 'Snares between the hi-hats', bpm: 60, div: 4, reps: 4,
    goal: 'Extra snare hits on the "a" of 2 and the "e" of 3, between the hi-hat hits.',
    tip: 'The left hand plays the extra snares on its own. Real funk players make them very quiet.',
    bars: [{ hihat: 'x-x-x-x-x-x-x-x-', snare: '----x--x-x--x---', kick: 'x-------x-x-----' }] },
  { id: 'f5', title: 'Two-handed funk', bpm: 50, div: 4, reps: 4,
    goal: 'Both hands share the 16ths on the hi-hat, with the funk kick underneath.',
    tip: 'Your hands never stop going right, left, right, left. The kicks land with either hand.',
    bars: [{ hihat: 'xxxx-xxxxxxx-xxx', snare: '----x-------x---', kick: 'x--x----x-x-----' }] },
  { id: 'f6', title: 'Linear groove', bpm: 50, div: 4, reps: 4,
    goal: 'Only one thing plays at a time: kick, hi-hat and snare take turns.',
    tip: '"Linear" means no two limbs ever land together. Learn it in Wait mode: it is a tongue-twister for the body.',
    bars: [{ kick: 'x--x--x---x-----', snare: '----x-------x---', hihat: '-xx--x-xxx-x-xxx' }] },
  { id: 'f7', title: 'Funk phrase with a fill', bpm: 60, div: 4, reps: 2,
    goal: 'Two funk beats over three bars, then a fast fill and a crash.',
    tip: 'Keep the fill in time: it is the same speed as counting "1 e and a".',
    bars: [
      { crash: 'x---------------', hihat: '--x-x-x-x-x-x-x-', snare: '----x-------x---', kick: 'x--x----x-x-----' },
      FUNK_A, FUNK_B,
      { hihat: 'x-x-x-x---------', kick: 'x--x------------', snare: '----x---xxxx----', tom1: '------------xx--', tom3: '--------------xx' }
    ] },

  // ---------- Odd time and beats from around the world ----------
  { id: 'o1', title: 'Waltz: boom, tap, tap', bpm: 90, div: 1, beats: 3, feel: '3/4 time', reps: 8,
    goal: 'Three beats in a bar: kick on 1, snare on 2 and 3.',
    tip: 'Count "1, 2, 3, 1, 2, 3". Sway with it: this is a dance.',
    bars: [{ kick: 'x--', snare: '-xx' }] },
  { id: 'o2', title: 'Waltz with hi-hat', bpm: 80, div: 2, beats: 3, feel: '3/4 time', reps: 8,
    goal: 'Hi-hat twice per click, kick on 1, snare on 2 and 3.',
    tip: 'Still "boom, tap, tap", now with the hi-hat running over the top.',
    bars: [{ hihat: 'xxxxxx', kick: 'x-----', snare: '--x-x-' }] },
  { id: 'o3', title: 'Six-eight', bpm: 50, div: 3, beats: 2, feel: '6/8 time', count: ['1', '2', '3', '4', '5', '6'], reps: 8,
    goal: 'Six hi-hat hits in a bar, kick on 1, snare on 4.',
    tip: 'Count "ONE two three FOUR five six". It rocks from side to side like a boat.',
    bars: [SIX8] },
  { id: 'o4', title: 'Six-eight with a fill', bpm: 50, div: 3, beats: 2, feel: '6/8 time', count: ['1', '2', '3', '4', '5', '6'], reps: 2,
    goal: 'Three bars of six-eight, then a fill: three on the snare, then one on each tom.',
    tip: 'The fill has six notes, one for each count. Crash on the "one" after it.',
    bars: [{ crash: 'x-----', hihat: '-xxxxx', kick: 'x-----', snare: '---x--' }, SIX8, SIX8, { snare: 'xxx---', tom1: '---x--', tom2: '----x-', tom3: '-----x' }] },
  { id: 'o5', title: 'Five-four', bpm: 80, div: 2, beats: 5, feel: '5/4 time', reps: 4,
    goal: 'Five beats in a bar. Kick on 1 and 4, snare on 2, 3 and 5.',
    tip: 'Think of it as three plus two: "1 2 3, 1 2". The bar feels like it has a limp, and that is its charm.',
    bars: [FIVE4] },
  { id: 'o6', title: 'Bossa nova', bpm: 80, div: 2, reps: 4,
    goal: 'Steady hi-hat, a "heartbeat" kick, and a snare pattern that takes two bars.',
    tip: 'From Brazil. On a real kit the snare part is a click of the stick on the rim. Keep everything soft.',
    bars: [{ hihat: 'xxxxxxxx', kick: 'x--xx--x', snare: 'x--x--x-' }, { hihat: 'xxxxxxxx', kick: 'x--xx--x', snare: '--x--x--' }] },
  { id: 'o7', title: 'Bossa nova with the hi-hat pedal', bpm: 75, div: 2, reps: 4,
    goal: 'The bossa nova on the ride, with the hi-hat pedal on 2 and 4.',
    tip: 'All four limbs, each with its own job. Add one limb at a time in Wait mode.',
    bars: [{ ride: 'xxxxxxxx', kick: 'x--xx--x', snare: 'x--x--x-', hhpedal: '--x---x-' }, { ride: 'xxxxxxxx', kick: 'x--xx--x', snare: '--x--x--', hhpedal: '--x---x-' }] },
  { id: 'o8', title: 'Train beat', bpm: 50, div: 4, reps: 4,
    goal: 'Four snare hits per click with alternating hands, kick on every click.',
    tip: 'It should chug like a steam train. Country and rockabilly drummers play this with brushes.',
    bars: [{ snare: 'xxxxxxxxxxxxxxxx', kick: 'x---x---x---x---' }] },
  { id: 'o9', title: 'Samba feet', bpm: 50, div: 4, reps: 4,
    goal: 'Ride twice per click. The kick plays the samba heartbeat; the hi-hat pedal plays between the clicks.',
    tip: 'The feet do the hard work here. Practise the feet alone first, then add the ride.',
    bars: [{ ride: 'x-x-x-x-x-x-x-x-', kick: 'x--xx--xx--xx--x', hhpedal: '--x---x---x---x-' }] },

  // ---------- Independence and advanced fills ----------
  { id: 'a1', title: 'Hands and feet: two and two', bpm: 50, div: 4, reps: 4,
    goal: 'Two snare hits, then two kicks, at four notes per click.',
    tip: 'Hands and foot should sound like one even roll. Used in big rock fills.',
    bars: [{ snare: 'xx--xx--xx--xx--', kick: '--xx--xx--xx--xx' }] },
  { id: 'a2', title: 'Hands and feet in threes', bpm: 60, div: 3, reps: 4,
    goal: 'High Tom, snare, kick: one after the other in triplets.',
    tip: 'Right hand, left hand, foot. Keep the three notes evenly spaced.',
    bars: [{ tom1: 'x--x--x--x--', snare: '-x--x--x--x-', kick: '--x--x--x--x' }] },
  { id: 'a3', title: 'Sextuplet fill', bpm: 50, div: 6, reps: 2,
    goal: 'Three bars of rock beat, then a very fast fill: six on the snare, three on the High Tom, three on the Floor Tom.',
    tip: 'The fill is three times as fast as the hi-hat. Relax: tense arms cannot play it.',
    bars: [
      { crash: 'x-----------------------', hihat: '---x--x--x--x--x--x--x--', snare: '------x-----------x-----', kick: 'x-----------x-----------' },
      ROCK6, ROCK6,
      { hihat: 'x--x--x--x--------------', kick: 'x-----------------------', snare: '------x-----xxxxxx------', tom1: '------------------xxx---', tom3: '---------------------xxx' }
    ] },
  { id: 'a4', title: 'Pushed crash', bpm: 80, div: 2, reps: 4,
    goal: 'The crash and kick come half a beat early, on the last "and", and beat 1 of the next bar is left empty.',
    tip: 'This "push" makes a song leap forward. Let the crash ring through the empty beat.',
    bars: [{ hihat: 'xxxxxxx-', crash: '-------x', snare: '--x---x-', kick: 'x---x--x' }, { hihat: '--xxxxxx', snare: '--x---x-', kick: '----x---' }] },
  { id: 'a5', title: 'Hi-hat pedal on every beat', bpm: 70, div: 2, reps: 4,
    goal: 'The ride beat, with the hi-hat pedal on all four clicks.',
    tip: 'The pedal foot becomes your own metronome. It lands with the kick on 1 and 3 and with the snare on 2 and 4.',
    bars: [{ ride: 'xxxxxxxx', snare: '--x---x-', kick: 'x---x---', hhpedal: 'x-x-x-x-' }] },
  { id: 'a6', title: 'Hi-hat pedal between the beats', bpm: 65, div: 2, reps: 4,
    goal: 'The ride beat, with the hi-hat pedal on every "and".',
    tip: 'The two feet now take turns while the hands carry on. One of the hardest coordination steps there is.',
    bars: [{ ride: 'xxxxxxxx', snare: '--x---x-', kick: 'x---x---', hhpedal: '-x-x-x-x' }] },
  { id: 'a7', title: 'Samba kick under a rock beat', bpm: 70, div: 2, reps: 4,
    goal: 'Hi-hat and snare play the rock beat. The kick plays 1, the "and" of 2, 3 and the "and" of 4.',
    tip: 'The foot repeats the same shape every two beats. Lock it in, then stop thinking about it.',
    bars: [{ hihat: 'xxxxxxxx', snare: '--x---x-', kick: 'x--xx--x' }] },
  { id: 'a8', title: 'Snare on every "and"', bpm: 70, div: 2, reps: 4,
    goal: 'Hi-hat on the clicks, snare between the clicks, kick on 1 and 3.',
    tip: 'The hands take turns: right on the hi-hat, left on the snare. It feels back to front at first.',
    bars: [{ hihat: 'x-x-x-x-', snare: '-x-x-x-x', kick: 'x---x---' }] },

  // ---------- Showpieces ----------
  { id: 'p1', title: 'Twelve-bar blues', bpm: 70, div: 3, reps: 1,
    goal: 'Twelve bars of shuffle, the shape of every blues song, with a triplet fill to finish.',
    tip: 'A blues goes round in twelve bars. Count the bars as well as the beats.',
    bars: barsOf(12, SHUF, { 0: { crash: 'x-----------', hihat: '--xx-xx-xx-x', kick: 'x-----x-----', snare: '---x-----x--' },
      4: { crash: 'x-----------', hihat: '--xx-xx-xx-x', kick: 'x-----x-----', snare: '---x-----x--' },
      11: { snare: 'xxx---------', tom1: '---xxx------', tom2: '------xxx---', tom3: '---------xxx' } }) },
  { id: 'p2', title: 'Funk workout', bpm: 60, div: 4, reps: 1,
    goal: 'Eight bars that move between two funk beats, with a fast fill in the middle and at the end.',
    tip: 'Read ahead. Your eyes should be on the notes that are still falling, not on the line.',
    bars: [
      { crash: 'x---------------', hihat: '--x-x-x-x-x-x-x-', snare: '----x-------x---', kick: 'x--x----x-x-----' }, FUNK_A, FUNK_B,
      { hihat: 'x-x-x-x---------', kick: 'x--x------------', snare: '----x---xxxxxxxx' },
      { crash: 'x---------------', hihat: '--x-x-x-x-x-x-x-', snare: '----x-------x---', kick: 'x--x--x---x-----' }, FUNK_B, FUNK_A,
      { snare: 'xxxx------------', tom1: '----xxxx--------', tom2: '--------xxxx----', tom3: '------------xxxx' }
    ] },
  { id: 'p3', title: 'Five-four piece', bpm: 80, div: 2, beats: 5, feel: '5/4 time', reps: 2,
    goal: 'Three bars of five-four, then a five-beat fill around the kit.',
    tip: 'The fill is two hits each on snare, High Tom and Low Tom, then four on the Floor Tom.',
    bars: [{ crash: 'x---------', hihat: '-xxxxxxxxx', kick: 'x-----x---', snare: '--x-x---x-' }, FIVE4, FIVE4, { snare: 'xx--------', tom1: '--xx------', tom2: '----xx----', tom3: '------xxxx' }] },
  { id: 'p4', title: 'Graduation piece', bpm: 60, div: 4, reps: 1,
    goal: 'Sixteen bars: rock beat, 16 beat, funk and half-time, joined by four different fills.',
    tip: 'Everything in the course in one piece. Take it apart with the tempo slider and put it back together.',
    bars: [
      { crash: 'x---------------', hihat: '--x-x-x-x-x-x-x-', snare: '----x-------x---', kick: 'x-------x-------' }, ROCK16, ROCK16,
      { hihat: 'x-x-x-x---------', kick: 'x---------------', snare: '----x---xxxx----', tom1: '------------xx--', tom3: '--------------xx' },
      { crash: 'x---------------', hihat: '-xxx-xxxxxxx-xxx', snare: '----x-------x---', kick: 'x-------x-x-----' }, SIXTEEN, SIXTEEN,
      { snare: 'xxxxxxxxxxxxxxxx' },
      { crash: 'x---------------', hihat: '--x-x-x-x-x-x-x-', snare: '----x-------x---', kick: 'x--x----x-x-----' }, FUNK_A, FUNK_B,
      { snare: 'xxxx------------', tom1: '----xxxx--------', tom2: '--------xxxx----', tom3: '------------xxxx' },
      { crash: 'x---------------', hihat: '--x-x-x-x-x-x-x-', kick: 'x-----x---------', snare: '--------x-------' },
      { hihat: 'x-x-x-x-x-x-x-x-', kick: 'x-----x---------', snare: '--------x-------' },
      { hihat: 'x-x-x-x-x-x-x-x-', kick: 'x-----x---------', snare: '--------x-------' },
      { crash: 'x---------------', kick: 'x---------------' }
    ] },

  // ---------- Songs: traditional children's tunes (public domain), with the melody played by the app ----------
  { id: 's1', song: true, title: 'Twinkle, Twinkle, Little Star', bpm: 80, div: 1, reps: 1,
    goal: 'Kick on 1 and 3, snare on 2 and 4, all the way through the song.',
    tip: 'Sing along in your head. The drums should stay the same even when the tune moves.',
    bars: barsOf(12, { kick: 'x-x-', snare: '-x-x' }),
    melody: 'C4 C4 G4 G4 | A4 A4 G4:2 | F4 F4 E4 E4 | D4 D4 C4:2 | G4 G4 F4 F4 | E4 E4 D4:2 | G4 G4 F4 F4 | E4 E4 D4:2 | C4 C4 G4 G4 | A4 A4 G4:2 | F4 F4 E4 E4 | D4 D4 C4:2' },
  { id: 's2', song: true, title: 'Mary Had a Little Lamb', bpm: 90, div: 1, reps: 2,
    goal: 'Your first beat, played along with the tune. The song plays twice.',
    tip: 'Hi-hat on every click, kick on 1 and 3, snare on 2 and 4.',
    bars: barsOf(8, BEAT_Q),
    melody: 'E4 D4 C4 D4 | E4 E4 E4:2 | D4 D4 D4:2 | E4 G4 G4:2 | E4 D4 C4 D4 | E4 E4 E4 E4 | D4 D4 E4 D4 | C4:4' },
  { id: 's3', song: true, title: 'London Bridge', bpm: 95, div: 1, reps: 2,
    goal: 'Same beat, with a crash at the start of each line.',
    tip: 'Crash and kick together on the very first beat, then back to the hi-hat.',
    bars: barsOf(8, BEAT_Q, { 0: CRASH_Q, 4: CRASH_Q }),
    melody: 'G4:1.5 A4:.5 G4 F4 | E4 F4 G4:2 | D4 E4 F4:2 | E4 F4 G4:2 | G4:1.5 A4:.5 G4 F4 | E4 F4 G4:2 | D4:2 G4:2 | E4 C4:3' },
  { id: 's4', song: true, title: 'Old MacDonald Had a Farm', bpm: 90, div: 2, reps: 1,
    goal: 'The rock beat through the whole song, with a crash at the start of each verse line.',
    tip: 'This one is long. Keep your hi-hat hand relaxed so it does not get tired.',
    bars: barsOf(16, ROCK, { 0: CRASH_ROCK, 4: CRASH_ROCK, 12: CRASH_ROCK }),
    melody: 'G4 G4 G4 D4 | E4 E4 D4:2 | B4 B4 A4 A4 | G4:3 D4 | G4 G4 G4 D4 | E4 E4 D4:2 | B4 B4 A4 A4 | G4:3 D4:.5 D4:.5 | ' +
      'G4 G4 G4 D4:.5 D4:.5 | G4 G4 G4:2 | G4:.5 G4:.5 G4 G4:.5 G4:.5 G4 | G4:.5 G4:.5 G4:.5 G4:.5 G4 G4 | G4 G4 G4 D4 | E4 E4 D4:2 | B4 B4 A4 A4 | G4:4' },
  { id: 's5', song: true, title: 'Yankee Doodle', bpm: 100, div: 2, reps: 2,
    goal: 'Rock beat with a short snare fill at the end of each line. The song plays twice.',
    tip: 'The fill is four quick snare hits. Count "3 and 4 and" while you play it.',
    bars: barsOf(8, ROCK, { 0: CRASH_ROCK, 3: HALF_FILL, 7: HALF_FILL }),
    melody: 'C4 C4 D4 E4 | C4 E4 D4 G3 | C4 C4 D4 E4 | C4:2 B3:2 | C4 C4 D4 E4 | F4 E4 D4 C4 | B3 G3 A3 B3 | C4:2 C4:2' },
  { id: 's6', song: true, title: 'Jingle Bells', bpm: 100, div: 2, reps: 1,
    goal: 'Rock beat with the busier kick, a tom fill in the middle, and a big finish.',
    tip: 'Everything you have learned, in one song. Slow the tempo down the first few times.',
    bars: barsOf(16, BUSY, { 0: CRASH_ROCK, 7: TOM_FILL, 8: CRASH_ROCK, 15: { crash: 'x-------', kick: 'x-------' } }),
    melody: 'E4 E4 E4:2 | E4 E4 E4:2 | E4 G4 C4:1.5 D4:.5 | E4:4 | F4 F4 F4:1.5 F4:.5 | F4 E4 E4 E4:.5 E4:.5 | E4 D4 D4 E4 | D4:2 G4:2 | ' +
      'E4 E4 E4:2 | E4 E4 E4:2 | E4 G4 C4:1.5 D4:.5 | E4:4 | F4 F4 F4:1.5 F4:.5 | F4 E4 E4 E4:.5 E4:.5 | G4 G4 F4 D4 | C4:4' },
  // ----- more songs for beginners (all traditional, free to use). The tunes are written in C so that they need no flats. -----
  { id: 's7', song: true, title: 'Hot Cross Buns', bpm: 80, div: 1, reps: 1,
    goal: 'Kick, snare, kick, snare. The shortest song there is: it plays twice.',
    tip: 'Only three notes in the tune. Keep the kick and snare even, like walking.',
    bars: barsOf(8, { kick: 'x-x-', snare: '-x-x' }),
    melody: 'E4 D4 C4:2 | E4 D4 C4:2 | C4:.5 C4:.5 C4:.5 C4:.5 D4:.5 D4:.5 D4:.5 D4:.5 | E4 D4 C4:2 | E4 D4 C4:2 | E4 D4 C4:2 | C4:.5 C4:.5 C4:.5 C4:.5 D4:.5 D4:.5 D4:.5 D4:.5 | E4 D4 C4:2' },
  { id: 's8', song: true, title: 'Frère Jacques', bpm: 90, div: 1, reps: 2,
    goal: 'Your first beat under a tune that everyone knows. The song plays twice.',
    tip: 'Every line of the tune comes twice. Your beat never changes.',
    bars: barsOf(8, BEAT_Q),
    melody: 'C4 D4 E4 C4 | C4 D4 E4 C4 | E4 F4 G4:2 | E4 F4 G4:2 | G4:.5 A4:.5 G4:.5 F4:.5 E4 C4 | G4:.5 A4:.5 G4:.5 F4:.5 E4 C4 | C4 G3 C4:2 | C4 G3 C4:2' },
  { id: 's9', song: true, title: 'Baa, Baa, Black Sheep', bpm: 85, div: 1, reps: 1,
    goal: 'Kick on 1 and 3, snare on 2 and 4, right through the song.',
    tip: 'The tune gets busy in the middle. Your hands stay calm.',
    bars: barsOf(12, { kick: 'x-x-', snare: '-x-x' }),
    melody: 'C4 C4 G4 G4 | A4:.5 A4:.5 A4:.5 A4:.5 G4:2 | F4 F4 E4 E4 | D4 D4 C4:2 | G4 G4:.5 G4:.5 F4 F4 | E4 E4:.5 E4:.5 D4:2 | G4 G4:.5 G4:.5 F4:.5 F4:.5 F4:.5 F4:.5 | E4 E4:.5 E4:.5 D4:2 | C4 C4 G4 G4 | A4:.5 A4:.5 A4:.5 A4:.5 G4:2 | F4 F4 E4 E4 | D4 D4 C4:2' },
  { id: 's10', song: true, title: 'Row, Row, Row Your Boat', bpm: 132, div: 1, beats: 3, feel: '3/4 time', reps: 2,
    goal: 'One hit in every bar of three: kick, then snare, then kick, then snare. The song plays twice.',
    tip: 'Count "ONE two three" and hit only on ONE. It should rock like a boat.',
    bars: [{ kick: 'x--' }, { snare: 'x--' }, { kick: 'x--' }, { snare: 'x--' }, { kick: 'x--' }, { snare: 'x--' }, { kick: 'x--' }, { snare: 'x--' },
      { kick: 'x--' }, { snare: 'x--' }, { kick: 'x--' }, { snare: 'x--' }, { kick: 'x--' }, { snare: 'x--' }, { kick: 'x--' }, { snare: 'x--' }],
    melody: 'C4:3 | C4:3 | C4:2 D4 | E4:3 | E4:2 D4 | E4:2 F4 | G4:6 | C5 C5 C5 | G4 G4 G4 | E4 E4 E4 | C4 C4 C4 | G4:2 F4 | E4:2 D4 | C4:6' },
  { id: 's11', song: true, title: 'If You\'re Happy and You Know It', bpm: 95, div: 2, reps: 2,
    goal: 'The rock beat, and two snare hits where everyone claps. The song plays twice.',
    tip: 'Listen for the gap in the tune: that is where your two "claps" on the snare go.',
    bars: barsOf(9, ROCK, { 2: { kick: 'x-------', snare: '--x-x---' }, 4: { kick: 'x-------', snare: '--x-x---' }, 8: { crash: 'x-------', kick: 'x-------', snare: '--x-x---' } }),
    melody: 'R:3 G3:.5 G3:.5 | C4:.5 C4:.5 C4:.5 C4:.5 C4:.5 C4:.5 B3:.5 C4:.5 | D4 R:2 G3:.5 G3:.5 | D4:.5 D4:.5 D4:.5 D4:.5 D4:.5 D4:.5 C4:.5 D4:.5 | E4 R:2 E4:.5 E4:.5 | ' +
      'F4:.5 F4:.5 F4:.5 F4:.5 A3:.5 A3:.5 F4:.5 F4:.5 | E4:.5 E4:.5 E4:.5 D4:.5 C4:.5 C4:.5 E4:.5 E4:.5 | D4:.5 D4:.5 D4:.5 C4:.5 B3:.5 B3:.5 A3:.5 B3:.5 | C4 R:3' },
  { id: 's12', song: true, title: 'The Wheels on the Bus', bpm: 100, div: 2, reps: 2,
    goal: 'The rock beat with a crash at the start of each half. The song plays twice.',
    tip: 'The tune starts one note before your beat does. Wait for it, then crash.',
    bars: barsOf(9, ROCK, { 1: CRASH_ROCK, 5: CRASH_ROCK }),
    melody: 'R:3 G3 | C4 C4:.5 C4:.5 C4 E4 | G4 E4 C4:2 | D4 B3 G3:2 | G4 E4 C4 G3 | C4 C4:.5 C4:.5 C4 E4 | G4 E4 C4:2 | D4:2 G3 G3 | C4:4' },
  { id: 's13', song: true, title: 'BINGO', bpm: 100, div: 2, reps: 1,
    goal: 'The rock beat, with a snare fill before the letters are spelled out.',
    tip: 'When the song spells B, I, N, G, O, keep your beat going underneath.',
    bars: barsOf(13, ROCK, { 1: CRASH_ROCK, 4: HALF_FILL, 5: CRASH_ROCK, 12: { crash: 'x-------', kick: 'x---x---', snare: '--x-----' } }),
    melody: 'R:3 G3 | C4 C4 G3 G3 | A3 A3 G3 G3 | C4 C4 D4 D4 | E4:2 C4:2 | E4:2 E4:2 | F4 F4 F4:2 | D4:2 D4:2 | E4 E4 E4:2 | C4:2 C4:2 | D4 D4 D4 D4 | C4 B3 G3 A3 | B3 C4 C4:2' },
  { id: 's14', song: true, title: 'Ode to Joy', bpm: 100, div: 2, reps: 1,
    goal: 'The rock beat under a famous tune, with a crash at the start of every line.',
    tip: 'Four lines of four bars. Count the bars, and crash on the first beat of each line.',
    bars: barsOf(16, ROCK, { 0: CRASH_ROCK, 4: CRASH_ROCK, 8: CRASH_ROCK, 11: HALF_FILL, 12: CRASH_ROCK }),
    melody: 'E4 E4 F4 G4 | G4 F4 E4 D4 | C4 C4 D4 E4 | E4:1.5 D4:.5 D4:2 | E4 E4 F4 G4 | G4 F4 E4 D4 | C4 C4 D4 E4 | D4:1.5 C4:.5 C4:2 | ' +
      'D4 D4 E4 C4 | D4 E4:.5 F4:.5 E4 C4 | D4 E4:.5 F4:.5 E4 D4 | C4 D4 G3:2 | E4 E4 F4 G4 | G4 F4 E4 D4 | C4 C4 D4 E4 | D4:1.5 C4:.5 C4:2' },
  { id: 's15', song: true, title: 'When the Saints Go Marching In', bpm: 110, div: 2, reps: 1,
    goal: 'The rock beat with the busier kick, and a fill in the middle.',
    tip: 'A marching song. Keep it bouncy and do not rush.',
    bars: barsOf(16, BUSY, { 1: CRASH_ROCK, 7: HALF_FILL, 9: CRASH_ROCK, 15: { crash: 'x-------', kick: 'x-------' } }),
    melody: 'R C4 E4 F4 | G4:4 | R C4 E4 F4 | G4:4 | R C4 E4 F4 | G4:2 E4:2 | C4:2 E4:2 | D4:4 | R E4 E4 D4 | C4:3 C4 | E4:2 G4:2 | G4 F4:3 | R:2 E4 F4 | G4:2 E4:2 | C4:2 D4:2 | C4:4' },
  { id: 's16', song: true, title: 'Oh! Susanna', bpm: 105, div: 2, reps: 1,
    goal: 'The rock beat with a tom fill before the chorus and a big finish.',
    tip: 'The fill goes round the toms from high to low. Slow the tempo down the first few times.',
    bars: barsOf(17, ROCK, { 1: CRASH_ROCK, 8: TOM_FILL, 9: CRASH_ROCK, 16: { crash: 'x-------', kick: 'x-------' } }),
    melody: 'R:3 C4:.5 D4:.5 | E4 G4 G4:1.5 A4:.5 | G4 E4 C4:1.5 D4:.5 | E4 E4 D4 C4 | D4:3 C4:.5 D4:.5 | E4 G4 G4:1.5 A4:.5 | G4 E4 C4:1.5 D4:.5 | E4 E4 D4 D4 | C4:4 | ' +
      'F4:2 F4:2 | A4 A4:2 A4 | G4 G4 E4 C4 | D4:3 C4:.5 D4:.5 | E4 G4 G4:1.5 A4:.5 | G4 E4 C4:1.5 D4:.5 | E4 E4 D4 D4 | C4:4' },
  { id: 's17', song: true, title: 'She\'ll Be Coming Round the Mountain', bpm: 100, div: 2, reps: 2,
    goal: 'The rock beat with a snare fill in the middle. The song plays twice.',
    tip: 'A fast tune over a steady beat. Your hi-hat hand sets the speed, not the tune.',
    bars: barsOf(9, ROCK, { 1: CRASH_ROCK, 4: HALF_FILL, 5: CRASH_ROCK, 8: { crash: 'x-------', kick: 'x---x---', snare: '--x-----' } }),
    melody: 'R:3 G3:.5 A3:.5 | C4:.5 C4:.5 C4:.5 C4:.5 A3:.5 G3:.5 E3:.5 G3:.5 | C4:3 C4:.5 D4:.5 | E4:.5 E4:.5 E4:.5 E4:.5 G4:.5 E4:.5 D4:.5 C4:.5 | D4:3 G4:.5 F4:.5 | ' +
      'E4:.5 E4:.5 E4:.5 E4:.5 D4:.5 C4:.5 C4:.5 C4:.5 | A3:.5 A3:.5 A3:.5 A3:.5 D4:.5 C4:.5 B3:.5 A3:.5 | G3:.5 G3:.5 C4:.5 C4:.5 E4:.5 D4:.5 D4:.5 B3:.5 | C4:4' },
  { id: 's18', song: true, title: 'Happy Birthday', bpm: 100, div: 1, beats: 3, feel: '3/4 time', reps: 2,
    goal: 'A waltz: kick on 1, snare on 2 and 3. Play it for someone on their birthday! The song plays twice.',
    tip: 'Count "1, 2, 3". The tune starts just before the first "1".',
    bars: barsOf(9, { kick: 'x--', snare: '-xx' }, { 8: { crash: 'x--', kick: 'x--' } }),
    melody: 'R:2 G3:.75 G3:.25 | A3 G3 C4 | B3:2 G3:.75 G3:.25 | A3 G3 D4 | C4:2 G3:.75 G3:.25 | G4 E4 C4 | B3 A3 F4:.75 F4:.25 | E4 C4 D4 | C4:3' }
];

// How finely a lesson divides each beat, in the words drum teachers use.
const FEEL = { 1: '4 beat', 2: '8 beat', 3: 'Triplet feel', 4: '16 beat', 6: 'Sextuplets' };
const COUNT = { 1: [''], 2: ['', '&'], 3: ['', 'trip', 'let'], 4: ['', 'e', '&', 'a'], 6: ['', '2', '3', '4', '5', '6'] };
const feelOf = (l) => l.feel || FEEL[l.div];

// The course: three stages, thirteen levels. Each level lists its lessons in teaching order.
const COURSE = [
  { stage: 'Beginner', name: 'Level 1: First hits', note: 'One hit per click, one pad at a time, then your first beat.',
    ids: ['l1', 'l2', 'l3', 'l4', 'l5', 'l6', 'l7', 'l8'] },
  { stage: 'Beginner', name: 'Level 2: The rock beat and fills', note: 'Two hi-hat hits per click, the toms, the crash and your first fills.',
    ids: ['l9', 'l10', 'l11', 'l12', 'l13', 'l14', 'l15', 'l16', 'l17', 'l18', 'l19', 'l20'] },
  { stage: 'Beginner', name: 'Level 3: Stick control', note: 'Rudiments: the hand patterns every drummer practises. Follow the R and L exactly.',
    ids: ['r1', 'r2', 'r3', 'r4'] },
  { stage: 'Beginner', name: 'Level 4: More kick patterns', note: 'The hands keep playing the rock beat while the kick moves around.',
    ids: ['l23', 'l24', 'l25', 'l26', 'l27', 'l28'] },
  { stage: 'Intermediate', name: 'Level 5: 16 beat', note: 'Four hits on every click. Slow tempos, both hands taking turns.',
    ids: ['l21', 'l22', 'l29', 'l30', 'l31', 'l32', 'l33'] },
  { stage: 'Intermediate', name: 'Level 6: Both feet and new beats', note: 'The second pedal joins in, and beats that feel different from the rock beat.',
    ids: ['l34', 'l35', 'l36', 'l37', 'l38', 'l39', 'l40', 'w1', 'w2'] },
  { stage: 'Intermediate', name: 'Level 7: Shuffle, blues and swing', note: 'Three hits on every click: triplets, the shuffle and the jazz ride.',
    ids: ['l41', 'l42', 'l43', 'l44', 'l45', 'j1', 'j2', 'j3', 'j4'] },
  { stage: 'Intermediate', name: 'Level 8: Stick control 2', note: 'The rudiments at speed, in triplets, and turned into a beat.',
    ids: ['r5', 'r6', 'r7', 'r8', 'r9', 'r10', 'r11'] },
  { stage: 'Intermediate', name: 'Level 9: Play it like a song', note: 'Long pieces with sections, fills and endings, the way a real song is built.',
    ids: ['l46', 'l47', 'l48'] },
  { stage: 'Advanced', name: 'Level 10: Funk', note: 'Sixteenth-note grooves where the kick and snare land between the hi-hats.',
    ids: ['f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7'] },
  { stage: 'Advanced', name: 'Level 11: Odd time and world beats', note: 'Three, five and six beats in a bar, bossa nova, samba and the train beat.',
    ids: ['o1', 'o2', 'o3', 'o4', 'o5', 'o6', 'o7', 'o8', 'o9'] },
  { stage: 'Advanced', name: 'Level 12: Independence and advanced fills', note: 'Each limb on its own job, hand-and-foot fills, and the fastest notes in the course.',
    ids: ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8'] },
  { stage: 'Advanced', name: 'Level 13: Showpieces', note: 'Complete pieces that use everything you have learned.',
    ids: ['p1', 'p2', 'p3', 'p4'] }
];
// The list the app works from: lessons in course order, then the songs.
const LESSONS = (() => {
  const byId = {};
  LESSON_BANK.forEach(l => { byId[l.id] = l; delete l.level; });
  const out = [];
  COURSE.forEach((lv, k) => lv.ids.forEach((id, i) => {
    const l = byId[id];
    l.lv = k;
    // Long enough to settle into: the pattern repeats until the lesson lasts about (2 minutes + 10 seconds per level) at its own tempo.
    // reps0 keeps the short version, which the level tests and the points still use.
    l.reps0 = l.reps;
    const barSec = (l.beats || 4) * 60 / l.bpm, want = 120 + 10 * k;
    l.reps = Math.max(l.reps, Math.ceil(want / (l.bars.length * barSec)));
    if (i === 0) l.level = [lv.name, lv.note, lv.stage];
    out.push(l);
  }));
  return out.concat(LESSON_BANK.filter(l => l.song));
})();   // '' = the beat number itself

// "C4 D4:2 R" ->[{ t: beat, d: beats, f: Hz }]; default length is one beat, R is a rest, | is ignored.
function parseMelody(str) {
  const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const out = [];
  let t = 0;
  str.split(/\s+/).forEach(tok => {
    if (!tok || tok === '|') return;
    const parts = tok.split(':');
    const d = parts[1] ? parseFloat(parts[1]) : 1;
    const m = /^([A-G])(#?)(\d)$/.exec(parts[0]);
    if (m) {
      const semi = SEMI[m[1]] + (m[2] ? 1 : 0) + (parseInt(m[3], 10) - 4) * 12 - 9;
      out.push({ t, d, f: 440 * Math.pow(2, semi / 12) });
    }
    t += d;
  });
  out.beats = t;
  return out;
}
