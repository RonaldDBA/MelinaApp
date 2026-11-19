import type { AppleCratesSpec, DominoFace, DominoSpec, ExerciseInstance, FrogJumpSpec, NumberPathSpec, NumberTrainSpec } from '@melina/shared';

/**
 * «Comment calculer»: a worked explanation, in short steps a 7-year-old can follow, for the math exercises (guardian's
 * request, 18/11/2026: «when she makes a mistake, explain how to calculate»). Research basis already used in the app:
 * worked examples and strategy feedback beat a bare «right/wrong»; the strategies are the ones of 2e année in Québec
 * (jumps on the number line, completing the ten, counting by tens, the rule of a sequence).
 *
 * - `plan` + the first step = a STRATEGY HINT after the 2nd mistake (it never gives the final answer);
 * - all the steps + `answer` = the explanation in the result panel, after a mistake or a success with help.
 */
export interface Worked {
  plan: string;
  steps: string[];
  answer: string;
  /** The first step may be shown as a hint (calculations: «8 + 2 = 10»). Off when it would give away part of the answer. */
  hintStep?: boolean;
}

const minus = '−';

/** Jumps on the number line: first the hundreds, then the tens, then the units (completing the ten when needed). */
export function addSubWorked(a: number, b: number, plus: boolean): Worked {
  const r = plus ? a + b : a - b;
  const op = plus ? '+' : minus;
  const parts = [Math.floor(b / 1000) * 1000, Math.floor((b % 1000) / 100) * 100, Math.floor((b % 100) / 10) * 10, b % 10].filter((p) => p > 0);
  const steps: string[] = [];
  let cur = a;
  for (const p of parts) {
    const next = plus ? cur + p : cur - p;
    const u = cur % 10;
    const crosses = p < 10 && (plus ? u + p > 10 : u > 0 && u < p);
    if (crosses) {
      // the units cross a ten: go to the ten first, then the rest
      const toTen = plus ? 10 - u : u;
      const ten = plus ? cur + toTen : cur - toTen;
      steps.push(`${cur} ${op} ${toTen} = ${ten} (on ${plus ? 'complète' : 'recule jusqu’à'} la dizaine).`);
      steps.push(`Il reste ${p - toTen} : ${ten} ${op} ${p - toTen} = ${next}.`);
    } else steps.push(`${cur} ${op} ${p} = ${next}.`);
    cur = next;
  }
  const units = parts.length === 1 && b < 10;
  const plan = units
    ? plus
      ? `On part de ${a} et on avance de ${b}.`
      : `On part de ${a} et on recule de ${b}.`
    : `On découpe ${b} : ${parts.join(' + ')}. On saute un morceau à la fois${plus ? '' : ', en reculant'}.`;
  return { plan, steps, answer: `Donc ${a} ${op} ${b} = ${r}.`, hintStep: true };
}

/** Sequence: the gap between two neighbours is the rule. */
export function sequenceWorked(terms: Array<number | null>, missing: number[]): Worked | null {
  const known = terms.map((t, i) => [i, t] as const).filter((x): x is readonly [number, number] => x[1] !== null);
  let step: number | null = null;
  for (let k = 1; k < known.length; k++) {
    const [i, v] = known[k] as readonly [number, number];
    const [j, w] = known[k - 1] as readonly [number, number];
    if (i - j === 1) {
      step = v - w;
      break;
    }
  }
  if (step === null) return null;
  const pairs = known.slice(0, 2).map(([, v]) => v);
  const rule = step > 0 ? `on ajoute ${step}` : `on enlève ${-step}`;
  const full = [...terms];
  const steps: string[] = [];
  let m = 0;
  for (let i = 0; i < full.length; i++) {
    if (full[i] !== null) continue;
    const value = missing[m++];
    if (value === undefined) break;
    if (i > 0 && full[i - 1] !== null) steps.push(`Après ${full[i - 1]} : ${full[i - 1]} ${step > 0 ? '+' : minus} ${Math.abs(step)} = ${value}.`);
    else {
      const after = full.slice(i + 1).find((t) => t !== null);
      steps.push(`Avant ${after} : ${after} ${step > 0 ? minus : '+'} ${Math.abs(step)} = ${value}.`);
    }
    full[i] = value;
  }
  return {
    plan: `Regarde l’écart entre deux nombres voisins${pairs.length === 2 ? ` : ${pairs[0]} → ${pairs[1]}` : ''}. À chaque fois, ${rule}.`,
    steps,
    answer: `Les nombres qui manquent : ${missing.join(', ')}.`,
  };
}

function cratesWorked(g: AppleCratesSpec, expected: number, statement: string): Worked {
  const total = g.packed * 10 + g.loose;
  const full = Math.floor(total / 10);
  const rest = total % 10;
  const tens = Array.from({ length: Math.min(full, 6) }, (_, i) => (i + 1) * 10).join(', ') + (full > 6 ? '…' : '');
  const f = g.fruitLabel;
  if (/manque/.test(statement))
    return {
      plan: `Une caisse pleine a 10 ${f}. Regarde la dernière caisse.`,
      steps: [`Elle a ${rest} ${f}.`, `De ${rest} jusqu’à 10 : ${rest} + ${10 - rest} = 10.`],
      answer: `Il manque ${expected} ${f}.`,
    };
  if (g.question === 'crates')
    return {
      plan: `On range par 10 : chaque caisse prend 10 ${f}.`,
      steps: [`${total} ${f}, c’est ${full} paquet${full > 1 ? 's' : ''} de 10${rest ? ` et ${rest} de plus` : ''}.`, ...(rest ? [`Les ${rest} qui restent ont besoin d’une caisse eux aussi : ${full} + 1 = ${full + 1}.`] : [])],
      answer: `Il faut ${expected} caisse${expected > 1 ? 's' : ''}.`,
    };
  return {
    plan: `Compte les caisses pleines par bonds de 10, puis ajoute les ${f} de la dernière caisse.`,
    steps: [`${full} caisse${full > 1 ? 's' : ''} pleine${full > 1 ? 's' : ''} : ${tens} → ${full * 10}.`, ...(rest ? [`Plus ${rest} : ${full * 10} + ${rest} = ${total}.`] : [])],
    answer: `Il y a ${expected} ${f} : ${full} dizaine${full > 1 ? 's' : ''} et ${rest} unité${rest > 1 ? 's' : ''}.`,
  };
}

function pathWorked(g: NumberPathSpec, values: number[]): Worked {
  const cells = g.cells.map((c) => c.value);
  const steps: string[] = [];
  let m = 0;
  for (let i = 0; i < cells.length; i++) {
    if (cells[i] !== null) continue;
    const v = values[m++] as number;
    const prev = cells[i - 1];
    if (prev !== null && prev !== undefined) {
      const d = v - prev;
      const why = Math.abs(d) === 10 ? ' (une ligne plus bas ou plus haut : 10 de plus ou de moins)' : (d > 0 ? v % 10 === 0 : prev % 10 === 0) ? ' (la dizaine change)' : '';
      steps.push(`Après ${prev} vient ${v}${why}.`);
    } else steps.push(`Avant ${cells.slice(i + 1).find((x) => x !== null)} vient ${v}.`);
    cells[i] = v;
  }
  const back = (values[1] ?? 0) < (values[0] ?? 0);
  return {
    plan: g.layout === 'grid' ? 'Sur la grille : vers la droite +1, vers la gauche −1, vers le bas +10, vers le haut −10.' : `On compte de 1 en 1${back ? ', à reculons' : ''}. Attention au changement de dizaine (39 → 40).`,
    steps,
    answer: `Les pierres : ${values.join(', ')}.`,
  };
}

function faceText(f: DominoFace): string {
  switch (f.kind) {
    case 'dots':
      return `${f.n} point${f.n > 1 ? 's' : ''}`;
    case 'digit':
      return String(f.n);
    case 'expr':
      return f.text;
    default:
      return `${f.tens} barre${f.tens > 1 ? 's' : ''} de 10 et ${f.units} cube${f.units > 1 ? 's' : ''}`;
  }
}
function faceValue(f: DominoFace): number {
  if (f.kind === 'dots' || f.kind === 'digit') return f.n;
  if (f.kind === 'tens') return f.tens * 10 + f.units;
  // «700 + 20 + 1», «13 − 5»: left to right
  const tokens = f.text.match(/\d+|[+−-]/g) ?? [];
  let v = Number(tokens[0]);
  for (let i = 1; i + 1 < tokens.length; i += 2) v = tokens[i] === '+' ? v + Number(tokens[i + 1]) : v - Number(tokens[i + 1]);
  return v;
}
function dominoWorked(g: DominoSpec): Worked {
  const open = g.table.open;
  const v = faceValue(open);
  const how =
    open.kind === 'dots'
      ? `Compte les points un par un : ${Array.from({ length: Math.min(v, 10) }, (_, i) => i + 1).join(', ')}.`
      : open.kind === 'tens'
        ? `${open.tens} barre${open.tens > 1 ? 's' : ''} de 10 = ${open.tens * 10}, et ${open.units} cube${open.units > 1 ? 's' : ''} : ${open.tens * 10} + ${open.units} = ${v}.`
        : open.kind === 'expr'
          ? `Calcule : ${open.text} = ${v}.`
          : `Le nombre est ${v}.`;
  return {
    plan: `Trouve d’abord quel nombre montre le bout du domino : ${faceText(open)}.`,
    steps: [how, `Cherche la pièce qui montre aussi ${v}, mais d’une autre façon.`],
    answer: `Le bon domino montre ${v}.`,
  };
}

/** The worked explanation of a math exercise (paper or game), or null when there is none for it. */
export function workedFor(ex: ExerciseInstance): Worked | null {
  const g = ex.game as unknown as Record<string, unknown> | undefined;
  const exp = ex.expected;
  if (g?.game === 'frog-jump') {
    const f = g as unknown as FrogJumpSpec;
    return addSubWorked(f.start, f.jump, f.op === '+');
  }
  if (g?.game === 'number-train' && exp.type === 'number') return sequenceWorked((g as unknown as NumberTrainSpec).terms, [exp.value]);
  if (g?.game === 'apple-crates' && exp.type === 'number') return cratesWorked(g as unknown as AppleCratesSpec, exp.value, ex.statement);
  if (g?.game === 'number-path' && exp.type === 'sequence') return pathWorked(g as unknown as NumberPathSpec, exp.values);
  if (g?.game === 'dominoes') return dominoWorked(g as unknown as DominoSpec);
  if (g) return null;
  // paper exercises: read the numbers from the statement
  if (ex.skillId === 'math.add-sub') {
    const m = /(\d+)\s*([+−-])\s*(\d+)/.exec(ex.statement);
    if (m) return addSubWorked(Number(m[1]), Number(m[3]), m[2] === '+');
    // word problem («Lila a 34 graines. Elle en trouve encore 28.»): first say which operation it is
    const n = ex.statement.match(/\d+/g);
    if (n && n.length >= 2) {
      const plus = !/plante|reste|donne|mange|perd/.test(ex.statement);
      const w = addSubWorked(Number(n[0]), Number(n[1]), plus);
      return { ...w, plan: `${plus ? 'Elle en a plus qu’avant : c’est une addition.' : 'Elle en a moins qu’avant : c’est une soustraction.'} ${w.plan}` };
    }
  }
  if (ex.skillId === 'math.sequences' && exp.type === 'sequence') {
    const shown = (ex.statement.split(':')[1] ?? '').split(',').map((s) => s.trim());
    const terms = shown.map((s) => (/^\d+$/.test(s) ? Number(s) : null));
    return sequenceWorked(terms, exp.values);
  }
  if (ex.visual?.kind === 'tens-units' && exp.type === 'number') {
    const v = ex.visual;
    const h = v.hundreds ?? 0;
    return {
      plan: 'Compte d’abord les grands paquets, puis les petits.',
      steps: [...(h ? [`${h} centaine${h > 1 ? 's' : ''} = ${h * 100}.`] : []), `${v.tens} dizaine${v.tens > 1 ? 's' : ''} = ${v.tens * 10}.`, `${v.units} unité${v.units > 1 ? 's' : ''} = ${v.units}.`],
      answer: `${h ? `${h * 100} + ` : ''}${v.tens * 10} + ${v.units} = ${exp.value}.`,
    };
  }
  return null;
}

/** Strategy hint after the 2nd mistake: the plan and the first step, never the final answer. */
export function workedHint(w: Worked): string {
  return w.hintStep && w.steps.length > 1 ? `${w.plan} ${w.steps[0]}` : w.plan;
}
