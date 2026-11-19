# Handwriting: reading, samples and measurement

## Reading

- The app only sends the image when the parents click **Lire avec l’IA**. Choosing the file does not trigger a send.
- The request carries the photo and the answer **type**, for example "un nombre écrit en chiffres". It **does not carry** the question or the expected answer.
- Claude returns, through a tool with a fixed schema, the literal transcription, the uncertain parts, a declared confidence (`low`, `medium` or `high`) and the illegible flag.
- The declared confidence is **an auxiliary signal, not a calibrated probability**.
- The response is validated: types, sizes and JSON. Malformed responses become a recoverable error.
- The call has a 45 s timeout and at most 1 retry for unavailability or rate limits. There is no retry for an invalid key or a refused request.
- The text inside the photos is treated as data. The prompt says so explicitly.
- In version 1, the parents **always** confirm or correct the reading.

## Samples (handwriting memory)

- They are only kept if the parents tick *Garder cette photo comme exemple d’écriture*. Not every photo becomes a sample.
- Sending in future readings is a **separate** permission: *Permettre d’envoyer cet exemple à l’IA lors de lectures futures*.
- Each sample records id, photo, confirmed transcription, type (number, word or sentence), skill, date, quality, origin, external permission and link to the attempt and the reading.
- In the library, the parents can view, correct the transcription, change the permission and delete.
- Deleting removes the sample from the library and from the next calls. The attempt, the transcription and the exercise photo remain in the history.

> Using samples **does not train Claude**. They go as visual context for each call, and the model does not "learn" Melina's handwriting between calls.

## Retrieval (simple and explainable)

Code in `packages/handwriting/src/samples.ts`.

1. Same answer type: numbers for numeric answers and sequences, words for words.
2. Only samples authorized for external sending.
3. Best quality first. Then, same skill. Then, the most recent.
4. Diversity: repeated transcriptions are left out, and those bringing characters not yet covered are preferred.
5. Limit per call: default 3, configurable from 0 to 5. This controls the cost.

Each reading records which samples were used and why, in `ai_reviews.samples_used_json`.

## Measurement

In *IA et données → Mesure de la lecture*, the dashboard shows:
- how many readings were done by the AI and how many the parents corrected;
- how many images were marked as illegible;
- the readings **with** and **without** samples and the corrections in each group;
- the most common character confusions (for example `4→9` and `h→n`).

**No improvement has been proven.** Comparing "with" and "without" samples requires a real volume of readings of Melina's handwriting. From the attached tests, the expected confusions are **n/h** and between some digits (see `docs/references.md`).

## Real validation pending

The AI tests are **simulated**: they do not call the API. Real reading will only be considered validated after a real call, with a configured key and consent given, and with the parents' assessment of real photos.
