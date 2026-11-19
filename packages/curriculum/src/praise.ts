import type { ExerciseInstance } from '@melina/shared';
import { tagsOf } from './tags';

/**
 * Praise for the PROCESS using the round's REAL data (research: specific and sincere; never about the person).
 * E.g. «Tu as compté par bonds de 10.», «Tu as bien fait la retenue.», «Tu as bien écrit le son « eau ».»
 * Short sentences (≤ 10 words), in French, without the child's name.
 */

const SOUND_TEXT: Record<string, string> = {
  'son-eau': 'le son « eau »',
  'son-ai-ei': 'le son « ai »',
  'son-ou': 'le son « ou »',
  'son-on': 'le son « on »',
  'son-an-en': 'le son « an »',
  'son-in-ain': 'le son « in »',
  'son-oi': 'le son « oi »',
  'son-eu': 'le son « eu »',
  'son-ch-gn': 'le son « ch »',
  'son-qu': 'le son « qu »',
};

const FALLBACK: Record<string, string> = {
  'math.place-value': 'Tu as bien compté les dizaines, puis les unités.',
  'math.grouping-tens': 'Tu as bien organisé les objets en groupes de 10.',
  'math.add-sub': 'Tu as bien calculé, position par position.',
  'math.sequences': 'Tu as trouvé la règle de la suite.',
  'math.counting': 'Tu as suivi la suite des nombres sans te perdre.',
  'math.representations': 'Tu as reconnu le même nombre sous une autre forme.',
  'fr.plural': 'Tu as bien regardé la fin des mots.',
  'fr.comprehension': 'Tu as retrouvé l’indice dans le texte.',
  'fr.spelling': 'Tu as bien écouté chaque son.',
  'en.listen-words': 'Tu as bien écouté le mot anglais.',
  'en.commands': 'Tu as bien suivi la consigne en anglais.',
};

export function strategyPraise(ex: ExerciseInstance): string {
  const t = new Set(tagsOf(ex));
  const k = ex.questionKey;
  const g = ex.game as Record<string, unknown> | undefined;
  switch (ex.skillId) {
    case 'en.listen-words': {
      if (t.has('en-devinette')) return 'Tu as compris toute la devinette en anglais.';
      if (t.has('en-th')) return 'Tu as entendu le « th » de three.';
      if (t.has('en-voyelle')) return 'Tu as entendu la voyelle courte ou longue.';
      if (t.has('en-teen-ty')) return 'Tu as entendu « teen » ou « ty ».';
      if (t.has('en-rime')) return 'Tu as bien écouté le premier son du mot.';
      if (t.has('en-phrase')) return 'Tu as trouvé le mot dans la phrase anglaise.';
      return FALLBACK['en.listen-words'] as string;
    }
    case 'en.commands': {
      if (t.has('en-trois-etapes')) return 'Tu as fait les trois étapes dans l’ordre.';
      if (t.has('en-mettre-dans')) return 'Tu as mis l’objet au bon endroit.';
      if (t.has('en-deux-etapes')) return 'Tu as suivi les deux consignes dans l’ordre.';
      if (t.has('en-couleur-nom')) return 'Tu as écouté la couleur et le nom.';
      return FALLBACK['en.commands'] as string;
    }
    case 'math.add-sub': {
      if (t.has('retenue-centaine')) return 'Tu as bien fait la retenue vers les centaines.';
      if (t.has('emprunt-centaine')) return 'Tu as bien échangé une centaine.';
      if (t.has('retenue')) return 'Tu as bien fait la retenue.';
      if (t.has('emprunt')) return 'Tu as bien échangé une dizaine.';
      if (t.has('calcul-passage-dizaine')) return 'Tu es bien passée par la dizaine.';
      if (g?.game === 'frog-jump') {
        const jump = g.jump as number;
        if (jump >= 1000) return 'Tu as sauté par milliers, puis par centaines.';
        if (jump >= 100) return 'Tu as sauté par centaines, puis par dizaines.';
        if (jump % 10 === 0) return `Tu as compté par bonds de 10.`;
        return `Tu as fait le saut de ${jump} sans te tromper.`;
      }
      return FALLBACK['math.add-sub'] as string;
    }
    case 'math.sequences': {
      const m = /^(?:seq|nt)-(-?\d+)-(-?\d+)/.exec(k);
      if (m) {
        const step = Number(m[2]);
        return step > 0 ? `Tu as trouvé la règle : on ajoute ${step}.` : `Tu as trouvé la règle : on enlève ${-step}.`;
      }
      return FALLBACK['math.sequences'] as string;
    }
    case 'math.counting': {
      if (t.has('passage-millier')) return 'Tu as bien passé le millier.';
      if (t.has('grille-100')) return 'Tu as bien utilisé la grille : +10 en descendant.';
      if (t.has('passage-centaine')) return 'Tu as bien passé la centaine.';
      if (t.has('bonds-de-10')) return 'Tu as compté de 10 en 10.';
      if (t.has('compte-a-rebours')) return 'Tu as bien compté à reculons.';
      if (t.has('passage-dizaine')) return 'Tu as bien passé la dizaine.';
      return FALLBACK['math.counting'] as string;
    }
    case 'math.place-value': {
      if (t.has('zero-au-milieu')) return 'Tu as pensé au zéro au milieu.';
      if (t.has('echange-dizaines')) return 'Tu as échangé 10 dizaines contre une centaine.';
      if (t.has('milliers')) return 'Tu as bien placé les milliers.';
      if (t.has('caisses-fermees')) return 'Tu as compté les caisses pleines par 10.';
      if (t.has('materiel-dizaines')) return 'Tu as compté par dizaines, puis les unités.';
      return FALLBACK['math.place-value'] as string;
    }
    case 'math.grouping-tens': {
      if (t.has('complement-a-10')) return 'Tu as trouvé combien il manque pour faire 10.';
      if (t.has('deux-etapes')) return 'Tu as fait le problème en deux étapes.';
      if (t.has('groupe-incomplet')) return 'Tu as pensé au groupe qui n’est pas plein.';
      return FALLBACK['math.grouping-tens'] as string;
    }
    case 'math.representations': {
      if (t.has('forme-decomposee')) return t.has('zero-au-milieu') ? 'Tu as pensé au zéro de la place vide.' : 'Tu as lu chaque position du nombre.';
      if (t.has('retenue') || t.has('emprunt')) return 'Tu as bien calculé avec la dizaine de plus.';
      if (t.has('calcul-passage-dizaine')) return 'Tu as calculé en passant par 10.';
      if (t.has('materiel-dizaines')) return 'Tu as compté les barres, puis les cubes.';
      if (t.has('points')) return 'Tu as compté les points un par un.';
      return FALLBACK['math.representations'] as string;
    }
    case 'fr.plural': {
      if (t.has('pluriel-gn')) return 'Tu as accordé tout le groupe du nom.';
      if (t.has('pluriel-xou')) return 'Tu t’es souvenue des noms en -oux.';
      if (t.has('pluriel-aux')) return 'Tu as bien fait -al → -aux.';
      if (t.has('pluriel-als')) return 'Tu as repéré l’exception en -s.';
      if (t.has('pluriel-eus')) return 'Tu as repéré l’exception : un « s ».';
      if (t.has('pluriel-x')) return 'Tu as pensé au « x » du pluriel.';
      if (t.has('pluriel-same')) return 'Tu as vu que le mot ne change pas.';
      return 'Tu as ajouté la marque du pluriel.';
    }
    case 'fr.spelling': {
      const sound = [...t].find((x) => SOUND_TEXT[x]);
      if (sound) return `Tu as bien écrit ${SOUND_TEXT[sound]}.`;
      if (t.has('accents')) return 'Tu as mis le bon accent.';
      if (t.has('consonne-double')) return 'Tu as pensé à la lettre double.';
      if (t.has('lettre-muette')) return 'Tu as pensé à la lettre muette.';
      return FALLBACK['fr.spelling'] as string;
    }
    case 'fr.comprehension': {
      if (t.has('inference')) return 'Tu as deviné grâce aux indices du texte.';
      if (t.has('question-pourquoi')) return 'Tu as trouvé la raison dans le texte.';
      if (t.has('question-qui')) return 'Tu as trouvé le bon personnage.';
      if (t.has('question-quand')) return 'Tu as trouvé le moment dans le texte.';
      if (t.has('question-ou')) return 'Tu as trouvé le lieu dans le texte.';
      return FALLBACK['fr.comprehension'] as string;
    }
    default:
      return 'Tu as bien réfléchi.';
  }
}
