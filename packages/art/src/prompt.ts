import type { ArtSpec, ArtStyle } from './specs';

const KIND_LINE: Record<ArtSpec['kind'], string> = {
  background: 'Photographie de décor d’arrière-plan pour un jeu éducatif destiné aux enfants',
  prop: 'Photographie d’un objet isolé pour un jeu éducatif destiné aux enfants',
  character: 'Photographie d’un vrai animal, personnage d’un jeu éducatif destiné aux enfants',
  clip: 'Clip vidéo court et réaliste pour un jeu éducatif destiné aux enfants',
};

/** Default prompt, built without AI from the style guide and the spec sheet. The parents can edit the text. */
export function buildPrompt(style: ArtStyle, spec: ArtSpec): string {
  const lines = [
    `${KIND_LINE[spec.kind]}.`,
    `Sujet : ${spec.brief}`,
    `Style : ${style.summary}`,
    `Couleurs de référence : ${style.palette.join(', ')}.`,
    `Toujours : ${style.always.join('; ')}.`,
    spec.kind === 'clip'
      ? 'Vidéo : de 2 à 6 secondes, sans son, caméra fixe, en boucle sans coupure visible (la dernière image s’enchaîne avec la première), animal entier et centré, fond uni, clair et neutre.'
      : spec.transparent
        ? 'Composition : un seul élément, entier, centré, avec une marge libre tout autour, sur un fond entièrement transparent, sans sol, sans ombre portée sur le fond et sans décor.'
        : 'Composition : image horizontale complète, sans bordures ni cadres.',
    spec.reference ? 'Utilisez l’image de référence comme modèle exact de l’animal : même pelage, mêmes couleurs, mêmes proportions et mêmes marques; changez seulement la pose demandée.' : '',
    `Ne jamais inclure : ${[...spec.mustNot, ...style.never].join('; ')}.`,
  ];
  return lines.filter(Boolean).join('\n');
}
