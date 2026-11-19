# Multi-child profiles on a shared family PC: entrance UX, separation of progress, parental gates and privacy (3-year-old non-reader + 7-year-old reader, Québec, local app)

Evidence-strength tags used below:
- **[Official]**: regulator, law, or platform policy text (or a regulator's own publication).
- **[Peer-reviewed]**: published academic study.
- **[Practitioner]**: well-known UX research firm or company help or product documentation.
- **[Secondary]**: law-firm summary, press, vendor blog, or a search-engine summary of a page I could not open myself. Treat with caution.
- **[Inference]**: my reasoning applied to this app. It is not a sourced fact.

Access notes: the ICO pages and the ICO code PDF returned HTTP 403 to my fetcher, and so did the Khan Academy Kids help page. Their content below comes from search-result summaries and is tagged [Secondary] even when the URL is official. Apple's parental-gate page and the CAI's 2024 brief were read in full.

---

## Q1. How do young non-reading children select their own profile? (avatars, voice prompts, color; recognizing their own name, photo or avatar)

### Takeaway
I found no peer-reviewed study of profile pickers for 3-year-olds. The evidence pieces fit together, though. By about 3, children can reliably recognize themselves in photos. Many 3-year-olds recognize their own printed name, but not all do. Young children read icons literally and need large targets. Commercial kids' apps pair a picture or avatar with the child's name and leave profile creation to a "grown-ups" area. For this app, the strongest design is a large, distinct picture card per child, with the name spoken aloud, a stable color, and a confirm step.

### Cited Findings
- **Apple** tells developers of apps for pre-literate children to "consider using a voiceover prompt" when a child must involve a parent. This is Apple's own acknowledgement that text-only prompts fail for this age group. [Official] — [Apple, Design safe and age-appropriate experiences](https://developer.apple.com/app-store/parental-gates/)
- **Apple's Kids category age bands** are "5 and under, 6-8, or 9-11". A 3-year-old and a 7-year-old fall in different bands. [Official] — [Apple, parental gates / Kids category page](https://developer.apple.com/app-store/parental-gates/)
- **NN/g, physical development:** recommends touch targets of at least 2 cm × 2 cm for young children, four times the 1 cm × 1 cm adult recommendation. [Practitioner] — [NN/g, Children's UX: Physical Development](https://www.nngroup.com/articles/children-ux-physical-development/)
- **NN/g's children's UX research** tested participants aged 3–12 in the US and China on kids' websites and apps. [Practitioner; I saw a summary only] — [NN/g, Designing for Children](https://www.nngroup.com/videos/designing-children/)
- **Icons:** design literature citing children's UX research says younger children interpret icons much more literally than adults. It advises pairing icons with labels or other cues rather than relying on abstract symbols. [Secondary] — [UXmatters, UX Design for Kids](https://uxmatters.com/mt/archives/2020/01/ux-design-for-kids-key-design-considerations.php)
- **Photo self-recognition:**
  - Mirror self-recognition is generally placed at about age 2.
  - Recognizing oneself in a *delayed* photo on the sticker ("mark") test becomes reliable only around 3 to 3.5 years. In Skouteris & Robson (2006), 3-year-olds reliably reached for the sticker after seeing the photo; 2.5-year-olds did not. Povinelli et al. (1996) found young 3-year-olds failed and older 3- and 4-year-olds passed.
  - [Peer-reviewed; I saw abstracts and metadata only] — [Ross et al. 2011 (Dundee)](https://sites.dundee.ac.uk/wp-content/uploads/sites/253/2012/01/Ross-et-al-2011.pdf); [Univ. of Malta replication record](https://um.edu.mt/library/oar/handle/123456789/84466); [Edison, Memorial Univ. thesis](https://research.library.mun.ca/9344/1/Edison_ShannonC.pdf)
  - Caveat: the mark test measures something harder (using the photo to reason about one's own body) than just pointing at "me" among two photos. Simple recognition is probably earlier and easier.
- **Own printed name:**
  - A commercial screener of 5,181 children reported that 64% of 3-year-olds recognize their own name in print and 26% write it. The figures for 4-year-olds were 72% and for 5-year-olds 93%. [Secondary / non-peer-reviewed sample] — [Nemours Reading BrightStart snapshot](https://prelaunch-assets.nemours.org/reading-brightstart/articles-for-parents/2nd-annual-reading-readiness-snapshot.html)
  - Name writing in preschool is treated as an early literacy marker. [Practitioner summary of research] — [Reading Rockets, What's in a Name?](https://readingrockets.org/resources/resource-library/whats-name-childrens-name-writing-and-literacy-acquisition)
  - Preschoolers under 4 know some letter shapes in their own first name, especially the first (leftmost) letter. [Peer-reviewed; abstract only] — [Cambridge, Applied Psycholinguistics: Preschool children's explorations of letters in their own names](https://cambridge.org/core/journals/applied-psycholinguistics/article/preschool-childrens-explorations-of-letters-in-their-own-names/513098040ED4EC5389D4C4BAB161A504)
- **Khan Academy Kids:**
  - A parent can set up several children under one account. A new child is added from a "Grown-Ups Only" section by entering the child's first name and age and choosing an animal avatar. The New button is on the opening page, and the user avatar sits at the top right of Home.
  - [Practitioner; from a search summary, the help page returned 403] — [Khan Academy Kids help: How do I add a new user](https://khankids.zendesk.com/hc/en-us/articles/360006538192-How-do-I-add-a-new-user)
- **Netflix:** profiles are picked from a picture (avatar) grid. Kids profiles are a separate profile type. [Practitioner] — [Netflix Tudum, Guide to parental controls](https://www.netflix.com/tudum/articles/guide-to-netflix-parental-controls)
- **Preschool HCI (3–5 year-olds, 18 child–parent dyads):**
  - Children aged 3–5 have limited verbal and reading skills and short attention spans. The child portion of sessions was kept to about 15 minutes.
  - Children responded best to the simplest interaction ("you press the button and it comes there", from a 3-year-old).
  - [Peer-reviewed, small qualitative sample] — [Geiskkovitch et al., DIS 2026, Exploring the Needs of Preschool-aged Children, Parents, and Grandparents for Communicating Over Distance](https://clab.iat.sfu.ca/pubs/Geiskkovitch-Preschool-DIS2026.pdf)

### Inferences
- **[Inference] Recommended picker for this app:** two (or N) very large cards, at least 2 cm and in practice far bigger on a PC screen at the 1920×1080 stage. Each card has:
  1. An original avatar the child chose with the parent, such as an animal or object. This is a concrete, literal image, not an abstract icon.
  2. A fixed signature color used everywhere in that child's world: frame, cursor, progress garden.
  3. The first name in large print, so Melina reads it and the little one starts learning his own name.
  4. The name spoken aloud (French TTS or a recorded clip) when the card is hovered or tapped.
- **[Inference] Confirm step for the non-reader:**
  - A first tap enlarges the card and plays "C'est toi, Léo ? Touche encore ton lion !". A second tap enters.
  - This cuts accidental entries from button-mashing without requiring any reading.
- **[Inference] Photo or avatar:**
  - A real photo would be recognized by a 3-year-old, given self-recognition at about 3.
  - However, a photo is more sensitive personal data, and the project's rules already restrict photos.
  - An avatar is the data-minimizing default. If the parent opts in, a photo should stay local in `data\` and never leave the PC.
  - The avatar must be stable over time. Recognition relies on familiarity, so the child's picture should not change between sessions.
- **[Inference] Name practice:** the little brother's card can show his name in the same font every day. This doubles as name-recognition practice, the earliest literacy marker cited above.

### Gaps
- I found no peer-reviewed study on preschoolers choosing *their own avatar* among siblings' avatars: error rates or how quickly they learn which is theirs.
- I could not read profile-picker documentation for PBS KIDS, Sago Mini, or YouTube Kids. Sago Mini is commonly described as having no profiles at all, but I found no source for that.
- I did not reach Hourcade's *Child-Computer Interaction* or Joan Ganz Cooney Center reports on this specific question.
- NN/g's icon-specific findings were seen only through secondary summaries.

---

## Q2. Age-range entry ("3 ans et moins" / "plus de 3 ans") or profile entry (picture + name read aloud)? Cross-entry risks and safe switching

### Takeaway
Profile-based entry is clearly better. Age then becomes a per-profile setting the parent fixes in the parent area. An age-range screen does not identify *which* child is playing, so it cannot keep two learner models apart. A 3-year-old cannot read it. It invites children to pick the "big kid" option. And regulators (CAI, Google) caution that an age question should be neutral and used to adapt the interface, not as a gate the child self-declares through.

### Cited Findings
- **CAI brief (24 September 2024)** on age verification [Official; read in full] — [CAI, *Mieux protéger les renseignements personnels des jeunes pour assurer leur bien-être numérique*](https://www.cai.gouv.qc.ca/uploads/pdfs/CAI_ME_PRP_Jeunes_CSESJ.pdf):
  - Age verification "n'est pas inconditionnellement désirable", because it always means extra processing of personal data.
  - Self-declaration is the least reliable method, though it collects only one data point.
  - Privacy by design and by default *for all users* is often preferable.
  - If age is checked, the information should be used only for that purpose. It should mainly serve to adapt interfaces and content to the child (clearer design, simplified information) rather than act as a barrier.
- **Google Play Families policy:**
  - A "neutral age screen" must verify age "in a way that doesn't encourage them to falsify their age".
  - Google's examples of incorrect implementations include presetting a birth date to the required age, or *indicating that a certain age is required* to access areas of the app.
  - [Official; via search summary of the Play Console help] — [Google Play Console Help, Families policies](https://support.google.com/googleplay/android-developer/answer/9893335?hl=en)
- **Netflix:**
  - Netflix uses profile-based entry. Its Profile Lock puts a 4-digit PIN on a *specific* profile, so parents lock adult profiles and leave the kids' profile open. [Secondary] — [MacRumors, Netflix PIN per profile](https://www.macrumors.com/how-to/protect-netflix-profile-with-pin-code)
  - Netflix says the PIN "helps prevent your kid from disabling or overriding your parental controls". [Practitioner] — [Netflix Tudum guide](https://www.netflix.com/tudum/articles/guide-to-netflix-parental-controls)
  - Reviewers point out that a child who knows how to switch can still move from a Kids profile to an unlocked profile. The standalone Netflix Kids app reportedly does not allow profile switching at all. [Secondary] — [Screenwise guide](https://screenwiseapp.com/guides/setting-up-netflix-kids-profiles); [How-To Geek](https://www.howtogeek.com/435304/netflix%E2%80%99s-parental-controls-are-terrible/)
- **Khan Academy Kids:** stores each child's *age* as a profile attribute set by the grown-up when the child is added. It is not chosen at the entrance. [Practitioner; search summary] — [Khan Academy Kids help](https://khankids.zendesk.com/hc/en-us/articles/360006538192-How-do-I-add-a-new-user)
- **Device sharing:**
  - Account and device sharing is common in households, including devices considered "personal". A study of 99 households plus a 21-day diary study proposed a six-type taxonomy of sharing. [Peer-reviewed / industry research] — [Google Research, household device sharing study](https://research.google.com/pubs/archive/44670.pdf)
  - On the problem of wrong-account progress, a Khan Academy community thread is titled "Progress made on wrong account". [Practitioner community post; anecdotal] — [Khan Academy support community](https://support.khanacademy.org/hc/es/community/posts/26610542139789/comments/26684241995789)
- **Apple's Kids age bands** put 5-and-under in one band and 6–8 in another. A "3 and under / over 3" split does not match any platform band I found. [Official] — [Apple](https://developer.apple.com/app-store/parental-gates/)

### Inferences
- **[Inference] Why age-range entry fails here:**
  1. It identifies a *mode*, not a *learner*. Melina's adaptive model would be updated by whoever pressed "plus de 3 ans".
  2. The little one cannot read either label. He will press whichever button is bigger, nearer, or his sister's favorite.
  3. "Plus de 3 ans" puts a future 4- or 5-year-old in the same bucket as a 7-year-old in 2e année. That is pedagogically wrong; the cut should follow content level, not the third birthday.
  4. A bare "older / younger" choice is exactly the kind of non-neutral screen Google warns invites falsification. Little children want to be "big".
- **[Inference] Recommended entrance:**
  - A profile picker as described in Q1.
  - Each profile carries a **mode** set only in the parent area, for example "Les petits (non-lecteur)" or "École – 2e année". It is shown to the parent as the child's birth year or age band.
  - The parent's age choice survives, but moves to profile creation, where the CAI says age data belongs: it serves to adapt the interface.
  - If the parent still wants a visible entrance choice, it should be two picture doors (a toddler toy-box door and a school-bag door), each leading only to the profiles in that mode. Even so, a profile tap is still needed afterwards to separate progress.
- **[Inference] Cross-entry risks and mitigations:**
  - **Little one → Melina's profile (highest risk).**
    - What happens: random taps produce wrong answers, which corrupt her mastery estimates, weak-point detection and reports.
    - Soft lock: her card asks for a tiny *reading* check a 7-year-old passes instantly but a 3-year-old cannot. Examples are "Touche le mot *chat*" among three printed words, or her own name among three names.
    - Make it a child-level gate, not an adult gate, so it never frustrates Melina.
    - Data hygiene in addition: the server can flag sessions with an implausible pattern, such as very fast taps with near-chance accuracy. Those answers are kept but not applied to the learner model until the parent confirms.
    - The parent area should also have "this session wasn't Melina, move or discard it". Use the app's existing backup-first approach before any data change.
  - **Melina → little one's profile.** Low harm to her own data, but it inflates his "progress". The same session flag can apply. A 7-year-old playing toddler mode for fun can be allowed as a "guest/visitor" button that records nothing.
  - **Switching profiles.**
    - From toddler mode back to the picker: use an adult gate (see Q3). Toddlers mash keys and should not wander out mid-activity.
    - From Melina's mode back to the picker: a simple, visible "Changer de joueur" button is fine. Re-entering any profile still needs the profile-level confirm or soft lock.
    - On a shared PC, also add an idle timeout. After N minutes without input, go back to the picker so the next child doesn't inherit the session.

### Gaps
- I found no study comparing age-range entry with profile entry for siblings, and no data on wrong-profile rates in kids' apps (only anecdotal community posts).
- I could not verify how PBS KIDS Games or YouTube Kids handle multiple children on one device.
- I found no sources on idle-timeout or auto-logout patterns in kids' apps.

---

## Q3. Parental controls and gates suitable for a 3-year-old and a 7-year-old

### Takeaway
Platform guidance treats a parental gate as an "adult-level task" that guards adult-only actions: purchases, external links, settings. It asks for a voice prompt for pre-literate children. In this family, one gate has to stop *both* children, and a 7-year-old in 2e année can solve simple arithmetic gates. Use a layered approach: a press-and-hold plus an adult question (or a parent PIN) for the parent area, and lighter child-level checks between child profiles.

### Cited Findings
- **Apple parental gates** [Official; read in full] — [Apple](https://developer.apple.com/app-store/parental-gates/):
  - Gates "aim to prevent kids from engaging in certain activities without their parent's knowledge", such as purchases or following links outside the app.
  - Gates are "adult-level tasks that must be completed in order to continue".
  - Apple's examples are a generic task, a math task, and a task "that requires answering a question".
  - For pre-literate children: "consider using a voiceover prompt to help kids know that they need to involve their parent".
  - Apple gives no "bad gate" examples and does not mention hold-to-open.
- **Apple Kids category rules:** apps must comply with guideline 1.3 and 5.1.4. Gates must precede link-outs and purchases. [Official, but current 1.3 text seen only through mirrors] — [Apple App Review Guidelines PDF](https://developer.apple.com/support/downloads/terms/app-review-guidelines/App-Review-Guidelines-English-UK.pdf)
- **Preschoolers and control (3–5 year-olds):**
  - Children wanted to act "by myself" yet also wanted "mom's help", a stated tension.
  - Parents wanted to keep control over *when* and *with whom* the child uses the device.
  - Authors' design values: parent-only controls such as on/off switches, logs of what the child did and for how long, and clear indicators when something is transmitting.
  - They also note a "tension between creating simple interactions that young children can use independently and the potential privacy risks that arise due to that simplicity".
  - [Peer-reviewed, qualitative] — [Geiskkovitch et al., DIS 2026](https://clab.iat.sfu.ca/pubs/Geiskkovitch-Preschool-DIS2026.pdf)
- **ICO Children's Code, parental controls standard:** the code includes a standard on parental controls. Summaries describe it as requiring age-appropriate information to the child and an obvious signal to the child when they are being monitored. [Secondary; the ICO page returned 403] — [ICO, Code standards](https://ico.org.uk/for-organisations/guide-to-data-protection/ico-codes-of-practice/age-appropriate-design-a-code-of-practice-for-online-services/code-standards)
- **Netflix:** uses a 4-digit PIN to stop children from changing controls or adding new profiles. Adding new profiles can be blocked only from the main profile. [Secondary] — [MacRumors](https://www.macrumors.com/how-to/protect-netflix-profile-with-pin-code); [Netflix Tudum](https://www.netflix.com/tudum/articles/guide-to-netflix-parental-controls)

### Inferences
- **[Inference] Gate for the parent area (both children must fail it):**
  1. A press-and-hold of about 3 seconds on a discreet corner button. This blocks accidental toddler taps; the reasoning is motor control and intent, not a sourced study.
  2. Then *either* a parent PIN set at first launch, *or* an adult question a 7-year-old cannot answer: two-digit multiplication, or a spelled-out number such as "Écris en chiffres : quarante-sept fois trois".
  - A plain "3 + 4" gate is **not** sufficient. Melina's own curriculum covers it.
  - A text-only gate stops the 3-year-old but not a reading 7-year-old.
  - A PIN is the most robust and cheapest option. If used, it must be stored hashed in the local data. If a parent writes it down, nothing in the app should repeat it.
- **[Inference] Voice prompt on the gate:** when a child triggers the gate, a short spoken line such as "Demande à papa ou maman de t'aider !" follows Apple's pre-literate advice. The child then understands it is not a failure.
- **[Inference] What to place behind the adult gate:**
  - Creating, renaming and deleting profiles; changing a profile's mode or age band.
  - Consent switches, such as the existing handwriting-reading consent.
  - Reports, exports and backups.
  - Time limits; reassigning or discarding sessions; anything that calls an external API.
- **[Inference] What should *not* be behind an adult gate:** moving between the picker and a profile; ending an activity; the sound on/off a child might need. Over-gating frustrates children, and the CAI warns against age checks working as barriers rather than adaptation.
- **[Inference] Transparency to the child:** show a small, always-visible cue in each child's world (their avatar in the corner) so the child knows "whose game this is". Show a simple "Papa/Maman peut voir tes progrès" message once in Melina's profile. This is in the spirit of the ICO standard about telling children when they are monitored.

### Gaps
- I found **no empirical study** testing how often children pass math, question or hold gates. The searches returned only general parental-control bypass surveys, mostly from vendors.
- No official source recommends "hold to open" specifically; it is a common pattern but unsourced here.
- Google Play's own parental-gate wording was not retrieved.

---

## Q4. Data minimization and privacy for each child's data (Law 25 / CAI, COPPA, ICO Children's Code, platform rules), applied to a local family app

### Takeaway
All four frameworks converge on the same rules:
- Collect the minimum.
- Keep profiling and tracking off by default unless it clearly serves the child.
- Get parental consent for under-14s (Québec) or under-13s (COPPA).
- Never pass a child's identifiable data to third parties without explicit parental consent.
- Keep a written retention and deletion rule.

A purely local family app is probably outside the formal scope of Law 25 (which targets enterprises) and of COPPA (online operators). Even so, following these principles is cheap, and it matches the project's own rules.

### Cited Findings
- **Québec Law 25 / private-sector act, parental consent:**
  - Under 14, the parent or tutor must consent to collection from the minor and to use or communication for other purposes.
  - From 14 to 17, the minor can consent, but the parent may continue to do so.
  - The CAI cites art. 4.1 and 14 of the *Loi sur la protection des renseignements personnels dans le secteur privé* (RLRQ c. P-39.1).
  - [Official] — [CAI brief, 24 Sept 2024, note 11](https://www.cai.gouv.qc.ca/uploads/pdfs/CAI_ME_PRP_Jeunes_CSESJ.pdf)
  - Secondary summaries also note an exception when collection is "manifestement" to the minor's benefit, without defining it. [Secondary] — [Fasken Q&A on Law 25](https://www.fasken.com/fr/knowledge/loi-25/on-repond-a-vos-questions-2-de-3)
- **CAI positions** [Official] — [CAI brief 2024](https://www.cai.gouv.qc.ca/uploads/pdfs/CAI_ME_PRP_Jeunes_CSESJ.pdf):
  - The CAI considers consent alone insufficient protection for minors.
  - It recommends:
    - explicitly banning use of minors' data to influence behaviour commercially;
    - banning the sale of minors' data *even with consent*;
    - embedding the child's best interest in privacy law;
    - a special duty of protection toward minors;
    - stronger regulation of product design.
  - It cites the UK ICO code as a model.
  - It recalls that Québec's Consumer Protection Act (arts. 248–249) bans commercial advertising aimed at children under 13.
- **Canadian privacy commissioners (joint resolution, October 2023):**
  - Organizations should build youth privacy and best-interest considerations in from the design stage.
  - Tracking such as geolocation should be off by default unless demonstrably necessary.
  - [Official] — [OPC, joint FPT resolution](https://www.priv.gc.ca/fr/a-propos-du-commissariat/ce-que-nous-faisons/collaboration-avec-les-provinces-et-les-territoires/resolutions-conjointes-avec-les-provinces-et-territoires/res_231005_01/)
- **ICO Age Appropriate Design Code (Children's Code)** [Official text exists but my fetch got 403; content via search summaries — Secondary] — [ICO code standards](https://ico.org.uk/for-organisations/guide-to-data-protection/ico-codes-of-practice/age-appropriate-design-a-code-of-practice-for-online-services/code-standards); [ICO code PDF v2.1](https://ico.org.uk/media/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/age-appropriate-design-a-code-of-practice-for-online-services-2-1.pdf); [ESRB summary on defaults and minimisation](https://www.esrb.org/privacy-certified-blog/the-icos-age-appropriate-design-code-default-settings-and-data-minimization/):
  - 15 cumulative standards for services likely to be accessed by under-18s.
  - Settings must be "high privacy" by default.
  - Collect and retain only the minimum data needed.
  - Options that use profiling are "off" by default, unless there is a compelling reason that accounts for the child's best interests and appropriate safeguards exist.
- **FTC COPPA amended Rule** (published 22 April 2025; effective 23 June 2025; compliance by 22 April 2026) [Secondary law-firm summaries of an official rule] — [Hunton](https://www.hunton.com/privacy-and-cybersecurity-law-blog/ftc-publishes-final-coppa-rule-amendments); [Jones Day](https://jonesday.com/en/insights/2025/05/ftc-finalizes-amendments-to-coppa--rule):
  - Operators must keep a *written data-retention policy* stating:
    1. why children's data is collected;
    2. the specific need to keep it;
    3. a deletion timeline.
  - They must not keep data longer than necessary for the documented purpose.
  - One alert notes the rule may still be revised after a 2025 regulatory freeze. [Secondary] — [Wilson Elser](https://www.wilsonelser.com/publications/ftc-finalizes-amendments-to-rule-protecting-childrens-data-regulatory-freeze-likely-signals-further-revisions)
- **Apple Kids category:** "Kids apps should not transmit personally identifiable information or device information to third parties — even in sections intended for adults — unless the parent explicitly consents." Third-party analytics and advertising are restricted. [Official] — [Apple](https://developer.apple.com/app-store/parental-gates/)
- **Google Play Families:** child-directed apps must use only self-certified ads SDKs and no personalized ads, and must keep a privacy policy that matches actual practice. [Official; via search summary] — [Google Play Families policy](https://support.google.com/googleplay/android-developer/answer/9893335?hl=en)
- **Parents' concerns (3–5 year-olds):** parents' main worries included hacking, who can access the child, and data being shared "by accident". Some children also voiced privacy discomfort; one wanted a teddy-bear camera "blindfolded". [Peer-reviewed, qualitative] — [Geiskkovitch et al., DIS 2026](https://clab.iat.sfu.ca/pubs/Geiskkovitch-Preschool-DIS2026.pdf)

### Inferences
- **[Inference] Legal scope (not legal advice):**
  - Law 25's private-sector act governs *enterprises*, and COPPA governs commercial online operators. A parent running a non-commercial app for their own children on their own PC is very likely outside both.
  - The useful move is to adopt the principles voluntarily, which the project already partly does (the local-only data folder, the consent switch for handwriting reading).
- **[Inference] What to store per child (minimum set):**
  - Internal ID; first name or nickname as displayed; avatar choice; signature color; mode or age band (or birth *year*, not full date of birth); per-skill learner-model state; session history (dates, activity, correct/incorrect); and settings.
  - **Do not** store a full birth date, surname, school name, a photo by default, or voice recordings by default.
- **[Inference] What must never leave the PC:**
  - Name, avatar or photo, answers, learner-model state, and session logs, for any child.
  - The toddler profile should have **no** external call at all. The existing handwriting-reading exception is gated by parental consent; it should stay per child and stay off by default for any new profile, especially the 3-year-old's.
  - This applies Apple's "no PII to third parties without explicit parental consent" and the ICO high-privacy default.
- **[Inference] Separation of data:**
  - Every record (answers, skills, rewards or "seeds", handwriting samples) carries the child's profile ID.
  - The server derives the active profile from the session, never from a value sent by the page, so one child's screen cannot read or write the other's records.
  - Report and export endpoints are scoped to one child, behind the parent gate.
- **[Inference] Retention:**
  - Write a short retention rule in `docs\privacy.md`, in the COPPA style: purpose, need, and when data is deleted. Examples: detailed answer logs pruned after N months while aggregated skill state is kept; everything for a profile deleted when the parent deletes the profile, after the automatic backup.
- **[Inference] Profiling:** adaptive difficulty *is* profiling in the ICO sense, but it directly serves the child's learning (the "compelling reason" case).
  - Keep it limited to learning.
  - Keep no engagement-maximizing nudges and no advertising.
  - Let the parent see it, and let the parent reset it per child.

### Gaps
- I could not read the full ICO standards text directly (403). The exact wording of the data-minimisation, parental-controls and age-band sections (I believe 0–5 "pre-literate and early literacy" and 6–9 "core primary school years") is unverified here.
- I found no CAI guidance written specifically for parents or for household, non-commercial apps.
- I did not verify the current text of Law 25 art. 9.1 (privacy-by-default for technological products) from the primary source.

---

## Q5. A separate adaptive learner model per child, siblings on one device, and per-child reports to parents

### Takeaway
No source addresses sibling learner models directly. The evidence points to three things:
- Devices and accounts are routinely shared, so the app itself must enforce per-child identity.
- Platforms model progress per child profile, with the age set by the parent.
- Parents of young children want per-child logs and controls.

A shared or contaminated model would distort both the adaptive engine and the reports.

### Cited Findings
- **Shared devices:** household device and account sharing is common, even for "personal" devices. [Peer-reviewed / industry] — [Google Research, 99-household study](https://research.google.com/pubs/archive/44670.pdf)
- **Tablet design for young children** (lab study, 15 parent–child pairs, ages 4–6): one-sided interfaces, designs demanding constant attention, and no support for parallel interaction shape how families use tablets. Shared co-use is poorly supported by typical kids' app design. [Peer-reviewed] — [Microsoft Research, CHI 2018, Tablets and Toys](https://microsoft.com/en-us/research/uploads/prod/2018/08/TabletsAndToys-CHI2018.pdf)
- **Khan Academy:**
  - Khan Academy Kids lets a parent set up several children, each with name, age and avatar. [Practitioner; search summary] — [Khan Academy Kids help](https://khankids.zendesk.com/hc/en-us/articles/360006538192-How-do-I-add-a-new-user)
  - The main Khan Academy Parent Dashboard reports per child. [Practitioner] — [Khan Academy help: How do I view my child's profile](https://support.khanacademy.org/hc/de/articles/204795300-How-do-I-view-my-child-s-profile)
  - A community thread documents the real-world problem of "progress made on wrong account". [Anecdotal] — [Khan Academy community](https://support.khanacademy.org/hc/es/community/posts/26610542139789/comments/26684241995789)
- **Parent-facing design values for preschool tech:** parent-only on/off controls, and logs of what the child did and for how long, so the parent keeps oversight while the child gains some independence. Short, child-led sessions suit 3–5 year-olds. [Peer-reviewed, qualitative] — [Geiskkovitch et al., DIS 2026](https://clab.iat.sfu.ca/pubs/Geiskkovitch-Preschool-DIS2026.pdf)
- **ICO:** profiling off by default unless it is in the child's best interest with safeguards. This supports learning-only adaptation, scoped to one child. [Secondary] — [ICO code standards](https://ico.org.uk/for-organisations/guide-to-data-protection/ico-codes-of-practice/age-appropriate-design-a-code-of-practice-for-online-services/code-standards)

### Inferences
- **[Inference] One learner model per profile, never shared or averaged.**
  - The toddler's model should use a different, simpler skill map (pre-literacy and pre-numeracy: colors, shapes, counting to 5, sounds). The 2e année curriculum map should not be shown to him with everything "not mastered".
  - Sharing skill IDs across modes is fine only where the skill is the same, such as counting.
- **[Inference] Model protection:**
  - Apply wrong-profile contamination safeguards (Q2): plausibility flags and parent-confirmed reassignment.
  - Allow a per-child "reset model" behind the parent gate.
  - Take a backup before any reassignment or migration, per the project's backup rule.
- **[Inference] Reports to parents:**
  - Write one report per child; never compare siblings in the child-facing UI.
  - The toddler report should be descriptive (time, activities tried, enjoyment signals) rather than score-based. At 3, "mastery" percentages mean little and invite over-interpretation.
  - Melina's report keeps the existing structure.
  - If a report is ever generated by an external model, it must receive no name, photo or raw answers, only anonymized aggregates, consistent with project rule 4.
- **[Inference] Rewards and motivation economy:**
  - Keep separate per child, such as each child's own garden.
  - A shared world where the little one's taps can "spend" or alter Melina's rewards is a likely source of sibling conflict.
  - Nothing in the sources addresses this directly; it is a design judgment.

### Gaps
- I found no study of adaptive learning systems used by siblings on one device, and no measured contamination rates.
- I found no research on how parents of a 3-year-old want progress reported (descriptive vs. scored).
- The Joan Ganz Cooney Center and Hourcade sources suggested in the brief were not reached in this session.
