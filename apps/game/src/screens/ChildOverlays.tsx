import { useEffect, useRef, useState } from 'react';
import { i18n, pickLine } from '@melina/shared';
import { api, type Assignment, type Outcome } from '../api';
import { Visual } from '../components/Visual';
import { cheer, cheerAfter, sfx } from '../audio';
import { hintDelayMs } from '../hints';
import { conquestPhrase, milestonePhrase, successPhrase, almostPhrase } from '../praise';
import { Confetti } from '../games/shell';

const t = i18n.child;

export function Modal({ children, label, wide }: { children: React.ReactNode; label: string; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const first = ref.current?.querySelector<HTMLElement>('button, input, textarea, select');
    first?.focus();
  }, []);
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={label}>
      <div className={`card ${wide ? 'card-wide' : ''}`} ref={ref}>
        {children}
      </div>
    </div>
  );
}

export interface DialogAction {
  label: string;
  onClick: () => void;
  primary?: boolean;
}

export function Dialog({ title, text, actions }: { title: string; text: string; actions: DialogAction[] }) {
  return (
    <Modal label={title}>
      <div className="speaker">🦔 {title}</div>
      <p className="big-text">{text}</p>
      <div className="actions">
        {actions.map((a) => (
          <button key={a.label} className={a.primary ? 'btn primary' : 'btn'} onClick={a.onClick}>
            {a.label}
          </button>
        ))}
      </div>
    </Modal>
  );
}

export function ExerciseCard({ assignment, onDone, onClose, onStopped }: { assignment: Assignment; onDone: (a: Assignment) => void; onClose: () => void; onStopped: () => void }) {
  const ex = assignment.exercise;
  const [hint, setHint] = useState<string | null>(assignment.hintUsed ? (ex.hint ?? null) : null);
  // think before asking: the hint button appears after ~20 s with the sheet (not right away)
  const [hintReady, setHintReady] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setHintReady(true), hintDelayMs());
    return () => window.clearTimeout(id);
  }, [assignment.id]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [confirmStop, setConfirmStop] = useState(false);

  // Give up: the exercise is cancelled on the server (it does not count as a mistake or touch mastery);
  // in a mission, the step stays open and comes back with a new exercise.
  const stop = async () => {
    setBusy(true);
    setErr(null);
    try {
      await api.cancel(assignment.id);
      onStopped();
    } catch (e) {
      console.error('[papier]', (e as Error).message);
      setErr(t.sendError);
      setConfirmStop(false);
    } finally {
      setBusy(false);
    }
  };

  const askHint = async () => {
    setHint(ex.hint ?? 'Relis bien la question.');
    try {
      await api.hint(assignment.id);
    } catch {
      /* the hint stays visible even offline */
    }
  };
  const done = async () => {
    setBusy(true);
    setErr(null);
    try {
      onDone(await api.done(assignment.id));
    } catch (e) {
      console.error('[papier]', (e as Error).message);
      setErr(t.sendError);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal label="Exercice" wide>
      <div className="exercise">
        <p className="instruction">{ex.instruction}</p>
        {ex.visual && <Visual v={ex.visual} />}
        <p className="statement">{ex.statement}</p>
        <p className="paper-note">✏️ {t.writeOnPaper} ({ex.answerFormat})</p>
        {hint && (
          <div className="hint" role="note">
            <strong>💡 {t.hintTitle} :</strong> {hint}
          </div>
        )}
        {err && <p className="error">{err}</p>}
        {confirmStop ? (
          <div className="stop-confirm" role="alertdialog" aria-label={t.stopActivity}>
            <p className="big-text">🦔 {t.stopQuestion}</p>
            <div className="actions">
              <button className="btn" onClick={() => void stop()} disabled={busy} data-testid="stop-yes">
                {t.stopYes}
              </button>
              <button className="btn primary" onClick={() => setConfirmStop(false)} disabled={busy} autoFocus>
                {t.stopNo}
              </button>
            </div>
          </div>
        ) : (
          <div className="actions">
            <button className="btn stop-btn" onClick={() => setConfirmStop(true)} disabled={busy} data-testid="stop-activity">
              🚪 {t.stopActivity}
            </button>
            {!hint && ex.hint && hintReady && (
              <button className="btn" onClick={askHint} data-testid="paper-hint">
                💡 {t.hint}
              </button>
            )}
            <button className="btn" onClick={onClose}>
              {t.backToWorld}
            </button>
            <button className="btn primary" onClick={done} disabled={busy}>
              ✅ {t.doneOnPaper}
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}

export function WaitingCard({ assignment, onParents, onClose, illegibleNote }: { assignment: Assignment; onParents: () => void; onClose: () => void; illegibleNote?: boolean }) {
  return (
    <Modal label="Envoyer la réponse">
      <div className="speaker">🦔 Lila</div>
      {illegibleNote && <p className="big-text">📷 {t.illegibleChild}</p>}
      <p className="big-text">{assignment.status === 'in_review' ? t.waitingParent : t.callParent}</p>
      <p className="muted">« {assignment.exercise.statement} »</p>
      <div className="actions">
        <button className="btn" onClick={onClose}>
          {t.backToWorld}
        </button>
        <button className="btn primary" onClick={onParents}>
          👨‍👩‍👧 {t.parentsArea}
        </button>
      </div>
    </Modal>
  );
}

export function FeedbackCard({
  outcome,
  rewards,
  onNext,
  onClose,
  nextLabel,
  retryStep = false,
}: {
  retryStep?: boolean;
  outcome: Outcome;
  rewards: Array<{ key: string; label: string }>;
  onNext: (() => void) | null;
  onClose: () => void;
  nextLabel?: string;
}) {
  const ok = outcome.result === 'correct';
  const seed = outcome.attemptId.charCodeAt(0) + outcome.attemptId.charCodeAt(1);
  const missionDone = rewards.some((r) => r.key === 'garden.bloom');
  const line = ok ? pickLine(t.correctLines, seed) : pickLine(t.tryTogetherLines, seed);
  // correct on the sheet: «ta-da» with applause; mission complete (garden in bloom): the big celebration
  const mc = outcome.masteryChange;
  const levelUp = ok && mc && mc.levelAfter > mc.levelBefore ? mc.levelAfter : null;
  const conquered = ok ? outcome.conquered : null;
  const big = missionDone || levelUp !== null || conquered !== null;
  // proportional celebration: correct = little bell; mission complete or new level = big celebration
  useEffect(() => {
    if (!ok) return;
    const p = levelUp ? milestonePhrase() : conquered ? conquestPhrase(conquered.label) : successPhrase({ strategy: outcome.praise, afterError: outcome.help !== 'none', hard: false, streak: 0 }).spoken;
    // milestone: full applause, then the sentence (as at the end of activities); simple correct answer: little bell and sentence
    if (big) cheerAfter('celebrate', p);
    else {
      sfx.chime();
      cheer(p, '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ok, big]);
  return (
    <Modal label="Résultat">
      {ok && <Confetti fixed big={big} small={!big} />}
      <div className={`feedback ${ok ? 'ok' : 'retry'}`}>
        <h2>{ok ? `🌟 ${t.correctTitle}` : `🤝 ${t.tryTogetherTitle}`}</h2>
        <p className="big-text">{line}</p>
        {ok && outcome.praise && <p className="praise">🌟 {outcome.praise}</p>}
        {levelUp && <p className="reward big">🚀 Nouveau niveau {levelUp}!</p>}
        {conquered && <p className="reward big">🌟 Point fort gagné : {conquered.label}!</p>}
        {ok && !conquered && outcome.almost && <p className="reward">🌱 {almostPhrase(outcome.almost.label)}</p>}
        {!ok && outcome.errorMessage && <p className="hint">💡 {outcome.errorMessage}</p>}
        <p className="explanation">{outcome.explanation}</p>
        {!ok && (
          <p>
            {t.theAnswerWas} <strong>{outcome.correctAnswerDisplay}</strong>
          </p>
        )}
        {rewards.filter((r) => r.key.startsWith('seed.')).map((r) => (
          <p key={r.key} className="reward">
            🌱 {t.stepDone} Tu as trouvé {r.label}!
          </p>
        ))}
        {retryStep && <p className="reward">🌱 La graine t’attend : on réessaie cette étape avec une nouvelle question.</p>}
        {missionDone && <p className="reward big">🌻 {t.missionDone} Le potager fleurit!</p>}
        <div className="actions">
          <button className="btn" onClick={onClose}>
            {t.backToWorld}
          </button>
          {onNext && (
            <button className="btn primary" onClick={onNext}>
              {nextLabel ?? t.nextActivity} ➜
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
