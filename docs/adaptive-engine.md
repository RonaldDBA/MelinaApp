# Adaptive engine

Code in `packages/adaptive-engine/src/index.ts`. These are **deterministic** rules that do not use AI. Every decision is recorded with its reason, in `assignments.selection_reason`, and every mastery change too, in `attempts.mastery_before_json` and `mastery_after_json`.

## State per skill

`estimate` is the mastery estimate, from 0 to 1. The other fields are: `level` (1 to 3), `evidenceCount`, `independentStreak`, `consecutiveErrors`, `helpCount`, `recent` (the last 8 pieces of evidence), `lastPracticedAt`, `nextReviewAt`, `reviewStep`, `confidence` and `lastChangeReason`.

> `confidence` measures the **confidence of the estimate**, that is, the amount of evidence. It **has nothing to do** with the confidence of the image reading.

## Update (only with a confirmed answer)

| Evidence | Effect |
|---|---|
| Independent correct answer | `estimate += 0.15 × (1 − estimate)`. Adds 1 to the independent streak. Advances the spaced review. |
| Correct answer with an app hint | `+0.06 × (1 − estimate)`. Resets the streak and does not count towards advancing. Review in 1 day. |
| Correct answer with adult help | `+0.02 × (1 − estimate)`. Same rules as the correct answer with a hint. |
| Mistake | `estimate −= 0.12 × estimate`. Adds 1 to the consecutive mistakes. The review becomes available again for reinforcement. |
| Evidence below the current level | Counts half. |
| **Illegible image** | **No effect**: it creates no attempt and does not change mastery. |
| Reading corrected by the parents | **It is not help.** Only the answer to the question "was there help solving it?" counts. |

- **Advancing** (changed on 17/11/2026, at the parent's request: «go up until you find her limit, as long as the foundation is confirmed»):
  - **Foundation:** at level 1, 3 consecutive independent correct answers are needed.
  - **Above the foundation:** 2 consecutive independent correct answers move up 1 more level.
  - **Ceiling:** the last level of the skill; `maxLevel` reads the keys of `levels`. Since 17/11/2026, all 9 skills go up to level 5. At the ceiling, the reason records «Niveau maximum… réussi».
  - **Confirmation on another day (since 17/11/2026, research):** once the streak is reached, the level-up is pending (`pendingAdvance`) and the review is scheduled for the next day. The first independent correct answer in a session on another day confirms the level; a mistake cancels it. On the same day, the learner model offers «avant-goûts» of the next level.
  - **Difficulty that follows her the same day (guardian, 18/11/2026: «growing the difficulty as much as the kid's learning»):**
    - *Problem found in her real data:* Le train des nombres, 21 correct answers in a row on 18/11 and every round stayed at
      level 2. The official level waits for another day, and exploration and «Un défi plus difficile?» only went to official + 1.
    - *Session staircase* (`sessionLevel` in `learner.ts`, `todayLevel` in `service.ts`): the play level starts the day where
      she was before her first answer (the official level, or the higher level already proven and pending), climbs one
      level after `CLIMB_AFTER` = 3 first-try correct answers in a row at that level, and goes down one level after an
      answer not found on the first try (an error or a correct answer with help), never below the official level. A
      3-up/1-down staircase settles around 80 % success (Levitt 1971; close to the "85 % rule", Wilson et al. 2019).
      Easier rounds (review, reinforcement) neither climb nor break the run.
    - `planRound` uses the staircase level as its base. Exploration above it only happens when it is still too easy
      (predicted ≥ 85 %), and the old «avant-goût» is off, because the staircase already starts at the proven level.
      The help alarm, the engine's reinforcement after errors and the parents' choice switch the staircase off.
    - «Un défi plus difficile?» = today's staircase level + 1.
    - *The pending level climbs:* while a level-up waits for confirmation, 2 first-try correct answers in a row at a
      higher level make THAT level the one to confirm. The next day, a correct answer confirms up to the level of that
      answer (at least one more), so an easy answer does not jump from 1 to 5; the rest stays pending.
    - *Errors while looking for her limit* (above the official level): half the loss on the estimate, no level-down, the
      review schedule is kept. Above the pending level they change nothing in it; at or below it, the pending level goes
      back to the level under that error (or is cancelled right above the official level).
    - *On screen:* when a round is harder than the previous one, Lila starts with «Ça monte d’un cran!».
  - **Going down:** 2 consecutive mistakes move down 1 level. Her limit is where the level oscillates.
  - **Help:** a correct answer with help (correct on the 2nd attempt) still resets the streak.
- **Reinforcement:** 2 consecutive mistakes move down 1 level (minimum 1).
- A single attempt never defines mastery or inability.

## Model that learns from her (since 17/11/2026)

**Parent's request:** the app should learn from her, strengthen the weak points and build on the strong points, even beyond what
school requires. The level ladder above remains the official rule. On top of it, a local statistical model
(`packages/adaptive-engine/src/learner.ts`) learns from every answer. It is not an external AI: nothing leaves the computer.

**Tags** (`packages/curriculum/src/tags.ts`)
- Each exercise gets tags for what it requires:
  - **math:** retenue, emprunt, passage de centaine, zéro au milieu, grille de 100…
  - **French:** son « eau », accents, lettre muette, noms en -ou, accord dans le groupe du nom, questions « pourquoi »…
- The tags are read from the exercise itself, so the old history is also usable.

**Model** (logistic, Elo/IRT-like, one per skill)
- Chance of getting it right first time = σ(ability − level + 0.85 − Σ tag weights).
- With ability = level, the predicted chance is ~70 %, the challenge zone.
- **Online learning:** with every answer, the ability goes up or down according to the surprise (actual answer minus predicted). The tag weights move the opposite way.
- **Value of each answer:** right first time = 1; right after a mistake or with help = 0.45; wrong = 0.
- **Caution:** the weights of the tags OF THE ANSWER shrink by 3 %, so that a single answer does not become a weak point. Since 17/11/2026, only the answer's own tags shrink: before, a weak point «disappeared» (and could even be «conquered») just because she was answering other things.
- **Classification:** weight ≥ 0.2 (with 2 answers or more) = point to strengthen; ≤ −0.2 = strong point.
- **Conquered weak point** (`conqueredTags`):
  - the tag keeps `wasWeak` from the moment it passed 0.2, `weakDay` (last day it was weak or had a mistake or help) and `streak` (consecutive first-time correct answers with it);
  - **«presque gagné»** (`almostTags`, answer with `almost`): the model no longer sees it as weak (weight < 0.2) and she got the last 4 rounds with the tag right first time. A discreet sentence, no celebration;
  - the win counts with a first-time correct answer on **another day**, while already «presque» (research: a correct answer in the same session is misleading). A mistake or help resets the streak and postpones it to another day;
  - why not «weight ≤ 0.05»: with high ability, the model already predicts the correct answer and each new correct answer barely moves the weight. In the test, 42 correct answers stopped at 0.086, and the win would be impossible;
  - the server plants a flower `flower.tag.<skill>.<tag>` for EACH conquered tag, and the answer carries `conquered` (the most specific one: «retenue» before «addition»), which triggers the big celebration.
- **Recalculation:** the model is rebuilt from the recorded attempts: deterministic, auditable and with no new table. Since 17/11/2026 the server keeps the already computed profile and only APPLIES the new answers (the model is online). If an answer goes missing or arrives out of order, it recalculates everything. Measured with 20 000 answers: from ~850 ms to under 400 ms per game answer, with a result identical to the full recalculation (test `perf.test.ts`).

**Plan for each round** (`planRound`, applied in `applyLearner` on the server, in game rounds and paper sheets)
- **Exploration:** when the model predicts ≥ 55 % correct one level above the official one, it tries that level. This always applies when she gets ≥ 85 % right at the current level, and otherwise in 30 % of the rounds. It avoids the weak points so that the only challenge is the novelty. It can go beyond what school asks, up to level 5.
- **Reinforcement:** if there is a weak point, in ~85 % of the remaining rounds the app draws 12 candidate rounds and picks the one with the weak tags. If the predicted chance falls below 35 %, it goes down one level so as not to discourage her.
- **Priority:** the parents' choice and reinforcement after consecutive mistakes come first. After mistakes, exploration is turned off.
- **Minimum information:** with fewer than 4 answers in a skill, the round is normal.
- **Logging:** the reason appears in the parents' history («Renforcement ciblé : retenue…», «Exploration d’un point fort…»).

**Parent dashboard:** the section «Ce que le jeu a appris de Melina» shows, per skill, the number of answers, the comfortable level (~70 % correct), what to reinforce and the strong points.

## Evidence from the on-screen mini-games

Each mini-game round produces **one** piece of evidence, evaluated by the server:

| What happened | Evidence |
|---|---|
| Correct on the 1st attempt | Independent correct answer (3 stars) |
| Correct on the 2nd or 3rd attempt, after a hint | Correct answer with a hint: lower weight, does not count towards advancing (2 stars) |
| Wrong 3 times | Incorrect answer; the game shows the answer and the explanation (no star: since 17/11/2026 there is no reward just for taking part) |

The stars are a narrative reward and do not enter the mastery calculation. A mini-game can train more than one skill: *Les caisses de pommes* alternates `math.place-value` (how many fruits in total) and `math.grouping-tens` (how many boxes).

## Choosing the next activity

1. **Reinforcement** of a skill with a recent mistake: "Reinforcement after a recent difficulty."
2. **Overdue review**, oldest first: "Scheduled review." or "Advancing after independent correct answers".
3. **First contact**, at level 1: "First contact with this skill."
4. **Practice** of the least consolidated skill.

Additional rules:
- **Variety:** avoids repeating the same skill as the previous activity when there is another option.
- **No immediate repetition:** the same question does not come back while it is among the last 6 of the skill.
- **Prerequisites:** they only block when there are already at least 3 pieces of evidence and the prerequisite's estimate is below 0.35.
- **Parents' choice:** in *Dashboard → Choose the next activity*, the parents can set the skill and level of the next activity. The choice applies once.
- **Missions:** each step defines the subject (math, French or either), and the engine chooses within it.

## Spaced review

The default intervals are **1, 2, 4 and 7 days** after consecutive independent correct answers. After that, the interval stays at 7 days. They can be adjusted in *IA et données → Révision espacée*.

**All values are initial parameters to be validated** with real use: gains, losses, thresholds and intervals (`defaultParams`).

## Spaced review by days (17/11/2026)

- **Intervals:** 1, 2, 4 and 7 days. For what is already **mastered** (estimate ≥ 0.8), 14 and then 30 days follow (`masteredIntervalsDays`).
- **One step per day:** several correct answers in the same session do not push the review far away; the step only goes up with a first-time correct answer on a day when it has not gone up yet (`reviewStepAt`). Before, 4 correct answers in a row in one session already pushed the review to 7 days.
- **Due by the day:** the review becomes due at local midnight of the scheduled day (the 4 p.m. session picks up the review scheduled for 6 p.m. the day before; no daylight-saving shift).
- **No skipping 14:** without mastery, the step stops at 7; once mastered, the next is 14, then 30.
- **New level:** once confirmed (on 2 different days), review within 4 days, instead of inheriting 7 to 30 days from the previous level. Restarting at 1 day would leave the skill always «due», jumping ahead of the other skills in the game.
- **Paper sheet from a previous day** (the parents confirmed it later): it only adjusts the estimate. It does not complete a streak, does not confirm or cancel a level-up, does not drop a level and does not touch the review. Practice dates never go backwards.
- **Hint alarm (parent's decision, 18/11/2026):** help (app hint, astuce after a mistake, or an adult) in more than 30 % of the last 10 answers of a skill (minimum 5) = level too hard for now. The round comes one level lower, to consolidate; the official level does not change, and the alarm goes away when she gets answers right without help again. At level 1, the model reinforces the weak points, with no exploration above. The parents' choice and the «défi» she chose take priority. Reason in the history: «Beaucoup d’aide récemment…».
- **Going down a level:** only mistakes at her level or below count. Getting an item ABOVE wrong (exploration, the staircase) does not drop the level; since 18/11/2026 it only lowers or cancels the pending level-up when it is at or below it. After consecutive mistakes, reinforcement stays at the official level, without going back to the level where she has just made mistakes.
- A mistake resets the step to 0, as before. A pending level-up still has its review on the next day.
