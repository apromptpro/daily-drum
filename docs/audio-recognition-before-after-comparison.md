# Daily Drum: pad recognition, before and after

Date: 18 November 2026. Baseline: commit `de66a53` (cache `drum-coach-41`). Nothing in this report has been published; the app's default is unchanged.

## Executive summary

**What was changed.** A second "engine" was added next to the existing one. It is off unless switched on.

- A new hit finder (`worklet2.js`). Besides overall loudness it watches three frequency ranges, so it notices a hit that the old finder misses: a quick second hit, or a drum hit while a cymbal is still ringing.
- "Ringing removal" (`ear2.js`). When something was already sounding just before a hit, that sound is taken out of the hit's fingerprint before the existing recogniser names the pad.
- The recogniser itself (`Ear.classify` in `audio.js`) is the same code as before. Setup is untouched.

**Why.** The brief was to recognise hits more accurately, especially simultaneous ones, without changing Setup.

**Is it better overall?** In the tests that could be run here (artificial recordings only), yes for hits that follow each other quickly and hits under a ringing cymbal, and exactly equal everywhere else.

**Largest improvements** (lesson mode, pads taught one by one, 8 unseen test kits):

| | Existing | Engine 2 |
|---|---|---|
| Second hit on the same pad, 90 ms after the first | 2.5% | 92.5% |
| Two different pads 70 to 150 ms apart (second hit) | 53.0% | 94.8% |
| Drum hit 120 ms after a cymbal | 63.0% | 78.5% |

**Simultaneous hits were not improved.** Three replacement recognisers were built and measured for this (a decomposition method and two small neural networks). All three named fewer correctly played chords than the existing recogniser, so none was adopted. Details are under "Rejected candidates".

**Did anything become worse?** No case was found where the existing engine was right and engine 2 was wrong (0 of 22,016 scored hits). Engine 2 costs about 1 ms more computing per hit on this desktop. See "Regressions, Trade-offs, and Unresolved Limitations".

**Recommended for production?** **CONDITIONAL.** All evidence is from artificial recordings on a desktop computer. No real pad, microphone or iPad was available. Engine 1 should stay the default until engine 2 has been tried on the real pad and iPad.

## Technical implementation comparison

| Stage | Existing (engine 1) | Engine 2 |
|---|---|---|
| Finding a hit | `worklet.js`: a hit starts when the loudness of a 128-sample block exceeds 2.2 times the recent loudness (which fades by 3% per block). No new hit for 60 ms. | `worklet2.js`: the same rule, **or** a rise of 2.5 times in one of three ranges (below about 400 Hz, middle, above about 3000 Hz). The middle and high ranges forget faster (5% and 7% per block). Same 60 ms gap. |
| Capture | 2048 samples (about 43 ms) from the start of the hit. | The same, plus the 1024 samples before the hit. |
| Time of the hit | First sample at 30% of the block's peak. | The same. |
| Fingerprint | 48 numbers: energy in 24 frequency bands, for the whole capture and for its second half. | The same. If the sound before the hit holds at least 3% of the capture's energy, its expected share is subtracted first (lessons and games only). |
| Naming the pad | `Ear.classify`: compares with taught hits, taught combinations and guessed blends of an expected chord. | The same function, unchanged. |
| Combination training | Used as taught. | Unchanged. |
| Neural network | None. | None adopted. Two were built and measured (see below). |
| Setup | | Not changed. Setup-style calls (`allPairs`, teaching, pad check, `quality()`) always use the plain fingerprint. |
| Saved calibrations | `dc.cal2`, `dc.cal2snd` | Same data, same format. Nothing new is stored. |

### Rejected candidates

All three used the existing 48-number fingerprints, so they would have worked with saved calibrations.

| Candidate | What it does | Correct pairs | Correct triples | Subset played, not over-credited | Verdict |
|---|---|---|---|---|---|
| Existing recogniser | | 92.1% | 99.0% | 61.6% | |
| Decomposition (`Ear2.makeNmf`) | Explains a hit as a sum of taught hits | 75.9% | 44.3% | 93.6% | Rejected |
| Network, trained on mixed fingerprints (`Ear2.makeNet`) | 48 inputs, 32 hidden units, one output per instrument | 73.3% | 38.8% | 88.0% | Rejected |
| Network, trained on mixed real waveforms | Same network; needs the raw capture of every taught hit | 85.0% | 45.6% | 94.8% | Rejected |
| Existing recogniser + waveform network as a veto | The network may only remove a pad it finds no trace of | 92.0% | 90.6% | 70.8% | Rejected |

Counts: 1,728 pairs, 384 triples, 1,280 subset cases; pads taught one by one.

The pattern is the same for all: they give credit for a pad that was not played far less often, but they also miss far more chords that were played. The existing recogniser deliberately gives the benefit of the doubt to a chord the lesson expects. For children practising, a missed chord that was played correctly is the worse error, so these were not adopted. The veto variant lost 8.4 points on triples for 9.2 points on over-crediting, and with taught combinations it gained nothing (89.7% both) while losing pairs (90.7% to 89.9%).

The waveform network also showed that mixing real waveforms teaches more than mixing fingerprints: it was the only candidate that coped with two pads 10 to 30 ms apart (84.8% at 10 ms against 52.7% and 45.7%).

## Accuracy comparison

**How it was measured.** 11 artificial pad sounds per kit, played through a simulated small speaker and room at 48 kHz. Each kit was taught as Setup does it (8 hits per pad through the existing finder, 6 metronome clicks). Both engines then received identical recordings. Settings were tuned on kits 1 to 3; the figures below are from kits 101 to 108, which were not used for tuning. "Correct" means the named pads are exactly the pads played. Intervals are 95% (Wilson). The p value is from a paired (McNemar) test.

### Lesson mode, pads taught one by one

| Test scenario | n | Existing | Engine 2 | Difference (points) | Verdict |
|---|---|---|---|---|---|
| Single drum hit | 1,056 | 100% [99.6, 100] | 100% [99.6, 100] | 0 | Same |
| Two simultaneous hits (all 36 pairs, 0 to 8 ms apart) | 1,728 | 92.1% [90.7, 93.3] | 92.1% [90.7, 93.3] | 0 | Same |
| Three simultaneous hits | 384 | 99.0% [97.4, 99.6] | 99.0% [97.4, 99.6] | 0 | Same |
| Quiet + loud simultaneous hits | 768 | 75.0% [71.8, 77.9] | 75.0% [71.8, 77.9] | 0 | Same |
| Exactly simultaneous | 256 | 98.8% [96.6, 99.6] | 98.8% | 0 | Same |
| 5 ms apart | 256 | 97.3% [94.5, 98.7] | 97.3% | 0 | Same |
| 10 ms apart | 256 | 98.0% [95.5, 99.2] | 98.0% | 0 | Same |
| 20 ms apart | 256 | 94.1% [90.6, 96.4] | 94.1% | 0 | Same |
| 30 ms apart | 256 | 46.1% [40.1, 52.2] | 46.1% | 0 | Same |
| Rapid successive strikes, 70 ms | 192 | 32.8% [26.6, 39.7] | 85.9% [80.3, 90.2] | +53.1 (p < 0.001) | Improved |
| Rapid successive strikes, 90 ms | 192 | 56.3% [49.2, 63.1] | 97.9% [94.8, 99.2] | +41.6 (p < 0.001) | Improved |
| Rapid successive strikes, 120 ms | 192 | 62.0% [54.9, 68.5] | 97.9% [94.8, 99.2] | +35.9 (p < 0.001) | Improved |
| Rapid successive strikes, 150 ms | 192 | 60.9% [53.9, 67.6] | 97.4% [94.0, 98.9] | +36.5 (p < 0.001) | Improved |
| Same-pad double strike, 70 ms | 240 | 0% [0, 1.6] | 41.3% [35.2, 47.6] | +41.3 (p < 0.001) | Improved |
| Same-pad double strike, 90 ms | 240 | 2.5% [1.2, 5.3] | 92.5% [88.5, 95.2] | +90.0 (p < 0.001) | Improved |
| Same-pad double strike, 120 ms | 240 | 16.3% [12.1, 21.4] | 97.5% [94.7, 98.8] | +81.2 (p < 0.001) | Improved |
| Overlapping cymbal decay, hit 120 ms after | 576 | 63.0% [59.0, 66.9] | 78.5% [74.9, 81.6] | +15.5 (p < 0.001) | Improved |
| Overlapping cymbal decay, 250 ms after | 576 | 92.9% [90.5, 94.7] | 93.8% [91.5, 95.5] | +0.9 (p = 0.06) | Same (within noise) |
| Overlapping cymbal decay, 500 ms after | 576 | 99.8% | 99.8% | 0 | Same |
| Soft hits | 528 | 77.5% [73.7, 80.8] | 77.5% | 0 | Same |
| Similar-sounding drums (singles confused with each other) | 1,056 | 0 confusions | 0 confusions | 0 | Same |
| Wrong pad played, named correctly | 288 | 97.9% | 97.9% | 0 | Same |
| Part of a chord played, no extra credit | 1,280 | 61.6% [58.9, 64.3] | 61.6% | 0 | Same |
| Metronome click alone ignored | 192 | 100% | 100% | 0 | Same |
| Pad hit together with the click | 288 | 100% | 100% | 0 | Same |
| False-positive rate: hits reported where none was played | 14,224 events | 0 | 0 | 0 | Same |
| False-negative rate: single hits not found | 1,056 | 0% | 0% | 0 | Same |
| False-negative rate: second of two quick hits not found | 1,488 | 69.6% | 13.7% | -55.9 | Improved |
| Hit timing error (isolated hits) | 1,056 | mean 0.07 ms, 95% within 0.17 ms | identical | 0 | Same |
| Median recognition time per hit (desktop) | see below | about 1.0 ms (sum of parts) | about 1.9 ms | +1.0 ms | Degraded (small) |
| 95th-percentile recognition time (desktop) | see below | about 1.1 ms (sum of parts) | about 2.0 ms | +0.9 ms | Degraded (small) |
| Peak memory usage | | Not tested reliably | Not tested reliably | | Not tested |
| Long-session stability (30,000 hits, desktop) | 30,000 | 0 faults | 0 faults | | Same |

In the second scenario of each quick pair only the second hit is scored; the first is found by both engines.

### Lesson mode, pads and the 12 lesson combinations taught

| Test scenario | n | Existing | Engine 2 | Difference | Verdict |
|---|---|---|---|---|---|
| Single drum hit | 1,056 | 100% | 100% | 0 | Same |
| Two simultaneous hits | 1,728 | 90.7% | 90.7% | 0 | Same |
| Three simultaneous hits | 384 | 89.8% | 89.8% | 0 | Same |
| Quiet + loud | 768 | 32.8% | 32.8% | 0 | Same |
| 0 / 5 / 10 / 20 / 30 ms apart | 256 each | 84.8 / 92.2 / 85.5 / 72.7 / 25.8% | identical | 0 | Same |
| Part of a chord played, no extra credit | 1,280 | 89.7% | 89.7% | 0 | Same |
| Rapid successive 70 / 90 / 120 / 150 ms | 192 each | 27.6 / 50.0 / 55.7 / 60.9% | 79.2 / 94.8 / 96.9 / 98.4% | +37 to +52 (p < 0.001) | Improved |
| Same-pad double 70 / 90 / 120 ms | 240 each | 0 / 2.5 / 16.7% | 42.9 / 92.5 / 97.5% | +43 to +90 (p < 0.001) | Improved |
| Hit 120 ms after a cymbal | 576 | 53.1% | 79.5% | +26.4 (p < 0.001) | Improved |
| Hit 250 ms after a cymbal | 576 | 90.8% | 93.2% | +2.4 (p < 0.001) | Improved |
| Hit 500 ms after a cymbal | 576 | 99.8% | 99.8% | 0 | Same |
| Soft hits, click alone, click with pad, wrong pad | | 77.8 / 100 / 100 / 98.3% | identical | 0 | Same |

A side finding about the existing design, unchanged by this work: teaching combinations makes the recogniser stricter. Over-crediting falls (61.6% to 89.7% correct), but quiet-and-loud chords are credited far less often (75.0% to 32.8%).

### Per instrument (lesson mode, pads taught one by one)

Counted over singles, soft hits, pairs, quiet-and-loud, triples, partial chords and wrong pads. Engine 2 is identical to the existing engine here because these scenarios hold no quick or overlapping hits.

| Instrument (taught places) | Times played | Precision | Recall | F1 | Harder with engine 2? |
|---|---|---|---|---|---|
| Kick | 1,678 | 97.2% | 99.0% | 98.1% | No |
| Snare | 1,518 | 97.8% | 97.4% | 97.6% | No |
| Hi-hat (closed, and open "hihatopen") | 1,143 | 93.2% | 83.3% | 88.0% | No |
| Hi-hat pedal | 1,028 | 91.3% | 73.6% | 81.5% | No |
| Crash (crash 1 and "crash2") | 882 | 100% | 92.1% | 95.9% | No |
| Ride | 1,478 | 97.9% | 93.8% | 95.8% | No |
| High tom | 609 | 100% | 100% | 100% | No |
| Low tom | 610 | 100% | 99.5% | 99.8% | No |
| Floor tom | 734 | 95.7% | 99.6% | 97.6% | No |

The app counts the two crash pads as one instrument, and the open and closed hi-hat as one; the kick pad as the kick. The bench kits have no separate kick pad.

Confusion pattern: no single hit was named as another drum. Losses are missed pads in chords and soft hits below the loudness floor. Soft hits found: kick, toms 100%; snare 97.9%; ride 81.3%; crashes 66.7%; hi-hats about 55%; hi-hat pedal 29.2%.

### Combinations

Pairs, existing engine and engine 2 alike (48 trials each): 28 of 36 pairs 100%. The others: kick+hi-hat 83.3%, hi-hat+floor tom 87.5%, hi-hat+high tom 75.0%, hi-hat+low tom 62.5%, hi-hat pedal+floor tom 60.4%, kick+hi-hat pedal 54.2%, hi-hat pedal+high tom 50.0%, hi-hat pedal+low tom 41.7%. In each, a quiet high sound is covered by a loud low one.

Triples (48 trials each): hi-hat+kick+snare 97.9%, hi-hat pedal+kick+ride 93.8%, the other five 100%.

Same-pad doubles, existing to engine 2: at 90 ms kick 12.5% to 87.5%, snare 0 to 100%, hi-hat 0 to 100%, high tom 0 to 75%, ride 0 to 100%. At 70 ms: kick 75%, hi-hat 64.6%, high tom 29.2%, snare 25%, ride 12.5%.

Hit 120 ms after a cymbal, by drum (96 each): kick 85% to 100%, snare 73% to 100%, high tom 93% to 100%, floor tom 89% to 100%, hi-hat 28% to 43%, hi-hat pedal 10% to 28%.

### Open mode (as Setup's test uses it)

Setup keeps the existing behaviour in the app. For reference, the existing recogniser without lesson expectations names 52.9% of pairs and 0% of triples (it never guesses triples there). This was not changed.

## Latency and performance comparison

Measured in the desktop browser used for the bench. **Desktop figures are not evidence for the iPad.**

| | Existing | Engine 2 | Difference |
|---|---|---|---|
| Wait from hit to pad name (capture length) | about 40 ms | about 40 ms | 0 |
| Fingerprint, per hit | 0.67 ms | 0.67 ms + 1.01 ms for the extra analysis | +1.01 ms |
| Naming the pad, per hit, median / 95th percentile | 0.28 / 0.42 ms | 0.18 / 0.29 ms (same code) | within noise |
| Hit finder, per 128-sample block (2,667 microseconds long) | 5.7 microseconds | 9.3 microseconds | +3.6 microseconds |
| Hit timing error | mean 0.07 ms | mean 0.07 ms | 0 |
| Extra files to fetch | | `worklet2.js` 5 KB, `ear2.js` 15 KB | |
| Model loading or training time | none | none | 0 |
| 30,000 recognitions in a row | no faults, same answer every time, no slowdown | the same | |
| Peak memory | Not tested | Not tested | Heap readings were dominated by garbage collection |

For the rejected candidates: network training took 1.1 to 4.8 s per kit on the desktop; one recognition 0.015 ms (network) or 1.5 ms (decomposition); model size 7.6 KB (network), 18 to 37 KB (decomposition).

iPad 8th generation: browser compatibility, AudioWorklet continuity, CPU, memory, latency, long sessions, effect on animations and scoring are all **Pending physical-device validation**.

## Regressions, Trade-offs, and Unresolved Limitations

### Regressions observed

No accuracy regression was observed in the tested cases: in 22,016 scored hits (11,008 per calibration style), there was none that the existing engine named correctly and engine 2 did not. This holds for artificial recordings only.

Operational cost of engine 2:

1. **More computing per hit.** About +1.0 ms on the main thread per hit and +3.6 microseconds per audio block on the desktop. Affects every hit. Measured over 500 to 3,000 calls. Cause: three extra frequency analyses per hit, written for clarity, not speed. No fix attempted; it could be roughly halved by reusing the fingerprint's own analysis. Unresolved. Should not block a trial; must be measured on the iPad.
2. **Two more files.** They are fetched only when engine 2 is on. `sw.js` was left alone, so they are not in the offline cache; offline, the app falls back to engine 1. To be fixed at publishing time.

### Trade-offs and risks not covered by the tests

3. **More hits are heard.** Engine 2 hears quick second hits the old finder ignored. If a real pad produces unintended double sounds (a bouncing stick), those would now count as extra hits in a lesson. Not tested; needs the real pad.
4. **Room echo.** The artificial rooms have reflections up to 35 ms. A strong, late echo could in principle be taken for a second hit. No false hit occurred in 14,224 events, but long echoes were not tested.
5. **Setup with engine 2 on.** Setup's code and its recogniser calls are unchanged, but with engine 2 on, the hits it receives come from the new finder. Teaching ignores hits closer than 150 ms, as before. With engine 2 off, Setup is bit-for-bit as before.
6. **Timing under a ringing cymbal.** A hit found by the new rule is timed to its 2.7 ms block, so it can be stamped up to about 1.3 ms early. Seen in one traced example (0.3387 s for a hit at 0.3400 s). Not measured across the set.

### Unresolved limitations (both engines)

7. Simultaneous hits were not improved. Pairs 92.1%, quiet-and-loud 75.0%, 30 ms apart 46.1%.
8. Credit for a pad that was not played: 38.4% of partial chords when combinations are not taught, 10.3% when they are.
9. Soft hits: 22.5% are not found (loudness floor), mostly hi-hats and the hi-hat pedal.
10. Same-pad doubles at 70 ms: 41.3%. The 60 ms gap between hits was kept.
11. Hi-hat and hi-hat pedal 120 ms after a cymbal: 43% and 28%.

## Test coverage and confidence

| Kind of evidence | Status |
|---|---|
| Artificial recordings, 8 held-out kits, 22,016 scored hits | Done |
| Automated check: with the switch off, 6,400 recogniser calls (lesson, Setup-style, no options) give output identical to commit `de66a53`; fingerprints identical; `quality()` identical; saved calibrations exported and loaded again in both, with and without combinations | Passed |
| Automated check: Setup-style calls ignore the ringing-removed fingerprint | Passed |
| Both hit finders run in a real audio thread (offline rendering) and match the bench: existing finds 3 of 5 hits in the trace, engine 2 all 5 | Passed |
| Engine 2 files missing: falls back to engine 1 | By code reading; not run |
| Setup screen driven by hand with engine 2 on | Not tested (microphone is blocked in the test browser) |
| Real recordings from the pad | Not tested: none exist on this computer; taught hits live only in the iPad's browser |
| Physical pad, microphone, room | Not tested |
| iPad 8th generation (all items in section 8 of the brief) | Pending physical-device validation |
| Battery use | Not tested |

The artificial kits repeat each pad's sound exactly, as a sound module does, and single hits score 100% for both engines. Real pads will score lower; the figures compare the engines, they do not predict real scores.

To repeat the measurement: open `bench/bench.html` from the local server, then in the console run `await Bench.init()` and `Bench.job('run', 'plain', {nmf:{tE:0.02}, net:{tE:0.08}, hyb:{veto:0.001, clean:true}}, ['P0','P5','A2','P4','P1','P2','P3','A1'], [101,102,103,104,105,106,107,108], {N:12, full:true})`. `Bench.out()` shows the results. P0 is the existing engine, P5 is engine 2.

## Final recommendation

**CONDITIONAL** for engine 2 (new hit finder + ringing removal, existing recogniser kept).

- Meaningful, statistically clear improvement for quick successive hits and hits under a ringing cymbal; no regression observed in any tested scenario.
- Approval is not possible: all evidence is artificial, and the brief rules out approval on artificial data alone.
- Conditions: try it on the real pad and iPad 8th generation; check for unintended double hits (point 3), per-hit time, and lesson animation smoothness.

**REJECT** for replacing the recogniser with the decomposition method or either neural network: material regressions on correctly played chords.

Engine 1 remains the default in the code.

## Rollback

- Engine 2 is off unless the address was opened once with `?ear=2`. Opening it with `?ear=1` switches back; the choice is kept in `dc.ear` in the browser.
- To remove it entirely: restore `audio.js` from commit `de66a53` and delete `worklet2.js`, `ear2.js` and `bench/`. No saved data changes format, so nothing needs converting.

## Files

| File | Change |
|---|---|
| `audio.js` | Engine switch, loading of the engine 2 files, ringing-removed fingerprint used by lesson and game calls. 24 lines added, 4 changed. |
| `worklet2.js` | New: candidate hit finder. |
| `ear2.js` | New: ringing removal, and the rejected recognisers (used only by the bench). |
| `bench/` | New: test bench. Not part of the app. |
| `index.html`, `app.js`, `app.css`, `sw.js`, `worklet.js` | Not changed by this work. |
