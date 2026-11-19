# Feedback sounds and praise/completion messages in educational games (ages 7–10)

Research notes (17/11/2026). Scope: what the evidence says about **feedback sounds** (correct answer, error, end of activity, milestones) and about **praise and completion messages** for children aged 7–10, turned into concrete rules for the app. No personal data was used in the searches.

Current app behaviour (starting point):
- **Correct answer per round**: short synthesized bell, small confetti and a spoken « Bravo! », with a process-praise sentence.
- **End of a 3-round activity**: bells, ~1.6 s of synthesized applause and normal confetti.
- **Milestones** (level confirmed on another day, mission completed): audience applause, whistles and confetti cannons.
- **After an error**: two soft descending notes, a gentle message and a strategy hint.
- **Voice**: the browser's French TTS.

How to read these notes:
- **Strong**: meta-analysis or several converging experimental studies.
- **Moderate**: one or a few experimental studies, or studies with another age range or another context.
- **Inference**: my extrapolation to the app. Not a finding.

Method limitations:
- Several primary texts could not be read in full: PDFs unreadable for the tool, or pages with 403/cookies (ACM DL, PubMed, PMC, EEF).
- When a data point comes from an abstract, a search snippet or a secondary source, this is indicated.
- **There are no duration figures ("X seconds") backed by a study with children.** All limits in seconds in the final section are design inference, anchored in the principles cited.
- Complements `research_notes\Child learning ages 7 to 10\motivation_and_reports.md`, which already covers self-determination, gamification and praise in general. Here the focus is **sound** and **message wording**.

---

## 1. Feedback sounds: positive versus negative, and whether an error should have a sound

### Conclusion
- There is no robust study comparing, **in children aged 7–10**, an error "buzzer" with a neutral sound or with silence with respect to learning.
- What exists points in the same direction:
  - **Adults, gamification**: **low-valence** sounds ("sad", "failure") do not improve performance and increase the feeling of **pressure/tension**.
  - **Children aged 8–9, neuroscience**: they learn more from **positive** feedback than from negative feedback, which they still process poorly.
- Recommendation: **correct answer with a short, pleasant and calm sound**; **error without a "failure" sound**, or at most a neutral, discreet sound. The useful information after an error comes from the **calm voice with the hint**, not from the sound effect.

### Findings with sources
- **Altmeyer, Hnatovskiy, Rogers, Lessel & Nacke (CHI 2022)**, "Here Comes No Boom!" (adults; **moderate** strength for our case):
  - the authors created 18 sound effects and rated valence and arousal with N = 49; four were used in a between-groups study with N = 317, in a gamified task with points;
  - **neither performance, nor affect, nor immersion, nor enjoyment changed** with the sounds;
  - the only significant effect was on **pressure/tension**: low-valence sounds may harm intrinsic motivation;
  - the authors' recommendation: a **high-valence, low-arousal** sound to affirm a correct answer, and avoid low-valence sounds.
  — [ACM DL (403 in this session; data from the abstract and search snippets)](https://dl.acm.org/doi/fullHtml/10.1145/3491102.3517581); [DFKI](https://dfki.de/web/forschung/projekte-publikationen/publikation/12296)
- **van Duijvenvoorde, Zanolie, Rombouts, Raijmakers & Crone (2008)**, *Journal of Neuroscience* 28(38), 9495–9503 (**moderate to strong** strength for the age):
  - compared with adults, children aged **8–9** made proportionally more errors after negative feedback than after positive feedback;
  - the dorsolateral prefrontal cortex and the superior parietal cortex respond more to **negative** feedback in adults and to **positive** feedback in children aged 8–9;
  - the transition to "learning from the negative" happens around ages 11–13.
  — [VU Amsterdam](https://research.vu.nl/en/publications/evaluating-the-negative-or-valuing-the-positive-neural-mechanisms/); [EUR repository](https://repub.eur.nl/pub/74879)
- **Arbel & Fox (2021)**, *Frontiers in Psychology*: EEG with 80 children aged 8–11 in a declarative learning task. The brain response (FRN) to **positive** feedback predicted retention of what was learned; the P3a response to negative feedback was also associated with learning (**moderate** strength: one study) — [PMC7947233](https://pmc.ncbi.nlm.nih.gov/articles/PMC7947233)
- **Reviews of feedback in developmental neuroscience**: children tend to have large responses to feedback **regardless of valence** and differentiate less between positive and negative — [Frontiers 2021](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2021.640270/full)
- **Miranda & Palmer (2011)**, cited second-hand: positive, stimulating sounds increased motivation more than negative, inhibiting sounds (**weak** strength: I did not read the original) — [Springer, Behavior Research Methods 2013](https://link.springer.com/article/10.3758/s13428-013-0357-7)
- **Callaghan & Reich (2018)**, analysis of 171 preschool apps:
  - positive feedback is common, but feedback that **explains** what is right or wrong is rare;
  - a secondary source reports that many literacy apps used a sound effect **only on errors**, without helping to understand why.
  - The same pattern (positive feedback almost always present, explanation rare) appears in Nikolayev et al. (2021), 76 preschool games — [Observatório Tec de Monterrey](https://observatory.tec.mx/?p=862); [UCI News](https://news.uci.edu/2018/09/19/most-preschool-math-literacy-apps-not-designed-to-help-children-learn-uci-study-finds); [Harvard Reach Every Reader](https://reacheveryreader.gse.harvard.edu/review-of-feedback-in-edutainment-games-for-preschoolers-in-the-usa)
- **"I Don't Usually Listen, I Read" (CHI 2022)**, primary-school children with different reading profiles:
  - all benefited from **visual, non-verbal outcome feedback**, which helped them interpret their own performance;
  - **elaborate verbal feedback in audio** was hard to understand for all groups, and beginning readers paid less attention to it.
  — [ACM DL (403; data from the abstract)](https://dl.acm.org/doi/fullHtml/10.1145/3491102.3517480)
- **Serious-game studies with sound notifications** for correct/incorrect answers report more attention and concentration, but without isolating the effect of the error sound (**weak** strength) — [SciTePress 2025](https://www.scitepress.org/Papers/2025/135044/135044.pdf); [ResearchGate](https://www.researchgate.net/publication/374674825_Sound_Design_Impacts_User_Experience_and_Attention_in_Serious_Game)
- **UX guideline** (secondary, not research): Material Design treats celebration sounds ("hero sounds") as **rare and consistent**, frequent sounds as **shorter** and designed to tolerate repetition, and defends silence as an option — [Material: Applying sound to UI](https://m2.material.io/design/sound/applying-sound-to-ui.html); [Material: About sound](https://m2.material.io/design/sound/about-sound.html)

### Inference
- The current **correct-answer bell** is aligned with the evidence (high valence). It should be **calm** (low arousal), not a "party".
- The **two descending notes** on an error are, by design, a low-valence ("sad") sound. Based on the CHI 2022 finding and the neuroscience with 8–9-year-olds, it **adds no learning** and may increase pressure. The information is already in the voice and the hint.
  - Better: **no sound effect on errors**.
  - If the family prefers an audio signal: **a single neutral note**, of stable pitch and not descending, quieter than the bell and very short.
- Visual outcome feedback (e.g. the correct answer highlighted and a simple icon) matters **more** than sound and more than long spoken sentences. Audio should **complement** the visual, never carry the explanation on its own.

### Gaps
- I found no controlled study with children aged 7–10 comparing buzzer × neutral sound × silence on errors.
- I did not read the full texts of CHI 2022 (403). The details of the four sounds and the effect sizes are missing.
- There are no data on **anxiety** (for example, math anxiety) linked specifically to error sounds. The link with "pressure/tension" comes from adults.

---

## 2. Duration, frequency, variation and volume

### Conclusion
- **Coherence (Mayer)**: sounds and music that do not help understand the content **hinder** learning, especially for novices and in short lessons. The effect is strong for material **during** the explanation.
- Celebrations **between** rounds are not the same as background sound during the explanation. Even so, the principle indicates they should be **short, separated from thinking time and never overlap the spoken instruction**.
- On **repetition and variation** there is only game audio design practice (secondary source):
  - repeating the same sound is tiring;
  - some variation helps;
  - but feedback sounds need to keep a **recognizable identity**.
- On volume I found no specific evidence for children in apps.

### Findings with sources
- **Moreno & Mayer (2000)** and the **coherence principle**:
  - the study tested whether adding background music and/or sound effects to a multimedia lesson improved learning;
  - the principle, as formulated by Mayer, says that people learn better when interesting but irrelevant sounds and music are **excluded**, with a large median effect in Mayer's studies (d ≈ 0.97, according to a secondary source);
  - the effect matters most for those with low working memory or little prior knowledge;
  - proposed mechanism: overload of the auditory channel.
  (**strong** strength for the principle; **moderate** for its application to celebrations between rounds)
  — [PDF Moreno & Mayer 2000 (TECFA)](https://tecfa.unige.ch/tecfa/teaching/methodo/Moreno_Mayer00.pdf); [Cambridge, chapter "Coherence principle"](https://www.cambridge.org/core/books/abs/multimedia-learning/coherence-principle/4E80B70CB76E2166B76E5653EBDE7D3E)
- **Sundararajan & Adesope (2020)**, "Keep it Coherent", *Educational Psychology Review* 32(3), 707–734 (meta-analysis of 68 experiments; **strong** strength):
  - "seductive details" (interesting but irrelevant) **reduce** learning;
  - the effect is considerable in **short lessons (< 5 min)** and not significant in long ones (> 10 min);
  - it is larger in novices.
  Our 3-round activities are short lessons.
  — [WSU News](https://news.wsu.edu/2020/03/19/seductive-details-inhibit-learning/); [e-teaching.org](https://www.e-teaching.org/materialien/literatur/sundararajan-adesope-2020)
- **Counterpoint**: a dissertation (Curran 2012) found no harm from **relevant** music and effects in an audio-only presentation (**weak** strength; seen only in a search snippet, without a verified link, and it does not apply to the Moreno & Mayer design)
- **Repetition** (game audio design practice, **secondary** source):
  - repeated sounds cause "listening fatigue" and boredom; studios measure a "nuisance score" and reduce annoyance with random variations;
  - but some sounds **should** repeat, because repetition creates recognition.
  — [A Sound Effect: game audio immersion](https://www.asoundeffect.com/?p=123022); [A Sound Effect](https://asoundeffect.com/game-audio-immersion/)
- **Material Design** (secondary):
  - notification sounds, which play many times, should be shorter and tolerate repetition;
  - celebration sounds should be **rare** and applied **consistently**.
  — [Material: Applying sound to UI](https://m2.material.io/design/sound/applying-sound-to-ui.html)
- **Long speech and children**: primary-school children poorly understood elaborate verbal feedback in audio (CHI 2022, above). In educational games, a large share of textual or verbal feedback is **ignored**: about 77% in a science game for 10–11-year-olds, and about 1/3 was not even noticed in a history game — [PMC7334178](https://pmc.ncbi.nlm.nih.gov/articles/PMC7334178)

### Inference
- **Separate in time**:
  - no celebration sound playing while the next instruction is spoken or while the child needs to think;
  - the speech for the next round only starts when the celebration is over.
- **Duration** (no study with figures; design proposal):
  - **Per correct answer**: the complete feedback fits in ~1.5–2 s, with ~0.5 s of bell and ~1–1.5 s of short speech.
  - **End of activity**: ≤ 3 s of audio.
  - **Milestone**: ≤ 5 s, always with tap to skip.
- **Volume**: effects always **quieter than the voice** (about 6–10 dB below) and nothing "blaring" at milestones; respect the system volume and keep the sound button in the parents' area. This is inference, with no study.
- **Variation**:
  - the correct-answer bell keeps the **same identity**, with 3–4 micro-variations of pitch or timbre (recognition without monotony);
  - it is the **sentences** that vary a lot.

### Gaps
- No study with children aged 7–10 measures the **ideal duration** of celebrations between items or **habituation** to repeated sounds.
- I did not read the full text of Moreno & Mayer (2000). I did not confirm the effect size for "sound effects" separately from "music".

---

## 3. Praise and completion messages: process × person, specificity, sincerity and dose

### Conclusion
- **Process praise** (strategy, effective effort, persistence, self-correction), **specific** and **sincere**, is the safest type. The evidence is **strong** and converges across lab studies, observation and reviews.
- **Person praise** ("tu es intelligente", "tu es une bonne…") and **inflated praise** ("incroyablement parfait!") carry the most risk, especially after a failure and in children with low self-esteem.
- A relevant data point for us: in a study with 4th- and 5th-grade students, person praise **reduced** the motivation of **girls**, while product and process praise increased it.
- The total **amount** of praise does not predict benefit; the **type** is what matters.
- **Empty effort** praise, given after a failure or for something too easy, can be read as "you are weak". **Consolation** of the kind "it's okay, not everyone is good at math" is also demotivating.

### Findings with sources
- **Mueller & Dweck (1998)**, *JPSP* 75(1), 33–52 (six studies with 5th-grade students; **strong** strength):
  - those praised for **intelligence** started prioritizing performance goals and choosing easy problems;
  - after a failure, these children lost motivation and performance;
  - those praised for **effort** persisted.
  — [PDF Columbia](https://www.columbia.edu/cu/psychology/courses/3615/Readings/Mueller_Dweck.pdf)
- **Cimpian, Arce, Markman & Dweck (2007)**, *Psychological Science* 18 (4-year-olds): **generic** praise ("tu es une bonne dessinatrice") led to discouragement in the face of criticism; praise **specific to the action** ("tu as bien dessiné") led to looking for how to fix things — [BPS Research Digest](https://bps.org.uk/research-digest/how-praise-children)
- **Zentall & Morris (2010)**, *J. Exp. Child Psychology*: even a **small proportion** of generic praise reduced persistence; more non-generic praise was linearly related to more motivation — [PubMed 20570281](https://pubmed.ncbi.nlm.nih.gov/20570281/)
- **Gunderson et al. (2013)**, *Child Development* (observational, N ≈ 53):
  - the **proportion** of parents' process praise between ages 1 and 3 predicted, at ages 7–8, a liking for challenges, more strategies in the face of obstacles and a belief in malleable intelligence;
  - the total amount of praise and person praise predicted none of this;
  - **boys received more process praise than girls.**
  — [PMC3655123](https://pmc.ncbi.nlm.nih.gov/articles/PMC3655123); [UChicago News](https://news.uchicago.edu/article/2013/02/12/parents-who-praise-effort-can-bolster-children-s-persistence-self-belief)
- **Corpus & Lepper (2007)**, *Motivation and Emotion* (**moderate** strength; the gender detail comes from a secondary summary):
  - in 4th- and 5th-grade students, product and process praise increased motivation and person praise reduced it **in girls**; in boys there were few effects;
  - in preschoolers, all three types increased motivation.
  — [PDF Reed College](https://www.reed.edu/psychology/motivation/assets/downloads/Corpus_Lepper_2007.pdf)
- **Henderlong & Lepper (2002)**, *Psychological Bulletin* 128(5), 774–795 (review; **strong** strength). Praise can increase, reduce or not affect intrinsic motivation. As long as it is perceived as **sincere**, it helps when it:
  1. attributes the outcome to **controllable causes** (strategy, effort);
  2. promotes **autonomy** (informational, not controlling);
  3. reinforces **competence without social comparison**;
  4. conveys **attainable standards and expectations**.
  (Wording taken from the abstract and from sources that cite it; the PDF could not be read.)
  — [PubMed 12206194](https://pubmed.ncbi.nlm.nih.gov/12206194/); [Corpus & Good 2020, chapter](https://kagood.github.io/files/Corpus_Good_PraiseChapter_2020.pdf)
- **Brummelman et al. (2014)**, *Psychological Science* 25(3), 728–735:
  - about 25% of parents' praise was **inflated**, and more inflated for children with low self-esteem;
  - in the experiment, inflated praise led children with **low self-esteem** to **avoid challenges**, and those with high self-esteem to seek them.
  — [Ohio State News](https://news.osu.edu/when-being-called-incredibly-good-is-bad-for-children/); [BPS Research Digest](https://www.bps.org.uk/research-digest/inflated-praise-your-children-incredibly-bad-idea)
- **Brummelman, Crocker & Bushman (2016)**, "The Praise Paradox", *Child Development Perspectives*: person praise and inflated praise, used to "cure" low self-esteem, can backfire; person praise, but not process praise, predisposes to **shame** after failure — [PDF Weber State](https://www.weber.edu/wsuimages/psychology/2016%20Brummelman_et_al-2016-CDP%20Praise%20Paradox.pdf)
- **Barker & Graham (1987)**, *J. Educational Psychology* 79, 62–66: only **older** children inferred **low ability** from praise for a success (Meyer's paradigm); younger ones inferred the opposite. From my memory, the ages were 4–5, 8–9 and 11–12, and only the 11–12 group made this inference; **the ages were not confirmed in this session**. The 7–10 range is in the **transition** — [scite (abstract)](https://scite.ai/authors/george-phillip-barker-D1YPbp)
- **Amemiya & Wang (2018)**, "Why Effort Praise Can Backfire in Adolescence": effort praise can suggest that the person "needs to try hard because they have little ability". Dweck and Yeager call a focus on effort alone a "false growth mindset" (adolescents; for ages 7–10, **weak to moderate** strength) — [Education Research Report](https://educationresearchreport.blogspot.com/2018/04/why-effort-praise-can-backfire-in.html); [EdWeek](https://edweek.org/leadership/teenagers-are-skeptical-of-praise-for-good-effort-study-finds/2018/04)
- **Rattan, Good & Dweck (2012)**, *JESP* 48, 731–737 (university students): **comfort** feedback ("it's okay, not everyone is good at math") made students perceive low teacher expectations and reduced motivation and investment, compared with **strategy** feedback — [BPS Research Digest](https://www.bps.org.uk/research-digest/be-careful-when-comforting-struggling-students); [PDF](https://scottbarrykaufman.com///wp-content/uploads/2012/02/Rattan-et-al.-2012.pdf)
- **Hattie & Timperley (2007)** and the **EEF Toolkit**:
  - feedback about the **person** is the least effective;
  - feedback about the task, process and self-regulation is the most effective;
  - the EEF says that feedback "about them as individuals" "tends to be the least effective" (search snippet; page with 403).
  — [Frontiers: Wisniewski, Zierer & Hattie 2020](https://www.frontiersin.org/articles/10.3389/fpsyg.2019.03087/full); [EEF Toolkit: Feedback](https://educationendowmentfoundation.org.uk/evidence/teaching-learning-toolkit/feedback)
- **Shute (2008)**, "Focus on Formative Feedback", *Review of Educational Research* 78(1): focus feedback on the **task, not the person**, be specific and suggest how to improve, and avoid controlling or critical feedback — [PDF FSU](https://myweb.fsu.edu/vshute/pdf/shute%202008_b.pdf)
- **Deci, Koestner & Ryan (1999)**, meta-analysis of 128 experiments: **verbal** rewards tend to increase intrinsic motivation, but "tend to be **less** positive for children than for college students"; **controlling** verbal rewards are harmful. The exact d for children **was not verified** — [PDF U. Baltimore](https://home.ubalt.edu/ntygmitc/642/Articles%20syllabus/Deci%20Koestner%20Ryan%20meta%20IM%20psy%20bull%2099.pdf)
- **Popular writing in French** (not academic): advises against the vague « c'est bien! » and recommends **describing what the child did** — [Consoglobe](https://www.consoglobe.com/?p=381514)

### Inference
- **Message formula**: [short marker] + [what she did, concretely]. For example: « Oui! Tu as compté par bonds de 10. » Specificity is what makes the praise **sincere and informative**, and it only exists if the sentence is built from real round data: strategy used, whether she used the hint, whether she corrected herself, whether it was a hard item.
- **Dose**:
  - do not speak a praise sentence for **every** easy correct answer;
  - for first-try correct answers on easy items, a short marker (« Oui! », « C'est ça! ») plus the bell is enough;
  - reserve the process sentence for when it **informs** something: a correct answer after an error, a harder item, a new strategy or self-correction.
  - Basis: Gunderson (quantity does not help), Brummelman (inflated praise), Barker & Graham (praise for something easy can signal low ability from ~8–11 years) and the risk of habituation.
- **Effort praise only together with progress or strategy.** After an error, do **not** say « Bel effort! » on its own: give the next strategy. After a correct answer with effort, name **what** worked.
- **Never console with ability** (« C'est pas grave, les maths c'est difficile pour tout le monde »). Console with **strategy** (« C'est un mot difficile. Écoute le son du milieu. »).
- **How many sentences**: enough that she rarely hears the same sentence twice in a row (see rules). Variety comes mainly from **inserting the concrete detail** into a template, not from synonyms of « Super! ».

### Gaps
- There is no study saying **how many different sentences** an app should have. The number in the rules section is inference.
- Most praise studies involve a **human adult** giving praise. Transfer to **machine/app praise** has not been tested directly; it is plausible that perceived sincerity is even more fragile in an app, which reinforces specificity.
- The full texts of Henderlong & Lepper, Corpus & Lepper and Deci et al. were not read (PDF unreadable for the tool).

---

## 4. When to celebrate: per item, end of activity or milestones; the risk of unpredictability and manipulative patterns

### Conclusion
- Feedback **per item** should be **immediate and informative**. **Celebration** should be proportional to meaning: small per item, medium at the end of the activity, large only at **real mastery milestones** (mastery confirmed on another day, improvement on a weak point).
- Rewards **announced in advance** in exchange for playing or finishing reduce intrinsic motivation; **unannounced** surprises do not show this effect.
- **Intermittent variable-value rewards** ("slot machine") are flagged by the AAP (2026) as **high-risk** design.
- Variation should be in the **words**, not in the **probability** of winning something.

### Findings with sources
- **Lepper, Greene & Nisbett (1973)**: preschoolers who **expected** a certificate for drawing drew less afterwards; those who received it **as a surprise** did not differ from the no-reward group — [Structural Learning (secondary)](https://www.structural-learning.com/post/overjustification-effect)
- **Deci, Koestner & Ryan (1999)**: **expected**, contingent tangible rewards reduce intrinsic motivation; the effect is worse in children. Already summarized in `motivation_and_reports.md` — [PDF U. Washington](https://depts.washington.edu/techdocs/papers/deciExtrinsicRewardsAndIntrinsicMotivation99.pdf)
- **Radesky et al. (2022)**, *JAMA Network Open* 5(6), e2217641 (160 apps used by children aged 3–5):
  - only 20% of apps had no manipulative feature at all;
  - categories found: parasocial relationship pressure, fabricated time pressure, navigation constraints, **attractive lures to prolong play**, and ad pressure;
  - examples cited: a character who cries when the child declines; « reviens demain pour gagner un dragon ».
  — [deceptive.design](https://deceptive.design/articles/prevalence-and-characteristics-of-manipulative-design-in-mobile-applications-used-by-children); [EurekAlert](https://www.eurekalert.org/news-releases/956153)
- **AAP, "Digital Ecosystems, Children, and Adolescents"** (Munzer et al., *Pediatrics* 157(2), Feb. 2026):
  - engagement features (autoplay, infinite scroll, algorithmic recommendation, **behavioural reinforcers**) prolong use and undermine the child's agency;
  - summaries cite **"intermittent and variable reward systems"** among the high-risk features;
  - it calls for child-centred design that **makes stopping easy**.
  (Popular-press sources; the AAP text was not opened in this session.)
  — [AAP news release](https://www.aap.org/en/news-room/news-releases/aap/2026/american-academy-of-pediatrics-calls-for-creating-a-child-friendly-digital-world/); [EPIC](https://epic.org/in-new-policy-statement-american-academy-of-pediatrics-sounds-alarm-about-impact-of-harmful-platform-design-for-kids/); [Contemporary Pediatrics](https://www.contemporarypediatrics.com/view/aap-calls-for-system-level-changes-to-improve-children-s-digital-media-environments); [HealthyChildren.org](https://www.healthychildren.org/English/news/Pages/creating-a-child-friendly-digital-world-AAP-releases-new-media-recommendations.aspx)
- **Hirsh-Pasek et al. (2015)**: the "**engaged**" pillar means engaged in the **learning goal**, without distractions that interrupt it — [APS](https://www.psychologicalscience.org/index.php/publications/educational-apps.html)
- **Material Design** (secondary): celebration sounds are for **important moments**, rare and consistent — [Material](https://m2.material.io/design/sound/applying-sound-to-ui.html)

### Inference
- The current hierarchy (small per round → medium at the end → large at milestones) **is correct**. The adjustment is one of **dose and criterion**:
  - the large milestone only for **evidence of learning**: mastery confirmed on another day, or improvement on a weak point measured against herself;
  - never for "amount played" or for "coming back tomorrow".
- **Acceptable "surprise"**: the child does not know *when* the milestone will come, because it depends on real mastery, but the criterion is **fixed and tied to learning**. This is **not** a variable-ratio reward, in which the same action gives a random prize.
- **Draws forbidden**: "rare" confetti, random prize, wheel, treasure chest.
- **Do not announce** celebrations as payment (« Finis 3 activités et tu auras des feux d'artifice! »).
- After a milestone, the message should make it easy to **stop** (« Le jardin se repose. À la prochaine! »), without calling for "one more".

### Gaps
- I found no study with children aged 7–10 comparing celebration **per item** × **only at the end** with respect to learning.
- The evidence on "variable reward" in children is mostly theoretical and from expert commentary (AAP, Radesky). I found no experimental study in educational apps.

---

## 5. Synthesized voice (TTS) for children's feedback

### Conclusion
- **Moderate** evidence:
  - **positive prosody** (warm tone) improves listening comprehension in children;
  - a **human voice** is better understood and rated more pleasant than TTS;
  - modern, "humanized" TTS comes close to a human voice, while old robotic voices worsen credibility and ratings;
  - children understand synthesized speech **worse** than adults.
- In practice: **short** sentences, a **slightly slower** pace, warm intonation and the best available fr-CA voice. For the most frequent sentences, **human recordings** (for example, by the parents) would be superior.

### Findings with sources
- **Dylman, Champoux-Larsson & Frances (2025)**, *Educational Psychology*, doi:10.1080/01443410.2024.2446778 (children aged 11–13; four experiments):
  - **positive** intonation, compared with neutral, improved listening comprehension;
  - the **human voice** produced more correct answers than TTS and was rated more pleasant and easier to understand.
  — [MPI](https://forms.mpi.nl/node/56855)
- **Craig & Schroeder (2017)**, *Computers & Education* 114, 193–205: improved TTS voices or human voices were rated more credible and had better learning outcomes than a "classic" robotic synthesizer — [Frontiers in Neurorobotics 2020 (cites it)](https://www.frontiersin.org/article/10.3389/fnbot.2020.593732)
- **Scoping review on synthesized speech and children** (Penn State): there is **little research**; children follow trends similar to adults, but with **lower intelligibility**; the variables studied include speed and context — [Penn State Pure](https://pure.psu.edu/en/publications/synthesized-speech-output-and-children-a-scoping-review/)
- **ASHA review (2010)**: only about 10 studies on synthesized speech with child listeners; the effect of slow speed is cited (Higginbotham et al. 1994), but I did not read it — [ASHA](https://pubs.asha.org/doi/10.1044/1058-0360(2010/09-0024))
- **CHI 2022**: **long** verbal feedback in audio is poorly understood by primary-school children (see section 1).

### Inference
- **Speed**: Web Speech API `rate` ≈ 0.9 (slightly slower than the default). **Pitch** default or slightly above (1.0–1.1). Test with the family's ears.
- **Spoken sentences of at most ~8–10 words**, with the key word at the start (« Oui! », « Presque! »). The long explanation stays in text or image.
- **Choose the best local fr-CA voice** and lock it in; avoid switching voices between screens. A robotic voice worsens credibility.
- **Punctuation**: avoid several exclamation marks in a row, which make the prosody exaggerated or artificial in some TTS engines.
- **Possible future improvement**: the parents record the 10–20 most frequent short sentences (markers and milestone messages). This leverages the advantage of the human voice and the "socially interactive" pillar, and sends nothing outside (respects project rule 4). This is inference, not tested.

### Gaps
- I found no study with children aged 7–10 on the **ideal speed** of modern **neural** TTS, nor on TTS in **French**.
- The Dylman et al. study is with 11–13-year-olds and in Swedish or English; I did not read the full text.

---

## Rules for the app

Priority order: P1 = do now; P2 = do next; P3 = desirable. Every duration and count below is **design inference** supported by sections 1–5, not a number taken from a study.

### A. Sounds

| Situation | Sound | Max. duration | Variation | Relative volume |
|---|---|---|---|---|
| **Correct answer** (per round) | Short bell, **pleasant and calm** (high valence, low arousal), always from the same "family" | **≤ 0.6 s** | 3–4 micro-variations (pitch ±1–2 semitones or timbre), chosen without repeating the last one | Below the voice (~ −6 to −10 dB) |
| **Error** | **P1: remove the two descending notes.** Default: **no sound effect**; the calm voice and the hint are enough. Optional (parents' setting): a **neutral** note, of stable pitch, never descending nor a "buzzer" | **≤ 0.3 s** (if any) | None needed | Quieter than the correct-answer bell (~ −12 dB relative to the voice) |
| **End of activity** (3 rounds) | Bells + short applause (the current one works), without overlapping speech | **≤ 3 s** of audio in total; applause ≤ 2 s | 3–4 arrangement variants | Below the voice |
| **Milestone** (mastery confirmed on another day, mission completed, improvement on a weak point) | Large celebration (the current one), **rare** and always tied to learning | **≤ 5 s**, with **tap to skip** | 2–3 variants; the same recognizable "signature" | May be the loudest, but **never above the voice** nor with a shrill peak (soft whistles) |

Sound rules:
1. **P1 – Error without a "failure" sound.** No buzzer, descending notes, "uh-oh", laughter or sad sound. The information comes from the voice, the hint and the visual highlight of the answer.
2. **P1 – No overlap.** No effect plays while an instruction is being spoken or while the child needs to think. The next round only speaks after the celebration has ended. The celebration **does not block** interaction for more than ~2 s: a tap moves on.
3. **P1 – Proportion.** Item < end of activity < milestone, in duration and intensity. A large celebration can only appear with **real evidence of learning**, never for usage time, day streaks or "coming back tomorrow".
4. **P2 – Nothing random with value.** No "rare" confetti, drawn prize, wheel or treasure chest. Sound variation is purely aesthetic, never a "chance to win more".
5. **P2 – Volume.** Effects always below the voice; the sound (and voice) button stays in the parents' area. Tests remain muted (project rule 9).
6. **P3 – Silence is an option.** In "focus" mode (parents' setting), only the voice and the visuals.

### B. Voice (TTS)

1. **P1** – Spoken sentence per correct answer: **at most 8–10 words**, marker at the start. Target duration **≤ 2 s**.
2. **P1** – After an error: **calm** tone (not "sad"), a single concrete hint, **≤ 12 words**. The longer explanation stays visual.
3. **P2** – `rate` ≈ 0.9 and `pitch` 1.0–1.1, with the best **local fr-CA** voice, fixed across the whole app. Avoid "!!!" and sentences in capitals.
4. **P3** – Evaluate parents' recordings for the most frequent markers and for the milestone messages.

### C. Praise: when and how much

1. **P1 – Process, specific, sincere.** Every praise sentence names **what she did** (strategy, checking, use of the hint, self-correction, persistence that paid off), using real round data. Never praise the person (intelligence, "talent", "good girl").
2. **P1 – Dose.**
   - **First-try** correct answer on an **easy** item: only bell + **short marker** (« Oui! », « C'est ça! »), no process sentence.
   - Full process sentence: on **1 out of every 2–3 correct answers** and **always** when it is informative (correct answer after an error, harder item, new strategy, self-correction).
3. **P1 – No inflation.** No « parfait », « incroyable », « génial » for easy items. Reserve the strongest tone for milestones.
4. **P1 – After an error**: no empty effort praise, no consolation by ability. Give the **next strategy** and a new chance.
5. **P2 – Variety and no repetition.**
   - Minimum pools: **first-try correct**: 6–8 markers + 8–10 templates with a slot for the strategy; **correct after error**: 6–8 templates; **after error**: 8–10 hints per game (tied to the content) + 4–6 neutral openings; **end of activity**: 6–8 templates; **milestone**: 5–6 templates, always with the concrete mastery data.
   - **Do not repeat** any of the last 3 sentences in the same context, nor any marker twice in a row.
   - « Bravo! » stops being the fixed marker and becomes one among several.
6. **P2 – Compare only with herself** (« avant… maintenant… »), never with other children nor with "the average".
7. **P2 – Non-controlling language**: no « tu dois », « il faut finir ». Offer a choice at the end (« Veux-tu une autre activité ou on arrête pour aujourd'hui? »), without insisting.

### D. Example sentences (fr-CA; original content; `{…}` = filled with the real round data)

The child is a girl: examples with grammatical agreement use the feminine. Where possible, the sentences avoid agreement.

**First-try correct answer** (short marker + detail, when it fits)
1. « Oui! Tu as compté par bonds de {10}. »
2. « C'est en plein ça! Tu as bien regardé les dizaines. »
3. « Exact! Tu as pris le temps de vérifier. »
4. « Bien vu! Tu as écouté le son au complet avant de choisir. »
5. « C'est ça! Tu as lu le mot syllabe par syllabe. »

**Correct answer after an error**
6. « Tu as essayé une autre façon, et ça a marché! »
7. « Tu as utilisé l'indice, et tu as trouvé. C'est comme ça qu'on apprend. »
8. « Tu t'es corrigée toute seule. Bravo! »
9. « Tu n'as pas lâché, et tu l'as eue! »
10. « Cette fois, tu as regardé les unités en premier. Bien joué! »

**After an error** (calm, one strategy, no judgement)
11. « Pas tout à fait. Regarde encore les dizaines. »
12. « Presque! Essaie de compter à partir du plus grand nombre. »
13. « Hmm, on vérifie ensemble? Écoute le mot encore une fois. »
14. « C'est un mot difficile. Écoute bien le son du milieu. »
15. « Lâche pas! Commence par le premier son. »

**End of activity** (informative; what she practised and how)
16. « Activité terminée! Tu as pratiqué les additions avec des dizaines. »
17. « La dernière question était plus difficile, et tu l'as réussie. »
18. « Tu es restée concentrée jusqu'au bout. »
19. « Aujourd'hui, tu as travaillé les sons « on » et « an ». »

**Milestone** (always with the concrete evidence; comparison only with herself)
20. « Tu maîtrises les additions jusqu'à {20} : tu les as réussies deux jours différents! »
21. « Avant, les mots avec « {ou} » étaient difficiles. Maintenant, tu les lis! Tu as beaucoup pratiqué, et ça paraît. »
22. « Mission accomplie! Tu as pratiqué un peu chaque fois, et tu as appris {à compter par bonds de 5}. »
23. « Une nouvelle fleur pousse dans ton jardin : tu sais maintenant {lire les mots avec « an »}. »

### E. Avoid

- **Person praise**: « Tu es tellement intelligente! », « Tu es la meilleure! », « Tu es un génie! », « Quelle bonne fille! », « Tu es douée en maths! ».
- **Inflated praise or praise for something easy**: « Incroyable!!! », « Parfait, parfait, parfait! », « Wow, extraordinaire! » for trivial items.
- **Judging the error**: « Faux! », « Non! », « Mauvaise réponse », « Dommage! », « Oups, raté! », « Encore une erreur ».
- **Consolation by ability**: « C'est pas grave, les maths c'est pas pour tout le monde », « C'est normal, c'est trop difficile pour toi ».
- **Empty effort after an error**: « Bel effort! » on its own, without a strategy.
- **Comparison**: « Tu es plus rapide que les autres amis », « Seulement 10 % des enfants réussissent ça ».
- **Pressure and lures**: « Vite! », countdowns, « Reviens demain pour gagner… », « Ne perds pas ta série! », a character who gets sad when she leaves, an insistent « Encore une? ».
- **Announced payment**: « Si tu finis 3 activités, tu auras des feux d'artifice! »
- **Sound**: buzzer, descending notes, "uh-oh", laughter, any "sad" sound; a celebration that covers the instruction; a long celebration (> 5 s) or one impossible to skip; drawn prizes.
- **Repeated "growth mindset" mini-lessons** (« Ton cerveau grandit quand tu fais des erreurs! ») on every error: the evidence of effect is weak and it sounds like a sermon. Use rarely at most.

### F. Status of this research
- **Tested**: nothing. These notes are a literature review; no rule has been implemented or tested in the app.
- **Not tested**: all the durations, volumes, pools and frequencies above (they are inference).
- **Could not be verified**: full texts of Henderlong & Lepper (2002), Deci et al. (1999), Moreno & Mayer (2000), the two CHI 2022 papers, the EEF feedback guide and the 2026 AAP statement (unreadable PDF or 403 access). The claims about them come from abstracts and the secondary sources cited.
