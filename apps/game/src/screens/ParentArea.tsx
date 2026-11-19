import { voiceInfo } from '../audio';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArtStudio } from './ArtStudio';
import { i18n, type HelpLevel } from '@melina/shared';
import { Kpi, Report, SKILL_ICON } from './Report';
import { fmtDate, fmtDateTime, fmtDay, fmtTime } from '../dates';
import { api, ApiError, type Assignment, type ConfirmResponse, type LearnedSkill, type Review, type Settings, type SkillProgress } from '../api';
import { Visual } from '../components/Visual';

const p = i18n.parent;
type Tab = 'review' | 'dashboard' | 'report' | 'history' | 'samples' | 'art' | 'settings';
const TAB_ICON: Record<Tab, string> = { review: '✅', dashboard: '📊', report: '📒', history: '🕰️', samples: '✍️', art: '🎨', settings: '🤖' };

// ------------------------------------------------------------------ gate

function Gate({ onPass, onClose }: { onPass: () => void; onClose: () => void }) {
  const [q] = useState(() => ({ a: 6 + Math.floor(Math.random() * 4), b: 6 + Math.floor(Math.random() * 4) }));
  const [v, setV] = useState('');
  const [err, setErr] = useState(false);
  return (
    <div className="parent-gate">
      <h2>{p.gateTitle}</h2>
      <p className="muted">{p.gateExplain}</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (Number(v) === q.a * q.b) onPass();
          else setErr(true);
        }}
      >
        <label>
          {p.gateQuestion} {q.a} × {q.b}?{' '}
          <input autoFocus inputMode="numeric" value={v} onChange={(e) => setV(e.target.value)} aria-label="Réponse" className="input-small" />
        </label>
        {err && <p className="error">Réponse incorrecte.</p>}
        <div className="actions">
          <button type="button" className="btn" onClick={onClose}>
            {p.back}
          </button>
          <button type="submit" className="btn primary">
            {p.enter}
          </button>
        </div>
      </form>
    </div>
  );
}

// ------------------------------------------------------------------ image

async function normalizeImage(file: File): Promise<Blob> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Utilisez une photo JPEG, PNG ou WebP.');
  if (file.size > 25 * 1024 * 1024) throw new Error('Photo trop lourde (maximum 25 Mo avant la réduction).');
  // Fixes the orientation (EXIF) and downsizes; the new file carries no metadata (location etc.).
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Impossible de traiter l’image.');
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Échec de la conversion de l’image.'))), 'image/jpeg', 0.88));
}

function PhotoView({ photoId }: { photoId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let u: string | null = null;
    let alive = true;
    api
      .photoUrl(photoId)
      .then((x) => {
        u = x;
        if (alive) setUrl(x);
      })
      .catch(() => setUrl(null));
    return () => {
      alive = false;
      if (u) URL.revokeObjectURL(u);
    };
  }, [photoId]);
  return url ? <img className="answer-photo" src={url} alt="Photo de la réponse" /> : <div className="answer-photo placeholder">Chargement de la photo…</div>;
}

// ------------------------------------------------------------------ review

const openStatuses = ['pending', 'suggested', 'failed', 'analyzing'];

function ReviewFlow({ assignmentId, settings, onConfirmed, onBack }: { assignmentId: string; settings: Settings | null; onConfirmed: (r: ConfirmResponse) => void; onBack: () => void }) {
  const [a, setA] = useState<Assignment | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [preview, setPreview] = useState<{ blob: Blob; url: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [help, setHelp] = useState<HelpLevel | null>(null);
  const [saveSample, setSaveSample] = useState(false);
  const [allowExternal, setAllowExternal] = useState(false);
  const [quality, setQuality] = useState(2);
  const [done, setDone] = useState<ConfirmResponse | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    const x = await api.assignment(assignmentId);
    setA(x);
    const open = [...x.reviews].reverse().find((r) => openStatuses.includes(r.status)) ?? null;
    setReview(open);
    if (open) setText(open.draftText ?? open.suggestedText ?? '');
    if (x.hintUsed) setHelp((h) => h ?? 'hint');
  }, [assignmentId]);

  useEffect(() => {
    load().catch((e) => setErr((e as Error).message));
  }, [load]);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview.url);
    },
    [preview],
  );

  const aiReady = Boolean(settings?.['ai.enabled'] && settings?.aiKeyConfigured);

  const pick = async (f: File | undefined) => {
    if (!f) return;
    setErr(null);
    try {
      const blob = await normalizeImage(f);
      setPreview({ blob, url: URL.createObjectURL(blob) });
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  const upload = async () => {
    if (!preview) return;
    setBusy('upload');
    setErr(null);
    try {
      const r = await api.uploadPhoto(assignmentId, preview.blob);
      setReview(r.review);
      setText(r.review.draftText ?? r.review.suggestedText ?? '');
      setPreview(null);
      if (r.duplicate) setNotice('Cette photo avait déjà été envoyée — la même lecture est réutilisée.');
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  const manual = async () => {
    setBusy('manual');
    setErr(null);
    try {
      if (review) {
        setReview({ ...review });
      } else {
        const r = await api.manual(assignmentId);
        setReview(r.review);
        setText(r.review.draftText ?? '');
      }
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  const analyze = async () => {
    if (!review) return;
    setBusy('analyze');
    setErr(null);
    try {
      const r = await api.analyze(review.id);
      setReview(r);
      if (r.status === 'suggested') setText(r.suggestedText ?? '');
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'La lecture a échoué. Utilisez la transcription manuelle.');
    } finally {
      setBusy(null);
    }
  };
  const confirm = async (illegible: boolean) => {
    if (!review) return;
    if (!illegible && !help) {
      setErr('Indiquez si Melina a reçu de l’aide pour résoudre.');
      return;
    }
    if (!illegible && !text.trim()) {
      setErr('Saisissez exactement ce qui est écrit ou marquez la réponse comme illisible.');
      return;
    }
    setBusy('confirm');
    setErr(null);
    try {
      const r = await api.confirm(review.id, illegible ? { illegible: true } : { text: text.trim(), help: help ?? 'none', saveSample, allowExternal: saveSample && allowExternal, quality });
      if (r.outcome === 'illegible') {
        setReview(null);
        setText('');
        setNotice('Marqué comme illisible. Cela NE compte PAS comme une erreur de Melina. Prenez une autre photo ou saisissez la réponse.');
        await load();
      } else setDone(r);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  const cancelAssignment = async () => {
    setBusy('cancel');
    try {
      await api.cancel(assignmentId);
      onBack();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  if (!a) return <p>{err ?? 'Chargement…'}</p>;
  const ex = a.exercise;

  if (done?.result) {
    const r = done.result;
    return (
      <section className="review-done">
        <h3>Réponse enregistrée</h3>
        <p>
          Écrit : <strong>{r.confirmedAnswer}</strong> — {r.result === 'correct' ? '✅ correcte' : '❌ incorrecte'} (attendu : {r.correctAnswerDisplay})
        </p>
        {r.errorType && <p className="muted">Type d’erreur relevé : {r.errorType}</p>}
        <p className="muted">
          Origine de la transcription : {r.transcriptionSource === 'manual' ? 'saisie par les parents' : r.transcriptionSource === 'ai' ? 'lecture de l’IA confirmée' : 'lecture de l’IA corrigée par les parents'} · Aide :{' '}
          {r.help === 'none' ? 'aucune' : r.help === 'hint' ? 'indice de l’app' : 'adulte'}
        </p>
        {r.masteryChange && (
          <p className="muted">
            Maîtrise estimée : {Math.round(r.masteryChange.before * 100)}% → {Math.round(r.masteryChange.after * 100)}% · {r.masteryChange.reason}
          </p>
        )}
        <div className="actions">
          <button className="btn primary" onClick={() => onConfirmed(done)}>
            Montrer le résultat à Melina
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="review-flow">
      <div className="review-grid">
        <div>
          <h3>Exercice</h3>
          <p className="muted">{ex.instruction}</p>
          {ex.visual && ex.visual.kind !== 'text' && <Visual v={ex.visual} />}
          {ex.visual?.kind === 'text' && <p className="muted">Texte : « {ex.visual.title} »</p>}
          <p className="statement-small">{ex.statement}</p>
          <p className="muted">
            Réponse attendue : {ex.answerFormat} · Niveau {ex.difficulty} · {a.selectionReason}
          </p>
        </div>
        <div>
          {review?.photoId ? <PhotoView photoId={review.photoId} /> : preview ? <img className="answer-photo" src={preview.url} alt="Aperçu de la photo" /> : null}
        </div>
      </div>

      {notice && <p className="notice">{notice}</p>}
      {err && <p className="error">{err}</p>}

      {!review && (
        <div className="photo-step">
          <h3>{p.sendPhoto}</h3>
          <p className="muted">{p.photoTip}</p>
          {!preview ? (
            <div className="actions left">
              <label className="btn primary file-btn">
                📷 {p.choosePhoto}
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => pick(e.target.files?.[0])} hidden data-testid="photo-input" />
              </label>
              <button className="btn" onClick={manual} disabled={busy !== null}>
                ⌨️ {p.typeManually}
              </button>
            </div>
          ) : (
            <div className="actions left">
              <button className="btn" onClick={() => setPreview(null)}>
                {p.retakePhoto}
              </button>
              <button className="btn primary" onClick={upload} disabled={busy !== null}>
                {busy === 'upload' ? 'Envoi…' : p.uploadPhoto}
              </button>
            </div>
          )}
        </div>
      )}

      {review && (
        <div className="confirm-step">
          {review.source === 'photo' && review.status !== 'suggested' && (
            <div className="actions left">
              <button className="btn" onClick={analyze} disabled={!aiReady || busy !== null} title={aiReady ? '' : p.aiDisabled}>
                🤖 {busy === 'analyze' ? p.reading : p.readWithAi}
              </button>
              {!aiReady && <span className="muted">{p.aiDisabled}</span>}
            </div>
          )}
          {review.status === 'failed' && <p className="error">La lecture par l’IA a échoué : {review.errorMessage} — saisissez la réponse ci-dessous.</p>}

          <h3>{p.confirmTitle}</h3>
          <p className="rule">{p.confirmRule}</p>
          <label className="field">
            {p.transcription}
            <input className="input-big" value={text} onChange={(e) => setText(e.target.value)} onBlur={() => review && api.saveDraft(review.id, text).catch(() => undefined)} maxLength={500} data-testid="transcription" />
          </label>
          {review.readingOrigin === 'ai' && (
            <div className="ai-info">
              {review.uncertain.length > 0 && (
                <p>
                  ⚠️ {p.uncertain}: {review.uncertain.join(' · ')}
                </p>
              )}
              <p className="muted">
                {p.modelConfidence}: {review.modelConfidence} · modèle {review.model}
                {review.samplesUsed.length > 0 && ` · ${review.samplesUsed.length} exemple(s) d’écriture utilisé(s)`}
              </p>
            </div>
          )}

          <fieldset className="field">
            <legend>{p.helpQuestion}</legend>
            {(
              [
                ['none', p.helpNone],
                ['hint', p.helpHint],
                ['adult', p.helpAdult],
              ] as Array<[HelpLevel, string]>
            ).map(([v, label]) => (
              <label key={v} className="radio">
                <input type="radio" name="help" checked={help === v} onChange={() => setHelp(v)} /> {label}
              </label>
            ))}
            <p className="muted small">Corriger la lecture de l’écriture n’est pas une aide : cochez une aide seulement si quelqu’un a aidé à résoudre.</p>
          </fieldset>

          {review.hasPhoto && (
            <fieldset className="field">
              <legend>Écriture</legend>
              <label className="check">
                <input type="checkbox" checked={saveSample} onChange={(e) => setSaveSample(e.target.checked)} /> {p.saveSample}
              </label>
              {saveSample && (
                <>
                  <label className="check">
                    <input type="checkbox" checked={allowExternal} onChange={(e) => setAllowExternal(e.target.checked)} /> {p.allowExternal}
                  </label>
                  <label className="check">
                    Qualité de la photo :{' '}
                    <select value={quality} onChange={(e) => setQuality(Number(e.target.value))}>
                      <option value={3}>bonne</option>
                      <option value={2}>moyenne</option>
                      <option value={1}>faible</option>
                    </select>
                  </label>
                </>
              )}
            </fieldset>
          )}

          <div className="actions left">
            <button className="btn primary" onClick={() => confirm(false)} disabled={busy !== null} data-testid="confirm">
              ✔ {p.confirm}
            </button>
            <button className="btn" onClick={() => confirm(true)} disabled={busy !== null}>
              {p.illegible}
            </button>
            {review.source === 'photo' && (
              <label className="btn file-btn">
                {p.retakePhoto}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  hidden
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    setReview(null);
                    await pick(f);
                  }}
                />
              </label>
            )}
          </div>
        </div>
      )}
      <div className="actions left footer-actions">
        <button className="btn" onClick={onBack}>
          {p.back}
        </button>
        <button className="btn danger-outline" onClick={cancelAssignment} disabled={busy !== null}>
          Annuler cet exercice
        </button>
      </div>
    </section>
  );
}

function PendingList({ onOpen }: { onOpen: (id: string) => void }) {
  const [items, setItems] = useState<Assignment[] | null>(null);
  useEffect(() => {
    api.pending().then(setItems).catch(() => setItems([]));
  }, []);
  if (!items) return <p>Chargement…</p>;
  const waiting = items.filter((i) => i.status !== 'presented');
  if (!waiting.length) return <p className="muted">{p.noPending}</p>;
  return (
    <ul className="list">
      {waiting.map((i) => (
        <li key={i.id}>
          <span>
            <strong>{i.exercise.statement}</strong>
            <br />
            <span className="muted">
              {statusPt[i.status]} · {fmtDateTime(i.createdAt)}
            </span>
          </span>
          <button className="btn primary" onClick={() => onOpen(i.id)}>
            Vérifier
          </button>
        </li>
      ))}
    </ul>
  );
}

const statusPt: Record<string, string> = {
  presented: 'présenté',
  answered_on_paper: 'répondu sur papier',
  in_review: 'en vérification',
  confirmed: 'confirmé',
  illegible: 'image illisible — à refaire',
  cancelled: 'annulé',
};

// ------------------------------------------------------------------ dashboard

function pct(n: number | undefined) {
  return `${Math.round((n ?? 0) * 100)}%`;
}

function Dashboard() {
  const [data, setData] = useState<{ skills: SkillProgress[]; totals: Record<string, number>; learned: LearnedSkill[] } | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [choice, setChoice] = useState({ skillId: '', difficulty: '' });
  const reload = useCallback(() => {
    api.progress().then(setData).catch(() => undefined);
    api.settings().then(setSettings).catch(() => undefined);
  }, []);
  useEffect(reload, [reload]);
  if (!data) return <p>Chargement…</p>;
  const reviews = data.skills.filter((s) => s.state?.nextReviewAt).sort((a, b) => String(a.state?.nextReviewAt).localeCompare(String(b.state?.nextReviewAt)));
  return (
    <section className="pa-page">
      <div className="rp-kpis">
        <Kpi emoji="🎯" color="peach" value={String(data.totals.attempts)} caption="activités évaluées" delta={null} />
        <Kpi emoji="🌟" color="sun" value={String(data.totals.correct)} caption="réussites" delta={null} />
        <Kpi emoji="🤝" color="mint" value={String(data.totals.withHelp)} caption="avec un coup de pouce" delta={null} />
        <Kpi emoji="📷" color="sky" value={String(data.totals.illegible)} caption="photos illisibles (pas des erreurs)" delta={null} />
      </div>

      <h3 className="rp-h">🧩 {p.skills}</h3>
      <p className="pa-note">Maîtrise estimée selon des règles simples et vérifiables. Ce n’est pas un diagnostic. Catalogue initial : il ne couvre pas tout le programme.</p>
      <div className="rp-skills" data-testid="skills-cards">
        {data.skills.map((s) => {
          const est = s.state ? Math.round(s.state.estimate * 100) : 0;
          return (
            <div key={s.id} className={`rp-skill ${s.subject === 'french' ? 'fr' : 'ma'}`} data-skill={s.id}>
              <div className="rp-skill-top">
                <span className="rp-skill-icon" aria-hidden="true">
                  {SKILL_ICON[s.id] ?? '🌟'}
                </span>
                <div>
                  <strong>{s.title}</strong>
                  <span className="rp-skill-sub">{s.subject === 'french' ? 'Français' : 'Mathématiques'}</span>
                </div>
                <span className="rp-trend new" title={s.levels[String(s.state?.level ?? 1)]}>
                  niveau {s.state?.level ?? 1}
                  {s.state?.pendingAdvance ? ` → ${s.state.pendingAdvance.level} ⏳` : ''}
                </span>
              </div>
              <div className="rp-meter" role="img" aria-label={`Maîtrise estimée ${est} %`}>
                <div className="rp-meter-fill" style={{ width: `${est}%` }} />
              </div>
              <div className="rp-skill-foot">
                <span>Maîtrise estimée : {s.state ? pct(s.state.estimate) : '—'}</span>
                <span>
                  {s.state?.evidenceCount ?? 0} observation{(s.state?.evidenceCount ?? 0) > 1 ? 's' : ''} · confiance {s.state ? pct(s.state.confidence) : '—'}
                </span>
              </div>
              <p className="pa-reason">{s.state?.lastChangeReason ?? 'Aucun historique.'}</p>
            </div>
          );
        })}
      </div>

      <h3 className="rp-h">🧠 Ce que le jeu a appris de Melina</h3>
      <p className="pa-note">
        Après chaque réponse, le jeu ajuste un petit modèle statistique, sur cet ordinateur, sans IA externe. Il renforce
        les points à travailler et propose, pour les points forts, des défis d’un niveau plus haut, même au-delà de ce que
        l’école demande.
      </p>
      {data.learned.length === 0 ? (
        <p className="rp-empty">Pas encore assez de réponses.</p>
      ) : (
        <div className="rp-skills" data-testid="learned">
          {data.learned.map((l) => (
            <div key={l.skillId} className="rp-skill pa-learned" data-skill={l.skillId}>
              <div className="rp-skill-top">
                <span className="rp-skill-icon" aria-hidden="true">
                  {SKILL_ICON[l.skillId] ?? '🌟'}
                </span>
                <div>
                  <strong>{l.title}</strong>
                  <span className="rp-skill-sub">
                    {l.answers} réponse{l.answers > 1 ? 's' : ''}
                  </span>
                </div>
                <span className="rp-trend up" title={`Habileté estimée : ${l.ability.toFixed(2)}`}>
                  {l.answers >= 4 ? `à l’aise au niveau ${l.comfortableLevel}` : 'on apprend à la connaître'}
                </span>
              </div>
              <div className="pa-chips">
                {l.strong.map((x) => (
                  <span key={x.tag} className="pa-chip sun">
                    ✨ {x.label}
                  </span>
                ))}
                {l.weak.map((x) => (
                  <span key={x.tag} className="pa-chip sky">
                    🎯 {x.label}
                  </span>
                ))}
                {!l.strong.length && !l.weak.length && <span className="rp-empty">Rien de marquant pour l’instant.</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      <h3 className="rp-h">📅 {p.reviews}</h3>
      {reviews.length === 0 ? (
        <p className="rp-empty">Aucune révision prévue pour l’instant.</p>
      ) : (
        <div className="pa-chips">
          {reviews.map((s) => (
            <span key={s.id} className={`pa-chip ${s.reviewDue ? 'peach' : 'mint'}`}>
              {SKILL_ICON[s.id] ?? '🌟'} {s.title} : {fmtDay(String(s.state?.nextReviewAt))}
              {s.reviewDue && <strong> (à faire)</strong>}
            </span>
          ))}
        </div>
      )}
      <div className="pa-panel lilac">
      <h3 className="rp-h">🎛️ {p.practiceChoice}</h3>
      <p className="pa-note">La prochaine activité de la matière correspondante utilisera ce choix une seule fois.</p>
      {settings?.['parent.nextChoice'] && <p>Choix en attente : {data.skills.find((s) => s.id === settings['parent.nextChoice']?.skillId)?.title}</p>}
      <div className="actions left">
        <select value={choice.skillId} onChange={(e) => setChoice({ ...choice, skillId: e.target.value })} aria-label="Compétence">
          <option value="">Choisir une compétence…</option>
          {data.skills.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
            </option>
          ))}
        </select>
        <select value={choice.difficulty} onChange={(e) => setChoice({ ...choice, difficulty: e.target.value })} aria-label="Niveau">
          <option value="">Niveau actuel</option>
          <option value="1">Niveau 1</option>
          <option value="2">Niveau 2</option>
          <option value="3">Niveau 3</option>
          {/* only skills with 5 levels (Orthographe); the server refuses the others */}
          {(data.skills.find((s) => s.id === choice.skillId)?.levels['4'] ?? '') !== '' && <option value="4">Niveau 4</option>}
          {(data.skills.find((s) => s.id === choice.skillId)?.levels['5'] ?? '') !== '' && <option value="5">Niveau 5</option>}
          {(data.skills.find((s) => s.id === choice.skillId)?.levels['6'] ?? '') !== '' && <option value="6">Niveau 6 — Défi</option>}
        </select>
        <button
          className="btn"
          disabled={!choice.skillId}
          onClick={async () => {
            await api.patchSettings({ 'parent.nextChoice': { skillId: choice.skillId, ...(choice.difficulty ? { difficulty: Number(choice.difficulty) } : {}) } });
            reload();
          }}
        >
          Définir
        </button>
        {settings?.['parent.nextChoice'] && (
          <button
            className="btn"
            onClick={async () => {
              await api.patchSettings({ 'parent.nextChoice': null });
              reload();
            }}
          >
            Effacer
          </button>
        )}
      </div>
      </div>
      {settings && <SchoolWords settings={settings} reload={reload} />}
    </section>
  );
}

/** Week of the school's «Les mots à savoir écrire» list: the Les mots cachés game uses the words up to it. */
function SchoolWords({ settings, reload }: { settings: Settings; reload: () => void }) {
  const current = settings['french.schoolWeek'];
  const week = settings.schoolWeeks.find((w) => w.key === current);
  return (
    <div className="pa-panel sun">
      <h3 className="rp-h">🔍 Mots de l’école (Les mots cachés)</h3>
      <p className="pa-note">
        Choisissez la semaine où la classe est rendue. Le jeu prend les mots jusqu’à cette semaine et dicte surtout ceux de la semaine choisie.
      </p>
      <div className="actions left">
        <select
          value={current ?? ''}
          aria-label="Semaine de la liste de l’école"
          data-testid="school-week"
          onChange={async (e) => {
            await api.patchSettings({ 'french.schoolWeek': e.target.value || null });
            reload();
          }}
        >
          <option value="">Toute la liste</option>
          {settings.schoolWeeks.map((w) => (
            <option key={w.key} value={w.key}>
              {w.label}
            </option>
          ))}
        </select>
      </div>
      {week && (
        <p className="small" data-testid="school-week-words">
          {week.words.map((w, i) => (
            <span key={w.text}>
              {i > 0 && ' · '}
              {w.forms.length ? w.text : <span className="muted" title="Pas dans la grille (espace, trait d’union, apostrophe, œ ou moins de 3 lettres)">{w.text}*</span>}
            </span>
          ))}
          <br />
          <span className="muted">* reste dans la liste, mais n’entre pas dans la grille.</span>
        </p>
      )}
    </div>
  );
}

const categoryPt: Record<string, string> = {
  correct: '✅ Réussi',
  'wrong-answer': '❌ Réponse incorrecte',
  illegible: '📷 Image illisible',
  'not-finished': '⏳ Non terminée',
  cancelled: '⛔ Annulée',
};

const STATUS_LOOK: Record<string, { cls: string }> = {
  correct: { cls: 'mint' },
  'wrong-answer': { cls: 'peach' },
  illegible: { cls: 'sky' },
  'not-finished': { cls: 'lilac' },
  cancelled: { cls: 'lilac' },
};

function History() {
  const [rows, setRows] = useState<Array<Record<string, unknown>> | null>(null);
  useEffect(() => {
    api.history().then(setRows).catch(() => setRows([]));
  }, []);
  if (!rows) return <p>Chargement…</p>;
  if (!rows.length) return <p className="rp-empty">Aucune activité pour l’instant.</p>;
  // grouped by day, newest to oldest (local time)
  const days: Array<{ day: string; items: Array<Record<string, unknown>> }> = [];
  for (const r of rows) {
    const day = fmtDate(String(r.createdAt));
    const last = days[days.length - 1];
    if (last && last.day === day) last.items.push(r);
    else days.push({ day, items: [r] });
  }
  return (
    <section className="pa-page" data-testid="history">
      {days.map((d) => (
        <div key={d.day} className="pa-day">
          <h3 className="rp-h">🗓️ {d.day.charAt(0).toUpperCase() + d.day.slice(1)}</h3>
          <div className="pa-timeline">
            {d.items.map((r) => {
              const look = STATUS_LOOK[String(r.category)] ?? { cls: 'lilac' };
              return (
                <article key={String(r.assignmentId)} className={`pa-event ${look.cls}`}>
                  <div className="pa-event-head">
                    <span className={`pa-chip ${look.cls}`}>{categoryPt[String(r.category)] ?? String(r.category)}</span>
                    <span className="pa-time">{fmtTime(String(r.createdAt))}</span>
                  </div>
                  <p className="pa-statement">
                    <span aria-hidden="true">{SKILL_ICON[String(r.skillId)] ?? '🌟'}</span> {String(r.statement)}
                  </p>
                  <div className="pa-chips">
                    <span className="pa-chip">niveau {String(r.difficulty)}</span>
                    <span className="pa-chip">réponse : {r.confirmedAnswer ? String(r.confirmedAnswer) : '—'}</span>
                    <span className="pa-chip">
                      aide : {r.help ? (r.help === 'none' ? 'aucune' : r.help === 'hint' ? (r.inputMode === 'screen' ? 'indice du jeu' : 'indice') : 'adulte') : '—'}
                    </span>
                    <span className="pa-chip">
                      {r.inputMode === 'screen'
                        ? `à l’écran${Number(r.tries) > 1 ? ` (${String(r.tries)} essais)` : ''}`
                        : r.transcriptionSource
                          ? r.readingCorrected
                            ? 'IA corrigée par les parents'
                            : r.transcriptionSource === 'ai'
                              ? 'IA confirmée'
                              : 'sur papier, saisie à la main'
                          : '—'}
                    </span>
                    {Number(r.illegibleReadings) > 0 && r.category !== 'illegible' && <span className="pa-chip sky">{String(r.illegibleReadings)} photo illisible avant</span>}
                  </div>
                  <p className="pa-reason">Raison du choix : {String(r.selectionReason)}</p>
                </article>
              );
            })}
          </div>
        </div>
      ))}
    </section>
  );
}

function SampleCard({ s, onChange }: { s: Awaited<ReturnType<typeof api.samples>>[number]; onChange: () => void }) {
  const [text, setText] = useState(s.transcription);
  const [confirmDelete, setConfirmDelete] = useState(false);
  return (
    <div className="sample">
      <PhotoView photoId={s.photoId} />
      <input value={text} onChange={(e) => setText(e.target.value)} aria-label="Transcription confirmée" />
      <div className="actions left">
        {text !== s.transcription && (
          <button className="btn small" onClick={() => api.patchSample(s.id, { transcription: text }).then(onChange)}>
            Enregistrer
          </button>
        )}
        <label className="check small">
          <input type="checkbox" checked={s.allowExternal} onChange={(e) => api.patchSample(s.id, { allowExternal: e.target.checked }).then(onChange)} /> utiliser avec l’IA
        </label>
        {!confirmDelete ? (
          <button className="btn small danger-outline" onClick={() => setConfirmDelete(true)}>
            Supprimer
          </button>
        ) : (
          <button className="btn small danger" onClick={() => api.deleteSample(s.id).then(onChange)}>
            Confirmer la suppression
          </button>
        )}
      </div>
      <p className="muted small">
        {s.kind} · qualité {s.quality} · {fmtDay(s.createdAt)}
      </p>
    </div>
  );
}

function Samples() {
  const [items, setItems] = useState<Awaited<ReturnType<typeof api.samples>> | null>(null);
  const reload = useCallback(() => {
    api.samples().then(setItems).catch(() => setItems([]));
  }, []);
  useEffect(reload, [reload]);
  if (!items) return <p>Chargement…</p>;
  return (
    <section>
      <p className="muted">
        Exemples confirmés de l’écriture de Melina. Ils restent sur cet ordinateur. Seuls ceux cochés « utiliser avec l’IA » peuvent être envoyés à Claude comme contexte pour de nouvelles lectures — cela n’entraîne pas le modèle.
        Supprimer retire l’exemple de la collection; l’historique de l’activité est conservé.
      </p>
      {items.length === 0 ? <p className="muted">Aucun exemple enregistré pour l’instant.</p> : <div className="samples">{items.map((s) => <SampleCard key={s.id} s={s} onChange={reload} />)}</div>}
    </section>
  );
}

/** The browser voice in use (the technical name stays here, for the parents; her screen shows only «française»). */
function VoiceLine() {
  const [v, setV] = useState(voiceInfo());
  useEffect(() => {
    const id = window.setTimeout(() => setV(voiceInfo()), 800);
    return () => window.clearTimeout(id);
  }, []);
  return (
    <p className="muted small" data-testid="voice-line">
      Voix du jeu : {v.available ? `${v.name}${v.canadian ? ' (français du Canada)' : ' (français, pas du Canada)'}${v.natural ? ' · voix naturelle' : ''}` : 'aucune voix française trouvée dans ce navigateur'}
    </p>
  );
}

function SettingsPanel({ onSettings }: { onSettings: (s: Settings) => void }) {
  const [s, setS] = useState<Settings | null>(null);
  const [consent, setConsent] = useState(false);
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [backups, setBackups] = useState<Array<{ name: string; createdAt: string }>>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [intervals, setIntervals] = useState('');

  const reload = useCallback(() => {
    api.settings().then((x) => {
      setS(x);
      onSettings(x);
      setIntervals(x['engine.reviewIntervalsDays'].join(', '));
    });
    api.readingStats().then(setStats).catch(() => undefined);
    api.backups().then(setBackups).catch(() => undefined);
  }, [onSettings]);
  useEffect(reload, [reload]);
  if (!s) return <p>Chargement…</p>;

  const patch = async (b: Record<string, unknown>) => {
    setErr(null);
    setMsg(null);
    try {
      await api.patchSettings(b);
      reload();
      setMsg('Enregistré.');
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  return (
    <section className="settings">
      <h3>Lecture de l’écriture avec l’IA (Claude)</h3>
      <p>
        Clé de l’API : <strong>{s.aiKeyConfigured ? 'configurée dans le fichier .env' : 'non configurée'}</strong> · Modèle : <code>{s.aiModel}</code>
      </p>
      <VoiceLine />
      {!s.aiKeyConfigured && <p className="muted small">Pour utiliser l’IA, créez le fichier .env dans le dossier de l’app (voir le README) et redémarrez. Sans clé, la transcription manuelle fonctionne normalement.</p>}
      <div className="consent">
        <p>
          <strong>Avant d’activer :</strong> lorsque vous demandez une lecture, la photo de la réponse et jusqu’à {s['ai.maxSamples']} exemple(s) d’écriture autorisé(s) sont envoyés à Anthropic (fournisseur de Claude) par Internet. Chaque lecture peut
          entraîner des frais sur votre compte de l’API. Rien n’est envoyé automatiquement : seulement quand vous cliquez sur « Lire avec l’IA ». Le nom de Melina, l’école et la réponse attendue ne sont pas envoyés.
        </p>
        {s['ai.enabled'] ? (
          <p>
            ✅ IA activée le {s['ai.consentAt'] ? fmtDateTime(s['ai.consentAt']) : ''}.{' '}
            <button className="btn small" onClick={() => patch({ 'ai.enabled': false })}>
              Désactiver
            </button>
          </p>
        ) : (
          <p>
            <label className="check">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} /> J’ai lu et j’accepte l’envoi décrit ci-dessus.
            </label>
            <button className="btn small primary" disabled={!consent} onClick={() => patch({ 'ai.enabled': true, 'ai.consent': true })}>
              Activer la lecture par IA
            </button>
          </p>
        )}
        <label className="check">
          Nombre maximal d’exemples par lecture :{' '}
          <select value={s['ai.maxSamples']} onChange={(e) => patch({ 'ai.maxSamples': Number(e.target.value) })}>
            {[0, 1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>
      {stats && (
        <>
          <h4>Mesure de la lecture</h4>
          <p className="small">
            Lectures par l’IA : {String(stats.aiReadings)} · corrigées par les parents : {String(stats.correctedByParents)} · illisibles : {String(stats.illegible)} · avec exemples : {String(stats.withSamples)} (
            {String(stats.withSamplesCorrected)} corrigées) · sans exemples : {String(stats.withoutSamples)} ({String(stats.withoutSamplesCorrected)} corrigées)
          </p>
          <p className="muted small">Confusions les plus fréquentes : {Object.entries((stats.confusions as Record<string, number>) ?? {}).map(([k, v]) => `${k} (${v})`).join(', ') || '—'}</p>
          <p className="muted small">{String(stats.note)}</p>
        </>
      )}

      <h3>Révision espacée</h3>
      <label className="check">
        Intervalles en jours après des réussites sans aide :{' '}
        <input className="input-small" value={intervals} onChange={(e) => setIntervals(e.target.value)} />
      </label>
      <button className="btn small" onClick={() => patch({ 'engine.reviewIntervalsDays': intervals.split(/[,; ]+/).filter(Boolean).map(Number) })}>
        Enregistrer les intervalles
      </button>

      <h3>Données et sauvegardes</h3>
      <p className="small">
        Base de données : <code>data\melina.db</code> · Photos : <code>data\photos\</code> · Sauvegardes : <code>data\backups\</code>. Le stockage local n’est pas chiffré. La clé de l’API n’est pas incluse dans la sauvegarde.
      </p>
      <button
        className="btn"
        onClick={async () => {
          setErr(null);
          try {
            const b = await api.createBackup();
            setMsg(`Sauvegarde créée avec ${b.photos} photo(s).`);
            reload();
          } catch (e) {
            setErr((e as Error).message);
          }
        }}
      >
        💾 Faire une sauvegarde maintenant
      </button>
      {backups.length > 0 && (
        <ul className="list compact">
          {backups.slice(0, 8).map((b) => (
            <li key={b.name} className="small">
              {b.name}
            </li>
          ))}
        </ul>
      )}
      {msg && <p className="notice">{msg}</p>}
      {err && <p className="error">{err}</p>}
    </section>
  );
}

// ------------------------------------------------------------------ area

export function ParentArea({ initialAssignmentId, onClose, onConfirmed }: { initialAssignmentId?: string; onClose: () => void; onConfirmed: (r: ConfirmResponse) => void }) {
  const [passed, setPassed] = useState(false);
  const [tab, setTab] = useState<Tab>('review');
  const [current, setCurrent] = useState<string | undefined>(initialAssignmentId);
  const [settings, setSettings] = useState<Settings | null>(null);
  useEffect(() => {
    if (passed) api.settings().then(setSettings).catch(() => undefined);
  }, [passed]);
  const tabs = useMemo<Array<[Tab, string]>>(
    () => [
      ['review', 'Vérifier les réponses'],
      ['dashboard', p.dashboard],
      ['report', 'Rapports'],
      ['history', p.history],
      ['samples', p.samples],
      ['art', 'Art du jeu'],
      ['settings', p.settings],
    ],
    [],
  );
  return (
    <div className="parent-area" lang="fr-CA">
      {!passed ? (
        <div className="overlay">
          <div className="card">
            <Gate onPass={() => setPassed(true)} onClose={onClose} />
          </div>
        </div>
      ) : (
        <div className="parent-shell">
          <header className="parent-header">
            <h2>
              <span aria-hidden="true">🌻 </span>
              {p.areaTitle}
            </h2>
            <nav>
              {tabs.map(([k, label]) => (
                <button key={k} className={`tab ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>
                  <span aria-hidden="true">{TAB_ICON[k]} </span>
                  {label}
                </button>
              ))}
            </nav>
            <button className="btn" onClick={onClose}>
              Retour au jeu
            </button>
          </header>
          <main className="parent-main">
            {tab === 'review' &&
              (current ? (
                <ReviewFlow key={current} assignmentId={current} settings={settings} onConfirmed={onConfirmed} onBack={() => setCurrent(undefined)} />
              ) : (
                <>
                  <h3>{p.pendingTitle}</h3>
                  <PendingList onOpen={setCurrent} />
                </>
              ))}
            {tab === 'dashboard' && <Dashboard />}
            {tab === 'report' && <Report />}
            {tab === 'history' && <History />}
            {tab === 'samples' && <Samples />}
            {tab === 'art' && <ArtStudio />}
            {tab === 'settings' && <SettingsPanel onSettings={setSettings} />}
          </main>
        </div>
      )}
    </div>
  );
}
