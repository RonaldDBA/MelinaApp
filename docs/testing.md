# Tests run

Date: 17/11/2026. First in the development environment (Linux, Node 22.23, headless Chrome via Playwright);
then **on the family's Windows** (Windows 11, section [Validation on Windows](#validation-on-windows-17112026-stage-1)).

## English, stage 1: «Le potager qui écoute» (18/11/2026)

**Tested (seen):**
- **Content** (`english.test.ts`, 10 tests):
  - Unique ids and pictures; every sound-alike pair points to existing words.
  - At least 25 new words on each of levels 1–5, and at least 60 riddles.
  - A riddle never says its own word, in at most 2 sentences.
- **Rounds** (6 levels × up to 300 seeds):
  - Right number of pictures, all different, with the answer among them. The answer is accepted and a distractor is not.
  - No `expected` in what the child receives.
  - Level 1: three different themes. Levels 2–3: same theme. Level 3: a sentence.
  - Levels 4–5: a word with a sound-alike always meets it, and the contrast is tagged. Level 6: always a riddle.
  - Real variety per level. Every tag has a French label, and the praise is at most 10 words.
- **Model** (`learner.test.ts`): a lucky tap counts less, an error counts the same, and random tapping does not look like
  knowing the words.
- **Server** (`server.test.ts`):
  - A level-1 round with 3 pictures, with no answer exposed. An invalid option gets 400; a wrong picture gets a retry
    with «Écoute encore»; the right one is graded correct with help.
  - Paper practice never picks English.
  - The staircase reaches level 4 the same day, with a sentence or riddle and at least 4 pictures.
- **E2E** (headless, muted; speech is a no-op, so the audio log is checked):
  - The 9 home cards fit above «Sur papier».
  - 3 pictures, and the English word is «spoken» once after the French instruction. It is never written on screen before
    the answer.
  - A mistake removes the picture and replays the word slower. The big speaker replays it.
  - The result shows the picture and the English word. Result and end panels fit.
  - Round 5 climbed to level 2. Levels 5 and 6 show 6 pictures with no overlap.
  - Without an English voice: a French message for the parents, and no round is opened.

**Not tested:**
- The sound of the English voice itself (tests are silent by rule).
- How Melina likes the game.
- The emoji look on the family PC (they come from Windows' own emoji font).

## Difficulty that grows with her within the session (18/11/2026)

**Reported by the guardian:** «my daughter thinks this is too easy, and I'm not seeing the difficulty growing» (Le train des nombres).

**Diagnosis on a temporary COPY of the real database (scratchpad, never `data\`):**
- `math.sequences`: official level 1, estimate 0.987, 21 first-try correct answers in a row, pending level 2.
- Every round of the evening was at level 2. The level-up waits for another day, and exploration and the «défi» were capped at official + 1.

**Change:** see «Difficulty that follows her the same day» in `docs/adaptive-engine.md`. In short:
- the session staircase climbs 3 up / 1 down;
- the pending level climbs with what she proves;
- confirmation the next day happens at the level of the answer;
- the «défi» is the staircase level + 1;
- Lila says «Ça monte d’un cran!».

**Tested (seen):**
- **Engine** (`engine.test.ts`): 4 new tests.
  - The pending level climbs to 5 the same day.
  - The next day, an easy answer confirms only level 2 and a level-5 answer confirms 5.
  - One success is not enough and help breaks the run.
  - An error above the pending level does not undo it; an error at it brings it back to the level below.
  - An error above the official level costs half and keeps the review step.
- **Staircase** (`learner.test.ts`): 5 new tests.
  - 21 correct answers go from level 1 to 6 (level 2 after 3 answers, at least 5 by the 15th).
  - Errors go down one step, never below the official level.
  - Help counts as a step down.
  - Easier rounds do not climb.
  - The day starts at the pending level and stops at the skill maximum.
  - `planRound` plays at the staircase level, and not after consecutive errors.
- **Server** (`server.test.ts`): 2 new tests.
  - 21 correct train rounds in one evening reach level ≥ 5, one step at a time.
  - The official level stays 1 with level ≥ 4 pending, and the «défi» goes above today's level.
  - The next day starts at the proven level, and one correct answer confirms it.
  - Two misses bring the level back down.
- **Replay of her real history** (copy):
  - Tonight the staircase is at level 3 and the «défi» would be level 4 (before: level 2).
  - Tomorrow she starts at level 2, with exploration at 3.
- **E2E:** after 3 first-try answers, «Encore» opens a harder round, and the bubble says «Ça monte d’un cran!».

**Not tested:** how Melina herself feels the new pace (to be watched in the next sessions; the parents' history shows the reason for every round).

## Secrets guard in Git (18/11/2026)

**Parent's request:** «be careful not to send passwords or the API key» and «each completed phase, you can update git».

- ✅ **Whole history** (`--all`): no secrets. Two false alarms from the 1st version of the rules were fixed: the model name, which is public configuration, and the fake key «k-imagem» from a test.
- ✅ **With FAKE keys generated on the spot and deleted** (no commit created):
  - blocked a file with a key in the Anthropic format;
  - blocked a `.env.local`;
  - blocked a value copied from a test `.env`, without showing the value in the message;
  - let a normal file through.
- ✅ This commit went through the guard (`pre-commit` hook), and the push went through `pre-push`.

## Hint with a 30 % limit and audible applause (18/11/2026)

**Parent's request:** «limit hint help to 30 %», in the proposed form, and «applause at the end, audible».

- **Why the applause «disappeared»:** on each correct round it was removed by the research decision (17/11): only the little chime remains. At the end of the activity and at milestones, it played TOGETHER with the speech and stayed at 30 % volume, under the voice. Now it plays in full and Lila speaks afterwards. This also applies at milestones (new level, weak point conquered, mission), by the rule of keeping everything consistent.
- **Hint:**
  - the button only appears after 20 s (paper) or after searching for 20 s (Les mots cachés, one hint per word);
  - help in more than 30 % of the last 10 answers → the round comes one level lower;
  - in the report, the hint % per skill.

**Tests**
- ✅ `pnpm typecheck`, `pnpm build`, `pnpm test` 189/189. New alarm test: with 3 of 5 answers with help, the next round goes down from level 3 to 2, with the reason; with 1 of 10, the alarm goes away. Without the rule, the test fails (level 3).
- ✅ `run_e2e.py` 117/117, with 4 new checks: the paper «Un indice ?» only after the delay; Les mots cachés with one hint per word and a wait; speech 1.9 s after the applause at the end of the activity; «Indice utilisé…» in the report.
- ⏳ Not tested with Melina. Could not HEAR the applause (rule 9). The E2E checks the order through the audio log: the speech starts at least 1.5 s after the applause.

## Deep review: bugs, errors and failures (17/11/2026)

**Parent's request:** «deep analysis of the app. look for bugs, errors, failures… fix them and reanalyse the point of failure again until it is resolved».

**How it was done**
1. Three independent reviews, reading the code only: server; engine and curriculum; screens. Result: 42 findings.
2. Each finding was checked in the code. For each one, first a test that reproduced the failure (failing), then the fix (passing).
3. Two adversarial reanalyses of the fixes themselves. The 1st found 8 problems in the server and curriculum and 9 in the screens; the 2nd checked the fixes from the 1st.
4. The E2E ran at every round; 3 of its failures were regressions or real failures (see below).

**Most serious (fixed)**
- **Game stuck at level 6:** «Le chemin des nombres», «Le train» and «Les caisses» cut the number to 3 digits (server and screen). The correct answer «4028» was refused, and the round stayed open forever.
- **Slowness with a large history:** the profile was recalculated 2 to 4 times per answer (~850 ms with 20 000 answers). Now it is incremental (< 400 ms), with a result identical to the full recalculation.
- **Transaction switched off** after a failed `BEGIN` (database busy). Now it also retries a `ROLLBACK` that failed.
- **Paper sequences:** «120 130» was read as 120130 and «34-35» as 34, −35; level 3 generated sequences with negative numbers.
- **Weak point «disappeared» without practice** (the shrinking applied to all tags), and the win over a weak point could never arrive (weight stuck at 0.086). New criterion: no longer weak + 4 consecutive first-time correct answers + one correct answer on another day.
- **Level dropped when getting an item ABOVE her level wrong** (exploration); reinforcement that went back to the level where she had made mistakes.
- **Paper sheet counted at the time of the parents' confirmation** (sometimes the next day), confirming «another day» level-ups with work from the same day. It also no longer confirms a level-up with a sheet done BEFORE it.
- **Reviews:** jumped from 7 to 30 days; became due by the exact hour, not by the day; a correct answer with a hint locked the step for the whole day.

**Others (fixed)**
- **Server:**
  - paper routes accepted game rounds;
  - the app hint did not count;
  - an AI reading stuck in «analyzing» stayed that way forever;
  - resending the confirmation lost the rewards;
  - the 2nd conquered tag got no flower;
  - a 2nd instance (double click on iniciar.bat) migrated the database and deleted uploads in progress (now there is a port check + `data/melina.lock`);
  - the report mixed up the same tag from two skills.
- **Curriculum:**
  - French: «1 groupes», «0 dizaines», «paniers pleines», «Celui qui reste» for pommes;
  - explanation «de 1 en 1» on paths going by 100;
  - wrong tags: «retenue» on 8 + 5, «zéro au milieu» on 738 and 827, sound « è » in «main», silent letter in «cactus», sound « an » in «disent»;
  - wrong sound hints in the Les mots cachés check and on paper;
  - «2» refused where «deux» was accepted; the variant «pas de» accepted any answer;
  - «de beaux chapeaux» refused;
  - paper spelling at levels 4 to 6 without getting harder (now: words from the school list with a picture and the 1st letter visible).
- **Screens:**
  - «On réessaie cette étape» only closed the card;
  - server down with no reaction at all, or with a technical message for the child;
  - sounds and speech after leaving the game;
  - a held Enter skipped the explanation;
  - interrupted speech left the effects low;
  - mute did not stop the celebration;
  - quick clicks in the report showed another period;
  - technical name of the voice (in English) on her screen;
  - reduced motion froze animations;
  - end confetti inherited from the last round;
  - options «sunk» for an instant;
  - repeated sentences with short lists.

**Regressions created by the fixes themselves, found by the tests and the reanalysis (fixed)**
- **Enter after tapping a stone or key with the mouse did not validate** (the 1st version of the «focused button» rule). The E2E caught it; the rule now uses `:focus-visible`.
- **New level with review «tomorrow»:** the skill was always due and Les caisses de pommes never showed the 2nd skill. Now the review comes within 4 days.
- **«1 750 2 000»** (thousands with a space, as in Québec) started being read wrongly by the new reader. Now it picks the reading that gives the expected quantity.
- **Old sheet affecting the present** (a consequence of counting the sheet at the time she finished): a sheet from days before could complete a level-up on the same day, pull the review into the past or drop the level because of old mistakes. Now a sheet from a day BEFORE the last practice only adjusts the estimate.
- **Lock against two instances that could stop the game from opening:** Windows reuses process numbers. Now a lock older than 60 s is always stale, and closing the window (SIGHUP) releases the lock.
- **Level 6 dictation easier than level 4** (the pool fell back to level 1 words). Now it stays on words of level 3 or more.
- **Mouse click on the sound + Enter toggled the sound again:** `:focus-visible` can turn into «keyboard» on the Enter itself. Now the game records whether the last action was a tap/click or a Tab.
- **Minor:** hints for ê, î, ô, û, au, qu, gn; «traineau»/«boite» accepted (1990 rectified spelling, accepted in Québec), but not «sur» for «sûr»; a stale open transaction is undone at the next `BEGIN`.

**Tests**
- ✅ `pnpm typecheck` and `pnpm build`.
- ✅ `pnpm test` 188/188. New files:
  - `content-quality.test.ts`: sweeps all generators, levels 1 to 6, hundreds of seeds (negatives, French, tags, hints, explanation step);
  - `evaluate.test.ts`, `db.tx.test.ts`, `perf.test.ts` (20 000 answers) and `apps/game/src/praise.test.ts`.
  - Each fix first had a failing test; in several cases I checked by removing the fix and seeing the test fail.
- ✅ `run_e2e.py` 113/113, with new checks:
  - level 6 with 4 digits typed;
  - «On réessaie cette étape» opens the step directly;
  - server down and back (notice, «Réessayer», images);
  - held Enter;
  - keys tapped with the mouse + Enter;
  - sound clicked + Enter;
  - Tab to «Accueil» + Enter.
- ✅ Smoke test on a temporary copy of the real database (deleted): migration 6 was applied with an automatic backup first, and the real history was recalculated.
- ✅ Second instance (compiled server, temporary folders, no window):
  - port taken by another program: exits without creating the database and preserves the upload in progress;
  - live lock: exits;
  - stale lock (dead process or older than 60 s): starts.
- ⏳ Not tested with Melina. Could not test really closing the console window (SIGHUP) nor the real voice and sounds (rule 9).

**Not reproduced:** the single Les mots cachés failure (click on a letter stuck for 30 s), seen once before the review. The E2E now saves the screen and the console (`FAILURE.png`, `FAILURE.txt`) on any failure.

**Conscious decision:** getting an item ABOVE her level wrong does not trigger «reinforcement after difficulty» (it is not a weakness at her level); it only cancels the pending level-up.

## What the research asked for and was missing: A–E (17/11/2026)

**Parent's request:** «Yes, do A–E», after the adversarial analysis of the research report against the code.

**A. Weak point conquered only on another day**
- On the same day: «🌱 Presque gagné : retenue! On vérifie un autre jour.», without a big celebration.
- On the next day, the 1st first-time correct answer with the tag confirms it: celebration, «🌟 Point fort gagné!» and a flower.
- Defect found along the way: with two tags conquered together, the celebration talked about the generic one («addition»). Now the most specific one wins.

**B. Report using the same model as the Tableau de bord**
- Super-pouvoirs and On s’entraîne use the same model weights the dashboard uses. Before, the report used the raw %, and the two tabs could disagree.
- Ça monte / Coup de pouce: the tag weight fell or rose by ≥ 0.15. A decline only counts when she practised at the **same level** as before (or below).
- Skills: «En progrès» when the level goes up or the estimated ability rises ≥ 0.3. «À retravailler» when the level goes down, when **reviews done on another day** fail (≥ 2, fewer than half right) or when the ability drops ≥ 0.5 at the same level. With fewer than 3 answers: «🔎 Peu de données».
- Each skill shows «révisions un autre jour : 2/3».
- The band «À garder à l’œil (50–60 %)» was removed. «🌱 Presque gagné» came in.
- Each tag appears in only one box, by priority: to strengthen > presque gagné > coup de pouce > super-pouvoir > ça monte. The preview with the real history showed «pluriel en -s» in three boxes at the same time.
- With fewer than 15 answers in the week (40 in the month), the notice «les tendances sont des indices, pas des conclusions» appears.
- The 4 numbers at the top no longer have a change pill. Quantity should not become a goal, and the change in raw % is misleading when the level goes up.

**C. Stars are not currency**
- A wrong answer earns no star, and the result panel does not show greyed-out stars.
- Each game's card shows «Niveau N · 🌻 flowers» instead of the star total, which grew just from playing.

**D. 14- and 30-day reviews** for what is already mastered, with one step per day (see `docs/adaptive-engine.md`).

**E. «🏡 À la maison» in the report**
- A short activity for home: from the skill to strengthen or, failing that, from the most practised one.
- A question to talk about with her.
- In the month, a small goal to choose with her.
- The notice «Pas de récompense ni de punition selon les résultats».

**Tests**
- ✅ `pnpm typecheck` and `pnpm build`.
- ✅ `pnpm test` 142/142 (3 runs in a row). New or rewritten tests:
  - **model:** «presque» on the same day, win only on day 3 after a mistake on day 2;
  - **reviews:** one step per day; 1, 2, 4, 7, 14, 30 for the mastered, and stops at 7 for the rest;
  - **server:**
    - weak point: no celebration on the same day, `almost` = retenue, flower only the next day;
    - report: the weak points are the same as in the Tableau de bord, one box per tag, low-data notice, «À la maison» and goal of the month;
    - **levelling up with 50 % does not show as a decline** (before it did);
    - games: the card carries level and flowers, no stars, and a mistake gives 0 stars.
- E2E: see the result below.
- ⏳ Not tested with Melina.

## Rewards that inform: specific praise, weak point conquered and seed only with a correct answer (17/11/2026)

**Parent's request:** «Yes, do all 3», for the 3 fixes from the text about rewards.

**1. Praise with the round's data** (`packages/curriculum/src/praise.ts`, `strategyPraise`)
- The server returns `praise` in each answer: a short sentence about what she DID in this round, never about the person.
- Examples: «Tu as trouvé la règle : on ajoute 2.», «Tu as bien fait la retenue.», «Tu as bien écrit le son « on ».», «Tu as fait le saut de 7 sans te tromper.».
- After a corrected mistake: «Tu n’as pas abandonné et tu as trouvé!».

**2. Celebration when a weak point becomes strong**
- The model remembers that the tag was weak (weight ≥ 0.2). When the weight drops to ≤ 0.05, it counts as conquered.
- A flower sprouts in the garden (`flower.tag.<skill>.<tag>`), once per tag.
- The screen does the big celebration with «🌟 Point fort gagné!». The sentences work with any label: «Nouveau point fort : retenue!».
- Fix made during testing: in the 1st version, the celebration never triggered. The tag stopped being «weak» at 0.2, so on reaching 0.05 the server no longer knew it had been weak. It was solved with the `wasWeak` memory in the model, recalculated from the history, without a migration.

**3. Mission seed only with a correct answer**
- With a wrong answer, the step stays open.
- The screen says «🌱 La graine t’attend : on réessaie cette étape avec une nouvelle question.» and the button «On réessaie cette étape».
- The new question comes as reinforcement of the same skill. Nothing she has already earned is taken away.

**Tests**
- ✅ `pnpm typecheck` and `pnpm build`.
- ✅ `pnpm test` 139/139 (3 runs in a row). New tests:
  - the praise of every round of every game, levels 1 to 6, starts with «Tu», has at most 10 words and does not praise the person;
  - the praise uses the real data: rule of the suite, jump of the grenouille, sound of the word;
  - the model: the tag goes through «no longer weak, but not yet conquered» and the win is announced only once;
  - the server: after creating the weakness in retenue, the correct answers carry `conquered`, the flower sprouts and the celebration does not repeat;
  - the mission with one wrong step: no seed, step open, redone as «Renforcement après une difficulté récente.» and completed.
- ✅ `run_e2e.py` 101/101. A wrong step 2 does not give the seed; redone correctly, the «graine de carotte» sprouts.
- ✅ Smoke test on a temporary copy of the real database (deleted at the end), with `runtime\node.exe` 24: the 9 skills were recalculated; 3 correct rounds gave specific praise.
- ⏳ Not tested with Melina. Could not see the weak-point celebration on the real database: today she has no weak point.

## Same look across the whole parent area; dates in full; sounds and messages from the research (17/11/2026)

**Parent's requests**
- the cheerful look of the report on ALL tabs;
- wrong date: «mar. 17» was read as «March»;
- rewards without «paying to play»;
- completion sounds and messages researched and validated (`research_notes/Completion sounds and messages/notes.md`).

**Parent area with a single theme**
- **Header:** sky, grass and sun; tabs as pills with emoji; rounded, colourful buttons, fields, lists, tables and boxes.
- **Tableau de bord:** cards with emoji, skill cards with a maîtrise bar, ✨/🎯 stickers for what the game learned, reviews as badges and colourful panels.
- **Historique:** timeline by day, with cards and badges.
- **Exemples, Art du jeu, IA et données:** the same theme.

**Dates:** always in full («mardi 17 novembre 2026», «lundi 16 novembre, 23 h 25», in `apps/game/src/dates.ts`). No raw «2026-11-16» and no «mar.». In the report, days that have not come yet appear as «à venir», and today as «(aujourd’hui)».

**Rewards that inform**
- The accumulated star scoreboard at the top and the «Encore 2 essais», which was an attempt count for the child, were removed.
- The end of the activity says «3 défis faits, dont N réussis du premier coup».
- A **flower in the garden** sprouts with each confirmed level (reward `flower.<skill>.<level>`).
- **Autonomy:** after 2 first-time correct answers, she can choose «🚀 Un défi plus difficile?» (round one level up, reason `child-choice`).

**Sounds (research rules)**
- **Mistake:** no sound. The two descending notes were removed.
- **Correct:** 3-note chime, 4 variations, with 0.28 s audible (max. 0.6).
- **End:** chime with applause, 3 variations, 1.7 s (max. 3).
- **Milestone:** 2 variations, 3.3 s (max. 5), and a tap on the panel skips the celebration.
- The effects lower while the voice speaks.
- **Voice:** rate 0.9 to 0.95, pitch 1.05 to 1.1; before, the reaction used pitch 1.45.

**Messages (`apps/game/src/praise.ts`)**
- **Varied markers** instead of the fixed «Bravo!»; none of the last 3 sentences of the same context repeats.
- **Full sentence with the strategy:** on the 1st correct answer of the session, every 3 correct answers and always on a hard item.
- **Correct after a mistake:** sentences about persistence and self-correction.
- **Answer shown:** neutral opening and the explanation.
- **End and milestone:** their own, specific sentences.
- **Sentences praising the person were removed:** «Tu lis comme une vraie détective», «Quelle championne!».

**Tests**
- ✅ `pnpm typecheck` and `pnpm build`.
- ✅ `pnpm test` 135/135. New test: the level confirmed the next day plants the flower, and the «défi» she chose opens the round one level up.
- ✅ `run_e2e.py` 100/100:
  - the 1st mistake shows «Prends ton temps» and no attempt count;
  - the 3 sounds are generated in memory only and measured within the maximum durations;
  - the section «Ce que le jeu a appris» and the history as cards appear.
- ✅ The 7 parent tabs were screenshotted with the real history, on a temporary copy.
- ⏳ Not tested with Melina; could not hear the sounds or the voice (rule 9).

## Cheerful report and the 3 research recommendations (17/11/2026)

**Report redesigned** (parent's request: «relaxed, colourful, lively; it does not need to look enterprise»)
- **Header:** sky, grass and sun, with Lila 🦔 and a summary sentence to read with her.
- **Numbers:** colourful cards with emojis; changes become gentle badges (green or peach, never red).
- **«Le jardin de la semaine»:** each day a stem with a flower 🌻/🌼/🌷, according to the first-time correct answers.
- **Skills:** cards with an icon, colourful bar and trend badge (🚀 En progrès, 🌱 Nouveau, 💪 À retravailler).
- **Sticker boxes:** ✨ Ses super-pouvoirs, 📈 Ça monte!, 🎯 On s’entraîne, 🤏 Petit coup de pouce, 🔍 À garder à l’œil.
- **End:** «Ses jeux préférés» and «Idées pour la suite».
- **Printing:** prints in colour.
- ✅ Preview with the real history on a temporary copy (`tests/e2e/output/report-preview/`).

**Recommendation 1: level up only after confirming on another day.**
- The streak of correct answers leaves the level-up pending (`pendingAdvance`), with a review scheduled for the next day. The first independent correct answer on another day confirms the level; a mistake cancels the pending state.
- On the same day, the learner model gives «avant-goûts» of the next level, so she does not stand still.
- **Priority revised:** with a known weak point, ~half of the rounds reinforce that point, at the level she is really at. Before, when she seemed «bored», exploration always won and the weak point was never trained; the end-to-end test revealed this.

**Recommendation 2: proportional celebration.**
- **Correct round:** little chime, a few confetti (26) and «Bravo!» with process praise.
- **End of the activity:** little chimes with applause and normal confetti.
- **Big celebration** (crowd, whistles, cannon confetti, «🚀 Nouveau niveau!»): only at milestones, that is, a new confirmed level or a completed mission.

**Recommendation 3: feedback that explains and process praise.**
- **1st mistake:** the mistake recognized; if it is not recognized, «Astuce : » with the strategy.
- **2nd mistake:** the strategy.
- **Correct:** a sentence naming what she did right («Tu as trouvé la règle de la suite»). After a mistake and then a correct answer, the praise goes to persistence.
- The voice never says the child's name.

**Tests**
- ✅ `pnpm typecheck` and `pnpm build`.
- ✅ `pnpm test` 134/134, with 0 failures in 10 runs in a row. The engine tests were rewritten for confirmation on another day and include cancellation by a mistake.
- ✅ `run_e2e.py` 100/100:
  - the end of the activity has normal confetti, without the big celebration;
  - the sounds «chime», «win» and «celebrate» are generated in memory only, without playing and without clipping;
  - the correct-answer panel shows the praise.
- ⏳ Not tested with Melina; could not hear the real sounds (rule 9).

## Level 6 «Défi», beyond 2e année; research on learning (17/11/2026)

The parent asked for level 6 «Défi» and research in official sources (report in
`reports/Child learning ages 7 to 10.md`, notes in `research_notes/`).

**Level 6 in each skill** (2e cycle content)

| Skill | Level 6 |
|---|---|
| Tens and ones | 4 digits: role of each digit, composing with a zero in the middle |
| Groups | groups of 100 up to 4 999 |
| Sums (paper) | 4 digits with regrouping |
| Grenouille | jumps of thousands and hundreds |
| Suites and train | skip counts from the times tables (6, 7, 8, 9, 11, 12, 15) and by 250/500 up to 9 999 |
| Path | crossing the thousand (999 → 1000, 2 950 → 3 050) |
| Dominoes | 4000 + 500 + 7 |
| Plural | -al/-ail → -aux and the exceptions in -s (bals, chandails) |
| Comprehension | 2 original inference texts |
| Mots cachés | the whole year's list (even weeks not yet covered), 8 words, dictation |

**Database:** migration 5 recreates the rounds table accepting levels 1 to 10, headroom so as not to recreate it again.

**Progress report, adjusted by the research**
- Levelling up already counts as progress: «En baisse» no longer appears when the % drops because the level went up.
- «À surveiller» becomes 50–60 %, because ~70 % is the challenge zone the engine aims for.

**Screens:** 4-digit numbers shrink the font in the dominoes.

**Tests**
- ✅ `pnpm typecheck` and `pnpm build`.
- ✅ `pnpm test` 133/133. The high-level tests now cover 4, 5 and 6 in all games and sheets: numbers up to 9 999 at level 6, correct answer accepted, mistakes refused and a single correct option.
- ✅ `run_e2e.py` 99/99: the 8 games also opened at level 6, everything inside the stage and nothing overflowing.
- ✅ Migration 5 on a temporary copy of the real database:
  - migrations 1 to 5 applied, with the automatic `pre-migracao` backup first;
  - the same 78 rounds and 70 attempts, with the rounds identical field by field;
  - `integrity_check` ok and no broken references.
- ✅ `smoke_copy.py` 13/13 on a temporary copy.

**GitHub:** the `origin` remote points to the private repository. The push was left for later, at the parent's request: the GitHub login did not open in this session and there was a momentary DNS failure. Before the push it was checked that: there is no API key in the whole history; the PDFs and photos of the tests, `.env`, `data\` and the copies are outside the repository.

## Weekly and monthly report; old sound stuck in the cache (17/11/2026)

**Old sound in the fishing game:** the parent still heard the «accordion» in the fishing game.
- **Probable cause:** the game is served with a fixed name (`/assets/app.js`) and the server allowed caching. Edge could keep running the old code after the update.
- **Fix 1:** each build changes the address (`app.js?v=…`, plugin `melina-build-stamp` in `vite.config.ts`).
- **Fix 2:** the server sends `cache-control: no-cache` with an ETag for the game files.
- ✅ Checked on a server with a temporary copy: `/assets/app.js?v=mwlcfiuy`, `cache-control: no-cache`, ETag present.
- ⏳ Not verified in the family's app: it was not open, so it was not possible to see which version had played.

**Report (`Espace parents → Rapports`, `apps/server/src/report.ts`)**
- **Period:** week (Monday to Sunday) or month, with navigation to previous periods and comparison with the previous period.
- **Indicators:** activities, % correct first time, practice days and estimated minutes, each with its change.
- **Chart:** day-by-day bars, with the share answered correctly first time.
- **Table per skill:** current and previous correct rate, level at the start and at the end, trend with icon and label (en progrès / stable / en baisse / nouveau).
- **Points per tag (minimum of 3 essais):** points forts (≥ 85 %), à renforcer (≤ 50 %), en amélioration (+15 pts), en baisse (−15 pts), à surveiller (50–70 %).
- **Automatic recommendations:** short and without comparing with other children.
- **Print / PDF:** only the report sheet, without menus.

**Fix in the model:** reinforcement of a weak point now happens at a level where that point exists. Before, at level 5 of grenouille, for example, there is no carrying of ones, and the reinforcement had nothing to train.

**Tests**
- ✅ `pnpm test` 133/133. The new test simulates two weeks: the current week all wrong and the previous one all right. It checks the period label, the 7 days, the indicators, the «baisse» trend, the weak and declining points, the strong points of the previous week and the month with 30 days.
- ✅ The model test became stable: 0 failures in 10 runs.
- ✅ `run_e2e.py` 91/91, with 3 new checks: weekly report, monthly report (one bar per day) and printed version without menus.

## Model that learns from her: weak and strong points (17/11/2026)

**Parent's request:** that the app learn from her, strengthen the weak points and build on the strong points, even beyond school. The design is in `docs/adaptive-engine.md`.

**Tests**
- ✅ `pnpm typecheck` and `pnpm build`.
- ✅ `pnpm test` 132/132, with 7 new tests:
  - someone who always gets retenue wrong has «retenue» as a weak point and «soustraction» as a strong point;
  - someone who gets everything right has their ability rising and the plan exploring the level above;
  - with a weak point, the plan reinforces and prefers exercises with that tag;
  - with little information, the round is normal;
  - a correct answer after a mistake is worth less;
  - no exploration after mistakes;
  - **end-to-end server:** 14 rounds of Saute-grenouille getting the sums with retenue wrong make «retenue» appear on the dashboard. In the next 6 rounds, at least 2 are reinforcement with retenue.
- ✅ `run_e2e.py` 88/88. The new section appears on the parent dashboard.
- ✅ `smoke_copy.py` 13/13 on a temporary copy of the real database.
- ✅ **Real history on a temporary copy:**
  - there are no clear weak points yet, because there are few answers per skill;
  - there are already strong points: rods and cubes, calculation across 10, counting dots and the change of ten;
  - in «Le même nombre», the estimated comfortable level is 2 (ability 2.77).
- ⏳ **Not tested:** the effect over weeks with Melina; the parameters (learning rates, thresholds) need to be reviewed with real use.

## All skills up to level 5 and a crowd instead of the fanfare (17/11/2026)

**Parent's requests:** «turn on all levels» and replace the «accordion» at the end of the activity with a crowd clapping.

**Sound**
- The synthesized trumpet fanfare, which sounded like an accordion, was removed.
- **End of the activity:** 2 confetti poppers, a crowd applauding for ~4 s with room echo, an «ooooh!» from the crowd, 2 whistles and sparkles.
- **Correct round:** rising little chimes and short applause.

**Levels 4 and 5**
- **Dominoes:** 4 = 2-digit sum ↔ result; 5 = 3-digit number ↔ expanded form (300 + 40 + 7).
- **Saute-grenouille and sums on paper:** 4 = 3 digits ± 2 digits with regrouping; 5 = jumps of hundreds and tens (paper: 3 digits ± 3 digits).
- **Train and suites on paper:** 4 = skip counts by 3, 4 or 25 passing 100; 5 = skip counts by 20, 50 or 100 up to 999.
- **Number path:** 4 = by 1 across the hundred; 5 = by 10 across the hundred.
- **Tens and ones (paper):** 4 = role of each digit in 3-digit numbers; 5 = exchanges (13 tens = 1 hundred and 3 tens) and «how many tens in total».
- **Groups of 10 (paper):** 4 = 101 to 399; 5 = boxes and trucks (groups of groups).
- **Apple boxes (game):** the screen holds 10 boxes. That is why 4 and 5 use the maximum that fits, and 5 asks how many fruits are missing to fill the last box.
- **Plural, aligned with the school aide-mémoire:**
  - 3 = nouns ending in s, x, z and -au/-eu;
  - 4 = -ou with the 7 exceptions, and bleu/pneu;
  - 5 = the whole noun group (des beaux chapeaux).
  - -al → -aux was removed, because the book does not cover it in 2e année.
  - Plural with «des» or «les» in front is accepted.
- **Comprehension:** 4 new original texts. Those at level 4 have 7 sentences and «pourquoi/comment» questions; those at level 5 have 8 sentences, with beginning, middle and end.
- **Screens adjusted for level 5:** smaller font in the long domino sums, in the long stories and in the two-word labels of the fishing game.

**Defect found and fixed:** answers with an apostrophe («l'automne») were refused when grading short answers. Now the apostrophe counts as a space.

**Tests**
- ✅ `pnpm typecheck` and `pnpm build`.
- ✅ `pnpm test` 125/125, with 3 new tests:
  - all skills have 5 levels;
  - the 8 games at levels 4 and 5, with 80 seeds each: correct answer accepted, typical mistakes refused, exactly 1 correct option and at least 3 options, nothing above 999, variety;
  - the paper exercises at levels 4 and 5.
- ✅ `run_e2e.py` 87/87, with 7 new checks: the 7 games opened at level 5, everything inside the stage and no text overflowing its box.
- ✅ The 4 long stories measured one by one: they fit on the page.
- ✅ `smoke_copy.py` 13/13 on a temporary copy of the real database, already with migration 4.
- ⏳ **Could not be tested:** how the crowd sounds on the speakers (rule 9).

## Faster levelling up and Les mots cachés up to level 5 (17/11/2026)

**Parent's request:** the complexity went up slowly, the words repeated and were too simple. He wants the app to
go up until it finds her limit, but only after the foundation is confirmed.

**What the database showed** (read on a copy):
- She played with the old list, of 18 words. The open app did not have the school list yet, hence the repetition.
- The engine only had 3 levels and required 3 correct answers in a row to go up. In Les dominos she was already at the ceiling (level 3, 5 correct answers in a row).

**Changes**
- **Engine:** the foundation still requires 3 correct answers at level 1; above it, 2 are enough. The ceiling is the skill's: 5 in Orthographe, 3 in the others. Details in `docs/adaptive-engine.md`.
- **Les mots cachés:** 5 levels, with increasingly harder words and checks and less repetition (table in `docs/curriculum.md`).
- **Database:** **migration 4.** The rounds table only accepted levels 1 to 3, and that is why the level 5 round did not open in the test. The table was recreated accepting 1 to 5. Foreign keys are turned off only during the copy and checked at the end; if anything breaks, nothing is changed.
- **Parent area:** the manual choice offers levels 4 and 5 for Orthographe.

**Tests**
- ✅ `pnpm typecheck` and `pnpm build`.
- ✅ `pnpm test` 122/122, with 3 new tests:
  - engine: goes up from 1 to 5 and stops at the ceiling; goes down with 2 mistakes;
  - levels 4 and 5: correct grid, number of words and check; the average word difficulty rises with the level;
  - fewer than 5% repeated words in 40 rounds in a row.
- ✅ `run_e2e.py` 80/80, with 3 new checks: level 5 with a 12×12 grid and 7 words inside the stage; dictation with no letter visible; correct dictation accepted.
- ✅ **Migration on a copy of the real database**, with the bundled server:
  - migrations 1 to 4 applied, with the automatic `pre-migracao` backup first;
  - the same 66 rounds, 58 attempts and 9 mastery records, with the rounds identical field by field;
  - `integrity_check` ok and no broken references.
- **Manual copy before the migration (rule 8):** `copias-seguranca\melina-antes-migracao-4-20261117-175938.db`.
- ⏳ **Not tested:** the family's app has not migrated yet. The migration happens when the app is reopened, after the automatic backup.

## New celebration: fanfare, applause, «Bravo!» and confetti (17/11/2026)

Parent's request: the activity-complete sound was «very ugly»; he wanted something lively, like «bravooo», applause
and falling confetti. All sounds are synthesized in the app itself (Web Audio), with no third-party sound files.

**Sounds by moment**

| Moment | Sound | On screen |
|---|---|---|
| Correct round | trumpet «ta-da», sparkles, ~1.5 s of applause, «Bravo!» spoken in a lively tone | normal confetti |
| Activity complete (end of the game) | 2 confetti poppers, trumpet fanfare, ~4 s of crowd applauding, sparkles, «Bravo! Bravo!» and the final sentence | big confetti: cannons in the 2 bottom corners + long shower (~260 pieces: rectangles, ribbons, dots, stars, spinning in 3D) |
| Correct paper sheet | «ta-da» with applause | normal confetti |
| Paper sheet with mission complete | big celebration | big confetti |

- Word found in Les mots cachés: the short arpeggio stays, without applause.
- Compressor on the output, so that fanfare and applause together do not clip.
- The voice **never says the child's name**: Edge's natural voice may be online (rule 4).
- With «prefers-reduced-motion», the confetti does not appear.

**Tests**
- ✅ `pnpm typecheck` and `pnpm build`.
- ✅ `run_e2e.py` 77/77, with 3 new checks, all **without sound**:
  - end of game with big confetti (260 pieces);
  - the «win» and «celebrate» effects rendered in an `OfflineAudioContext`: the sound is generated in memory only, nothing comes out of the speakers. Peak 0.67 and 0.69 (no clipping); average volume 0.09 and 0.11.
- ⏳ **Could not be tested:** how it really sounds. The tests do not play sound (rule 9), and the spoken «Bravo!» depends on the voice installed in Windows.

## School word list in Les mots cachés (17/11/2026)

The parent sent photos of the school's 2e année aide-mémoire: «Les mots à savoir écrire», themes 1 to 7, 31 weeks.
The list was transcribed into `content/french/school-words.json` and the parents choose the week in the parent area. The photos
stayed only in the conversation: they were not copied into the project nor sent to any service.

- ✅ `pnpm typecheck` and `pnpm build`.
- ✅ `pnpm test` 119/119, with 3 new tests:
  - list: 31 weeks, grid forms, no repeated form, only letters that fit in the grid;
  - generator: with 6 different weeks × 3 levels × 40 seeds, only words up to the week, each word only once, no word inside another, check from the week itself;
  - server: invalid week refused (400) and week 1.1 applying to the next round.
- ✅ `run_e2e.py` 74/74, with 2 new checks:
  - in the parent area, week 1.2 is chosen and shows the words (marks «à côté de*», which does not go into the grid);
  - the next round uses only words up to week 1.2, with the check taken from the week itself.
- ✅ `smoke_copy.py` 13/13 on a **copy** of the real database: the 8 games, including Les mots cachés with the new list.
- **Defect found and fixed:**
  - **What happened:** 3-letter words (oui, sur, ici…) sometimes also appeared by chance on the diagonal, at the level where the diagonal does not count.
  - **Fix:** now the grid requires each word to appear only once in any direction.
- **Review the transcription:** it was done by hand from the photos; it is worth a check.
- ⏳ **Not tested with Melina.**

## Jardin de Lila with photos (17/11/2026)

Parent's request: the garden (paper activities) was «horrible and not real». His decisions: keep the girl
drawn and generate the 6 garden cards (`garden.bg`, `garden.shed`, `garden.well`, `garden.bed`, `garden.sprout`,
`garden.sunflower`), 3 candidates each, medium quality.

| Generation in the open app (backup `backup-2026-11-17T22-01-39-529Z-manual`, daily limit back to 25) | |
|---|---|
| Images | ✅ 18/18 generated, no failures |
| Scenery | 3/3 approved by Claude; **landscapes in perspective** (sky, trees and lake in the top third) |
| Remise | only no. 1 approved (2 and 3: no grass underneath, low point of view) |
| Puits, potager, pousse | 3/3 approved |
| Tournesol | only no. 3 approved (no. 1 failed the technical check: stem cut at the edge) |

Nothing was approved in the real app: the 18 are waiting for the parents in the studio.

**Garden adjustment:** with the photo scenery (perspective), the remise was «floating» in the trees and the girl walked across the sky.
Now there are two layouts in `GardenScene.ts`. The **fallback drawing**, seen from above, keeps the usual positions. The **photo**
puts everything on the lawn and keeps the girl below line 250 of the world. There, the closer to the camera, the bigger the girl, and
pieces and girl are drawn in depth order. The empty rectangle that appeared in the corner when there was
no written goal also disappeared.

- ✅ `pnpm typecheck`, `pnpm build`, `pnpm test` 116/116, `run_e2e.py` 72/72 (with the fallback drawing).
- ✅ Preview on a **copy** of the database, with the first candidate approved by Claude in each card
  (`tests\e2e\output\garden-preview\`). The girl stops at the edge of the lawn and passes behind the potager.
- ⏳ Not tested: sceneries 2 and 3 in the photo layout (only no. 1 went into the preview); pousses and tournesols over the
  potager photo (the copy had no rewards).

## Giving up on a paper activity (17/11/2026)

Parent's request: being able to leave a paper activity. Button « J’arrête » in the exercise, with confirmation
(« Tu veux arrêter cette activité? Ce n’est pas grave… », « Oui, j’arrête » / « Non, je continue »). It uses the cancellation
that already existed on the server: no evaluation, no mastery change; in a mission, the step stays open and comes back
with a new exercise.

- ✅ `pnpm test` 116/116 (new test: cancelling in the mission creates no attempt, mastery or step; the step returns another exercise).
- ✅ `run_e2e.py` 72/72 (3 new: confirmation appears; «Non» goes back to the exercise; «Oui» cancels without evaluation).
- ⏳ Not tested with Melina. The app open at home needs to be reopened to show the button.

## First real art generation in the studio (17/11/2026)

Parent's request: 19 cards × 3 candidates, medium quality, in the real app. Done through the app that was open
(started by `iniciar.bat` at 4:03 p.m.), with the same effect as clicking « Générer des candidates »:
manual app backup first (`backup-2026-11-17T21-34-59-889Z-manual`), daily limit 25 → 60 during generation and back
to 25 at the end. **Nothing was approved**: the 57 candidates await the parents' decision in the studio.

| Result | |
|---|---|
| Images generated | ✅ 57/57 (`gpt-image-2.5-sunburst`, medium), no OpenAI failures |
| Technical check | ✅ 54/57; the 3 of the **pond** failed for touching the edge (the card asked for «edge to edge» and a transparent background with a margin at the same time; card fixed) |
| Claude's check | 43 approve, 1 refuses, **13 errors** |
| Visual (contact sheets) | realistic, consistent photos; Lila a real hedgehog on all fours; clean transparent pieces over a green background |

**Defect found and fixed:** the 13 errors were Claude responses that were **cut off** (`stop_reason: max_tokens`): the current model
«thinks» before answering and the thinking counts against the 700-token limit. Limits went up to 3000 (check),
2000 (drafting the request) and 2000 (**reading Melina's handwriting**, which used 400 and ran the same risk). A cut-off response
now produces a clear message (art) or a retry (reading). Checked with real calls on 2 candidates that had
given an error: both answered in full. Tests 115/115.

Pending: the open app still runs the previous version; the 13 checks with errors can be redone («Vérifier avec Claude»)
after reopening the app.

## Code review fixes (17/11/2026, Windows)

| # | Finding | Fix | How it was checked |
|---|---|---|---|
| 1 | Clips served whole, without partial requests (MP4 might not play) | `/art-files/…` and the pack preview serve from disk as a stream, with `Accept-Ranges` and 206/416 responses | server test (ranges `0-9`, `-5`, out of size); E2E with an **MP4 recorded by Edge**, approved, served with 206 and playing on a correct answer |
| 2 | Failure to send an answer showed technical text to the child | a gentle sentence in French (`sendError` / `serverDown`); detail in the console | code review |
| 3 | Tab captured in the number path and in the word check | Tab free; arrows and space switch between blanks | E2E: Tab moves focus to a button |
| 4 | Studio played all the pack's videos at the same time | preview paused (first frame, only the beginning of the file); plays on mouse hover; only the art in use plays by itself | E2E: 2 clips in the pack, none playing by itself |
| 5 | Pack scan read whole videos | reads only the first 64 bytes; size from the file system | server tests (packs with disguised MP4, WebM, HEIC and PNG) |
| 6 | Level-up detected by the text of the reason | `lastLevelChange` marker in the state; the text only applies to old states | new engine test (marker, changed text, old state in Portuguese) |
| 7 | Check on the copy of the real database only played 5 games | `smoke_copy.py` plays all 8 | **13/13 on a new copy of the real database**, bundled server with the family's Node, without opening a window; migration 3 with automatic backup on the copy |
| 8 | `titlePt` duplicated the French title | field removed | typecheck and tests |

Result: `pnpm test` 113/113 · `run_e2e.py` 69/69 · `layout_check.py` 14900/14900 · real database untouched (hash).
Not tested: an MP4 with the index at the **end** of the file (Edge records with the index at the beginning and there is no video tool installed to produce the other kind); with partial requests, the browser can fetch the index wherever it is.

## Whole app in French (17/11/2026, Windows)

Parent area, art studio, server messages (errors, reason for the choice, mastery reasons, black window),
skills, art cards, style guide, default image request and Claude's check were switched to Canadian
French. Only what nobody sees on screen stayed in Portuguese: code comments, the system instruction sent to
Claude for reading handwriting and internal programming messages.

| Check | Result |
|---|---|
| `pnpm typecheck` / `pnpm build` | ✅ |
| `pnpm test` | ✅ 112/112 (text assertions updated to French) |
| `run_e2e.py` | ✅ 65/65 with the new labels (parent gate «Combien font…», «Historique», «Tableau de bord», «Art du jeu», «Retour au jeu»…) |
| Scan of the rendered text | ✅ home screen, gate, the 6 tabs of the parent area, studio turned on and 4 cards (including generated candidates): no Portuguese words |
| Visual check | ✅ history, reading confirmation and studio card in French |

Notes:
- In the **real** database, old records (reason for the choice, reason for the last mastery change, art credits) keep the Portuguese text they were recorded with; new ones come out in French. The app accepts both.
- `iniciar.bat`: messages in French, without accents (as before, so as not to break in the console). Only the `echo`/`rem` lines changed; it was not run (it opens Edge with sound).

## Stage 3, game 3: Les dominos des nombres (17/11/2026, Windows)

Silent and invisible tests; real database checked by hash at the end: untouched.

| Check | Result |
|---|---|
| `pnpm typecheck` / `pnpm build` | ✅ |
| `pnpm test` | ✅ **112/112** (there were 108). Generator: 150 seeds × 3 levels — always 4 tiles with unique labels, **exactly one** with the same number as the end, always in a different representation, both directions appear at each level (e.g. dots→digit and digit→dots), limits per level, level 2 sums crossing the ten, typical mistakes recognized; tens/ones reversal present in most level 3 rounds. Server: only one of the tiles shown counts (without using up an attempt), a typical mistake returns its own message (run 5 times in a row), correct after a mistake = 2 stars, attempt recorded as `math.representations`; paper exercise for the skill |
| `run_e2e.py` | ✅ **65/65** (5 new): levels 1 and 3 with 4 tiles, correct representations and everything inside the stage at 2 window sizes; a wrong tile moves aside with the typical-mistake message; the correct tile fits in and the server evaluates (correct with and without a hint) |
| `layout_check.py` | ✅ 16220/16220 (home screen now with 8 cards, 4 per row) |
| Visual check | ✅ levels 1, 2 and 3 on the table and when matching. Fix made: the halves that do not touch showed sums and were confusing; now they are dimmed and the ones that matter get a frame |

Not tested: sound and voice; real photos of the table and the tile; the game with Melina.

## Stage 3, game 2: Les mots cachés (17/11/2026, Windows)

Silent and invisible tests; real database checked by hash at the end: untouched.

| Check | Result |
|---|---|
| `pnpm typecheck` / `pnpm build` | ✅ |
| `pnpm test` | ✅ **108/108** (there were 105). Generator: 150 seeds × 3 levels — grid 6/8/10, only valid lowercase letters, each word exactly once in the level's directions, never diagonal at levels 1 and 2 (and diagonal actually used at 3), check with the target word among those found, visible letters matching the word, keyboard with the right letters and no repetition, variety; wrong accent recognized as an accent mistake. Server: answer outside the template or with a letter not on the keyboard refused (400) without using up an attempt, mistake → new attempt, decomposed accents (NFD) accepted, attempt recorded as `fr.spelling` |
| `run_e2e.py` | ✅ **60/60** (9 new): level 1 with a 6×6 grid, 3 words, only horizontal/vertical, inside the stage; invalid selection (diagonal at level 1) does not mark; finding the words does not create an attempt on the server; **in the check the word does not appear written on the screen**; mistake → empty blanks again; only the check is evaluated (`fr.spelling`, correct after a mistake); level 3 with a 10×10 grid, 5 words and diagonal; 3 stars on a direct correct answer; **the stage never scrolls** |
| `layout_check.py` | ✅ 18370/18370 |

**Old defect found and fixed:** after window resizes and clicks, the stage container ended up scrolled to (60, 60) and the whole screen appeared shifted (the blurred background extends 60 points beyond the window and `overflow: hidden` still allows scrolling by focus/click). Now `overflow: clip`, with a check in the E2E.

Not tested: sound and voice (including the word spoken in the check); real photos of the sheet and the magnifying glass; the game with Melina; the school word list (it had not arrived yet).

## Stage 3, game 1: Le chemin des nombres (17/11/2026, Windows)

Silent and invisible tests; real database checked by hash at the end: untouched.

| Check | Result |
|---|---|
| `pnpm typecheck` / `pnpm build` | ✅ |
| `pnpm test` | ✅ **105/105** (there were 101). Generator: 150 seeds × 3 levels — limits per level (≤ 20; 1 to 100), constant step along the row, change of ten always with an empty stone at level 2, backward paths, 4×5 grid with neighbouring squares and step = 10×row + column, empty stone after a vertical step, never 3 empty in a row, variety (> 60 different paths per level), typical mistakes recognized. Server: answer format (one number per stone), correct stones indicated on a mistake without revealing the others, correct after a mistake = 2 stars, new skill in the database without a migration, paper exercise for `math.counting` |
| `run_e2e.py` | ✅ **51/51** (6 new): level 1 with 10 stones and 3 empty inside the stage at 2 window sizes; «Valider» with an empty stone does not use up an attempt; after a mistake, correct stone green and locked and the others empty; evaluation on the server; level 3 with an 8-square path on a 4×5 piece of the grid and 12 hidden squares; correct on the 1st attempt = 3 stars |
| `layout_check.py` | ✅ 20770/20770 (apple game; the home screen changed to 4 cards per row) |
| Visual check (screenshots) | ✅ levels 1, 2 and 3: start, help after 2 mistakes (labels +1/−1/+10/−10) and result; home screen with 6 cards |

Not tested: sound and voice; real photos of the stone and the basket (only the app's drawing and the current icon); the game with Melina.

## Stage 2 on Windows (17/11/2026)

All browser tests run **silent and invisible** (`tests/e2e/_platform.py`: `--mute-audio`, app with sound
turned off, speech disabled). The real database (`data\`) was compared by hash with the backup copy at the end: untouched.

| Check | Result |
|---|---|
| `pnpm typecheck` | ✅ no errors |
| `pnpm test` | ✅ **101/101** (there were 95; new: realistic style and Lila's poses, cards for the new pieces, clip and video recognition by content, clip on the server, OpenAI error messages) |
| `pnpm build` | ✅ |
| `run_e2e.py` (Edge, the family's Node) | ✅ **45/45**, 0 JavaScript errors. New: home screen in French; lily pads and wagons switch to the approved photo; clip card without a generate button; synthetic WebM clip approved and playing **muted and looping** on a correct answer |
| `layout_check.py` | ✅ 21590/21590 |
| Child's screens without Portuguese | ✅ checked in the code and in the home-screen screenshot; the parent area is still in Portuguese (it goes to French after this stage) |

**Real call to OpenAI** (`scripts\real-image-test.py --spec fruit.red_apple --quality low`, the app's server with a temporary
data folder, key read only from `.env`):
- ✅ `gpt-image-2.5-sunburst` answered in 15 s: 1 PNG 1024×1024, 1.63 MB.
- ✅ **Truly transparent background**: 45% of the pixels with alpha 0, clear corners, minimum margin 4.1%. Technical check all ok.
- ✅ Claude's check (real call) approved it, with notes for the parents.
- ✅ Visually: realistic photo of an apple; over a green background it looks clean (the coloured pixels around it have alpha 0 and do not show).
- Note: the whole apple came with alpha 253 of 255 (99% opaque), not 255. Imperceptible in the game; no cropping was done.

Not tested / could not be tested:
- ⏳ Generations with a reference image (`/images/edits`, Lila's poses) and opaque scenery: only the apple was generated.
- ⏳ Realistic photos approved inside the games (the games were only tested with the simulated provider's shapes).
- ⏳ Real clip (MP4 from a video tool); only the synthetic WebM was tested.
- ⏳ Sound and voice (decision: no test plays audio).

## Validation on Windows (17/11/2026, Stage 1)

Environment: Windows 11 Home, Node 26.13.1 (tests and build), `runtime\node.exe` 24.22.3 (server, as in
`iniciar.bat`), pnpm 10.34.9, Python 3.13 + Playwright 1.65.2 with the installed **Microsoft Edge 157**.
First of all, `data\` was copied to a dated folder under `copias-seguranca\` (17/11/2026, before Stage 1; hashes checked).
After each step, the hashes of `data\` were compared with that copy: **the real database was not touched**.

| Check | Command | Result |
|---|---|---|
| Typing | `pnpm typecheck` | ✅ no errors |
| Automated tests | `pnpm test` | ✅ 95/95 (9 files) |
| Build | `pnpm build` | ✅ `app.js`, `index.html` and `server.mjs` identical to the ones already in the folder |
| Full flow in the browser | `set MELINA_NODE=runtime\node.exe` + `.venv\Scripts\python tests\e2e\run_e2e.py` | ✅ 38/38, 0 JavaScript errors (Edge) |
| Stage alignment | `.venv\Scripts\python tests\e2e\layout_check.py` | ✅ 20180/20180 checks |
| App opened by `iniciar.bat` on a **copy** of the real database | `DATA_DIR=<copy>` + `iniciar.bat`, then `tests\e2e\smoke_copy.py` | ✅ 10/10: the 5 games opened and completed a round (evaluated on the server), the parent area and the game-art tab (9 cards) loaded, 0 JavaScript errors |
| Migration 2 → 3 on a copy of the real database | `iniciar.bat` server | ✅ `pre-migracao` backup created first; `PRAGMA integrity_check` ok before and after; no table lost rows; 6 new `art_*` tables |
| Migration 1 → 2 already done on the real database | comparison of the 12:09 UTC automatic backup with the current database | ✅ backup exists, integrity ok, no table lost rows |

Fixes made to run on Windows (only in the tests; the app did not change):
- `run_e2e.py` stopped the server with `os.killpg` (Linux only) and looked for `google-chrome`. The new
  `tests/e2e/_platform.py` stops the server on both systems, uses the installed Edge
  (`MELINA_E2E_CHANNEL` changes the channel), accepts `MELINA_NODE`, uses a Windows font in the synthetic images
  and forces UTF-8 on output and when reading the scenes.
- New `tests/e2e/smoke_copy.py`: checks an app that is already open (for example, by `iniciar.bat`) on a copy
  of the database; refuses to run if `--data` points to the real `data\`.

Notes:
- **The real database is still at migration 2.** Migration 3 (art tables) will run the next time the
  family opens the app, with an automatic backup first. The same process was validated on the copy (above).
- In one of the rounds the server resumed a round that was open in the real database (expected behaviour);
  that is why the copy gained 4 new rounds and 5 evaluations.

Not tested / could not be tested on Windows:
- ⏳ **Sound and voice** (including Edge's natural fr-CA voice): there is no way to hear audio in this session.
- ⏳ **Edge's own window opened by `iniciar.bat`**: after the test there was an Edge window with the
  title «Le jardin de Melina», but Edge was already open before, and it was not possible to prove that it came
  from this test and not from earlier use. The games above were played in an Edge controlled by Playwright.
- ⏳ Double click on `iniciar.bat` from Explorer: the test started it with `cmd /c iniciar.bat`, the same file
  and the same Node, but not by clicking.

## Summary

| Check | Command | Result |
|---|---|---|
| Typing (strict TypeScript) | `pnpm typecheck` | ✅ no errors |
| Automated tests | `pnpm test` | ✅ 95/95 (9 files) |
| Interface build | `pnpm build` | ✅ |
| Full flow in the browser (paper, 5 mini-games, art studio) | `python3 tests/e2e/run_e2e.py` | ✅ 38/38 checks, 0 JavaScript errors |
| Stage alignment at several window sizes | `python3 tests/e2e/layout_check.py` | ✅ more than 20 thousand checks per run (3 scenarios × 10 windows × 5 moments) |
| Checking and drafting art requests with Claude | real calls inside the app, simulated image provider | ✅ (17/11/2026) |
| Real image generation (OpenAI API) | — | ⏳ **not verified**: the image APIs are unreachable from the development environment; the adapter was only tested against a fake server |
| **Real** reading with Claude | bundled server + real API, 5 synthetic images | ✅ 5/5 correct literal transcriptions (17/11/2026). ⏳ Not yet measured with Melina's real handwriting |
| Bundled server (`apps/server/dist/server.mjs`) | the E2E always runs against it | ✅ (Linux, Node 22.23) |
| Updating an existing database | bundled server on a simulated old database (version 1 → 2); version 3 only adds tables and goes through the same migration tests | ✅ automatic backup created, data preserved |
| Sound and voice | — | ⏳ **not verified**: there is no way to hear audio in the test environment, and the Edge voice only exists on Windows |
| Running on Windows (`iniciar.bat`) | by the user; then in Stage 1 | ✅ the previous version opened and worked with the portable `node.exe` (user's report). ✅ The current version started via `iniciar.bat` on a copy of the real database and the 5 games completed a round (17/11/2026, see the section above) |

## Automated tests (Vitest)

**Teaching rules** (`packages/curriculum`, `packages/adaptive-engine`)
- An independent correct answer weighs more than a correct answer with a hint, which weighs more than a correct answer with adult help.
- Advancing requires 3 consecutive independent correct answers. Help resets the streak.
- A single attempt does not define mastery or inability.
- Repeated mistakes trigger reinforcement and lower the level.
- Spaced review follows 1, 2, 4 and 7 days. An overdue review has priority in selection.
- First contact, variety between skills and prerequisites work as described.
- All skills generate valid exercises at the 3 levels, with more than 3 different questions per level. The expected answer is always evaluated as correct.
- Number ranges per level are respected.
- There is no immediate repetition of the same question.
- Grading: numbers (spaces, reversal), accents in spelling, plural (-s, -x), sequence (order matters), comprehension by variants (no exact text match) and forgotten incomplete group.

**API and persistence** (`apps/server`, real SQLite database in a temporary folder)
- Security: refuses mutations without the header, from another origin or from a non-local host. Does not expose the expected answer before confirmation. Does not serve `data/`. Ignores a "correct" sent by the browser.
- Full manual flow. Two **simultaneous** confirmations and a third repeated one result in **1** evaluation, **1** reward and **1** step.
- An illegible image does not create an evaluation or change mastery, and a new transcription allows continuing.
- A repeated step returns the same exercise. An out-of-order step is refused (409).
- Mission completed with 3 steps and a final reward. A mistake in step 2 does not take away the achievement. Step 3 was chosen as **reinforcement** of the skill with the mistake.
- State preserved after closing and reopening the database: mission, position, history and pending activity.
- Exercise version frozen in the snapshot.
- Upload of valid JPEG, PNG and WebP. Refuses a fake file (415) and a file above 8 MB (413). Removes EXIF and GPS. Ignores the malicious file name `../../etc/passwd`.
- Accidental resending of the same photo returns the same reading.
- Photo only accessible with the app header.
- Orphan and temporary files are collected on startup.
- Consistent backup with WAL active, including photos and without `.env`.

**AI — SIMULATED** (no real calls)
- Without consent, the API is not called.
- The suggested reading is corrected by the parents, the origin is recorded as "ai-corrected" and the reading correction does **not** count as help.
- The authorized sample is reused in the next reading. Once deleted, it is no longer used.
- The request contains neither the question nor the expected answer.
- The response is validated, malformed responses are rejected, an invalid key is not retried, unavailability is retried once, and lack of network and of a key are handled.
- An AI failure keeps manual transcription available.

## Full flow in the browser (E2E)

The script uses a temporary data folder and synthetic images generated on the spot. The screenshots are in `docs/evidence/`.

1. Home screen with the local state and the AI state.
2. 2D world. The character walked with the arrows and WASD, and the position was saved.
3. Conversation with Lila by click, as an alternative to the keyboard. Mission started.
4. Step 1 (math): exercise on paper, synthetic photo, transcription, "did it on her own", authorized sample. A **double click** on confirm did not duplicate anything. Correct-answer feedback with the seed.
5. Step 2 (French, comprehension text): manual transcription of a wrong answer with adult help. Feedback "On essaie ensemble" with an explanation. The seed was kept.
6. Step 3: photo marked as **illegible**, which did not create an evaluation. Then, correct manual typing. Mission completed and garden in bloom.
7. **Server restarted.** The 3/3 seeds and the completed mission were recovered from SQLite.
8. Parent dashboard: history separating correct and wrong answers, skills, library with 1 sample, backup created.
9. New French activity chosen from the history, with an auditable reason.

## Mini-game « Les caisses de pommes » (17/11/2026)

New automated tests (server):
- The round does not expose the answer; an open round is resumed instead of creating another; evaluation is done on the server; repeating the answer does not duplicate anything.
- Progressive hints: the 1st mistake does not create an evaluation; correct after a mistake counts as correct with a hint (2 stars, no advancing); 3 mistakes count as an incorrect answer (1 star) and show the answer.
- On-screen rounds do not enter the parents' check queue and appear in the history as "on screen".
- The engine alternates the game's two skills and levels up with correct answers; quantities always below 100.
- Migration of an existing database (version 1 → 2) preserves the data.

Flow in the browser (Chrome, no sound), 3 rounds:
1. Round 1: fruits arranged by click and by space bar; answer on the on-screen keypad; 3 stars.
2. Round 2: two mistakes on purpose (gentle message, then a hint with the count "10, 20, +7" over the boxes); correct afterwards; 2 stars.
3. Round 3: three mistakes; the game shows the answer with the explanation; 1 star.
4. Final screen and accumulated stars (6) on the game card.
5. Database: three `screen` evaluations recorded as `correct/none`, `correct/hint`, `incorrect/hint`.

Screenshots in `docs/evidence/` (19 to 23).

**Not verified:** sound, voice, opening in Microsoft Edge in its own window and the behaviour on Windows.

## First run on Windows (17/11/2026)

- The original `iniciar.bat` stopped at "Node.js was not found". The specification said there was Node.js 24 on the machine, but this was not checked on Windows before delivery. **My validation error.**
- Fix: the app no longer needs pnpm or an `install` on the family computer. The server ships bundled in one file and the interface ships compiled. `iniciar.bat` accepts Node.js installed in Windows or portable in `runtime\`.
- The package was tested in a clean folder, with only the delivered files and no `node_modules`: full flow 16/16. A second launch with the app already running only opens the browser.
- With the parent's authorization, the portable Node.js 24.22.3 (`node.exe`, Windows x64) was placed in `C:\MelinaApp\runtime`. It came from the `node-win-x64` package of the npm registry, because the nodejs.org site was blocked in the session.
- Check of `node.exe`: it was not possible to compare with the nodejs.org checksum list (site unreachable). Instead, the **digital signature** was verified: the file's hash matches the signed hash, the signer is the OpenJS Foundation and the certificate chain closes at the Microsoft root embedded in the file. Trust in that root is checked by Windows itself.
- **Not yet validated:** `iniciar.bat` with `node.exe` (a .bat and an .exe do not run in the development environment) and the app on Node.js for Windows.

## Real call to Claude (17/11/2026)

**First attempt (wrong conclusion, corrected below).** The call made from Claude Desktop's Linux environment came back with 401, and this was attributed to the key. It was wrong for two reasons:

- The 401 did not come from Anthropic. That environment's proxy refuses any request carrying a key, even a made-up one, before it leaves (response `text/plain`, without `request-id`).
- `sk-ant-usr-…` keys are valid personal keys from the Claude Console.

**Valid test.** Done in the cloud development environment, which reaches the real API, with the bundled server (`apps/server/dist/server.mjs`), the key in an environment variable and the full flow over HTTP: consent → session → exercise → photo upload → analysis → confirmation.

- **Defect found and fixed:** the API refused the request with 400, `tool_choice: type "tool" and "any" are not supported for this model`. `packages/ai` switched to `tool_choice: auto`; the system instruction still requires calling the tool, and a response without it is treated as a retryable failure (one retry). The 400 error now shows the reason given by the API.
- **Result after the fix** (model `claude-sonnet-5-5`), with synthetic images in a font that imitates handwriting, on ruled paper, with tilt and blur:

| Written in the image | Read | Confidence |
|---|---|---|
| `35` | `35` | high |
| `89` | `89` | high |
| `sur la nege` | `sur la nege` | high |
| `les pomes sont rouge` | `les pomes sont rouge` | high |
| `Zoe est contente` | `Zoe est contente` | high |

- The spelling mistakes and the missing accent were preserved, as the app requires (literal transcription, without correcting).
- The confirmation of the first case went all the way through: correct answer, origin `ai`, mastery 0 → 0.15.
- No photo or data of Melina was sent. The key was not stored in the test environment.
- **Limit of this test:** a computer font is much more regular than a 7-year-old's handwriting. The accuracy with Melina's real handwriting **has not been measured yet**.

## What depends on you

- **API key**: it is in `.env` and it expires; when it expires, create another one in the Console and replace it.
- **Real photos of Melina's work**: to measure the reading accuracy with her handwriting.
- **The family's Windows**: at the next launch via `iniciar.bat`, check whether Edge opens in its own window and whether sound and voice work (migration 3 runs at that time, with an automatic backup).
