import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { i18n, type MissionDefinition, type Subject } from '@melina/shared';
import { api, type Assignment, type ConfirmResponse, type GameProgress, type Outcome } from './api';
import { GameBridge, type PointId } from './game/bridge';
import { PhaserGame } from './game/PhaserGame';
import { waitingAt, waitingPoints } from './game/waiting';
import { Dialog, ExerciseCard, FeedbackCard, WaitingCard, type DialogAction } from './screens/ChildOverlays';
import { ParentArea } from './screens/ParentArea';
import { Home } from './screens/Home';
import { gameScreens } from './games';

const t = i18n.child;
const MISSION_ID = 'garden-seeds';

type Overlay =
  | { kind: 'dialog'; title: string; text: string; actions: DialogAction[] }
  | { kind: 'exercise'; assignment: Assignment }
  | { kind: 'waiting'; assignment: Assignment; illegible?: boolean }
  | { kind: 'feedback'; outcome: Outcome; rewards: Array<{ key: string; label: string }>; assignment: Assignment }
  | { kind: 'loading' }
  | null;

type MissionInfo = MissionDefinition & { state: { status: string; nextStep: number | null; completedSteps: number[] } };

const pointSubject: Record<Exclude<PointId, 'lila'>, Subject | undefined> = { shed: 'mathematics', well: 'french', bed: undefined };

export function App() {
  const [view, setView] = useState<'home' | 'world' | 'game'>('home');
  const [gameId, setGameId] = useState('game.apple-crates');
  const GameScreen = gameScreens[gameId];
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [parent, setParent] = useState<{ assignmentId?: string } | null>(null);
  const [mission, setMission] = useState<MissionInfo | null>(null);
  const [progress, setProgress] = useState<GameProgress | null>(null);
  // paper sheets still open (a waiting sheet is shown on its station, never as a pop-up on entering)
  const [pending, setPending] = useState<Assignment[]>([]);
  const [health, setHealth] = useState<{ ok: boolean; ai: { keyConfigured: boolean; enabled: boolean } } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sessions = useRef<{ mission?: string; practice: Partial<Record<Subject | 'any', string>> }>({ practice: {} });
  const bridge = useMemo(() => new GameBridge(), []);

  const refresh = useCallback(async () => {
    const [ms, gp, pd] = await Promise.all([api.missions(), api.gameProgress(), api.pending().catch(() => null)]);
    const m = (ms as MissionInfo[]).find((x) => x.id === MISSION_ID) ?? null;
    setMission(m);
    setProgress(gp);
    if (pd) setPending(pd);
    return { m, gp, pd: pd ?? [] };
  }, []);

  // server down at startup: the error screen has «Réessayer» (before, it stayed stuck until the page was reloaded)
  const connect = useCallback(() => {
    // the error only leaves the screen once the server answers (no flash of the home screen while it is still down)
    api
      .health()
      .then((h) => {
        setHealth(h);
        setError(null);
      })
      .catch(() => setError(t.serverDown));
    refresh().catch(() => undefined);
  }, [refresh]);
  useEffect(() => connect(), [connect]);

  // World: current objective and rewards
  useEffect(() => {
    if (!mission || !progress) return;
    const st = mission.state;
    const waiting = waitingPoints(pending, mission.steps);
    let objective: PointId | null = null;
    let text = '';
    if (st.status === 'not-started') {
      objective = 'lila';
      text = `⭐ ${t.goTalk} Lila!`;
    } else if (st.status === 'active' && st.nextStep !== null) {
      const step = mission.steps[st.nextStep];
      objective = (step?.pointId as PointId) ?? null;
      text = objective && waiting.includes(objective) ? '✏️ Ta feuille attend un parent. Tu peux jouer ailleurs!' : `⭐ Graine ${st.nextStep + 1}/3 : ${step?.title ?? ''}`;
    } else {
      text = '🌻 Le potager a fleuri! Remise = maths, puits = français.';
    }
    bridge.setView({
      rewards: progress.rewards.map((r) => r.key),
      objective,
      objectiveText: text,
      start: progress.state.x != null && progress.state.y != null ? { x: progress.state.x, y: progress.state.y } : undefined,
      waiting,
    });
  }, [mission, progress, pending, bridge]);

  // Pause the controls while a dialog is open
  useEffect(() => {
    bridge.setControls(view === 'world' && overlay === null && parent === null);
  }, [overlay, parent, view, bridge]);

  const showAssignment = useCallback((a: Assignment) => {
    if (a.status === 'presented') setOverlay({ kind: 'exercise', assignment: a });
    else if (['answered_on_paper', 'in_review', 'illegible'].includes(a.status)) setOverlay({ kind: 'waiting', assignment: a, illegible: a.status === 'illegible' });
    else setOverlay(null);
  }, []);

  // the child never sees the server's technical message («Séance introuvable», «Erreur 502»): only a gentle sentence
  const fail = useCallback((e: unknown) => {
    console.error('[jardin]', (e as Error)?.message);
    const code = (e as { code?: string })?.code;
    // server messages written for her (simple French) pass through; the rest becomes a gentle sentence
    const SAFE = new Set(['step-not-available']);
    const text = code === 'offline' ? t.serverDown : code && SAFE.has(code) ? (e as Error).message : 'Oups! Ça n’a pas marché. Réessaie dans un instant.';
    setOverlay({ kind: 'dialog', title: 'Oups', text, actions: [{ label: t.close, onClick: () => setOverlay(null), primary: true }] });
  }, []);

  const missionSession = useCallback(async () => {
    if (!sessions.current.mission) sessions.current.mission = (await api.startSession({ mode: 'mission', missionId: MISSION_ID })).id;
    return sessions.current.mission;
  }, []);

  const startStep = useCallback(
    async (stepIndex: number) => {
      setOverlay({ kind: 'loading' });
      try {
        const sid = await missionSession();
        showAssignment(await api.createAssignment({ sessionId: sid, missionStep: stepIndex }));
      } catch (e) {
        fail(e);
      }
    },
    [missionSession, showAssignment, fail],
  );

  const startPractice = useCallback(
    async (subject?: Subject) => {
      setOverlay({ kind: 'loading' });
      try {
        const key = subject ?? 'any';
        if (!sessions.current.practice[key]) sessions.current.practice[key] = (await api.startSession({ mode: 'practice', subject })).id;
        showAssignment(await api.createAssignment({ sessionId: sessions.current.practice[key] as string, subject }));
      } catch (e) {
        fail(e);
      }
    },
    [showAssignment, fail],
  );

  const onInteract = useCallback(
    async (id: PointId) => {
      // server down: a gentle message (before, pressing Space near Lila did nothing)
      let m: MissionInfo | null;
      let pd: Assignment[];
      try {
        ({ m, pd } = await refresh());
      } catch (e) {
        fail(e);
        return;
      }
      if (!m) return;
      const st = m.state;
      const close = () => setOverlay(null);
      // a sheet waiting for a parent at this station: a calm card, only when she comes here
      const sheet = id === 'lila' ? null : waitingAt(pd, m.steps, id);
      if (sheet) {
        setOverlay({ kind: 'waiting', assignment: sheet, illegible: sheet.status === 'illegible' });
        return;
      }
      const nextPoint = st.nextStep !== null ? (m.steps[st.nextStep]?.pointId as PointId | undefined) : undefined;
      const nextWaits = nextPoint !== undefined && waitingAt(pd, m.steps, nextPoint) !== null;
      if (id === 'lila') {
        if (st.status === 'not-started') {
          setOverlay({
            kind: 'dialog',
            title: 'Lila',
            text: m.intro,
            actions: [
              {
                label: 'Oui, je t’aide!',
                primary: true,
                onClick: async () => {
                  try {
                    await missionSession();
                    await refresh();
                    setOverlay({ kind: 'dialog', title: 'Lila', text: `Merci! Commence par ${m.steps[0]?.title.toLowerCase()}. Suis l’étoile!`, actions: [{ label: 'D’accord', primary: true, onClick: close }] });
                  } catch (e) {
                    fail(e);
                  }
                },
              },
              { label: 'Plus tard', onClick: close },
            ],
          });
        } else if (st.status === 'completed') {
          setOverlay({ kind: 'dialog', title: 'Lila', text: m.outro, actions: [{ label: t.close, primary: true, onClick: close }] });
        } else {
          const next = st.nextStep !== null ? m.steps[st.nextStep] : null;
          const text = nextWaits ? 'Ta feuille attend un parent. En attendant, tu peux faire un petit défi à la remise ou au puits!' : next ? `Tu y es presque! La prochaine graine est à : ${next.title}.` : 'Merci!';
          setOverlay({ kind: 'dialog', title: 'Lila', text, actions: [{ label: 'D’accord', primary: true, onClick: close }] });
        }
        return;
      }
      const stepIndex = m.steps.findIndex((s) => s.pointId === id);
      const step = m.steps[stepIndex];
      const practiceAction = (label = 'Pratiquer ici'): DialogAction => ({ label, primary: true, onClick: () => startPractice(pointSubject[id]) });
      if (st.status === 'not-started') {
        setOverlay({ kind: 'dialog', title: step?.title ?? '', text: 'Va d’abord parler à Lila, la hérissonne. Elle a besoin d’aide!', actions: [{ label: t.close, primary: true, onClick: close }] });
      } else if (st.status === 'completed') {
        setOverlay({ kind: 'dialog', title: step?.title ?? '', text: 'Le potager est prêt! Veux-tu faire un petit défi ici?', actions: [practiceAction('Oui!'), { label: 'Non merci', onClick: close }] });
      } else if (st.completedSteps.includes(stepIndex)) {
        setOverlay({ kind: 'dialog', title: step?.title ?? '', text: 'Tu as déjà trouvé la graine ici! Bravo!', actions: [{ label: t.close, primary: true, onClick: close }, { label: 'Pratiquer ici', onClick: () => startPractice(pointSubject[id]) }] });
      } else if (st.nextStep === stepIndex && step) {
        setOverlay({ kind: 'dialog', title: step.title, text: step.intro, actions: [{ label: 'Commencer', primary: true, onClick: () => startStep(stepIndex) }, { label: 'Plus tard', onClick: close }] });
      } else if (nextWaits && pointSubject[id]) {
        // the story waits for a parent: she can still play here meanwhile
        setOverlay({ kind: 'dialog', title: step?.title ?? '', text: 'Ta feuille attend un parent. En attendant, veux-tu faire un petit défi ici?', actions: [practiceAction('Oui!'), { label: 'Non merci', onClick: close }] });
      } else {
        const next = st.nextStep !== null ? m.steps[st.nextStep] : null;
        setOverlay({ kind: 'dialog', title: step?.title ?? '', text: `Pas encore! Va d’abord à : ${next?.title ?? ''}. Suis l’étoile!`, actions: [{ label: 'D’accord', primary: true, onClick: close }] });
      }
    },
    [refresh, missionSession, startStep, startPractice, fail],
  );

  useEffect(() => {
    const offs = [
      bridge.onGame('interact', (id) => void onInteract(id)),
      bridge.onGame('position', (pos) => void api.saveGameState(pos).catch(() => undefined)),
      // entering the garden only refreshes the map (before, it re-opened a waiting sheet as a pop-up)
      bridge.onGame('ready', () => void refresh().catch(() => undefined)),
    ];
    return () => offs.forEach((o) => o());
  }, [bridge, onInteract, refresh]);

  const onConfirmed = useCallback(
    async (r: ConfirmResponse) => {
      setParent(null);
      await refresh().catch(() => undefined); // the result already came in the response: show it even without refreshing the world
      if (view !== 'world') setView('world');
      if (r.outcome === 'evaluated' && r.result) setOverlay({ kind: 'feedback', outcome: r.result, rewards: r.rewards, assignment: r.assignment });
      else setOverlay({ kind: 'waiting', assignment: r.assignment, illegible: true });
    },
    [refresh, view],
  );

  const closeParent = useCallback(async () => {
    setParent(null);
    await refresh().catch(() => undefined);
  }, [refresh]);

  const nextAfterFeedback = (o: Extract<Overlay, { kind: 'feedback' }>) => {
    const a = o.assignment;
    if (a.missionId) {
      const st = mission?.state;
      // the same step comes back RIGHT AWAY with a new question (before, the button only closed the card)
      const step = a.missionStep ?? st?.nextStep ?? null;
      if (o.outcome.result !== 'correct') return { label: 'On réessaie cette étape', go: () => (step !== null ? void startStep(step) : setOverlay(null)) };
      if (st && st.status === 'active' && st.nextStep !== null) return { label: 'Prochaine graine', go: () => setOverlay(null) };
      return null;
    }
    return { label: t.nextActivity, go: () => startPractice(a.exercise.subject) };
  };

  if (error) {
    return (
      <div className="home" lang="fr-CA">
        <h1>🌻 {t.appTitle}</h1>
        <p className="error big-text">{error}</p>
        <button className="btn" onClick={connect} data-testid="retry-connect">
          Réessayer
        </button>
      </div>
    );
  }

  return (
    <div className="app" lang="fr-CA">
      {view === 'home' && (
        <Home
          health={health}
          onGame={(id) => {
            if (!gameScreens[id]) return;
            setGameId(id);
            setView('game');
          }}
          onWorld={() => setView('world')}
          onPractice={(subject) => {
            setView('world');
            void startPractice(subject);
          }}
          onParents={() => setParent({})}
        />
      )}

      {view === 'game' && GameScreen && <GameScreen onExit={() => setView('home')} />}

      {view === 'world' && (
        <div className="world">
          <div className="world-bar">
            <button className="btn small" onClick={() => setView('home')}>
              🏠
            </button>
            <span className="muted">{t.moveHelp}</span>
            <span className="seeds">
              {t.seedsFound}: {progress?.rewards.filter((r) => r.key.startsWith('seed.')).length ?? 0}/3
            </span>
            <button className="btn small" onClick={() => setParent({})}>
              👨‍👩‍👧 {t.parentsArea}
            </button>
          </div>
          <PhaserGame bridge={bridge} />
        </div>
      )}

      {overlay?.kind === 'loading' && (
        <div className="overlay">
          <div className="card">
            <p className="big-text">🌱 …</p>
          </div>
        </div>
      )}
      {overlay?.kind === 'dialog' && <Dialog title={overlay.title} text={overlay.text} actions={overlay.actions} />}
      {overlay?.kind === 'exercise' && (
        <ExerciseCard
          assignment={overlay.assignment}
          onClose={() => setOverlay(null)}
          onDone={(a) => {
            setOverlay({ kind: 'waiting', assignment: a });
            void refresh().catch(() => undefined); // the station shows the waiting sheet after the card closes
          }}
          onStopped={() => {
            setOverlay(null);
            void refresh().catch(() => undefined); // the mission stays on the same step
          }}
        />
      )}
      {overlay?.kind === 'waiting' && (
        <WaitingCard
          assignment={overlay.assignment}
          illegibleNote={overlay.illegible}
          onClose={() => setOverlay(null)}
          onParents={() => setParent({ assignmentId: overlay.assignment.id })}
          onMore={overlay.assignment.missionId ? undefined : () => void startPractice(overlay.assignment.exercise.subject)}
        />
      )}
      {overlay?.kind === 'feedback' &&
        (() => {
          const next = nextAfterFeedback(overlay);
          return <FeedbackCard outcome={overlay.outcome} rewards={overlay.rewards} retryStep={Boolean(overlay.assignment.missionId) && overlay.outcome.result !== 'correct'} onClose={() => setOverlay(null)} onNext={next ? next.go : null} nextLabel={next?.label} />;
        })()}

      {parent && <ParentArea initialAssignmentId={parent.assignmentId} onClose={closeParent} onConfirmed={onConfirmed} />}
    </div>
  );
}
