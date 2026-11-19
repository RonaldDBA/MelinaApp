# Digital English (L2) learning games for a 7-year-old francophone: game formats, adaptation, TTS, motivation, parent reporting

Scope note: these notes cover evidence on game formats, adaptive scheduling and learner modelling, text-to-speech (TTS) and speech recognition, motivation without dark patterns, and progress reporting for parents. The target is a family app that already has mastery levels, a per-skill logistic learner model with tags, spaced review by days, and parent reports. Evidence strength is marked as follows. **[Strong]**: meta-analysis or several converging peer-reviewed studies. **[Moderate]**: single peer-reviewed studies or reviews, or results in adults that are likely to transfer. **[Weak]**: commentary, grey literature, or inference.

Method caveat: most sources were read only at abstract or repository-record level, because full texts were paywalled or blocked by bot checks. Exact moderator statistics are given only where an abstract stated them.

---

## 1. Which CALL/MALL game formats have evidence for children's L2 vocabulary and listening, and what do the meta-analyses say?

### Takeaway
Digital games reliably beat no-game or alternative-activity controls for L2 vocabulary. Effects are medium overall and large against weak controls. The evidence is about game design features in aggregate, not about specific micro-formats such as "odd-one-out" versus "memory pairs". **Game design features moderate the effect, but learner age apparently does not.** For the micro-formats, the choice has to come from general vocabulary-learning principles (retrieval, receptive-to-productive progression, spacing), not from format-level meta-analytic evidence.

### Cited Findings
- **Tsai & Tsai (2018), *Computers & Education* 125:345–357** (DOI 10.1016/j.compedu.2018.06.020) meta-analysed 26 studies from 2001–2017 on digital game-based L2 vocabulary learning. They classified designs into four "conditions" and found different effect sizes per condition, which they say explains why earlier meta-analyses disagreed. [Strong] — [NTNU Scholars record](https://scholar.lib.ntnu.edu.tw/en/publications/digital-game-based-second-language-vocabulary-learning-and-condit-2/)
  - Condition 1 (game vs. control doing alternative activities, 10 studies): **large** overall effect.
  - Condition 2 (game with an added or changed feature vs. base game, 10 studies): **medium** overall effect. *This is the most relevant one for designing features inside an existing app.*
  - Condition 3 (game vs. identical content delivered conventionally, 2 studies): medium to large.
  - Condition 4 (everyone plays the same game, grouped by a non-game variable, 4 studies): not significant.
  - Eight moderators were tested: game design, educational level, L2 proficiency, linguistic distance, setting, assessment type, game source and intervention length. Their results were not visible in the abstract.
- **Chen, Tseng & Hsiao (2018), *British Journal of Educational Technology* 49(1)** (DOI 10.1111/bjet.12526). The effect of digital game-based vocabulary learning (DGBVL) varied with **game design features** (Q = 5.857, df = 1, p = .016). It did **not** vary with **learner age** (Q = 0.906, p = .341) or **linguistic background** (Q = 0.0001, p = .994). The authors draw on Flow Theory and place adventure-oriented games higher on the "challenge" axis than non-adventure games. [Strong for the moderator pattern; effect sizes not seen] — [Open Development & Education library record](https://docs.opendeved.net/lib/24BG25I9)
  - Note: the brief cites "Chen et al. 2020". The search found Chen, Tseng & Hsiao **2018** as the Chen meta-analysis on DGBVL, and no 2020 Chen meta-analysis on this topic was confirmed — [search summary pointing to the 2018 BJET paper](https://docs.opendeved.net/lib/24BG25I9).
- **Dixon, Dixon & Jordan (2022), *Language Learning & Technology* 26(1):1–25.** Weighted d = **0.50** for between-groups designs (small to medium) and **0.95** for within-group designs. Games designed **for entertainment were more effective than games designed for L2 education**, although the 95% confidence intervals partly overlapped. The analysis covered publicly available games as of January 2020. [Strong] — [LLT item record](https://www.lltjournal.org/item/10125-73464/); [ScholarSpace record](https://scholarspace.manoa.hawaii.edu/items/8e966948-cfc4-452c-8e5f-dd6d0ea3a6aa)
- **Hung, Yang, Hwang, Chu & Wang (2018), *Computers & Education* 126:89–104**, a scoping review of DGBLL studies from 2007–2016. Reviewed studies mostly reported positive outcomes, and immersive games were the most common genre. [Moderate, descriptive] — [British Library record](https://eld.bl.uk/catalog/100067863382_0x000001)
- A technology-assisted L2 vocabulary meta-analysis in *ReCALL* (Yu & Trainin, 2022, per search summary) pooled 34 studies (N = 2,511) and found d = 0.64 overall. **College students benefited more than K–12 students**, and mobile-assisted learning outperformed computer-assisted learning. [Strong for adults; weaker for young children] — [Cambridge ReCALL PDF link](https://resolve.cambridge.org/core/services/aop-cambridge-core/content/view/08A549A6CFD1078406E6A4F8AFE28184/S0958344021000239a.pdf/a-meta-analysis-examining-technology-assisted-l2-vocabulary-learning.pdf)
- A 2020 Bayesian meta-analysis, "Video-game based instruction for vocabulary acquisition with English language learners", included 19 studies. Its authors were not visible in the record. — [Scinapse record](https://www.scinapse.io/papers/3016804751)
- Quizlet (flashcard/matching) meta-analysis: g = 0.62 for vocabulary achievement, g = 0.74 for retention, g = 0.37 for attitude. Not specific to young children. [Moderate] — [search summary via PMC listing](https://pmc.ncbi.nlm.nih.gov/articles/PMC9479751)
- **Minimal-pair listening (phonetic training):** Giannakopoulou, Brown, Clayards & Wonnacott (2017, *PeerJ*). Greek-speaking 8-year-olds (N = 52) and adults (N = 41) were trained on the English /i/–/ɪ/ contrast ("sheep/ship" type) over **10 sessions** in a computerised word-learning game. **Both age groups improved.** The expected advantage of high-variability training (4 talkers) did not appear. **Children did better with a single talker** (a reverse effect). There was no evidence of greater child plasticity, and no variability effect on lexical learning. [Moderate, single RCT] — [PeerJ article](https://peerj.com/articles/3209)

### Inferences
- **The evidence supports "a game wrapper around retrieval practice" in general, but not one specific micro-format over another.** No source found ranks picture–word matching vs. odd-one-out vs. memory pairs vs. word order. The formats should therefore be chosen to cover the receptive-to-productive ladder (see section 2), with each kept simple.
- Chen et al.'s null age moderator plus Dixon et al.'s "entertainment beats edu-games" result suggest that **game feel matters** (narrative, challenge, flow) more than drill dressing. For the app this means the existing garden-scene and stage framework, with light narrative such as helping a character and an adventure-style progression, is the right container.
- **Concrete format catalogue mapped to the knowledge ladder** (from easiest to hardest; the ordering is an inference based on Laufer & Goldstein's hierarchy in section 2):
  1. **Listen-and-choose (picture)**: hear the English word through TTS and tap 1 of 3–4 pictures. Passive recognition through the auditory channel. It needs no reading, so it is ideal for a 7-year-old who does not yet read English.
  2. **Picture–word matching (written)**: see a picture and pick the written word, or the reverse. Recognition that requires decoding English spelling. Introduce it after listen-and-choose for the same word.
  3. **Memory or matching pairs (audio-picture or word-picture)**: low-pressure recognition with a working-memory load. Good as a "warm-up" or review format, since there is no fail state.
  4. **Odd-one-out**: four pictures or words, one of which does not belong to the category. It trains semantic organisation. Because semantic sets are explicitly shown together (see the interference finding in section 2), use only already-known words.
  5. **Picture–sentence matching / listen-and-choose (sentence)**: hear "The cat is under the table" and choose the matching picture. Listening comprehension at the phrase level, with structures such as prepositions, plurals and colours + nouns.
  6. **Minimal-pair listening**: hear one word of a pair such as ship/sheep, three/tree, hat/hot or thin/fin and pick its picture. Target contrasts that are hard for francophones (for example /ɪ/–/iː/, /θ/–/t/–/s/, /h/-dropping, /æ/–/ʌ/; the contrast list is an inference not checked against a francophone-specific source). Use **one consistent voice** first, given the Giannakopoulou result that children did better with one talker, and add a second voice only after mastery.
  7. **Sentence building / word order**: drag 3–5 word tiles to match a picture or an audio sentence. Productive syntax with recognition support.
  8. **Spelling / dictation**: hear the word and build it from letter tiles, with distractor letters. Productive written recall, the hardest format. Keep it to very high-frequency, mostly phonically regular words at age 7.
- Effect sizes in young children are probably smaller than in college-age learners (Yu & Trainin's K–12 < college result). Expectations in parent reports should stay modest.

### Gaps
- No meta-analysis disaggregates effects by these specific micro-formats, and none reports separate effect sizes for ages 6–10. Full-text moderator tables for Tsai & Tsai (2018) were not accessible.
- No source was found that confirms a "Chen et al. 2020" meta-analysis. The Chen 2018 BJET paper is the likely intended citation.
- No francophone-child-specific evidence was found on which English phoneme contrasts to prioritise. The list above is an inference.

---

## 2. Spaced repetition, adaptive scheduling, receptive vs productive knowledge, distractor choice and difficulty

### Takeaway
Spacing beats massing robustly. Whether expanding intervals beat equal intervals is **not settled** and depends on the retention interval, so a simple expanding day-level schedule driven by model-predicted recall is defensible. Track each word on at least two dimensions, **receptive (recognise) vs. productive (recall/produce)**, because they form a difficulty hierarchy. **Do not teach semantically similar new words together**, since semantic clustering causes interference. Semantic and phonological distractors should be reserved for words the child already knows, as a way to raise difficulty.

### Cited Findings
**Spacing and schedules**
- **Pimsleur (1967), "A Memory Schedule", *Modern Language Journal***, proposed graduated-interval recall. The commonly cited sequence is 5 s, 25 s, 2 min, 10 min, 1 h, 5 h, 1 day, 5 days, 25 days, 4 months, 2 years, roughly powers of 5. [Historical/primary] — [original article text (typeset.io)](https://typeset.io/pdf/a-memory-schedule-1yvfb57hw1.pdf); [Art of Memory summary](https://artofmemory.com/blog/the-pimsleur-language-method/)
- A study of German vocabulary found that **uniform delays gave higher long-term retention than graduated delays**. [Moderate] — [UVic paper (Schuetze)](https://www.uvic.ca/humanities/germanicslavic/assets/docs/RetentionCalico.pdf)
- Comparisons of expanding vs. equal spacing in L2 vocabulary have yielded **mixed results**. The *SSLA* study by Nakata (expanding vs. equal spacing) examines whether the amount of spacing and the retention interval drive the outcome. [Strong that it is mixed] — [Cambridge SSLA abstract](https://www.cambridge.org/core/journals/studies-in-second-language-acquisition/article/effects-of-expanding-and-equal-spacing-on-second-language-vocabulary-learning/D1D796306985C52F9BE7A1200AC50DB9)
- Children: a classroom study of 30 children learning L2 word pairs found that **spaced beat massed**. Children with developmental language disorder (L1 word learning, JSLHR 2024) showed better early retrieval under expanding schedules, but **no difference in one-week retention** between expanding and equal schedules. [Moderate; indirect population] — [SAGE Open study](https://journals.sagepub.com/doi/10.1177/2158244016646148); [JSLHR 2024](https://pubs.asha.org/doi/10.1044/2024_JSLHR-23-00528)
- **Half-life regression (Settles & Meeder, ACL 2016, Duolingo).** Recall is modelled as p = 2^(−Δ/h), where Δ is the time since last practice and the half-life is h = 2^(Θ·x), with x being practice-history features (counts of correct and incorrect answers, lexeme features). It reduced recall-prediction error by **45%+** vs. baselines, **nearly half the error of the Leitner system** Duolingo used before, and raised daily engagement by 12% in an operational test. The data (13 M traces) and code are public: github.com/duolingo/halflife-regression. [Strong for adults/teens; children not studied] — [ACL Anthology P16-1174](https://preview.aclanthology.org/landing_page/P16-1174); [Duolingo blog](https://blog.duolingo.com/how-we-learn-how-you-learn)

**Knowledge tracing**
- **Bayesian Knowledge Tracing (Corbett & Anderson 1995, *User Modeling and User-Adapted Interaction* 4(4):253–278)** has four parameters: P(L0) prior knowledge, P(T) learning rate, P(G) guess, P(S) slip. Commonly cited bounds are P(G) < 0.3 and P(S) < 0.1 (attributed to Corbett & Anderson). Looser bounds of 0.5 appear in later work. [Strong as a method; the bounds are not verified in the original] — [Penn Learning Analytics slides](https://learninganalytics.upenn.edu/MOOT/slides/W004V002v6.pdf); [Wikipedia: BKT](https://www.wikipedia.com/wiki/Bayesian_knowledge_tracing)
- BKT and Item Response Theory are formally related and can be combined. Logistic (IRT-like) models give item difficulty, and BKT gives learning over time. [Moderate] — [arXiv 1803.05926](https://arxiv.org/pdf/1803.05926)

**Receptive vs productive**
- **Laufer & Goldstein (2004), *Language Learning* 54(3):399–436**, defined a strength hierarchy of four modalities. Passive recognition is easiest, then active recognition and passive recall, with active recall hardest. Secondary sources disagree on the order of the two middle levels. The hierarchy held at all frequency levels (435 ESL learners), and **passive recall best predicted classroom performance**. [Strong] — [Bohrium abstract](https://www.bohrium.com/paper-details/testing-vocabulary-knowledge-size-strength-and-computer-adaptiveness/812341984197869569-6763); [Mochizuki summary](https://reitaku.repo.nii.ac.jp/record/346/files/%E3%83%AC%E3%83%B4%E3%83%A5%E3%83%BC%E2%84%961%EF%BC%98%20%20MOCHIZUKI%2C%20Masamichi.pdf)

**Distractors and set composition**
- **Semantic clustering interferes with new-word learning.** Tinkham (1993, 1997) and Waring (1997) found that learning semantically related new words together (all colours, all fruits) hindered learning, while **thematic clustering** (words around a scene, such as "frog, pond, jump, green") helped. Later results are mixed. [Moderate] — [Frontiers in Psychology 2022](https://frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2022.997951/full)
- Pérez-Serrano et al. (2022): words presented **non-clustered were better recalled and recognised** than words in semantic clusters, especially with more repetitions. [Moderate] — [Frontiers in Psychology 2022](https://frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2022.997951/full)
- Nakata & Suzuki (2018, *SSLA*): introducing a related word only after the first is largely known (spacing) may reduce interference. [Moderate] — [Cambridge SSLA](https://resolve.cambridge.org/core/journals/studies-in-second-language-acquisition/article/effects-of-massing-and-spacing-on-the-learning-of-semantically-related-and-unrelated-words/F58BA8D70385603B9C42E408BFCB8A10)

### Inferences (implementable rules for the existing engine)
- **The skill unit is word × modality.** Each lexeme gets separate model entries (tags) for `listen-recognise` (audio→picture), `read-recognise` (written→picture), `sentence-listen` (phrase→picture), `spell` (audio→letters) and optionally `order` (syntax patterns). Unlock a harder modality only once the easier one is at mastery, for example a predicted P(correct) ≥ 0.85 on two separate days. This mirrors the Laufer & Goldstein hierarchy, which the app's mastery levels can represent directly.
- **Correct for guessing in recognition formats.** With 3–4 options, chance is 25–33%, close to the BKT P(G) bound. In the logistic model, give recognition-format items a guessing floor (a 3PL-style lower asymptote c ≈ 1/options), or weight a correct answer less as evidence than a correct spelling. A word should never become "mastered" through recognition-only answers.
- **Scheduling.** Keep the day-level spaced review. Schedule the next review when the model's predicted recall falls to about 0.8–0.9, in the half-life-regression style. If the existing engine uses fixed Leitner-like boxes, an acceptable child-friendly ladder is: same session (2–3 retrievals spaced by other items), 1 day, 3 days, 7 days, 14 days, 30 days. Demote one box on error, not back to the start. The fixed intervals are an inference: the evidence does not favour expanding over equal spacing, so the priority is "spaced, not massed".
- **Within-session spacing.** Interleave 2–3 other items before re-asking a word missed in the same session (short Pimsleur-style intervals), and re-ask it before the session ends.
- **Introduce new words in thematic scenes, not semantic sets.** For example, "in the garden: frog, pond, jump, green" rather than "red, blue, green, yellow" together. Introduce at most about 3–5 new words per session (a practical inference, not sourced). Stagger semantically related words across sessions, adding the next colour only when the previous one is at recognition mastery.
- **Distractor difficulty ladder** (inference built on the interference findings):
  - Level 1: distractors are **unrelated, known** words from other themes (easy discrimination).
  - Level 2: distractors from the **same semantic category**, known words only (cat vs. dog vs. rabbit).
  - Level 3: **phonologically similar** distractors (cat/cap/hat; ship/sheep), only for listening skills and minimal-pair work.
  - Level 4: semantic + phonological mix, or more options (4→6). Raise the level when the child's recent accuracy on the tag is above about 85% and lower it when it is below about 65%. This keeps success near the 70–85% "productive challenge" band (the band is an inference, not sourced here).
- **Number of options.** Start with 3 pictures at age 7, then 4. Only add more for mastered sets.

### Gaps
- No study was found that validates half-life regression, BKT or IRT specifically for vocabulary learning by 6–10-year-olds. All quantitative model evidence is from adults or teens.
- No primary empirical source was found that directly compares semantic vs. phonological distractors in children's L2 picture tasks. The ladder above is inference.
- The optimal number of new words per session for 7-year-olds was not found in peer-reviewed sources in this search.

---

## 3. Text-to-speech for L2 listening with children: intelligibility, accent, speed, risks; speech recognition (background only)

### Takeaway
Synthetic speech is **less intelligible for children than for adults, and especially hard for bilingual and non-native listeners**. Modern neural TTS is far better than the older systems in most of these studies, but it should still be treated as a model that can fail. Use one consistent, clear voice (North American English fits Québec), a slightly slowed rate, and short utterances. Always offer replay, and prefer human-recorded audio for the core vocabulary and minimal pairs where possible. Speech recognition for non-native children is still error-prone, and since the app forbids sending audio externally, only on-device options could ever be considered.

### Cited Findings
- **Axmear et al. (2005), *Language, Speech, and Hearing Services in Schools***, compared DECtalk synthetic speech with live speech for monolingual and bilingual children. Even higher-quality synthetic speech **may be a greater challenge for bilingual children** than for monolingual English-speaking children. [Moderate; old TTS] — [ASHA LSHSS](https://pubs.asha.org/doi/10.1044/0161-1461(2005/024))
- A 2010 review in *American Journal of Speech-Language Pathology* found few studies (n = 10) on synthesized speech for children. Children show the same trends as adults but **lower intelligibility**. [Moderate] — [ASHA AJSLP 2010](https://pubs.asha.org/doi/10.1044/1058-0360(2010/09-0024))
- **Simantiraki, Wagner & Cooke (2023), *Frontiers in Neuroscience***: for native and non-native adult listeners, artificially **enhanced** natural speech was most intelligible with the lowest listening effort, while **synthetic speech was the reverse** (least intelligible, highest effort). [Moderate; adults] — [PMC article](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10568627/)
- Thirty-seven L2 English learners rated five free TTS systems for comprehensibility, naturalness and intelligibility. IBM Watson and Google Translate ranked best. This shows that TTS quality varies a lot between engines. [Weak–moderate; conference paper] — [research-publishing.net chapter](https://research-publishing.net/publication/chapters/978-2-490057-22-1/817.pdf)
- **Single consistent voice vs. many voices:** in a child L2 phonetic-training game, children trained with **one talker did better** than children trained with four. [Moderate] — [PeerJ, Giannakopoulou et al. 2017](https://peerj.com/articles/3209)
- **ASR for non-native child speech:** modern pretrained models (Wav2Vec2.0, Whisper) achieved "acceptable" performance on native and non-native Dutch children's speech, enough to extract phoneme-level feedback. Child and non-native speech remain hard because of high variability and scarce training data, and fine-tuning on child speech is needed. [Moderate; short conference paper] — [arXiv 2306.16710 (SLATE 2023)](https://arxiv.org/pdf/2306.16710)
- A 2018 systematic review of automated speech analysis for children found these tools had been used effectively to improve children's foreign-language pronunciation, and judged them promising overall. [Moderate; pre-transformer] — [McKechnie et al. 2018, IJSLP](https://psi.engr.tamu.edu/wp-content/uploads/2019/06/mckechnie-2018-ijslp.pdf)

### Inferences
- **Voice choice.** Use **one** high-quality North American English voice (en-CA if a good one is installed, otherwise en-US) for all core content. Canadian English is close to US English in most vocabulary pronunciation, and both are what a Québec child hears in school media (an inference, not sourced). Avoid voice-switching between items, and introduce a second voice only in a later "different speakers" level.
- **Rate and form.** Use about 0.85–0.9× the normal rate for single words and short phrases, with no artificial over-slowing that distorts vowels (inference). Always provide a large **replay** button, and give a "slow" replay on the second request. Present each word both **alone** and in a short carrier phrase ("a frog", "I see a frog").
- **QA risk list for TTS** (inference informed by the intelligibility findings):
  - Mispronunciation of homographs (read/read, live/live).
  - Wrong stress.
  - Clipped short words (a, the).
  - Minimal pairs synthesised too similarly. Minimal-pair items must be listened to and checked by an adult before release, or better recorded by a human, since this is exactly where synthetic speech can fail.
  - Built-in browser voices (Web Speech API) differ between machines and OS updates. Pre-generating or recording audio files gives a stable, testable model.
- **Privacy fit.** Because no child audio may leave the device, **leave speech recognition out of the first version**. Production can be practised through spelling and word-order tiles, plus "say it out loud" prompts with no recording, which are still useful as self-rehearsal. On-device ASR (for example a locally run Whisper-class model) is the only option compatible with the privacy rule. It would be unreliable for a 7-year-old non-native speaker and should never be used to mark answers wrong. Note it only as background.

### Gaps
- No study was found on **modern neural TTS** intelligibility specifically for **child L2 listeners**. All child-TTS intelligibility evidence found is from older synthesizers.
- No peer-reviewed source was found on the optimal speech rate for TTS for child L2 learners, or comparing Canadian vs. US accents for francophone Québec children.

---

## 4. Motivation and gamification in children's L2 apps without dark patterns; informative feedback

### Takeaway
Apps for young children commonly use manipulative design: parasocial pressure, fabricated time pressure, lures. Streak mechanics operate through loss aversion and can displace the learning goal. For children, **simple, clear outcome feedback (right/wrong plus try again)** is more usable than verbal metalinguistic explanations, which children attend to but often do not understand. Motivation should come from game feel, visible mastery and specific praise, not from loss threats.

### Cited Findings
- **Radesky et al. (2022), *JAMA Network Open*.** Among apps used by 160 children aged 3–5, manipulative designs were coded: **parasocial relationship pressure, fabricated time pressure, navigation constraints, attractive lures**, and ad-based pressure. Only about one in five apps had none, and nearly 99% of children had at least one such design in a top-used app. Prevalence was higher for children of lower-education households. One example is a character saying "You're making me want to go to sleep" when the child is idle. The authors link these tactics to family stress around ending play. [Strong, cross-sectional] — [Michigan Medicine summary](https://www.michiganmedicine.org/health-lab/design-tricks-commonly-used-monetize-young-childrens-app-use); [Deceptive Design summary](https://deceptive.design/articles/prevalence-and-characteristics-of-manipulative-design-in-mobile-applications-used-by-children); [EurekAlert release](https://www.eurekalert.org/news-releases/956153)
- **Streaks.** Commentary citing a *Journal of Consumer Research* study says users can come to value extending the streak **more than the underlying activity**. Users who break streaks reportedly often quit. Streaks are commonly framed as working through loss aversion. [Weak: secondhand commentary; the primary JCR study was not verified] — [The Decision Lab, "Streak Creep"](https://thedecisionlab.com/insights/consumer-insights/streak-creep-the-perils-of-too-much-gamification); [Yu-kai Chou on streak design](https://yukaichou.com/gamification-study/master-the-art-of-streak-design-for-short-term-engagement-and-long-term-success/)
- Duolingo's own half-life regression deployment raised daily engagement by 12%. This shows that **scheduling quality itself** affects engagement, independent of streak pressure. [Strong for adults] — [ACL Anthology P16-1174](https://preview.aclanthology.org/landing_page/P16-1174)
- **Feedback for children in literacy games (Vasalou et al., BJET).** Children **benefited from outcome feedback**, which supported accurate interpretation of performance and prompted retries. **Elaborative (explanatory) feedback** attracted similar attention, but children **struggled to understand it** and relied on implicit knowledge. Games with verbal elaborative feedback need extra instruction or scaffolding. A follow-up across novice readers, struggling readers and **EFL learners** found that older children noticed auditory elaborative feedback more, but all groups struggled to understand it. [Moderate] — [Vasalou et al., BJET (UCL Discovery)](https://discovery-pp.ucl.ac.uk/id/eprint/10129142/7/Vasalou_bjet.13145.pdf); [iRead CEUR paper](https://ceur-ws.org/Vol-2497/paper3.pdf)
- Earlier work in non-language games (Moreno 2004; Mayer & Johnson 2010), as cited, found that **outcome + elaborative feedback together** helps more than outcome feedback alone. For adults in tutorial CALL, more specific corrective feedback tends to give better results and more self-correction. [Moderate] — [iRead CEUR paper](https://ceur-ws.org/Vol-2497/paper3.pdf); [AILA 2021 abstract](https://aila2021.dryfta.com/program/abstract-archive/abstract/public/2461/uptake-of-elaborative-feedback-in-serious-literacy-games)
- Dixon et al. (2022): entertainment-designed games outperformed education-designed games, which suggests intrinsic game appeal matters. [Strong, with overlapping CIs] — [LLT record](https://www.lltjournal.org/item/10125-73464/)

### Inferences (design rules)
- **Do not use:**
  - Streak counters that reset, or any "you'll lose X" messaging.
  - Timers that pressure (time-limited rounds), unless the child chooses them in an optional mode.
  - A sad or guilt-tripping character when the child stops.
  - Variable-ratio loot or randomised rewards.
  - Locking content behind daily logins.
  - "Just one more" prompts at session end.
  - These map directly onto the Radesky categories.
- **Use instead:**
  - A **cumulative, non-losable** record, such as plants in the garden that grow with mastered words and never wither.
  - A natural **session end** ("Great work today! See you tomorrow"), with an optional soft cap of about 10–15 minutes, which is an inference.
  - **"Words you can understand now"** collections, which make progress concrete.
- **Feedback for a 7-year-old non-reader in English:**
  1. Immediate outcome feedback: a visual and sound cue, with neutral, non-punitive wrong-answer cues.
  2. On error, **replay the correct audio and highlight the correct picture**. This is implicit elaborative feedback through the modality, not a verbal grammar explanation.
  3. One retry, then show the answer, then requeue the item later in the session.
  4. Any explanation in **French**, very short and concrete ("On dit *sheep* : le son est long, iii"), with no metalanguage. This follows the Vasalou finding that children don't understand verbal elaborative feedback.
- **Specific praise** tied to the skill ("You heard the difference between ship and sheep!") rather than generic "Bravo". This is consistent with the app's existing informative-praise policy.

### Gaps
- The primary *Journal of Consumer Research* study on streaks was not located or verified. The streak critique evidence here is grey literature.
- No peer-reviewed study was found that tests streaks or loss-aversion mechanics specifically in children aged 6–10 in L2 apps.

---

## 5. Reporting L2 progress to parents meaningfully (can-do statements, CEFR-style)

### Takeaway
The Council of Europe publishes collated, validated **can-do descriptors for young learners aged 7–10** (and 11–15), organised by CEFR level from Pre-A1 to A1 and up. They are built from European Language Portfolios with expert judgments of age relevance. They are the natural vocabulary for parent reports. Report "what she can do" in plain language, plus per-modality word counts (understands when heard / recognises written / can spell), and avoid raw scores and implied CEFR certification.

### Cited Findings
- The Council of Europe's **"Collated Representative Samples of Descriptors of Language Competences Developed for Young Learners", Volume 1: Ages 7–10 (2018 edition)** is organised by CEFR level. It covers communicative language activities and strategies (reception, interaction, production, mediation). Descriptors were drawn from validated European Language Portfolios and other sources, with relevance to the 7–10 and 11–15 age groups judged by experts and informed by cognitive-development literature. [Strong, authoritative grey literature] — [Council of Europe rm.coe.int](https://rm.coe.int/16808b1688); [CoE collation of validated ELP descriptors for young learners](https://rm.coe.int/the-collation-of-validated-portfolio-descriptors-for-young-learners-go/1680788b28); [Iwate University mirror, A1 extract](https://logos.edu.iwate-u.ac.jp/jhoffice/wp-content/uploads/sites/6/2019/04/COLLATED-REPRESENTATIVE-SAMPLES-DESCRIPTORS-YOUNG-LEARNERS-VOLUME-1-AGES-7-10-2018-Just-A1.pdf)
- The **CEFR Companion Volume (2018)** added new descriptors, including **Pre-A1**, and listening scales such as listening to announcements and instructions and to audio media. It is not age-specific. [Strong] — [CEFR Companion Volume 2018](https://rm.coe.int/cefr-companion-volume-with-new-descriptors-2018/1680787989)
- Laufer & Goldstein (2004): passive recall was the best predictor of classroom performance. This suggests reporting the modality split, not only recognition counts. [Strong] — [Bohrium abstract](https://www.bohrium.com/paper-details/testing-vocabulary-knowledge-size-strength-and-computer-adaptiveness/812341984197869569-6763)

### Inferences (report design)
- **Report structure**, in French in the app, since the parent area is fr-CA:
  1. **Can-do lines**, written originally in the spirit of the CEFR Pre-A1/A1 young-learner descriptors and not copied verbatim. Examples:
     - "Comprend des mots familiers (animaux, couleurs, nombres jusqu'à 10) quand on les dit clairement."
     - "Reconnaît à l'écrit des mots très courants accompagnés d'une image."
     - "Comprend une courte phrase simple qui décrit une image."
     - "Distingue des sons proches (ship/sheep)."
     - "Peut écrire quelques mots très courants."
     - Each line turns "acquis" only when the underlying tagged skills are at mastery on separate days.
  2. **Per-theme word counts by modality** ("Les animaux : 12 compris à l'oral, 9 reconnus à l'écrit, 4 épelés").
  3. **Retention evidence**, the share of words still correct at a review after 7 or more days. This is the honest measure of learning versus same-day performance.
  4. **"À travailler"**: one or two specific weak contrasts or words, with a suggested off-screen activity (point and name objects at home).
- **Avoid:**
  - Presenting a CEFR level as a certification. Say "repères inspirés du CECR", since the app's tasks are not a validated CEFR assessment.
  - Percent scores without context.
  - Comparisons to other children.
  - Time-on-app as a success metric.
- **Map the existing learner model to levels.** For example, "Pré-A1 en cours" when about 50 or more high-frequency words are receptively mastered, plus phrase-level listening on a few structures. These thresholds are an inference and should be labelled as the app's own indicators, not official ones.

### Gaps
- The actual text of the Pre-A1/A1 listening descriptors for ages 7–10 could not be extracted: the CoE server returned 403 and the mirror PDF could not be parsed. The report writer should consult the CoE PDF directly for verbatim descriptors, and paraphrase them rather than copy at length.
- No peer-reviewed study was found on how parents interpret or use L2 progress reports from children's apps.
- No source was found that links vocabulary counts to CEFR Pre-A1/A1 levels for young learners. Any word-count thresholds are inference.
