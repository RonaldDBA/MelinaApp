/**
 * Centralized texts.
 * - `child`: Melina's experience (français québécois).
 * - `parent`: the guardians' panel, now also in Canadian French (fr-CA), addressing the parents as « vous ».
 */

export const child = {
  appTitle: 'Le jardin de Melina',
  continueAdventure: 'Continuer l’aventure',
  practiceFrench: 'Pratiquer le français',
  practiceMath: 'Pratiquer les mathématiques',
  parentsArea: 'Espace parents',
  moveHelp: 'Flèches ou W A S D pour marcher. Espace ou E pour parler. Tu peux aussi cliquer.',
  hint: 'Un indice ?',
  hintTitle: 'Indice',
  doneOnPaper: 'J’ai terminé sur papier',
  writeOnPaper: 'Écris ta réponse sur ta feuille.',
  callParent: 'Bravo pour ton travail ! Appelle un parent pour envoyer ta réponse.',
  waitingParent: 'Un parent regarde ta réponse…',
  correctTitle: 'Bravo !',
  correctLines: ['Tu as réussi !', 'C’est exactement ça !', 'Super travail !'],
  tryTogetherTitle: 'On essaie ensemble.',
  tryTogetherLines: ['Regardons ensemble.', 'Ce n’est pas grave, on apprend.', 'On va pratiquer encore.'],
  theAnswerWas: 'La réponse était :',
  nextActivity: 'Activité suivante',
  backToWorld: 'Retour au jardin',
  stepDone: 'Tu as terminé cette étape !',
  missionDone: 'Mission accomplie !',
  illegibleChild: 'On va reprendre la photo. Ce n’est pas ta faute !',
  close: 'Fermer',
  aiOffline: 'Mode sans Internet',
  goTalk: 'Va parler à',
  seedsFound: 'Graines trouvées',
  // Errors seen by the child: always in French and with no technical detail (the detail goes to the console).
  serverDown: 'Le jeu ne répond pas. Demande à un parent de fermer le jeu et de l’ouvrir de nouveau.',
  levelUp: 'Ça monte d’un cran!',
  gameLoadError: 'Le jeu n’a pas pu commencer.',
  sendError: 'Ta réponse n’est pas partie. Réessaie dans un instant.',
  // Giving up a paper activity (does not count as an error; the mission step stays available)
  stopActivity: 'J’arrête',
  stopQuestion: 'Tu veux arrêter cette activité? Ce n’est pas grave : tu pourras en faire une autre plus tard.',
  stopYes: 'Oui, j’arrête',
  stopNo: 'Non, je continue',
  progressSaved:'Tes progrès sont gardés dans l’ordinateur.',
  // Status line of the home screen
  statusOk: 'Jeu prêt',
  statusConnecting: 'Connexion…',
  statusAi: 'Lecture par IA',
  statusAiOn: 'activée',
  statusAiOff: 'saisie à la main',
  statusVoice: 'Voix',
  statusVoiceNotCanadian: '(pas du Canada)',
  statusNoVoice: 'aucune voix française dans ce navigateur',
} as const;

export const parent = {
  areaTitle: 'Espace parents',
  gateTitle: 'Espace parents',
  gateExplain:
    'Ce blocage sert seulement à éviter que l’enfant entre ici par erreur. Ce n’est pas un mot de passe et il ne protège pas les données.',
  gateQuestion: 'Combien font',
  enter: 'Entrer',
  back: 'Retour',
  pendingTitle: 'Réponses à vérifier',
  noPending: 'Aucune réponse en attente de vérification.',
  sendPhoto: 'Envoyer la photo de la réponse',
  choosePhoto: 'Choisir une photo',
  photoTip: 'Photographiez seulement la réponse, avec un bon éclairage et la feuille bien droite. Évitez les visages et les autres pages.',
  retakePhoto: 'Changer de photo',
  uploadPhoto: 'Utiliser cette photo',
  typeManually: 'Saisir la réponse à la main',
  readWithAi: 'Lire avec l’IA (Claude)',
  aiDisabled: 'Lecture par IA désactivée ou non configurée — utilisez la transcription manuelle.',
  reading: 'Lecture de l’image…',
  confirmTitle: 'Confirmez ce que Melina a écrit',
  confirmRule:
    'Confirmez exactement ce qui est écrit, même si la réponse est fausse. La correction scolaire vient ensuite.',
  transcription: 'Transcription',
  uncertain: 'Passages incertains',
  modelConfidence: 'Confiance déclarée par le modèle (signal d’appoint, ce n’est pas une probabilité)',
  helpQuestion: 'A-t-elle reçu de l’aide pour résoudre?',
  helpNone: 'A fait seule',
  helpHint: 'A utilisé l’indice de l’app',
  helpAdult: 'Un adulte a aidé à résoudre',
  saveSample: 'Garder cette photo comme exemple d’écriture',
  allowExternal: 'Permettre d’envoyer cet exemple à l’IA lors de lectures futures',
  confirm: 'Confirmer la lecture',
  illegible: 'Illisible',
  cancel: 'Annuler',
  dashboard: 'Tableau de bord',
  history: 'Historique',
  skills: 'Compétences',
  reviews: 'Prochaines révisions',
  samples: 'Exemples d’écriture',
  settings: 'IA et données',
  practiceChoice: 'Choisir la prochaine activité',
} as const;

/** Name of each subject (parents' area and report). */
export const subjectName = { french: 'Français', mathematics: 'Mathématiques', english: 'Anglais' } as const;
/** CSS class of each subject's cards. */
export const subjectClass = { french: 'fr', mathematics: 'ma', english: 'en' } as const;

export function pickLine(lines: readonly string[], seed: number): string {
  return lines[Math.abs(seed) % lines.length] ?? lines[0] ?? '';
}
