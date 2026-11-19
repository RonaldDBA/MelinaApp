# Give each child a door, not an age

The parent's activity idea is the right core for a 3-year-old. The app says a word aloud (a colour, an animal, an animal sound) and the child taps the matching picture. This is the receptive "hear and point" format that standard vocabulary tests use from age 2½. The CDC's own 30-month colour milestone is worded the same way: the child points to the red crayon when asked "Which one is red?" Naming colours comes later, as a 4-year milestone ([CDC 30 mo](https://www.cdc.gov/ncbddd/actearly/milestones/milestones-30mo.html); [CDC 4 yr](https://www.cdc.gov/ncbddd/actearly/milestones/milestones-4yr.html)). The entrance idea should change shape, though. An age door ("3 ans et moins" / "plus de 3 ans") does not tell the app *which* child is playing, so the toddler's random taps would land in Melina's learner model and reports. Neither child can be stopped from picking the "big kid" door. The cut would also send the boy, on his 4th birthday, into a 2e année curriculum. Build per-child profiles instead: a large picture card with a spoken name for each child, and age or mode set by the parent in the parents' area. Québec's privacy regulator says this is where age data belongs: it should adapt the interface, not act as a gate the child declares himself through ([CAI 2024](https://www.cai.gouv.qc.ca/uploads/pdfs/CAI_ME_PRP_Jeunes_CSESJ.pdf)). Around that core, the evidence points to these design rules:

- One short session a day, well inside the **≤1 hour/day** screen ceiling that the Canadian Paediatric Society sets for ages 2–5 ([CPS](https://cps.ca/en/documents/position/screen-time-and-preschool-children)).
- Audio-first, tap-only screens with very large targets, and two pictures before three or four.
- Short, specific praise, with no announced prizes.
- A help ladder that ends by showing the answer, never with a buzzer.
- A predictable "the garden is resting" ending, with no autoplay into the next activity.
- No network call at all from the toddler mode.

The work needs no new technology. The server's tables are already keyed by `profile_id`. The main technical change is to stop using a single constant profile, then add one new "Les petits" game shell and a separate, simpler skill map.

## Three-year-olds understand far more than they can say, so test what they hear

The developmental case for "hear and point" is strong and consistent. The CDC's 2022 milestone checklists list skills that about 75% of children already show at a given age, so each item is a floor, not a teaching target ([ZERO TO THREE](https://www.zerotothree.org/resources/series/early-developmental-milestones)).

- **At 30 months**, a typical child says about 50 words, combines two words with an action word, names things in a book when an adult points, follows **two-step instructions** and shows he knows at least one colour by pointing ([CDC 30 mo](https://www.cdc.gov/ncbddd/actearly/milestones/milestones-30mo.html)).
- **At 3 years**, he holds a conversation of two or more turns, asks who/what/where/why, says what action is happening in a picture ("running", "eating"), and is understood by others most of the time ([CDC 3 yr](https://www.cdc.gov/ncbddd/actearly/milestones/milestones-3yr.html)).
- **At 4 years**, he uses sentences of four or more words, **names a few colours**, and tells what comes next in a well-known story ([CDC 4 yr](https://www.cdc.gov/ncbddd/actearly/milestones/milestones-4yr.html)).

The gap between *pointing to* a colour (30 months) and *naming* colours (48 months) is about a year and a half. That gap is the strongest single argument for building the toddler mode around recognition rather than production. The Québec source Naître et grandir, reviewed by speech-language pathologists, gives the local picture for 3–4 years: short and often imperfect sentences, a growing grip on "because/if/when", and clusters and "th" sounds still hard. It suggests teaching new words with actions, pictures and comparisons, sorting real objects into named groups, and exploring rhymes "from age 4" ([Naître et grandir](https://naitreetgrandir.com/en/step/3-5-years/reading-language/language-development-in-preschoolers)).

Numbers and sounds sit lower than parents often expect.

- **Subitizing.** The IES learning-trajectory progression, based on Clements and Sarama, places "instantly labels sets up to 4" in the band from about 3 to 4 years ([IES](https://ies.ed.gov/ncee/rel/math-young-children/pdf/TMYC_Mod1_Subitizing_Developmental_Progression.pdf)).
- **Counting.** Counting is assembled in stages: reciting number words, then matching words to objects one-to-one, then the **cardinal principle** (the last word said is "how many"). The cardinal principle is the final major milestone of early counting ([OISE Robertson Program](https://www.oise.utoronto.ca/robertson/blog/how-do-children-learn-numbers-2025-10-08)).
- **Rhyme.** Rhyme awareness typically begins between 3 and 4. French-speaking children reach syllable awareness more slowly than speakers of some other languages ([ASHA](https://pubs.asha.org/doi/pdf/10.1044/cicsd_30_S_41)).

The design consequence is concrete. "Un, deux, beaucoup" and small sets of 1–3 (stretching to 4) are fair targets at 3. A "how many?" question whose answer depends on the cardinal principle is not, so the app should not grade it. Rhymes and songs belong in the mode as listening and exposure, not as scored rhyme judgments.

The activity formats with the best evidence at 2–4 are mostly *social and physical*. That shapes what the app should try to be.

- **Reading.** The What Works Clearinghouse found positive effects for 3–5-year-olds from interactive and dialogic reading and from phonological-awareness training ([Reading Rockets/WWC](https://www.readingrockets.org/topics/preschool-and-child-care/articles/preschool-language-and-literacy-practices)). A 2022 systematic review found that dialogic reading improves receptive and expressive vocabulary, with no discernible effect on phonological processing ([Pillinger & Vardy 2022](https://reachoutandread.org/pillinger_2022_a-story-so-far-a-systematic-review-of-the-dialogic-reading-literature)).
- **Executive function.** Harvard's Center on the Developing Child lists imaginary play, storytelling, movement challenges, freeze dance and songs with repeating motions for ages 3–5. These are almost entirely off-screen ([Harvard GSE](https://www.gse.harvard.edu/ideas/usable-knowledge/14/10/art-control)). The same guide suggests matching and sorting games made harder by switching the sorting rule ([Harvard activities guide](https://developingchild.harvard.edu/resources/handouts-tools/activities-guide-enhancing-and-practicing-executive-function-skills/)).

What *can* go on a screen is a short, goal-directed task, which is what the parent proposed. Hirsh-Pasek and colleagues' four pillars define an educational app as one that is **active** (minds-on), **engaged** (not distracted), **meaningful** (tied to the child's life) and **socially interactive**, all serving a defined learning goal. Without the goal, the app is entertainment ([APS](https://www.psychologicalscience.org/index.php/publications/educational-apps.html)).

Two touchscreen findings refine "active":

- In a 116-toddler experiment at 24–36 months, tapping helped word learning only when the required touch **drew attention to the relevant object**. Fake (yoked) interactivity did not help ([Kirkorian, Choi & Pempek 2016](https://koeunchoi.github.io/publication/2016-03-28-word-learning-touchscreens)).
- A follow-up with 134 toddlers found that the same contingent touching helped some children and hurt others, depending on age and working memory ([Choi, Kirkorian & Pempek 2021](https://frontiersin.org/articles/10.3389/fpsyg.2021.621372/full)).

So the tap should *be* the answer, never a gate the child must tap to make the narration continue. A tablet study also found that 2–4-year-olds who chose which objects to learn did *worse* than peers shown the same items passively ([PLOS ONE 2020](https://dx.doi.org/10.1371/journal.pone.0240519)). Choice still has a place, because children attend longer when they choose the activity ([Early Childhood Education Journal 2025](https://link.springer.com/article/10.1007/s10643-025-01985-w)). The two findings fit together: let the child choose *which game*, and let the app choose *which words*.

Attention spans are a weaker basis. No peer-reviewed "minutes of attention" norm exists for 3-year-olds, and popular figures of 6–15 minutes are not research norms. In a computerised attention task, half of the children under 4 could not finish, and 3-year-olds looked away from the screen significantly more than 4–5-year-olds ([ERIC EJ1006825](https://bvbvf1.bib-bvb.de/vufind/PrimoRecord/cdi_eric_primary_EJ1006825)). Even the clinical Canadian-French picture vocabulary test (PPVT-5 CDN-F) runs only about 10–15 minutes from age 2;6, with an examiner sitting beside the child ([Pearson Canada](https://www.pearsonclinical.ca/content/dam/school/global/clinical/ca/assets/evt-3/PPVT5_EVT3-Cdn-FR-Flyer-can.pdf)). This report therefore plans activities of about 5–8 rounds (1–3 minutes each) inside a session of about 10 minutes. These are design choices, not evidence-based thresholds.

On curriculum alignment, Québec has no academic targets for 3-year-olds. They are in childcare, not school. The childcare program *Accueillir la petite enfance* (2019) is organised in four interacting domains: physique et moteur, social et affectif, cognitif, langagier ([Info-Qualité 2019](https://www.mfa.gouv.qc.ca/fr/publication/Documents/info-qualite-vol3no2-automne2019.pdf)). The *Programme-cycle de l'éducation préscolaire* (2021) covers maternelle 4 and 5 ans with five domains, and treats end-of-cycle expectations as group targets, not individual requirements ([Programme préscolaire 2021](https://st-albert-le-grand.cssdm.gouv.qc.ca/files/PFEQ_programme-prescolaire2021.pdf)). The toddler skill map should carry the four childcare domains as tags now, and add the préscolaire labels only when a 4-year mode exists. Passe-Partout, the free school-board program for 4-year-olds and their parents, runs mixed parent-only, parent-child and child-only sessions ([CSSHL](https://csshl.gouv.qc.ca/wp-content/uploads/2026/01/RE_Depliant-passe-partout_septembre-2025.pdf)). It is a good local model for adding "à faire ensemble" suggestions to the parents' area.

## Two pictures, one stable voice, many different dogs

Picture-pointing is the standard receptive-vocabulary format, and its research base gives most of the rules for the parent's game.

The number of pictures should grow:

- **Two at first.** The Computerized Comprehension Task for toddlers uses two images per trial ([J. Child Language](https://www-cambridge-org.ezproxyberklee.flo.org/core/journals/journal-of-child-language/article/reliability-and-validity-of-the-computerized-comprehension-task-cct-data-from-american-english-and-mexican-spanish-infants/DCCCE59D67EB4D48D2EE620D552F4898)). Across 36 two-choice experiments with children aged 2.5 to 6.5, pointing and looking agreed strongly (r = .7), and pointing becomes the typical response from about age 3 ([eScholarship](https://escholarship.org/content/qt6wh2s76n/qt6wh2s76n.pdf)).
- **Four for consolidated words.** The PPVT uses four pictures per page from age 2½ ([Pearson Canada](https://www.pearsonclinical.ca/content/dam/school/global/clinical/ca/assets/evt-3/PPVT5_EVT3-Cdn-FR-Flyer-can.pdf)).

No study compares 2, 3 and 4 choices at exactly 36 months. The progression of two pictures for new words, three once the child is mostly right, and four for consolidated words is therefore an inference from testing practice. Two-choice tasks have a known weakness: a child who always taps the left side, or always taps the unfamiliar item, is right half the time by chance ([PMC5501698](https://pmc.ncbi.nlm.nih.gov/articles/PMC5501698)). So the target's position must be randomised. A word should count as "known" only after success with three or four pictures, or with several different exemplars.

**Picture style.** The best picture evidence comes from children younger than this one. In Ganea, Pickard and DeLoache's study, 15–18-month-olds transferred labels from picture books to real objects more reliably from realistic photographs than from cartoons ([Ganea et al.](https://pmc.ncbi.nlm.nih.gov/articles/PMC2865246)). A later review warns that book gimmicks such as flaps can hinder learning ([Strouse, Nyhout & Ganea 2018](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2018.00050/pdf)). At 3 the effect is probably smaller. The safe default still holds: one clearly drawn, realistic-proportion object on a plain background at a consistent scale, in original art (project rule 5), rather than stylised cartoon creatures.

**Exemplars.** Variety helps memory. Preschoolers taught each new word with three *different* objects remembered it significantly better three weeks later than children taught with three identical objects ([LSHSS 2017](https://pubs.asha.org/doi/10.1044/2017_LSHSS-17-0031)). Exemplar variability also supports generalisation in toddlers ([Perry et al. 2010](https://research-portal.uea.ac.uk/en/publications/learn-locally-think-globally-exemplar-variability-supports-higher/)). Repetition of the *context* (the same storybooks) also helps 3-year-olds learn words ([Horst et al. 2011](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2011.00017/pdf)). Together, these give the game's central rule: **keep the frame constant and vary the exemplar**. Use the same voice, the same short carrier phrase and the same layout every time, with three or more different dogs, and red shown on a ball, a boot and an apple.

**Distractors** should be chosen on purpose, in stages:

1. **New word.** Use a familiar distractor from another category (chien vs. pomme). The child can then reason "the new word must be the thing I don't have a name for".
2. **Known word.** Switch to same-category distractors (chien vs. chat), which test real meaning.
3. **Colour.** First keep the object constant and vary only the colour, then vary the object, so that colour is the only cue.
4. **Similar-sounding words** (poule/boule) should come late and be used deliberately as a listening challenge.

**The prompt.** Keep the prompt short, with the target word last and stressed: « Où est le chien ? », « Touche le rouge. ». A large speaker button replays it. Feedback names the item again (« Oui, le chien ! »). After an error, the right picture is shown and named, with no penalty.

The parent's three variations (colour word, animal name, animal sound) map onto a natural order of word categories. The table below combines CDC items with typical early vocabulary. The category order is a synthesis, not a Québec norm. The Québec terms and onomatopoeia come from general knowledge and should be checked against the Québec adaptation of the MacArthur-Bates inventory or by a Québec speech-language pathologist before content is fixed.

| Window | Category (examples in Québec French) | Example prompt | Anchor |
|---|---|---|---|
| ~24–30 mo | Familiar animals; body parts (yeux, nez, mains, pieds); everyday objects (balle, verre, cuillère, soulier); foods (pomme, banane, lait) | « Où est le chat ? » | CDC 30 mo: names things in a book |
| ~24–36 mo | Animal sounds → animal: chien *ouaf*, chat *miaou*, vache *meuh*, canard *coin-coin*, mouton *bê*, cochon *groin-groin*, coq *cocorico* | « Qui fait meuh ? » | Inference from the receptive format |
| ~30–36 mo | One colour, then several (rouge, bleu, jaune, vert); clothing (tuque, mitaines, bottes, bas, chandail); vehicles (auto, autobus, camion) | « Touche le rouge. » | CDC 30 mo: points to one colour |
| ~36 mo | Actions in pictures (manger, dormir, courir, sauter) | « Qui mange ? » | CDC 3 yr: says what action is happening |
| ~36–42 mo | Gros/petit; un, deux, beaucoup; sets of 1–3; dans/sur/sous; more colours (orange, rose, mauve, brun, noir, blanc); rond, carré, triangle | « Montre-moi deux pommes. » | IES subitizing band 3–4 |
| ~42–48 mo | Derrière/devant/à côté; sets to 4–5; emotions (content, triste, fâché); categories; function (« Lequel sert à boire ? »); two-step instructions | « Touche le chien, puis le chat. » | CDC 4 yr; Naître et grandir 4–5 |

The research supports three more formats, each adding one cognitive demand to the same mechanic:

- **Odd one out** with a spoken prompt (« Lequel n'est pas un animal ? »), closer to 4.
- **What comes next** in a familiar story, a 4-year milestone.
- **Sorting** two or three items by a rule that later switches, the cognitive-flexibility game in the Harvard guide.

A "tap only when you hear *chien*" inhibition game also fits the executive-function evidence. However, design research says to avoid demanding quick reactions under 5 ([NN/g](https://www.nngroup.com/articles/children-ux-physical-development/)), so it must be slow and untimed. Animals walk by at a calm pace, and a missed tap costs nothing.

## One short session, a calm screen and a garden that goes to sleep

Every major guideline gives the same ceiling.

- **Canadian Paediatric Society** (2022): limit routine or sedentary screen time to about **one hour a day or less** for ages 2–5. Co-view whenever possible, prefer educational and interactive content over passive viewing, minimise advertising, and avoid screens in the hour before bed ([CPS](https://cps.ca/en/documents/position/screen-time-and-preschool-children)). Its counselling frame is the "4 Ms": minimise, mitigate, be mindful, model ([CPS tool](https://cps.ca/uploads/tools/CPS_ScreenTime-EN.pdf)).
- **WHO** (2019): at 3–4 years, at least 180 minutes of physical activity, no more than one hour of sedentary screen time ("less is better") and 10–13 hours of sleep ([WHO](https://www.who.int/news/item/24-04-2019-to-grow-up-healthy-children-need-to-sit-less-and-play-more)).
- **Canadian 24-Hour Movement Guidelines for the Early Years:** the same numbers, plus reading and storytelling with a caregiver when sedentary ([CSEP](https://csepguidelines.ca/guidelines/early-years/)).
- **AAP** (2016): the same one-hour limit for 2–5-year-olds, with co-viewing ([Healio](https://www.healio.com/news/pediatrics/20161020/aap-recommends-1-hour-limit-on-digital-media-use-for-preschoolers)).

The ceilings are precautionary. WHO rated the evidence behind them "very low quality", and the UK's paediatric college judged the data too weak to set thresholds ([Business Standard/AFP](https://business-standard.com/amp/article/health/screen-time-for-children-who-s-new-approach-may-do-little-to-curb-obesity-119050600198_1.html)). Still, the hour is shared with every other screen in the house. That makes the practical budget for this app **one session of about 10 minutes a day**: a parent-set daily cap defaulting to 15–20 minutes, a bedtime lock, and today's minutes shown in the parents' area.

Co-use matters more than minutes. Children under 3 learn from interactive touchscreens but have trouble applying screen learning to real objects. Research also shows how to help:

- Parent explanations and labelling during tablet use improved transfer.
- 2- and 3-year-olds learned a tablet puzzle from a visible adult hand but not from a "ghost" demonstration with pieces moving by themselves.
- Repeating the same content reduced the transfer gap.
- Only about a quarter of parents report co-engaging during tablet use.

All four findings are summarised in [Barr, McClure & Parlakian 2019](https://www.zerotothree.org/resources/3005-maximizing-the-potential-for-learning-from-screen-experiences-in-early-childhood-what-the-research-says). Live video chat taught 24–30-month-olds new verbs as well as face-to-face teaching did, while prerecorded video did not ([same review](https://www.zerotothree.org/resources/3005-maximizing-the-potential-for-learning-from-screen-experiences-in-early-childhood-what-the-research-says)). Responsiveness, not the screen, carries the learning.

The toddler mode should therefore assume a parent beside the child:

- **Pauses** where the narrator asks the child to show or tell the adult something.
- **A visible hand or guide character** in every demonstration, so nothing moves by itself.
- **Off-screen bridges** at the end of each session, such as « Cherche trois choses rouges dans la maison » or « Marche comme un canard ». They make the stopping point a transition rather than a loss.

The interaction rules for pre-readers are well established in practitioner research, though not in controlled trials.

- **Gestures.** Tap is the most intuitive gesture. Pinch and swipe should never be essential. Dialogue should come with visual reinforcement, and the bottom edge, where children rest their wrists, should stay free of hotspots ([Sesame/Cooney Center 2012](https://joanganzcooneycenter.org/?p=19607)).
- **Target size.** Targets should be at least **2 cm × 2 cm** for young children. Dragging, scrolling and small objects should be avoided on desktop.
- **Mouse.** In NN/g's testing, one 3-year-old could not fit her hand around a mouse and did not connect cursor movement with mouse movement ([NN/g](https://www.nngroup.com/articles/children-ux-physical-development/)). Even 4- and 5-year-olds overshoot and re-enter mouse targets far more than adults, and target size strongly affects their accuracy ([Hourcade et al. 2004](https://drum.lib.umd.edu/items/f3e5dc45-7acc-40c6-8dfd-a258b9c0bc9b)).

For this family PC, the inference is direct. Use the touch screen if there is one. With only a mouse, expect the parent to guide the hand, make the whole picture card clickable and enlarge the hit area beyond the drawing. Activate on pointer-down, and ignore movement, double-clicks, right-clicks, hovers and the keyboard.

The fixed 1920×1080 stage turns "2 cm" into stage pixels that depend on the monitor. The arithmetic: 2 cm is about 72 stage px on a 24-inch 1080p monitor and about 125 px on a 14-inch 1080p laptop. **A floor of about 160 stage px per target, with no more than four targets per screen**, leaves margin on any screen the family is likely to use. The exit control should sit in a corner behind a press-and-hold.

The screen itself should be sparse. A meta-analysis of technology-enhanced storybooks found that hotspots and games unrelated to the story **distracted children**, while animation and sound that illustrate the story **helped**. Only about 20% of hotspots in popular e-books related to the story ([Takacs, Swart & Bus 2015](https://journals.sagepub.com/doi/pdf/10.3102/0034654314566989)). In a lab classroom, kindergartners in a heavily decorated room spent more time off task (38.6% vs. 28.4%) and scored lower (42% vs. 55%) than in a sparse room ([Carnegie Mellon](https://www.cmu.edu/news/stories/archives/2014/may/may27_decoratedclassrooms.html)). The Phaser garden that motivates Melina is the wrong backdrop for the moment of choice. Choice screens should be plain, the garden can frame the session's beginning and end, and nothing idle should animate near the answers.

Manipulative design is the norm the toddler mode must reject explicitly. In a study of 160 children aged 3–5, apps averaged **three manipulative features**, and only **19.6% had none** ([Radesky et al. 2022](https://jamanetwork.com/journals/jamanetworkopen/fullarticle/2793493)). The study coded these features:

- **Parasocial pressure:** characters that urge the child to keep playing, in 24.8% of apps.
- **Time pressure**, in 17.3%.
- **Navigation constraints** such as auto-advance and missing exits, in 45.9%.
- **Lures** such as daily rewards and pulsing buttons, in 45.1%.

In a field study with 24 families, autoplay made transitions away hardest and took away the child's chance to decide to stop ([UW/Hiniker 2018](https://washington.edu/news/2018/05/01/apps-for-children-should-emphasize-parent-and-child-choice-researchers-say)). Apps with natural stopping points help children self-regulate ([Cooney Center 2018](https://joanganzcooneycenter.org/2018/05/21/research-suggests-well-designed-preschool-apps-can-encourage-family-engagement-and-self-regulation/)).

The ending mechanics follow. A session is a **fixed set** of three to five short activities, shown as seeds to plant, not a timer. When the last seed is planted, the guide recaps one thing the child did, waves, and the garden dims and "goes to sleep". There is no « Encore ? » button. The garden wakes up tomorrow, with no streak to lose. If the daily cap arrives mid-activity, the current round finishes, a spoken warning comes (« Encore une, puis le jardin se repose »), and the session never cuts to black. No research has tested "resting world" endings for preschoolers, so the metaphor is a design choice. The underlying principles (a predictable end, no autoplay, autonomy to stop) have support.

## Name what he did, slow the voice down, and show the answer by the third try

Feedback evidence at this age is thin but consistent. In a home study of 53 families recorded at ages 1–3, a higher *proportion* of **process praise**, which names effort, strategies and actions, predicted more positive approaches to challenge at ages 7–8. The total amount of praise and person praise did not ([Gunderson et al. 2013](https://news.uchicago.edu/story/parents-who-praise-effort-can-bolster-childrens-persistence-self-belief)). In an experiment with 4-year-olds, generic praise ("You are a good drawer") left children coping worse with later mistakes than specific praise ("You did a good job drawing") ([Cimpian et al. 2007](https://bps.org.uk/research-digest/how-praise-children)).

Announced tangible rewards are the documented hazard:

- **Lepper, Greene and Nisbett (1973).** Preschoolers who already liked drawing were promised a "Good Player Award". Afterwards they spent less free time drawing, while children who got the same award *unexpectedly* did not ([summary](https://teachingcs.substack.com/p/drawing-for-rewards)).
- **Warneken and Tomasello (2008).** 20-month-olds given a toy for helping later helped less than those given social praise or nothing ([Duke Scholars](https://scholars.duke.edu/publication/1458228)).
- **Deci, Koestner and Ryan (1999).** Their meta-analysis of 128 experiments found expected tangible rewards most harmful when they are given simply for engaging (d = −0.40), with larger harm in children ([PubMed](https://pubmed.ncbi.nlm.nih.gov/10589297/)).

For the toddler mode, this means one short, warm, specific phrase immediately after a correct tap (« Oui ! Tu as trouvé le chat. »), never a trait label. Nothing is promised in advance. Any collectible is an unannounced, decorative surprise, never a count or a currency. This extends the "stars without currency" principle the app already follows for Melina.

Celebrations should be short and anchored to the target:

- **Each correct answer:** a soft sound under 1–2 seconds, a little hop of the found animal, and the spoken praise.
- **The end of a set:** one calm, identical ritual every time.

This is not the fanfare-and-confetti pattern the 7-year-old's audit already flagged as uninformative.

The voice is the biggest technical risk in the current stack. The app uses the browser's French voice today. In 19-month-olds, **slower speech and hyperarticulated vowels** improved word recognition, while a wider pitch range alone did not ([Song, Demuth & Morgan 2010](https://pmc.ncbi.nlm.nih.gov/articles/PMC2921436)). Late talkers process words more slowly but learn them as well as peers, so response windows must be generous ([JSLHR 2023](https://pubs.asha.org/doi/10.1044/2023_JSLHR-22-00580)). The small literature on synthetic speech says preschoolers understand it worse than adults do and understand human recordings best. Their accuracy improves with repeated exposure, and 3-year-olds do worse than 4–5-year-olds in background noise ([UMN Experts](https://experts.umn.edu/en/publications/synthesized-speech-intelligibility-and-early-preschool-age-childr/); [AJSLP 2012](https://pubs.asha.org/doi/10.1044/1058-0360%282012/11-0020%29)). No study has tested modern neural voices, or Québec-French TTS, with preschoolers.

The toddler mode's prompt set is small and finite: a few carrier phrases, about a hundred words and the onomatopoeia. So the best option is **recorded human Québec-French clips**. A parent can record them on the family PC, which keeps everything local and gives the child a familiar voice. The familiar-voice benefit is an inference; the evidence that familiar characters help 2-year-olds learn concerns characters, not voices ([Barr et al. 2019](https://www.zerotothree.org/resources/3005-maximizing-the-potential-for-learning-from-screen-experiences-in-early-childhood-what-the-research-says)).

If TTS remains as a fallback, use these rules:

- Slow the voice.
- Mute music while it speaks.
- Use only voices the Web Speech API marks as `localService`. Some Edge voices run online, and project rule 4 forbids the child's name leaving the PC.

The name should be spoken only at the start and end of a session, never in error feedback. No study either way was found on using the child's name.

Hints should come faster and more concretely than they do for Melina. In Wood, Bruner and Ross's original scaffolding study, the tutor reportedly gave hands-on help about **twice as often to 3-year-olds as to 4-year-olds and four times as often as to 5-year-olds** ([Structural Learning briefing](https://www.structural-learning.com/research-briefings/support-that-fades)). Harvard's serve-and-return guidance adds "take turns and wait" and "let the child signal when they are done" ([Better Care Network/Harvard](https://bettercarenetwork.org/library/principles-of-good-care-practices/child-development/5-steps-for-brain-building-serve-and-return)). No study gives an optimal number of attempts. A three-step ladder is a reasonable design:

1. After a first error, the item wobbles back, with no sound or a neutral one, and the prompt repeats in the same words.
2. After a second error, the target glows or one distractor greys out.
3. After a third error, the guide models it (« Regarde ! »), then invites (« À toi ! »).

The modelled tap earns specific praise, is recorded internally as *assisted*, and is never shown as a failure. Warning signs include rapid random tapping, long silence and two modelled answers in a row. When they appear, the app drops a level at once, offers a sure win, or ends gracefully.

Adaptation should be slow and forgiving. Building Blocks, software and print organised around learning trajectories for 3–4-year-olds, has strong randomised-trial support ([WWC](https://ies.ed.gov/ncee/WWC/Study/77947)). The onebillion maths apps produced significant gains in a pupil-level trial, but with 4–5-year-olds, not 3-year-olds ([Outhwaite et al. 2019](https://eprints.nottingham.ac.uk/52319)). Neither study isolates adaptivity as the active ingredient. The "85% rule" comes from machine-learning theory on two-choice tasks, and its author declined to extend it to education ([Wilson et al. 2019](https://pmc.ncbi.nlm.nih.gov/articles/PMC6831579)).

The existing engine can serve the boy with a different configuration. All of these settings are design heuristics:

- **Target:** about 80–90% independent first-or-second-try success, and close to 100% eventual success with help.
- **Step up** after 4 independent successes in the last 5.
- **Step down** at once after two modelled answers.
- **Small steps:** one more picture, one more object, a slightly less obvious contrast.
- **Warm-up:** start each session one level below the last.

Response time should not be used as a skill signal at this age, because processing speed varies too much. The skill map should follow a developmental trajectory: hear-and-point with 2 pictures, then with 3–4, then across exemplars, then a category or function question. The 2e année map should not appear for him with everything "not mastered".

## Profiles, not age doors, keep two learners apart

No study compares age-range entry with profile entry for siblings. Every piece of evidence that does exist points the same way.

- **Regulators.** The CAI says age checks always add personal-data processing. Self-declaration is the least reliable method, and age information should mainly serve to **adapt the interface**, not to act as a barrier ([CAI 2024](https://www.cai.gouv.qc.ca/uploads/pdfs/CAI_ME_PRP_Jeunes_CSESJ.pdf)). Google Play's Families policy names "indicating that a certain age is required" as an age screen that invites falsification ([Google Play](https://support.google.com/googleplay/android-developer/answer/9893335?hl=en)).
- **Platforms.** Khan Academy Kids stores each child's age as a profile attribute that a grown-up sets when adding the child ([Khan Academy Kids help](https://khankids.zendesk.com/hc/en-us/articles/360006538192-How-do-I-add-a-new-user)). Netflix puts kids on their own profile type and uses a per-profile PIN to stop children changing controls ([Netflix](https://www.netflix.com/tudum/articles/guide-to-netflix-parental-controls)).
- **Shared devices.** Device sharing is routine even for "personal" devices ([Google Research](https://research.google.com/pubs/archive/44670.pdf)). "Progress made on wrong account" is a real complaint on a large learning platform, though the evidence is anecdotal ([Khan Academy community](https://support.khanacademy.org/hc/es/community/posts/26610542139789/comments/26684241995789)).

There are four concrete objections to "3 ans et moins / plus de 3 ans":

1. It identifies a mode, not a learner.
2. The 3-year-old cannot read it.
3. Little children want to be "big".
4. "Plus de 3 ans" puts a 4- or 5-year-old in the same bucket as a 7-year-old in 2e année.

The fourth objection becomes real on his next birthday. No platform band uses this cut; Apple's Kids category groups "5 and under" separately from "6–8" ([Apple](https://developer.apple.com/app-store/parental-gates/)).

The parent's intent survives intact if the age choice moves to profile creation in the parents' area. There, each profile gets a mode ("Les petits" or "École – 2e année") and a birth *year*, not a full birth date.

The entrance becomes a picker with one huge card per child. Each card has:

- an original avatar the child chose with the parent (a concrete animal or object, not an abstract icon);
- a fixed signature colour used throughout that child's world;
- the first name in large print;
- the name spoken when the card is tapped.

Two facts support this design. Self-recognition in delayed photos becomes reliable around 3 to 3½ ([Ross et al. 2011](https://sites.dundee.ac.uk/wp-content/uploads/sites/253/2012/01/Ross-et-al-2011.pdf)). In a non-peer-reviewed screener, 64% of 3-year-olds recognised their printed name ([Nemours](https://prelaunch-assets.nemours.org/reading-brightstart/articles-for-parents/2nd-annual-reading-readiness-snapshot.html)). A photo would work, but it is more sensitive data. The avatar is the data-minimising default, and it must never change, because recognition depends on familiarity.

A first tap enlarges the card and asks « C'est toi ? Touche encore ton lion ! ». The second tap enters. This blocks accidental entries without asking anyone to read. If the parent strongly prefers a visible age choice, two picture doors (a toy box and a school bag) can lead to the profiles in each mode. A profile tap is still needed behind each door.

The highest risk is the boy wandering into Melina's profile, where his random taps would corrupt her mastery estimates, her weak-point detection and her report. Her card should carry a tiny *child-level reading check* that she passes instantly and he cannot, such as tapping her own name among three printed names. This is not an adult gate and should never slow her down.

Two safeguards sit behind it:

- **A plausibility flag** for very fast taps at near-chance accuracy. Flagged answers are kept but not applied to the learner model until the parent confirms them.
- **A parents'-area action** to move or discard a session that "wasn't Melina", run after the app's automatic backup.

The reverse case, Melina playing his games for fun, does little harm. A "visiteur" option that records nothing handles it. Three rules cover switching between profiles:

- Leaving the toddler mode requires an adult gate, because toddlers mash.
- Melina gets a plain « Changer de joueur » button.
- An idle timeout returns to the picker, so the next child does not inherit the session.

The parents' gate has to stop *both* children. Apple describes gates as "adult-level tasks" and recommends a voice prompt for pre-literate children ([Apple](https://developer.apple.com/app-store/parental-gates/)). A "3 + 4" question will not stop Melina, whose curriculum covers it. The simplest robust design is a three-second press-and-hold followed by a parent PIN, stored hashed. When a child triggers the gate, a short spoken line plays: « Demande à papa ou maman de t'aider ! ».

These actions go behind the gate:

- profile creation, mode changes and deletion;
- consent switches;
- reports and backups;
- time limits;
- session reassignment;
- anything that calls an external API.

Moving between the picker and a profile, ending an activity and sound control stay ungated. No study measures how often children pass any kind of gate, so these choices rest on reasoning rather than data.

Privacy law probably does not bind this app, but its principles cost almost nothing to follow. Québec's private-sector act, as amended by Law 25, requires a parent's consent for collecting a minor's data under 14 ([CAI 2024](https://www.cai.gouv.qc.ca/uploads/pdfs/CAI_ME_PRP_Jeunes_CSESJ.pdf)). The act governs *enterprises*, and COPPA governs commercial online operators. A parent's non-commercial app running on the family PC very likely falls outside both. This is an inference, not legal advice.

The frameworks agree on what to do anyway:

- **ICO Children's Code:** high-privacy defaults, the minimum data, and profiling off unless it serves the child's best interest with safeguards ([ICO standards](https://ico.org.uk/for-organisations/guide-to-data-protection/ico-codes-of-practice/age-appropriate-design-a-code-of-practice-for-online-services/code-standards); [ESRB summary](https://www.esrb.org/privacy-certified-blog/the-icos-age-appropriate-design-code-default-settings-and-data-minimization/)). Its 0–5 band is "pre-literate and early literacy", and it forbids nudges toward weaker privacy ([ICO age bands](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/age-appropriate-design-a-code-of-practice-for-online-services/3-age-appropriate-application/)).
- **Canada's privacy commissioners:** tracking off by default unless demonstrably necessary ([OPC 2023](https://www.priv.gc.ca/fr/a-propos-du-commissariat/ce-que-nous-faisons/collaboration-avec-les-provinces-et-les-territoires/resolutions-conjointes-avec-les-provinces-et-territoires/res_231005_01/)).
- **COPPA's 2025 amendments:** a written retention policy that states the purpose, the need and a deletion timeline ([Hunton](https://www.hunton.com/privacy-and-cybersecurity-law-blog/ftc-publishes-final-coppa-rule-amendments)).
- **Apple's Kids category:** no personally identifiable information sent to third parties without explicit parental consent ([Apple](https://developer.apple.com/app-store/parental-gates/)).

Applied here, the boy's profile stores only:

- an internal ID;
- a display name;
- the avatar and colour;
- the mode and birth year;
- per-skill state, session history and settings.

It does **not** store a surname, a full birth date, a photo by default or voice recordings of the child. The toddler mode makes **no external call of any kind**, and the handwriting-reading consent stays per child and off for his profile.

Adaptive difficulty counts as profiling in the ICO sense. It is justified because it serves learning only, the parent can see it, and it can be reset per child. His report should be descriptive (activities tried, minutes, words he now finds with three pictures, one home activity), not percentages, which mean little at 3. No research tells us how parents of 3-year-olds want progress reported. In one qualitative study, parents of preschoolers wanted parent-only controls and logs of what the child did and for how long ([Geiskkovitch et al. 2026](https://clab.iat.sfu.ca/pubs/Geiskkovitch-Preschool-DIS2026.pdf)).

## Prioritized recommendations

The labels follow the earlier report's convention. **Strong** means official norms, meta-analyses or replicated experiments. **Moderate** means single experiments, official guidance without outcome data, or practitioner research. **Inference** means a design translation that nobody has tested in an app for 3-year-olds.

| # | Recommendation | Label | Basis |
|---|---|---|---|
| 1 | **Per-child profiles replace the age door.** Picture card, spoken name, confirm tap; mode and birth year set in the parents' area; the server derives the active profile from the session, never from a page parameter | Moderate (regulators, platforms) / Inference | [CAI 2024](https://www.cai.gouv.qc.ca/uploads/pdfs/CAI_ME_PRP_Jeunes_CSESJ.pdf); [Google Play](https://support.google.com/googleplay/android-developer/answer/9893335?hl=en) |
| 2 | **Protect Melina's model:** child-level name check on her card, plausibility flag, parent-side "move/discard session", idle timeout | Inference | [Google Research](https://research.google.com/pubs/archive/44670.pdf) |
| 3 | **Parents' gate = hold + hashed PIN**, voice prompt for the child; gate only adult actions | Moderate (Apple) / Inference | [Apple](https://developer.apple.com/app-store/parental-gates/) |
| 4 | **"Où est… ?" as the first game:** 2 → 3 → 4 pictures, randomised position, constant frame, varied exemplars, staged distractors, replay button | Strong (format) / Inference (progression) | [CDC 30 mo](https://www.cdc.gov/ncbddd/actearly/milestones/milestones-30mo.html); [LSHSS 2017](https://pubs.asha.org/doi/10.1044/2017_LSHSS-17-0031) |
| 5 | **Recorded Québec-French voice clips** for the fixed prompt set; slow, clear, target word last; local-only TTS fallback; no music under speech | Moderate | [Song et al. 2010](https://pmc.ncbi.nlm.nih.gov/articles/PMC2921436); [UMN](https://experts.umn.edu/en/publications/synthesized-speech-intelligibility-and-early-preschool-age-childr/) |
| 6 | **Toddler interaction contract:** tap only, ≥160 stage px targets, ≤4 per screen, pointer-down activation, edges free, keyboard ignored, sparse choice screens | Moderate (practitioner) / Inference (pixels) | [NN/g](https://www.nngroup.com/articles/children-ux-physical-development/); [Cooney 2012](https://joanganzcooneycenter.org/?p=19607) |
| 7 | **Help ladder of three steps** ending in a modelled answer; assisted taps recorded, never shown as failure | Moderate (scaffolding) / Inference (count) | [Wood et al. via briefing](https://www.structural-learning.com/research-briefings/support-that-fades) |
| 8 | **Specific praise, no announced rewards,** per-item celebration under 2 s on the target object, one calm end ritual | Strong–Moderate | [Lepper 1973](https://teachingcs.substack.com/p/drawing-for-rewards); [Warneken 2008](https://scholars.duke.edu/publication/1458228); [Deci 1999](https://pubmed.ncbi.nlm.nih.gov/10589297/) |
| 9 | **Session = 3–5 seeds, then the garden sleeps;** no autoplay or "encore"; daily cap (default 15–20 min); bedtime lock; minutes shown to the parent | Strong (ceiling) / Inference (mechanics) | [CPS](https://cps.ca/en/documents/position/screen-time-and-preschool-children); [Hiniker 2018](https://washington.edu/news/2018/05/01/apps-for-children-should-emphasize-parent-and-child-choice-researchers-say) |
| 10 | **Zero network in toddler mode;** minimal profile fields; written retention rule in `docs/privacy.md`; handwriting consent off for him | Moderate (frameworks) | [ICO](https://ico.org.uk/for-organisations/guide-to-data-protection/ico-codes-of-practice/age-appropriate-design-a-code-of-practice-for-online-services/code-standards); [Hunton/COPPA](https://www.hunton.com/privacy-and-cybersecurity-law-blog/ftc-publishes-final-coppa-rule-amendments) |
| 11 | **Co-use by design:** pauses that invite the child to tell the adult; visible-hand demonstrations; "à faire ensemble" cards in the parents' area | Moderate | [Barr et al. 2019](https://www.zerotothree.org/resources/3005-maximizing-the-potential-for-learning-from-screen-experiences-in-early-childhood-what-the-research-says) |
| 12 | **Slow adaptation:** ~80–90% independent success, up after 4/5, down after 2 modelled, start one level below; separate toddler skill map tagged with the four *Accueillir la petite enfance* domains | Inference | [Wilson 2019](https://pmc.ncbi.nlm.nih.gov/articles/PMC6831579); [Info-Qualité](https://www.mfa.gouv.qc.ca/fr/publication/Documents/info-qualite-vol3no2-automne2019.pdf) |
| 13 | **Descriptive toddler report,** one per child, never comparing siblings | Inference | [Geiskkovitch 2026](https://clab.iat.sfu.ca/pubs/Geiskkovitch-Preschool-DIS2026.pdf) |
| 14 | **Validate the word list** (Québec terms, onomatopoeia, age order) against the Québec MacArthur-Bates inventory or with a speech-language pathologist | Gap to close | [ISQ](https://www.jesuisjeserai.stat.gouv.qc.ca/publications/fascicule_ecole_bon_pied.pdf) |

**Avoid** in the toddler mode:

- shops, coins, stars counted as currency, streaks, daily-login rewards and leaderboards;
- countdowns or any timed reaction;
- a guide who is sad, sleepy or pleading when the child leaves;
- autoplay into the next activity;
- decorative hotspots, background music under speech and full-screen confetti after each item;
- drag, swipe, double-click and hover;
- scored rhyme judgments and scored "how many?" answers before the cardinal principle;
- the child's photo by default;
- any external API call.

## A phased plan that ships the parent's game in the second step

The plan follows the project's working rules: one commit per finished step, a stop to show the parent at the end of each phase, updates to `docs/testing.md` and `docs/visual-architecture.md` when they change, and the game pattern of generator plus tests in `packages/curriculum`, server evaluation, a stage screen with a scene in `content/scenes`, and a browser test. Browser tests run through `tests/e2e/_platform.py` (invisible, muted, speech disabled). Audio behaviour such as clip length and no music under speech is therefore checked by unit tests on the audio scheduler, not by listening.

Before any migration, the app's automatic backup runs, and `data/` is never touched by tests. The database schema already references `profiles(id)` from `assignments`, `attempts`, skill state, missions and rewards. Phase 1 is therefore mostly about retiring the constant `PROFILE_ID 'local-profile'`, not a redesign of the schema.

| Phase | Scope | Main work (by package) | Done when |
|---|---|---|---|
| **0 – Decisions** (no code) | Confirm the entrance design with the parent; decide touch vs. mouse; choose avatar and colour; plan voice recordings; validate the word list | `docs/roadmap.md`, `docs/curriculum.md` (toddler skill map, 4 childcare domains), `docs/privacy.md` (fields, retention, zero-network rule) | Parent approves profile picker vs. picture doors; word list reviewed |
| **1 – Two learners, safely apart** | Multi-profile foundation | `apps/server`: active profile from the session, profile CRUD behind the gate, hashed PIN, plausibility flag, session reassignment, per-profile report scoping; migration of `local-profile` to Melina's profile; `apps/game`: picker screen, confirm tap, Melina's name check, idle timeout, « Changer de joueur » | Server tests prove profile A cannot read or write B; e2e covers picker, gate and timeout; Melina's existing flows unchanged |
| **2 – "Les petits" shell + "Où est… ?"** | The parent's game, end to end | `packages/curriculum`: generator for hear-and-point rounds (2/3/4 choices, exemplar rotation, distractor rules, randomised position) with tests; `content/`: word bank with categories, exemplars, original art and recorded clips; `apps/server`: evaluation, assisted vs. independent; `apps/game`: toddler stage layout (≥160 px, edges free, pointer-down), prompt + replay component, help ladder, feedback, seed progress, resting-garden ending, daily cap, bedtime | Generator tests pass; e2e plays a full muted session to the resting garden; unit tests confirm clip length and no music under speech |
| **3 – Colours, sounds, sizes, 1–2–3** | The parent's other variations plus early number | Generators for « Touche le rouge » (object-constant, then object-varied), « Qui fait meuh ? », gros/petit, un/deux/beaucoup with sets of 1–3; toddler adaptation config in `packages/adaptive-engine`; descriptive report and "à faire ensemble" cards in the parents' area | Each game follows the full pattern; the report shows activities, minutes and words found with 3–4 pictures, with no percentages |
| **4 – Toward four** | Content for 42–48 months | Positions (dans/sur/sous, then derrière/devant), actions, function questions, odd one out, sort-and-switch, slow untimed "tap only the chien", story sequencing, rhyme and song listening (original comptines); préscolaire domain tags in preparation for a 4-year mode | Introduced only when the boy reaches 3–4 pictures reliably on Phase 2–3 content |

Three uncertainties should travel with this plan as parameters to revise:

- Nothing establishes the right session length, number of attempts or success rate for a 3-year-old.
- Nothing shows whether realistic pictures still matter at 36 months.
- Nobody has tested a sibling-proof profile picker.

The boy's own behaviour in the first two weeks of Phase 2 is the only data that will settle them. That behaviour includes where he hesitates, whether he wants to stop before the last seed, and whether he can use the mouse at all.

## Conclusion

The real design problem is not the 3-year-old's game. The parent's hear-and-point idea already matches how clinicians measure, and how children acquire, early vocabulary. The harder problem is that a second learner turns a single-child app into a shared-device system. Every feature Melina relies on assumes the app knows who is tapping: the adaptive model, the weak-point detection, the report and the garden. An age door leaves that assumption broken. A profile picker with a child-level check repairs it, and most of the plumbing already exists in the schema. Building Phase 1 first also protects the 7-year-old's progress before the 3-year-old's first tap.

The second insight is that the toddler mode should be *less* of an app than Melina's, not a simplified copy. The evidence for 2–4-year-olds puts most learning in conversation, play and movement with an adult, and treats the screen as a 10-minute, goal-directed supplement whose best moment is the hand-off back to the room. The measure of success is therefore not time in the app or percentage correct. It is that he finds the red boot among four pictures he has never seen, then finds a red thing in the kitchen when his parent asks.
