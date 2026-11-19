import { basicNormalize, stripAccents, type ResponseType } from '@melina/shared';

export type SampleKind = 'number' | 'word' | 'sentence';

export interface SampleCandidate {
  id: string;
  kind: SampleKind;
  transcription: string;
  quality: 1 | 2 | 3; // 3 = good
  allowExternal: boolean;
  skillId: string | null;
  createdAt: string;
}

export function kindForResponse(t: ResponseType): SampleKind {
  if (t === 'number' || t === 'sequence') return 'number';
  if (t === 'word') return 'word';
  return 'sentence';
}

export interface SelectOptions {
  kind: SampleKind;
  skillId?: string;
  max: number;
  /** Only samples authorized to be sent externally (always true for calls to Claude). */
  externalOnly: boolean;
}

/**
 * Simple, explainable selection (no vector search):
 * 1. same answer type; 2. authorized; 3. best quality; 4. same skill first;
 * 5. diversity — avoids repeated transcriptions and prefers characters not yet covered; 6. most recent.
 * Also returns the reason for each choice, for auditing.
 */
export function selectSamples(all: SampleCandidate[], opt: SelectOptions): Array<SampleCandidate & { why: string }> {
  const pool = all
    .filter((s) => s.kind === opt.kind && (!opt.externalOnly || s.allowExternal))
    .sort((a, b) => {
      if (b.quality !== a.quality) return b.quality - a.quality;
      const sa = a.skillId === opt.skillId ? 1 : 0;
      const sb = b.skillId === opt.skillId ? 1 : 0;
      if (sb !== sa) return sb - sa;
      return b.createdAt.localeCompare(a.createdAt);
    });

  const chosen: Array<SampleCandidate & { why: string }> = [];
  const seenText = new Set<string>();
  const covered = new Set<string>();
  const chars = (t: string) => new Set([...stripAccents(basicNormalize(t)).replace(/\s/g, '')]);

  // Step 1: maximize new characters; step 2: fill up in order.
  const remaining = [...pool];
  while (chosen.length < opt.max && remaining.length) {
    let bestIdx = -1;
    let bestGain = -1;
    remaining.forEach((s, idx) => {
      const key = basicNormalize(s.transcription);
      if (seenText.has(key)) return;
      const gain = [...chars(s.transcription)].filter((c) => !covered.has(c)).length;
      if (gain > bestGain) {
        bestGain = gain;
        bestIdx = idx;
      }
    });
    if (bestIdx < 0) break;
    const [s] = remaining.splice(bestIdx, 1);
    if (!s) break;
    seenText.add(basicNormalize(s.transcription));
    chars(s.transcription).forEach((c) => covered.add(c));
    const reasons = [`type ${s.kind}`, `qualité ${s.quality}`];
    if (s.skillId && s.skillId === opt.skillId) reasons.push('même compétence');
    if (bestGain > 0) reasons.push(`${bestGain} nouveau(x) caractère(s)`);
    chosen.push({ ...s, why: reasons.join(', ') });
  }
  return chosen;
}
