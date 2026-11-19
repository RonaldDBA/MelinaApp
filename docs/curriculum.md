# Curriculum

## Basis

- *Programme de formation de l'école québécoise* (PFEQ), first cycle of primary school.
- *Progression des apprentissages* (PDA) for French and math.
- French is treated as **langue d'enseignement**. The materials from Melina's school confirm this: the assessment "Le temps des pommes" is labelled *Français, langue d'enseignement, 2e année*.
- ⚠️ Québec's **new French program** will be mandatory from **2027-2028**. The date was postponed by a year, and the program has been in trial since 2025-26. The French skills must be revised when it comes into force.

> **This catalogue is preliminary.** It is not a complete or certified coverage of the curriculum. All skills have status `to-validate` and must be checked against the official PDA and with the teacher.

## Skills in the initial catalogue (10)

| Id | Subject | Observable description | Levels | Prereq. | Inspired by |
|---|---|---|---|---|---|
| `math.place-value` | Math | Writes the number from tens and ones (and hundreds) and identifies the value of each digit | 1: up to 59 with drawn material · 2: up to 99, written decomposition · 3: up to 999 · 4: role of each digit in 3 digits · 5: exchanges (13 tens = 1 hundred and 3 tens), tens in total | — | La récolte de citrouilles |
| `math.grouping-tens` | Math | How many groups of 10 are needed, including the incomplete group | 1: multiples of 10 · 2: non-multiples · 3: two days added together · 4: from 101 to 399 · 5: boxes and trucks (game: fruits missing in the last box) | place-value | La récolte de citrouilles |
| `math.add-sub` | Math | Addition and subtraction | 1: up to 20 · 2: up to 99 without regrouping · 3: with regrouping · 4: 3 digits ± 2 digits · 5: 3 digits ± 3 digits (game: jumps of hundreds and tens) | — | — |
| `math.sequences` | Math | Completes sequences | 1: by 1 or 2 · 2: by 5 or 10 · 3: descending or by 3 · 4: by 3, 4 or 25, passing 100 · 5: by 20, 50 or 100 up to 999 | — | — |
| `math.counting` | Math | Fills in the missing numbers when counting by 1, forwards and backwards, up to 100, across the change of ten and on the hundred grid | 1: path up to 20 · 2: any start up to 100, forwards or backwards, always across a change of ten · 3: hidden piece of the hundred grid (+1/−1 along the row, +10/−10 down the column; on paper: by 10) · 4: by 1 across the hundred · 5: by 10 across the hundred | — | Observed difficulty: accuracy when counting large collections |
| `math.representations` | Math | Recognizes the same number in different representations | 1: dots ↔ digit (1 to 9) · 2: sum ↔ result (sums and differences up to 20, across the ten) · 3: tens and ones (rods and cubes) ↔ number up to 99 · 4: 2-digit sum ↔ result · 5: 3 digits ↔ expanded form (300 + 40 + 7) | — | — |
| `fr.comprehension` | French | Finds explicit information in a short text | 1–3: original texts of 4 to 5 sentences · 4: 7 sentences, «pourquoi/comment» · 5: 8 sentences with beginning, middle and end | — | Le temps des pommes (format) |
| `fr.plural` | French | Writes the plural of nouns | 1: -s · 2: le/la→les, -x (-au, -eau, -eu) · 3: s, x, z do not change · 4: -ou and the 7 exceptions; bleu, pneu · 5: the whole noun group (aligned with the school aide-mémoire; -al → -aux was removed) | — | — |
| `fr.spelling` | French | Writes familiar words with accents and sound spellings | 1: 1–2 missing letters · 2: ai/eau/oi/eu/eil · 3: only the 1st letter | — | Jour 1 worksheet |
| `en.listen-words` | English | Hears an English word, a short sentence or a riddle and taps the matching picture (listening only, no reading) | 1: word alone, 3 pictures of different themes · 2: word alone, 3 pictures of the same theme · 3: word in a short sentence, 4 pictures · 4: 4 pictures with a sound-alike (ship/sheep, three/tree, thirteen/thirty) · 5: 6 pictures with sound-alikes · 6: original riddle that never says the word, 6 pictures | — | Report `reports/English learning games for kids.md` |

The full definitions, with curriculum reference and review status, are in `content/*/skills.json`.

## English (since 18/11/2026)

Based on the research report `reports/English learning games for kids.md` (notes in `research_notes/English learning games for kids/`).
Québec's Cycle One ESL program (2006) is oral only: listening is the «cornerstone» and there are no reading or writing
expectations. So the first English game is **listening only**: nothing is written in English before the answer.

- **Content:** `content/english/words.json`, 182 original words in Canadian spelling, each with a French gloss, a picture
  (system emoji or a numeral), a theme and a level (1 to 5; 2 extra «th» words at level 6), plus 25 sound-alike pairs and
  92 original riddles. Themes follow the Cycle Two inventory: colours, numbers, animals, the classroom, the garden, people,
  the body, food, clothes, toys, weather, actions, the house, school, feelings, transport, the town, the sky and holidays,
  wild animals of Canada.
- **Skill** `en.listen-words` (`content/english/skills.json`), screen only: `hasPaper()` keeps it out of the paper
  activities.
- **Game** «Le potager qui écoute» (`game.listen-garden`, 5 rounds): Lila gives the instruction in French, then the English
  voice says the word (`speakEnglish`). The big speaker replays it, slower from the second replay. After a mistake the
  wrong picture leaves and the word comes back slower (prompt before the answer).
- **Wrong pictures are hypotheses:** a sound-alike tests a sound contrast (`en-th`, `en-voyelle`, `en-teen-ty`, `en-rime`);
  a picture of the same theme tests meaning. Tags per round: theme, the word itself (`en-mot-…`), the contrast, the kind of
  listening (`en-phrase`, `en-devinette`), cognates and false friends (crayon, library). The learner model learns
  which words and contrasts she misses, and reinforcement rounds bring them back.
- **Guessing floor:** a correct tap among 3 pictures may be luck. The model counts it as weaker evidence (3PL-style), so a
  word is not «known» from a lucky tap; an error weighs as before.
- **Not yet (later stages of the report):** a word-level spaced schedule with modality unlock; adult-checked recorded audio
  for the minimal pairs (today: the browser's English voice); «La jardinière dit» (commands), «Paires de sons», sentences,
  stories; reading and spelling behind a parents' switch.

## On-screen mini-games

| Game | Skills | Levels |
|---|---|---|
| Les caisses de pommes (`game.apple-crates`) | `math.place-value`, `math.grouping-tens` | 1: 11 to 29 loose fruits (or 20/30 to count boxes) · 2: 1 to 3 boxes already full + loose fruits · 3: 4 to 7 boxes already full + loose fruits (up to 97) |

| Le chemin des nombres (`game.number-path`) | `math.counting` | 1: 10 stones, by 1 up to 20, 3 empty · 2: 10 stones starting from any number up to 100, forwards or backwards, 3 or 4 empty, always one at the change of ten · 3: an 8-square path on a 4×5 piece of the hundred grid, only the path shows, 3 or 4 empty, always one after a vertical step |

It was the first game because it tackles the difficulty seen in the test "La récolte de citrouilles": counting a large collection accurately, organizing it into groups of 10.

| Les mots cachés (`game.hidden-words`) | `fr.spelling` | 1: 6×6 grid, 3 words, horizontal and vertical; check with 1 or 2 missing letters · 2: 8×8 grid, 4 words, horizontal and vertical; check with the difficult grapheme (ai, eau, oi, eil…) · 3: 10×10 grid, 5 words, also diagonal; check with more missing letters |

| Les dominos des nombres (`game.dominoes`) | `math.representations` | 1: dots ↔ digit · 2: sum ↔ result up to 20 · 3: tens and ones ↔ number up to 99. Always 4 tiles, only one with the same number, in a different representation from the end on the table |

**Les dominos des nombres**: one round is one match. The wrong tiles are chosen to reveal the mistake: neighbours (±1, ±2) at level 1, a result with one ten more or less and near-results at level 2, **tens/ones reversal** (47 ↔ 74) and one rod or cube more or less at level 3. Each one has its own message. The same skill has a paper exercise (`representations.number`: write the number from the dots, the sum or the rods and cubes).

**Les mots cachés**: finding the words **is not assessed** (it is exposure to the spelling; nothing goes to the server). At the end of the round, one of the found words comes back with missing letters, the word is **spoken** (as in a dictation, never written on the screen) and the child completes it by tapping a keyboard with the right letters and the ones that get confused (e/é/è/ê, a/à/â, c/ç, m/n, b/d…). Only this spelling is assessed on the server, as `fr.spelling`; a wrong accent is recognized («Presque! Regarde bien les accents»). **Known limitation:** the full word is in the round data (the grid needs it); the screen only hides it during the check.

**Words (since 17/11/2026): school list.** They come from `content/french/school-words.json`, which is the transcription of «Les mots à savoir écrire» from Melina's 2e année aide-mémoire: 7 themes, 31 weeks and about 300 forms that go into the grid. It is school material (© TC Média Livres), for home use only; do not redistribute.
- **Week:** in the parent area (Tableau de bord → « Mots de l’école »), the parents choose the week the class is at (setting `french.schoolWeek`, for example `"3.2"`). The game uses the words **up to** that week (review) and prefers the ones from **that very week** for the check and for the grid. With no choice, it uses the whole list.
- **What goes into the grid** (`gridForms` in `packages/curriculum/src/schoolwords.ts`): «fâché / fâchée» becomes two forms and «(2e)» is removed. Entries with a space, hyphen or apostrophe (à côté de, grand-maman, aujourd’hui, parce que), those with **œ** (cœur, sœur, vœu; the keyboard has no œ and children usually write «oe») and those with fewer than 3 letters (y, ni, si…) stay only in the list. For conjugations (aller, faire, dire), only the conjugated verb goes in (vais, allons, font…).
- **Five levels (since 17/11/2026):**

  | Level | Grid | Words | Check |
  |---|---|---|---|
  | 1 | 6×6 | 3 | 1 or 2 letters of the difficult sound |
  | 2 | 8×8 | 4 | the whole difficult sound |
  | 3 | 10×10, with diagonal | 5 | all the difficult parts: sounds, accents, silent final letter, double consonant |
  | 4 | 11×11 | 6 | only the 1st letter remains |
  | 5 | 12×12 | 7 | dictation: no letter visible |

- **Word difficulty** (`levelOf`, from 1 to 5): 1 + one point for each of these:
  - 7 letters or more;
  - accent or cedilla;
  - sound written with more than one letter (eau, ai, ou, an, ch…);
  - silent final letter;
  - double consonant.

  The game prefers words close to its own level. At level 5 out come «printemps», «princesse», «traîneau», «deuxième». With a week chosen, only words up to that week go in: in a week at the start of the year, the difficulty comes more from the grid and the check than from the word.
- **Less repetition:** the words from the last 8 rounds go to the back of the queue.
- **Grid rules:** two words where one is inside the other (tout and toute) never go in together. Each word appears only once in **any** direction, including the diagonal at levels 1 and 2, where the diagonal does not count.
- `content/french/words.json` (18 original words with emoji and blanks) is still used by the paper exercise `spelling.complete-word`.

**Le chemin des nombres** tackles the same difficulty from the side of the number sequence: whoever loses count in a large collection usually stumbles on the change of ten (39 → 40, 40 → 39) and on counting backwards. The answer is evaluated on the server as a sequence; on a mistake, the server says **which stones are right** (without revealing the value of the others), they become locked and the child corrects only the wrong ones. Typical mistakes recognized: a path that goes backwards read as if it went forwards; on the grid, going down a row counted as +1 instead of +10. The same skill has a paper exercise (`counting.path`).

## Exercises

- They are generated by versioned templates (`packages/curriculum/src/generators.ts`) with a deterministic seed. That is why there is real variation: each level produces dozens of different questions.
- The assigned exercise is **frozen** in `assignments.snapshot_json`, with id, version, question, answer, explanation and common mistakes. Future changes to the catalogue do not alter the history.
- All reading texts and exercises are **original**. Nothing was copied from Melina's books or tests (see `docs/references.md`). The only exception is the school word list (`content/french/school-words.json`): the parents transcribed it for home use, and it must not be redistributed.

## Alignment with the school's 2e année aide-mémoire (17/11/2026)

The parent sent photos of the 2e année aide-mémoire from Melina's school (© TC Média Livres). Only the **topics** are kept here: the
app does not copy explanations, examples or illustrations from the book. New exercises on these topics will be original.

| School topic | In the app today | Missing |
|---|---|---|
| Mots à savoir écrire (themes 1 to 7) | ✅ Les mots cachés, with the week chosen by the parents | the paper spelling exercise still uses its own list |
| Plural: general rule (s) | ✅ `fr.plural` levels 1–2 | — |
| Plural, special cases: -au/-eau/-eu → x (exceptions bleu, pneu, émeu → s); -ou → s, with exceptions → x (bijou, caillou, chou, genou, hibou, joujou, pou); words ending in s, x, z do not change | partial: x for -eau/-eu and invariables (nez, souris) | exceptions for -ou and -eu. **Misalignment:** level 3 asks for -al → -aux (cheval, journal, animal), which this book does not cover in 2e année |
| Determiner; gender and number; determiner + noun agreement and agreement within the noun group (with adjective) | partial: only the number of the noun | gender (un/le × une/la), adjective agreement |
| Feminine, special cases (favori → favorite, long → longue, blanc → blanche) | — | everything |
| Verb (ne… pas test); present tense of aimer, aller, avoir, dire, être, faire; pronouns | only forms of aller, faire and dire in the Les mots cachés grid | conjugation game |
| Sounds and spellings: soft/hard g (ge, gu), soft/hard c and ç, s/ss between vowels; accents, diaeresis, hyphen; apostrophe | partial: accents in `fr.spelling` | sound and spelling rules, apostrophe |
| Silent letter; words from the same family | — | everything |
| Common noun × proper noun (capital letter) | — | everything |
| Sentence (word order); positive and negative sentence (ne… pas) | — | everything |
| Text: beginning, middle and end of a story | partial: `fr.comprehension` only covers explicit information | parts of the story |
| Reading and writing strategies | — | could become hints from Lila (« Regarde les images », « Relis la phrase ») |

## Grading

| Type | Rule |
|---|---|
| Number | Compares the integer value. Ignores spaces. If there are several numbers, the last one counts, which allows traces of reasoning. |
| Sequence | List of numbers in order. |
| Word | Ignores capitals. **Accents count** in spelling and plural, and the mistake appears as "accent". Accepts "des bateaux" as well as "bateaux". |
| Short answer | Expected keywords, without accents and without punctuation, accepting plural and feminine. **Never requires an exact text match.** |

Common mistakes identified: tens/ones reversal, forgotten zero, forgotten incomplete group, forgotten carry or borrow, forgotten plural mark, plural in -x/-aux, accent.

## Known limitations

- The number ranges follow the 1er cycle expectation (< 1000) and must be **validated against the PDA and with the school**.
- The short answer uses keywords. Opinion answers ("Pourquoi?") are not included yet and would need a rubric with human review.
- There is no audio dictation, sentence production, or geometry, measurement, time, money and charts yet (see `docs/roadmap.md`).
