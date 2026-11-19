# Next steps

## Mini-games and visuals
- Done: fixed 1920×1080 stage with illustrated scenery; eight games (*Les caisses de pommes*, *Le train des nombres*, *Saute-grenouille*, *La pêche aux mots*, *L'histoire mystère*, *Le chemin des nombres*, *Les mots cachés*, *Les dominos des nombres*); art studio with parent approval; realistic-photography style guide; Lila's victory clip; OpenAI tested for real.
- Done (17/11/2026): the whole app in French; school word list in *Les mots cachés*, with the week chosen by the parents.
- To do: approve the realistic photos in the studio (prompts in `docs/art-prompts.md`).
- Topic-by-topic table in `docs/curriculum.md` («Alignment with the aide-mémoire»). First: align the plural with the school book, because level 3 asks for -al → -aux, which she has not seen yet. Then: a conjugation game for the 6 useful verbs; gender and number agreement in the noun group.
- Ideas from the same school aide-mémoire (topics only, with original exercises): soft/hard g (ge, gu); soft/hard c and cedilla; s between two vowels (s/ss); apostrophe; silent letter at the end of a word (found through the feminine or a word from the same family); words from the same family; common noun and proper noun (capital letter); determiner, gender, number and agreement. The paper spelling exercise could also start using the school list.
- To do on the family PC: first real image generation (style guide, scenery, box, fruits, Lila) and assessment of the result.
- Later: dedicated scenery for each game (lake, train station, library); drag and drop in addition to clicking; optional background music; a profile for her brother; bring the paper adventure onto the same stage.

## English (report `reports/English learning games for kids.md`)
- Done (18/11/2026), stage 1: English subject, 182 original words, English voice, guessing floor in the model,
  «Le potager qui écoute» (levels 1 to 6).
- Done (18/11/2026), stage 2: «La jardinière dit» (commands, levels 1–6); words on a ladder of days; wrong tries kept
  (migration 7); English part of the parents' report (words still known after 7+ days, confusions, can-do lines).
- Next: «Paires de sons» with adult-checked recorded audio (h, th, ship/sheep, final consonants, stress); «La phrase et
  l’image»; stories with refrains; modality unlock; reading and spelling behind a parents' switch.

## Short term
- Validate the catalogue against the official PDA and with the teacher. Adjust the number ranges.
- Measure the accuracy of Claude's reading on real photos of Melina's work, with consent (real reading already works with synthetic images).
- Run `iniciar.bat` on the family's Windows and record the result in `docs/testing.md`.
- Replace the provisional art (geometric shapes) with own art or art with a suitable licence.
- Delete individual photos and restore a backup through the interface.

## Curriculum
- Math: geometric figures, measurement, time and money (Canadian coins), simple tables and charts, two-step problems.
- French: dictation with audio recorded by a human fr-CA voice, sentence building, capital letters and punctuation, simple inferences and opinion answers with a rubric and human review.
- Revise the French skills for the **new program**, mandatory in 2027-2028.
- Progression to 3e année.

## Game
- New regions (lac des castors, cabane à sucre) and new characters.
- Chained missions and a collection of cosmetic items for the garden.
- Optional sound and volume control.

## Research recommendations (17/11/2026, see `reports/Child learning ages 7 to 10.md`)
- Level up only after confirming in a review on another day (today the streak in the same session is enough).
- Explanatory feedback after a mistake: why it is wrong and which strategy to use, not just the right answer. The effect is much larger than right/wrong alone.
- Proportional celebration: a short reaction to each correct answer, with a sentence that names the strategy; big celebration only at milestones (level confirmed, mission).
- Interleaved rounds, mixing skills already learned, and the engine must not read the natural drop in correct answers as «too hard».
- New exercise types with strong evidence: number line, word problems with structure (schemas), inference and main-idea questions, dictation with justification (grammatical spelling: -s, -e, -nt).
- Avoid: coins or a shop as payment for playing, daily streaks that get lost, leaderboards, generic «brain training».

## Photos and AI
- Parent's request (17/11/2026): **a photo or video of Melina dancing** when she completes a step. Idea:
  a file chosen by the parents in the parent area, stored only in `data\` and shown at the end of a mission. It **never** goes
  through the Claude check or any API (rule 4), does not enter the art catalogue (the style guide has no
  people) and does not go into the tests.
- Capture with the computer's camera and sending from the phone over the local network, with security care.
- Explanation suggestions and assisted content generation, always with parent review.
- Evaluate a specialized recognizer if the measurement data justify it.

## Infrastructure
- Desktop packaging (Electron or Tauri) with an installer.
- Detailed reports for the parents, with PDF export.
- Parent dashboard texts already centralized in `packages/shared/src/i18n.ts`, ready for translation.
