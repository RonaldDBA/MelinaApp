import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fmtDateTime, fmtDay } from '../dates';
import { slotSpots, type GridSpec } from '@melina/shared';
import { api, artApi, type ArtCandidate, type ArtSpecView, type ArtStudio as Studio } from '../api';
import { loadArtCatalog } from '../stage/art';

/**
 * Art studio (parents' area): specs, request, generation, review and approval.
 * No image gets into the game unless an adult approves it here.
 */

const KIND = { background: 'Décor', prop: 'Objet', character: 'Animal', clip: 'Clip' } as const;
type Inset = [number, number, number, number];

/** Image or clip (video always muted, looping). */
/**
 * Image or clip (video always muted). By default the clip shows only a still frame and downloads only the start
 * of the file (preload «metadata» + range requests on the server); it plays while the mouse is over it.
 * `play`: plays on its own, looping (only for the art in use, one per screen).
 */
function Media({ url, mime, alt = '', className, play = false }: { url: string; mime?: string; alt?: string; className?: string; play?: boolean }) {
  if (!mime?.startsWith('video/')) return <img src={url} alt={alt} className={className} loading="lazy" />;
  if (play) return <video src={url} className={className} autoPlay loop muted playsInline aria-label={alt} />;
  return (
    <video
      src={`${url}#t=0.1`}
      className={className}
      preload="metadata"
      loop
      muted
      playsInline
      aria-label={alt}
      onMouseEnter={(e) => void e.currentTarget.play().catch(() => undefined)}
      onMouseLeave={(e) => e.currentTarget.pause()}
    />
  );
}

/** Processing done by the browser: trims the transparent margins and saves WebP (nothing installed on the PC). */
async function processImage(url: string, trim: boolean): Promise<{ blob: Blob; width: number; height: number }> {
  const img = new Image();
  img.src = url;
  await img.decode();
  const full = document.createElement('canvas');
  full.width = img.naturalWidth;
  full.height = img.naturalHeight;
  const g = full.getContext('2d') as CanvasRenderingContext2D;
  g.drawImage(img, 0, 0);
  let box = { x: 0, y: 0, w: full.width, h: full.height };
  if (trim) {
    const d = g.getImageData(0, 0, full.width, full.height).data;
    let x0 = full.width;
    let y0 = full.height;
    let x1 = -1;
    let y1 = -1;
    for (let y = 0; y < full.height; y++) {
      for (let x = 0; x < full.width; x++) {
        if ((d[(y * full.width + x) * 4 + 3] as number) > 8) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    }
    if (x1 >= 0) {
      const pad = Math.round(Math.max(x1 - x0, y1 - y0) * 0.01) + 2;
      x0 = Math.max(0, x0 - pad);
      y0 = Math.max(0, y0 - pad);
      x1 = Math.min(full.width - 1, x1 + pad);
      y1 = Math.min(full.height - 1, y1 + pad);
      box = { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
    }
  }
  const k = Math.min(1, 2048 / Math.max(box.w, box.h));
  const out = document.createElement('canvas');
  out.width = Math.max(1, Math.round(box.w * k));
  out.height = Math.max(1, Math.round(box.h * k));
  (out.getContext('2d') as CanvasRenderingContext2D).drawImage(full, box.x, box.y, box.w, box.h, 0, 0, out.width, out.height);
  const webp = await new Promise<Blob | null>((r) => out.toBlob(r, 'image/webp', 0.92));
  const blob = webp && webp.type === 'image/webp' ? webp : await new Promise<Blob | null>((r) => out.toBlob(r, 'image/png'));
  if (!blob) throw new Error('Le navigateur n’a pas pu traiter l’image.');
  return { blob, width: out.width, height: out.height };
}

function Mark({ ok }: { ok: boolean | null }) {
  return <span className={`art-mark ${ok === null ? 'unknown' : ok ? 'ok' : 'bad'}`}>{ok === null ? '?' : ok ? '✓' : '✗'}</span>;
}

/** Preview of how the 10 slots fall on the crate art, with adjustable inner margins. */
function GridPreview({ url, width, height, grid, inset, onInset }: { url: string; width: number; height: number; grid: GridSpec; inset: Inset; onInset: (i: Inset) => void }) {
  const spots = useMemo(() => slotSpots({ x: 0, y: 0, w: width, h: height }, { ...grid, inset }), [width, height, grid, inset]);
  const names = ['Haut', 'Droite', 'Bas', 'Gauche'];
  return (
    <div className="art-grid">
      <div className="art-grid-view checker" style={{ aspectRatio: `${width} / ${height}` }}>
        <img src={url} alt="" />
        {spots.map((s, i) => (
          <img key={i} className="art-grid-fruit" src="/art/red_apple.png" alt="" style={{ left: `${((s.x - s.size / 2) / width) * 100}%`, top: `${((s.y - s.size / 2) / height) * 100}%`, width: `${(s.size / width) * 100}%` }} />
        ))}
      </div>
      <div className="art-sliders">
        <p className="muted">Ajustez les marges jusqu’à ce que les 10 fruits tiennent dans la boîte.</p>
        {names.map((n, i) => (
          <label key={n}>
            {n} : {Math.round((inset[i] as number) * 100)} %
            <input type="range" min={0} max={45} value={Math.round((inset[i] as number) * 100)} onChange={(e) => onInset(inset.map((v, j) => (j === i ? Number(e.target.value) / 100 : v)) as Inset)} />
          </label>
        ))}
      </div>
    </div>
  );
}

interface Pending {
  title: string;
  blob: Blob;
  url: string;
  width: number;
  height: number;
  send: (blob: Blob, meta?: { inset: number[] }) => Promise<unknown>;
}

function SpecDetail({ spec, studio, onChange, onBack }: { spec: ArtSpecView; studio: Studio; onChange: () => Promise<void>; onBack: () => void }) {
  const [prompt, setPrompt] = useState(spec.prompt ?? spec.defaultPrompt);
  const [n, setN] = useState(3);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState<Pending | null>(null);
  const [pendingClip, setPendingClip] = useState<{ title: string; url: string; fileId: string } | null>(null);
  const clip = spec.kind === 'clip';
  const [inset, setInset] = useState<Inset>((spec.grid?.inset ?? [0, 0, 0, 0]) as Inset);
  const savedPrompt = spec.prompt ?? spec.defaultPrompt;
  useEffect(() => setPrompt(savedPrompt), [savedPrompt]);

  const act = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(label);
    setError('');
    try {
      await fn();
      await onChange();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy('');
    }
  };

  const prepare = (title: string, url: string, send: Pending['send']) =>
    act('prepare', async () => {
      const p = await processImage(url, spec.transparent);
      setInset((spec.grid?.inset ?? [0, 0, 0, 0]) as Inset);
      setPending({ title, blob: p.blob, url: URL.createObjectURL(p.blob), width: p.width, height: p.height, send });
    });

  const confirm = () =>
    pending &&
    act('approve', async () => {
      await pending.send(pending.blob, spec.grid ? { inset } : undefined);
      URL.revokeObjectURL(pending.url);
      setPending(null);
      await loadArtCatalog(true); // the game starts using the new art without restarting
    });

  const canGenerate = studio.enabled && studio.provider?.keyConfigured && spec.job?.status !== 'running';
  // a clip spec shows only videos from the packs; the others, only images
  const packFiles = studio.packs.map((p) => ({ p, files: p.files.filter((f) => (f.media === 'video') === clip) })).filter((x) => x.files.length > 0);
  const current = spec.active?.url ?? spec.fallback;

  return (
    <div className="art-detail">
      <button className="btn small" onClick={onBack}>
        ← Toutes les fiches
      </button>
      <h3>
        {spec.title} <span className="art-chip">{KIND[spec.kind]}</span>
      </h3>
      <p>{spec.brief}</p>
      <p className="muted">
        À éviter : {spec.mustNot.join('; ')}. Taille demandée : {spec.size[0]}×{spec.size[1]}
        {spec.transparent ? ', fond transparent' : ''}. Utilisée dans : {spec.usedBy.join(', ')}.
      </p>
      {error && <p className="error">{error}</p>}

      <div className="art-columns">
        <section className="field">
          <legend>Art utilisé dans le jeu</legend>
          <div className="art-current checker">
            <Media url={current} mime={spec.active?.mime} alt={spec.title} play />
          </div>
          <p>
            {spec.active
              ? `Version ${spec.active.version} — ${spec.active.credit ?? spec.active.source}`
              : spec.drawnByCode
                ? 'Dessin fait par le jeu (aucune photo approuvée). L’image ci-dessus ne fait qu’illustrer ce dessin.'
                : 'Art intégré de l’application (aucune version approuvée).'}
          </p>
          {spec.versions.length > 0 && (
            <ul className="art-versions">
              {spec.versions.map((v) => (
                <li key={v.id}>
                  <Media url={v.url} mime={v.mime} className="checker" /> v{v.version} · {v.source === 'pack' ? 'paquet' : 'générée'} · {fmtDay(v.approvedAt)}
                  {v.active ? <strong> · en usage</strong> : <button className="btn small" disabled={!!busy} onClick={() => act('activate', () => artApi.activate(spec.id, v.id).then(() => loadArtCatalog(true)))}>Utiliser celle-ci</button>}
                </li>
              ))}
              {spec.active && (
                <li>
                  <button className="btn small" disabled={!!busy} onClick={() => act('activate', () => artApi.activate(spec.id, null).then(() => loadArtCatalog(true)))}>
                    Revenir à l’art intégré
                  </button>
                </li>
              )}
            </ul>
          )}
        </section>

        <section className="field">
          <legend>{clip ? 'Demande du clip (à générer hors de l’application)' : 'Demande d’image'}</legend>
          {clip && (
            <p className="notice" data-testid="art-clip-note">
              L’application ne génère pas de vidéo. Utilisez cette demande dans un outil vidéo de votre choix, enregistrez le clip en MP4 ou WebM (de 2 à 6 secondes, jusqu’à 40 Mo) dans un dossier à l’intérieur de <code>assets\packs-inbox\</code>, cliquez sur
              « Chercher des paquets » et choisissez la vidéo ci-dessous. Le son ne joue jamais : le jeu la lit toujours sans le son. Sans clip approuvé, Lila continue de sauter comme aujourd’hui.
            </p>
          )}
          <textarea className="art-prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={9} data-testid="art-prompt" />
          <p className="muted">
            {spec.promptSource === 'default' ? 'Demande par défaut, construite à partir du guide de style et de la fiche.' : spec.promptSource === 'claude' ? 'Demande rédigée par Claude.' : 'Demande modifiée par vous.'}
            {spec.reference ? ' L’image maîtresse approuvée est jointe comme modèle.' : ''}
          </p>
          <div className="actions left">
            <button className="btn small" disabled={!!busy || prompt.trim() === savedPrompt.trim()} onClick={() => act('prompt', () => artApi.setPrompt(spec.id, prompt))}>
              Enregistrer la demande
            </button>
            <button className="btn small" disabled={!!busy || !studio.enabled || !studio.claudeAvailable} onClick={() => act('draft', () => artApi.draftPrompt(spec.id))} title={studio.claudeAvailable ? '' : 'Nécessite la clé de Claude'}>
              {busy === 'draft' ? 'Claude rédige…' : 'Demander à Claude de rédiger'}
            </button>
            {spec.promptSource !== 'default' && (
              <button className="btn small" disabled={!!busy} onClick={() => act('prompt', () => artApi.setPrompt(spec.id, null))}>
                Revenir à la demande par défaut
              </button>
            )}
          </div>
          {!clip && (
          <div className="actions left art-generate">
            <label>
              Candidates :{' '}
              <select value={n} onChange={(e) => setN(Number(e.target.value))}>
                {[1, 2, 3, 4].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <button className="btn primary" data-testid="art-generate" disabled={!!busy || !canGenerate || prompt.trim() !== savedPrompt.trim()} onClick={() => act('generate', () => artApi.generate(spec.id, n))}>
              {spec.job?.status === 'running' ? 'Génération…' : 'Générer des candidates'}
            </button>
          </div>
          )}
          {!clip && !studio.enabled && <p className="notice">Activez la génération d’art en haut de cet écran pour générer des images.</p>}
          {!clip && studio.enabled && !studio.provider && <p className="notice">Aucun fournisseur d’images configuré dans le fichier .env.</p>}
          {spec.job?.status === 'running' && <p className="notice" data-testid="art-running">Génération en cours ({spec.job.provider}). Cela peut prendre quelques minutes; cet écran se met à jour tout seul.</p>}
          {spec.job?.status === 'failed' && <p className="error">La dernière génération a échoué : {spec.job.errorMessage}</p>}
        </section>
      </div>

      {!clip && <h3>Candidates en attente de décision ({spec.candidates.length})</h3>}
      {!clip && spec.candidates.length === 0 && <p className="muted">Aucune candidate. Générez des images ci-dessus ou utilisez une image d’un paquet.</p>}
      <div className="art-candidates">
        {spec.candidates.map((c) => (
          <CandidateCard key={c.id} c={c} busy={!!busy} claude={studio.claudeAvailable && studio.enabled} onApprove={() => prepare(`Approuver la candidate pour « ${spec.title} »`, c.url, (blob, meta) => artApi.approve(c.id, blob, meta))} onReject={() => act('reject', () => artApi.reject(c.id, 'refusée par les parents'))} onReview={() => act('review', () => artApi.review(c.id))} />
        ))}
      </div>

      {packFiles.length > 0 && (
        <>
          <h3>{clip ? 'Utiliser un clip d’un paquet dans cette fiche' : 'Utiliser une image d’un paquet dans cette fiche'}</h3>
          {packFiles.map(({ p, files }) => (
            <details key={p.id} className="field" open={clip}>
              <summary>
                {p.name} ({files.length} {clip ? 'clip(s)' : 'images'}){p.licenseNote ? ` — ${p.licenseNote.slice(0, 90)}` : ' — aucun fichier de licence dans le dossier'}
              </summary>
              <div className="art-pack-files">
                {files.map((f) =>
                  clip ? (
                    <button key={f.id} className="art-pack-file checker" data-testid="art-pack-clip" title={f.path} disabled={!!busy} onClick={() => setPendingClip({ title: `Utiliser « ${f.path} » dans « ${spec.title} »`, url: f.url, fileId: f.id })}>
                      <Media url={f.url} mime={f.mime} alt={f.path} />
                    </button>
                  ) : (
                    <button key={f.id} className="art-pack-file checker" title={`${f.path} (${f.width}×${f.height})`} disabled={!!busy} onClick={() => prepare(`Utiliser « ${f.path} » dans « ${spec.title} »`, f.url, (blob, meta) => artApi.usePackFile(f.id, spec.id, blob, meta))}>
                      <img src={f.url} alt={f.path} loading="lazy" />
                    </button>
                  ),
                )}
              </div>
            </details>
          ))}
        </>
      )}
      {clip && packFiles.length === 0 && <p className="muted">Aucun clip dans les paquets pour l’instant.</p>}

      {pendingClip && (
        <div className="overlay">
          <div className="card card-wide" data-testid="art-confirm">
            <h3>{pendingClip.title}</h3>
            <p className="muted">Regardez le clip au complet. Il est utilisé tel quel, toujours sans son et en boucle, quand Melina donne une bonne réponse.</p>
            <div className="art-current checker">
              <video src={pendingClip.url} autoPlay loop muted playsInline controls={false} />
            </div>
            <div className="actions">
              <button className="btn" disabled={!!busy} onClick={() => setPendingClip(null)}>
                Annuler
              </button>
              <button
                className="btn primary"
                data-testid="art-confirm-ok"
                disabled={!!busy}
                onClick={() =>
                  act('approve', async () => {
                    await artApi.usePackFile(pendingClip.fileId, spec.id, null);
                    setPendingClip(null);
                    await loadArtCatalog(true);
                  })
                }
              >
                Approuver et utiliser dans le jeu
              </button>
            </div>
          </div>
        </div>
      )}

      {pending && (
        <div className="overlay">
          <div className="card card-wide" data-testid="art-confirm">
            <h3>{pending.title}</h3>
            <p className="muted">
              Image déjà traitée par le navigateur : {pending.width}×{pending.height}, {(pending.blob.size / 1024).toFixed(0)} Ko ({pending.blob.type.replace('image/', '').toUpperCase()}). Une fois approuvée, elle sera utilisée dans le jeu.
            </p>
            {spec.grid ? (
              <GridPreview url={pending.url} width={pending.width} height={pending.height} grid={spec.grid} inset={inset} onInset={setInset} />
            ) : (
              <div className="art-current checker">
                <img src={pending.url} alt="" />
              </div>
            )}
            <div className="actions">
              <button
                className="btn"
                disabled={!!busy}
                onClick={() => {
                  URL.revokeObjectURL(pending.url);
                  setPending(null);
                }}
              >
                Annuler
              </button>
              <button className="btn primary" data-testid="art-confirm-ok" disabled={!!busy} onClick={confirm}>
                Approuver et utiliser dans le jeu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CandidateCard({ c, busy, claude, onApprove, onReject, onReview }: { c: ArtCandidate; busy: boolean; claude: boolean; onApprove: () => void; onReject: () => void; onReview: () => void }) {
  return (
    <article className="art-candidate" data-testid="art-candidate" data-tech={c.techOk ? 'ok' : 'bad'}>
      <div className="art-current checker">
        <img src={c.url} alt="Candidate" />
      </div>
      <h4>
        <Mark ok={c.techOk} /> Vérification technique
      </h4>
      <ul className="art-checks">
        {c.tech?.checks.map((k) => (
          <li key={k.id}>
            <Mark ok={k.ok} /> {k.label} <span className="muted">— {k.detail}</span>
          </li>
        ))}
      </ul>
      <h4>
        <Mark ok={c.reviewVerdict === 'approve' ? true : c.reviewVerdict === 'reject' ? false : null} /> Vérification de Claude
      </h4>
      {c.reviewVerdict === null && <p className="muted">{claude ? 'Pas encore vérifiée.' : 'Non disponible (pas de clé de Claude ou génération désactivée).'}</p>}
      {c.reviewVerdict === 'error' && <p className="muted">Vérification impossible : {c.review?.error}</p>}
      {c.reviewVerdict === 'approve' && <p>Aucun problème signalé.</p>}
      {c.reviewVerdict === 'reject' && (
        <ul className="art-checks">
          {(c.review?.problems ?? []).map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </ul>
      )}
      <div className="actions left">
        <button className="btn primary small" data-testid="art-approve" disabled={busy} onClick={onApprove}>
          Approuver…
        </button>
        <button className="btn small danger-outline" data-testid="art-reject" disabled={busy} onClick={onReject}>
          Refuser
        </button>
        {claude && (
          <button className="btn small" disabled={busy} onClick={onReview}>
            Vérifier avec Claude
          </button>
        )}
      </div>
      <p className="muted">La décision vous revient toujours; les vérifications indiquent seulement quoi regarder.</p>
    </article>
  );
}

export function ArtStudio() {
  const [studio, setStudio] = useState<Studio | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [consent, setConsent] = useState(false);
  const [scan, setScan] = useState('');
  const timer = useRef<number | undefined>(undefined);

  const refresh = useCallback(async () => {
    try {
      setStudio(await artApi.studio());
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => void refresh(), [refresh]);

  // while a generation is in progress, poll the server
  const running = studio?.specs.some((s) => s.job?.status === 'running') ?? false;
  useEffect(() => {
    if (!running) return;
    timer.current = window.setInterval(() => void refresh(), 2000);
    return () => window.clearInterval(timer.current);
  }, [running, refresh]);

  const patch = async (body: Record<string, unknown>) => {
    setError('');
    try {
      await api.patchSettings(body);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (!studio) return <p className="muted">{error || 'Chargement…'}</p>;
  const spec = studio.specs.find((s) => s.id === open);
  if (spec) return <SpecDetail spec={spec} studio={studio} onChange={refresh} onBack={() => setOpen(null)} />;

  return (
    <div className="art-studio">
      <h3>Atelier d’art</h3>
      <p>
        Ici, vous changez l’art du jeu. Chaque image a sa fiche; l’art peut être <strong>généré</strong> par une API d’images ou provenir d’un <strong>paquet prêt</strong>. Rien n’entre dans le jeu sans votre approbation, et l’art intégré reste en
        place tant qu’il n’y en a pas d’autre.
      </p>
      {error && <p className="error">{error}</p>}

      <fieldset className="field">
        <legend>Génération d’images</legend>
        <p>
          Fournisseur d’images : <strong>{studio.provider ? studio.provider.label : 'non configuré'}</strong>
          {studio.provider && !studio.provider.keyConfigured ? ' — clé manquante (IMAGE_API_KEY dans le fichier .env)' : ''} · Vérification de Claude : <strong>{studio.claudeAvailable ? `disponible (${studio.claudeModel})` : 'pas de clé'}</strong>
        </p>
        {!studio.provider && (
          <p className="notice">
            Pour générer des images, ouvrez le fichier <code>.env</code> dans le dossier de l’application et remplissez <code>IMAGE_PROVIDER=openai</code> et <code>IMAGE_API_KEY=</code> avec la clé du fournisseur. Pour seulement essayer cet écran avec
            des images de test, utilisez <code>IMAGE_PROVIDER=mock</code>. Ensuite, fermez et rouvrez l’application. L’API de Claude ne génère pas d’images; elle rédige seulement la demande et vérifie le résultat.
          </p>
        )}
        {studio.enabled ? (
          <p>
            ✅ Génération activée le {studio.consentAt ? fmtDateTime(studio.consentAt) : ''}.{' '}
            <button className="btn small" onClick={() => void patch({ 'art.enabled': false })}>
              Désactiver
            </button>
          </p>
        ) : (
          <div className="consent">
            <label>
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} data-testid="art-consent" /> Je comprends que le texte de la demande et les images de référence déjà approuvées sont envoyés au fournisseur d’images, et
              que les images générées sont envoyées à Claude pour vérification. Aucun nom, aucune photo ni aucune réponse de l’enfant n’est envoyé. L’utilisation est facturée par les fournisseurs.
            </label>
            <button className="btn primary" disabled={!consent} onClick={() => void patch({ 'art.enabled': true, 'art.consent': true })} data-testid="art-enable">
              Activer la génération d’art
            </button>
          </div>
        )}
        <p>
          Images générées : <strong>{studio.usage.today}</strong> aujourd’hui (limite quotidienne{' '}
          <input className="input-small" type="number" min={0} max={2000} defaultValue={studio.limits.daily} onBlur={(e) => Number(e.target.value) !== studio.limits.daily && void patch({ 'art.dailyLimit': Number(e.target.value) })} />) ·{' '}
          <strong>{studio.usage.month}</strong> ce mois-ci (limite mensuelle{' '}
          <input className="input-small" type="number" min={0} max={2000} defaultValue={studio.limits.monthly} onBlur={(e) => Number(e.target.value) !== studio.limits.monthly && void patch({ 'art.monthlyLimit': Number(e.target.value) })} />
          ). La limite compte des images, pas de l’argent : le prix dépend du fournisseur.
        </p>
      </fieldset>

      <details className="field">
        <summary>Guide de style : {studio.style.name}</summary>
        <p>{studio.style.summary}</p>
        <p className="art-palette">
          {studio.style.palette.map((c) => (
            <span key={c} style={{ background: c }} title={c} />
          ))}
        </p>
        <p className="muted">Toujours : {studio.style.always.join('; ')}.</p>
        <p className="muted">Jamais : {studio.style.never.join('; ')}.</p>
      </details>

      <h3>Fiches d’art ({studio.specs.length})</h3>
      <div className="art-specs">
        {studio.specs.map((s) => (
          <button key={s.id} className="art-spec" onClick={() => setOpen(s.id)} data-testid={`art-spec-${s.id}`}>
            <span className="art-thumb checker">
              <Media url={s.active?.url ?? s.fallback} mime={s.active?.mime} />
            </span>
            <strong>{s.title}</strong>
            <span className="muted">{KIND[s.kind]}</span>
            <span className={`art-chip ${s.active ? 'on' : ''}`}>{s.active ? (s.active.source === 'pack' ? `Paquet · v${s.active.version}` : `Générée · v${s.active.version}`) : 'Intégré'}</span>
            {s.candidates.length > 0 && <span className="art-chip warn">{s.candidates.length} à décider</span>}
            {s.job?.status === 'running' && <span className="art-chip warn">génération…</span>}
          </button>
        ))}
      </div>

      <fieldset className="field">
        <legend>Paquets prêts</legend>
        <p>
          Téléchargez le paquet, décompressez-le et placez le dossier dans <code>assets\packs-inbox\</code>, dans le dossier de l’application (un dossier par paquet, avec le fichier de licence à l’intérieur). Ensuite, cliquez sur « Chercher des paquets ».
          Les images apparaissent dans chaque fiche, pour choisir où les utiliser.
        </p>
        <button
          className="btn"
          data-testid="art-scan"
          onClick={async () => {
            try {
              const r = await artApi.scanPacks();
              setScan(`${r.packs.length} paquet(s) trouvé(s); ${r.added} nouvelle(s) image(s).`);
              await refresh();
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          Chercher des paquets
        </button>{' '}
        <span className="muted">{scan}</span>
        <ul>
          {studio.packs.map((p) => (
            <li key={p.id}>
              <strong>{p.name}</strong> : {p.files.length} images. {p.licenseNote ? `Licence : ${p.licenseNote.slice(0, 140)}` : 'Aucun fichier de licence dans le dossier — vérifiez la licence avant de l’utiliser.'}
            </li>
          ))}
        </ul>
      </fieldset>
    </div>
  );
}
