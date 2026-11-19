import { useEffect, useState } from 'react';
import { api, type ProgressReport, type ReportTag } from '../api';
import { fmtDate } from '../dates';

/**
 * Progress report (week or month), compared with the previous period.
 * Warm, colourful tone (garden theme), to be read with Melina; also printable / PDF.
 */

const TREND: Record<string, { icon: string; label: string; cls: string }> = {
  progres: { icon: '🚀', label: 'En progrès', cls: 'up' },
  baisse: { icon: '💪', label: 'À retravailler', cls: 'down' },
  stable: { icon: '😌', label: 'Stable', cls: 'flat' },
  nouveau: { icon: '🌱', label: 'Nouveau', cls: 'new' },
  pause: { icon: '💤', label: 'Pas pratiqué', cls: 'pause' },
  peu: { icon: '🔎', label: 'Peu de données', cls: 'flat' },
};

export const SKILL_ICON: Record<string, string> = {
  'math.place-value': '🧱',
  'math.grouping-tens': '📦',
  'math.add-sub': '➕',
  'math.sequences': '🚂',
  'math.counting': '🪨',
  'math.representations': '🁫',
  'fr.plural': '🎣',
  'fr.comprehension': '📖',
  'fr.spelling': '🔍',
};

export function Kpi({ emoji, value, caption, color, delta }: { emoji: string; value: string; caption: string; color: string; delta: React.ReactNode }) {
  return (
    <div className={`rp-kpi ${color}`}>
      <span className="rp-kpi-emoji" aria-hidden="true">
        {emoji}
      </span>
      <span className="rp-num">{value}</span>
      <span className="rp-cap">{caption}</span>
      {delta}
    </div>
  );
}

function Board({ title, emoji, color, items, empty }: { title: string; emoji: string; color: string; items: ReportTag[]; empty: string }) {
  return (
    <section className={`rp-board ${color}`}>
      <h4>
        <span aria-hidden="true">{emoji}</span> {title}
      </h4>
      {items.length === 0 ? (
        <p className="rp-empty">{empty}</p>
      ) : (
        <ul>
          {items.map((t) => (
            <li key={t.tag} className="rp-sticker">
              <strong>{t.label}</strong>
              <span className="rp-sticker-meta">
                {t.rate === null ? 'pas pratiqué durant cette période' : `${t.rate} % du premier coup · ${t.n} essai${t.n > 1 ? 's' : ''}`}
                {t.rate !== null && t.prevRate !== null && ` · avant ${t.prevRate} %`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** The garden of days: each day grows a stem (activities); the flower opens according to first-try successes. */
function DayGarden({ days }: { days: ProgressReport['days'] }) {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const max = Math.max(4, ...days.map((d) => d.answers));
  const many = days.length > 10;
  return (
    <figure className="rp-days" aria-label="Activités par jour">
      <div className="rp-bars">
        {days.map((d) => {
          const date = new Date(`${d.date}T12:00:00`);
          // days written out in full («mardi 17»): «mar.» read as «março» (March) in Portuguese
          const label = many ? String(date.getDate()) : date.toLocaleDateString('fr-CA', { weekday: 'long', day: 'numeric' });
          const future = d.date > today;
          const tip = future
            ? `${date.toLocaleDateString('fr-CA', { weekday: 'long', day: 'numeric', month: 'long' })} : à venir`
            : `${date.toLocaleDateString('fr-CA', { weekday: 'long', day: 'numeric', month: 'long' })} : ${d.answers} activité${d.answers > 1 ? 's' : ''}, ${d.firstTry} réussie${d.firstTry > 1 ? 's' : ''} du premier coup`;
          const ratio = d.answers ? d.firstTry / d.answers : 0;
          const flower = !d.answers ? '' : ratio >= 0.8 ? '🌻' : ratio >= 0.5 ? '🌼' : '🌷';
          return (
            <div key={d.date} className={`rp-col ${future ? 'future' : ''} ${d.date === today ? 'today' : ''}`} title={tip} aria-label={tip}>
              <span className="rp-val">{d.answers > 0 ? d.answers : ''}</span>
              <div className="rp-track">
                {d.answers > 0 ? (
                  <div className="rp-plant" style={{ height: `${(100 * d.answers) / max}%` }}>
                    <span className="rp-flower" aria-hidden="true">
                      {flower}
                    </span>
                    <div className="rp-stem" />
                  </div>
                ) : future ? (
                  <span className="rp-future" aria-hidden="true">
                    à venir
                  </span>
                ) : (
                  <span className="rp-seed" aria-hidden="true">
                    ·
                  </span>
                )}
              </div>
              <span className="rp-day">{d.date === today ? `${label} (aujourd’hui)` : label}</span>
            </div>
          );
        })}
      </div>
      <figcaption className="rp-legend">
        Plus la tige est haute, plus il y a eu d’activités ce jour-là. 🌻 presque tout réussi du premier coup · 🌼 plus de la moitié · 🌷 on s’est bien entraîné.
      </figcaption>
    </figure>
  );
}

/** A welcome sentence summing up the period, to read with Melina. */
function headline(r: ProgressReport): string {
  const t = r.totals;
  const when = r.kind === 'week' ? 'Cette semaine' : 'Ce mois-ci';
  if (!t.answers) return `${when}, le jardin s’est reposé. On repart quand tu veux! 🌱`;
  const days = `${t.activeDays} jour${t.activeDays > 1 ? 's' : ''}`;
  const rate = t.firstTryRate ?? 0;
  // praise the process, never the person (research)
  const cheer = rate >= 80 ? 'Beaucoup de réussites du premier coup!' : rate >= 60 ? 'Beau travail régulier!' : 'Chaque essai fait pousser le jardin!';
  return `${when} : ${t.answers} activité${t.answers > 1 ? 's' : ''} en ${days}. ${cheer}`;
}

export function Report() {
  const [kind, setKind] = useState<'week' | 'month'>('week');
  const [offset, setOffset] = useState(0);
  const [r, setR] = useState<ProgressReport | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    // only the response for the CURRENT period counts (quick clicks on ◀ ▶ do not leave an old report over the new one)
    let current = true;
    setR(null);
    setErr('');
    api
      .report(kind, offset)
      .then((x) => current && setR(x))
      .catch(() => current && setErr('Impossible de charger le rapport.'));
    return () => {
      current = false;
    };
  }, [kind, offset]);

  return (
    <section className="report" data-testid="report">
      <div className="rp-toolbar no-print">
        <div className="rp-seg" role="group" aria-label="Période">
          <button className={kind === 'week' ? 'on' : ''} onClick={() => (setKind('week'), setOffset(0))}>
            🗓️ Semaine
          </button>
          <button className={kind === 'month' ? 'on' : ''} onClick={() => (setKind('month'), setOffset(0))}>
            🌙 Mois
          </button>
        </div>
        <div className="rp-seg">
          <button onClick={() => setOffset((o) => o - 1)} aria-label="Période précédente">
            ◀
          </button>
          <button onClick={() => setOffset((o) => Math.min(0, o + 1))} disabled={offset === 0} aria-label="Période suivante">
            ▶
          </button>
        </div>
        <button className="rp-print" onClick={() => window.print()} data-testid="report-print">
          🖨️ Imprimer / PDF
        </button>
      </div>
      {err && <p className="error">{err}</p>}
      {!r ? (
        !err && <p>Chargement…</p>
      ) : (
        <article className="rp-sheet">
          <header className="rp-hero">
            <div className="rp-hero-text">
              <p className="rp-kicker">{kind === 'week' ? 'Le journal de la semaine' : 'Le journal du mois'} 🌻</p>
              <h3 data-testid="report-title">{r.period.label}</h3>
              <p className="rp-headline">{headline(r)}</p>
              <p className="rp-sub">
                Comparé à : {r.previous.label.toLowerCase()} · fait le {fmtDate(r.generatedAt)}
              </p>
            </div>
            <span className="rp-mascot" aria-hidden="true">
              🦔
            </span>
          </header>

          <div className="rp-kpis">
            {/* context numbers, no change badge: the count must not become a goal (AAP, EEF), and the raw %
                drops when the game levels up (the real trend lives in the skills, from the model) */}
            <Kpi emoji="🎯" color="peach" value={String(r.totals.answers)} caption="activités faites" delta={null} />
            <Kpi emoji="⭐" color="sun" value={r.totals.firstTryRate === null ? '—' : `${r.totals.firstTryRate} %`} caption="réussies du premier coup" delta={null} />
            <Kpi emoji="📅" color="mint" value={String(r.totals.activeDays)} caption="jours de jardinage" delta={null} />
            <Kpi emoji="⏱️" color="sky" value={`≈ ${r.totals.minutes} min`} caption="de pratique" delta={null} />
          </div>
          {r.lowData && r.totals.answers > 0 && (
            <p className="rp-lowdata" data-testid="report-lowdata">
              🔎 Encore peu de réponses ({r.totals.answers}) : les tendances ci-dessous sont des indices, pas des conclusions.
            </p>
          )}

          <h4 className="rp-h">🌿 Le jardin {kind === 'week' ? 'de la semaine' : 'du mois'}</h4>
          <DayGarden days={r.days} />

          <h4 className="rp-h">🧩 Compétence par compétence</h4>
          {r.skills.length === 0 ? (
            <p className="rp-empty">Aucune activité sur ces deux périodes.</p>
          ) : (
            <div className="rp-skills" data-testid="report-skills">
              {r.skills.map((s) => {
                const t = TREND[s.trend] ?? (TREND.stable as { icon: string; label: string; cls: string });
                const pct = s.firstTryRate ?? 0;
                return (
                  <div key={s.skillId} className={`rp-skill ${s.subject === 'french' ? 'fr' : 'ma'}`} data-skill={s.skillId}>
                    <div className="rp-skill-top">
                      <span className="rp-skill-icon" aria-hidden="true">
                        {SKILL_ICON[s.skillId] ?? '🌟'}
                      </span>
                      <div>
                        <strong>{s.title}</strong>
                        <span className="rp-skill-sub">{s.subject === 'french' ? 'Français' : 'Mathématiques'} · {s.answers} activité{s.answers > 1 ? 's' : ''}</span>
                      </div>
                      <span className={`rp-trend ${t.cls}`}>
                        <span aria-hidden="true">{t.icon}</span> {t.label}
                      </span>
                    </div>
                    <div className="rp-meter" role="img" aria-label={`${s.firstTryRate ?? 0} % réussi du premier coup`}>
                      <div className="rp-meter-fill" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="rp-skill-foot">
                      <span>
                        {s.firstTryRate === null ? 'pas d’activité' : `${s.firstTryRate} % du premier coup`}
                        {s.reviews.n > 0 && ` · révisions un autre jour : ${s.reviews.ok}/${s.reviews.n}`}
                      </span>
                      {s.helpRate !== null && s.answers > 0 && (
                        <span className={`rp-help ${s.helpRate > 30 ? 'high' : ''}`} data-testid="report-help">
                          💡 Indice utilisé dans {s.helpRate} % des réponses{s.helpRate > 30 ? ' : le jeu baisse un peu le niveau pour consolider' : ''}
                        </span>
                      )}
                      {s.levelStart !== null && (
                        <span className="rp-level">{s.levelStart === s.levelEnd ? `niveau ${s.levelStart}` : `niveau ${s.levelStart} → ${s.levelEnd} 🚀`}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="rp-boards">
            <Board title="Ses super-pouvoirs" emoji="✨" color="sun" items={r.tags.strong} empty="Encore un peu d’entraînement et on les verra briller! (au moins 3 essais par point)" />
            <Board title="Ça monte!" emoji="📈" color="mint" items={r.tags.improving} empty="La comparaison viendra avec la prochaine période." />
            <Board title="On s’entraîne" emoji="🎯" color="sky" items={r.tags.weak} empty="Rien de difficile à signaler. Bravo!" />
            <Board title="Petit coup de pouce" emoji="🤏" color="peach" items={r.tags.declining} empty="Aucune baisse : tout roule!" />
            <Board title="Presque gagné" emoji="🌱" color="lilac" items={r.tags.almost} empty="Rien en attente de confirmation." />
          </div>

          {r.activities.length > 0 && (
            <>
              <h4 className="rp-h">🎮 Ses jeux préférés</h4>
              <div className="rp-games">
                {r.activities.map((a) => (
                  <span key={a.id} className="rp-game">
                    {a.title} <b>{a.answers}</b>
                  </span>
                ))}
              </div>
            </>
          )}

          <h4 className="rp-h">🏡 À la maison</h4>
          <div className="rp-home" data-testid="report-home">
            {r.home && (
              <p>
                <strong>🧺 Une activité ({r.home.skill}) :</strong> {r.home.text}
              </p>
            )}
            <p>
              <strong>💬 Une question pour en parler :</strong> « {r.talk} »
            </p>
            {r.goal && (
              <p>
                <strong>🎯 Un petit objectif :</strong> {r.goal}
              </p>
            )}
            <p className="rp-warning" data-testid="report-warning">
              🤝 Ce rapport sert à encourager et à choisir quoi pratiquer. Pas de récompense ni de punition selon les résultats : ça enlève le plaisir
              d’apprendre.
            </p>
          </div>

          <h4 className="rp-h">💡 Idées pour la suite</h4>
          <ul className="rp-recs" data-testid="report-recs">
            {r.recommendations.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
          <p className="rp-foot">
            🌱 « Du premier coup » = bonne réponse sans erreur ni aide · les super-pouvoirs et les points à travailler viennent du même modèle que le
            tableau de bord, qui tient compte du niveau : quand le jeu monte de niveau, le pourcentage baisse un peu, et ce n’est pas une baisse · « À
            revoir » ne s’affiche que si les révisions faites un autre jour sont ratées · calculé sur cet ordinateur, rien n’est envoyé.
          </p>
        </article>
      )}
    </section>
  );
}
