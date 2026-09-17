import Link from "next/link";
import { episodes as baseEpisodes } from "../../data/episodes";
import { extraEpisodes } from "../../data/extraEpisodes";
import { musicalEpisodes } from "../../data/musicalEpisodes";
import { episodeOverrides } from "../../data/episodeOverrides";
import { newEpisodes } from "../../data/newEpisodes";
import { dbConfigured, getBuiltEpisodeIds, getPostedEpisodeIds } from "../../lib/db";
import PostedToggle from "../../components/PostedToggle";
import styles from "./studio.module.css";

export const dynamic = "force-dynamic";

const episodes = [
  ...baseEpisodes.map((episode) => episodeOverrides[episode.id] ?? episode),
  ...extraEpisodes,
  ...newEpisodes,
  ...musicalEpisodes,
];

type StudioEpisode = (typeof episodes)[number];

function EpisodeCard({ episode, index, built, posted }: { episode: StudioEpisode; index: number; built: boolean; posted: boolean }) {
  const musical = "musical" in episode;
  const duration = episode.scenes.reduce((total, scene) => total + scene.duration, 0);
  const statusLabel = posted ? "Published" : built ? "Ready" : "In production";
  const statusClass = posted ? styles.published : built ? styles.ready : "";

  return <article className={styles.card}>
    <div className={styles.cardTop}>
      <span className={styles.episodeNo}>EP {String(index + 1).padStart(2, "0")}</span>
      <span className={`${styles.status} ${statusClass}`}>{statusLabel}</span>
    </div>
    <Link href={`/episodes/${episode.id}`}>
      <h3>{episode.title}</h3>
      <p>{episode.hook}</p>
    </Link>
    <div className={styles.cardMeta}>
      <span className={styles.metaPill}>{episode.scenes.length} scenes</span>
      <span className={styles.metaPill}>{duration} sec</span>
      {musical && <span className={`${styles.metaPill} ${styles.musical}`}>♪ Musical</span>}
    </div>
    <div className={styles.cardActions}>
      <PostedToggle episodeId={episode.id} initialPosted={posted} />
      <Link className={styles.open} href={`/episodes/${episode.id}`}>Open episode →</Link>
    </div>
  </article>;
}

export default async function Studio(){
  let builtIds = new Set<string>();
  let postedIds = new Set<string>();
  if (dbConfigured()) {
    try {
      const [built, posted] = await Promise.all([getBuiltEpisodeIds(), getPostedEpisodeIds()]);
      builtIds = new Set(built);
      postedIds = new Set(posted);
    } catch {
      builtIds = new Set();
      postedIds = new Set();
    }
  }

  const indexed = episodes.map((episode, index) => ({ episode, index }));
  const inProduction = indexed.filter(({ episode }) => !builtIds.has(episode.id));
  const ready = indexed.filter(({ episode }) => builtIds.has(episode.id) && !postedIds.has(episode.id));
  const published = indexed.filter(({ episode }) => postedIds.has(episode.id));
  const builtCount = episodes.filter((episode) => builtIds.has(episode.id)).length;
  const postedCount = episodes.filter((episode) => postedIds.has(episode.id)).length;
  const totalSeconds = episodes.reduce((total, episode) => total + episode.scenes.reduce((sum, scene) => sum + scene.duration, 0), 0);

  const lanes = [
    { title: "In production", items: inProduction },
    { title: "Ready to publish", items: ready },
    { title: "Published", items: published },
  ];

  return <div className={styles.shell}>
    <main className={styles.frame}>
      <nav className={styles.topbar}>
        <div className={styles.brand}>
          <div className={styles.brandMark}>R</div>
          <div className={styles.brandText}><strong>Relations</strong><span>Production Studio</span></div>
        </div>
        <div className={styles.nav}>
          <Link href="/">Public site</Link>
          <Link href="/music">Music</Link>
          <span className={styles.version}>Studio V2</span>
        </div>
      </nav>

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <span className={styles.kicker}>Recurring-character production</span>
          <h1>Make the next episode, not another random clip.</h1>
          <p>Your cast, show rules, scenes, generations, music and finished episodes in one production desk. The interface now follows the actual workflow: make it, finish it, publish it.</p>
        </div>
        <aside className={styles.heroPanel}>
          <div>
            <span className={styles.heroPanelLabel}>Generation router</span>
            <strong>Choose the right model for the scene.</strong>
            <p>Character references and show rules stay locked while the generation provider can change underneath.</p>
          </div>
          <div className={styles.providerRow}>
            <span className={styles.provider}>HIGGSFIELD · SEEDANCE 2.5</span>
            <span className={styles.provider}>FAL · SEEDANCE 2 FAST</span>
            <span className={styles.provider}>FAL · SEEDANCE 2 STANDARD</span>
          </div>
        </aside>
      </section>

      <section className={styles.metrics} aria-label="Studio overview">
        <div className={styles.metric}><b>{episodes.length}</b><span>episodes in library</span></div>
        <div className={styles.metric}><b>{builtCount}</b><span>finished builds</span></div>
        <div className={styles.metric}><b>{postedCount}</b><span>published to social</span></div>
        <div className={styles.metric}><b>{Math.round(totalSeconds / 60)}m</b><span>planned runtime</span></div>
      </section>

      <section>
        <div className={styles.sectionHead}>
          <div><span className={styles.kicker}>Production board</span><h2>Episode queue</h2></div>
          <p>Episodes move naturally from production to ready to publish to published. Open any card to generate or regenerate individual scenes.</p>
        </div>
        <div className={styles.lanes}>
          {lanes.map((lane) => <div className={styles.lane} key={lane.title}>
            <div className={styles.laneHead}>
              <div className={styles.laneTitle}><span className={styles.laneDot} />{lane.title}</div>
              <span className={styles.laneCount}>{lane.items.length}</span>
            </div>
            <div className={styles.cards}>
              {lane.items.length ? lane.items.map(({ episode, index }) => <EpisodeCard key={episode.id} episode={episode} index={index} built={builtIds.has(episode.id)} posted={postedIds.has(episode.id)} />) : <div className={styles.empty}>Nothing here yet.</div>}
            </div>
          </div>)}
        </div>
      </section>

      <footer className={styles.footer}>
        <span><b>Production format:</b> vertical 9:16 recurring-character shorts</span>
        <span>Character references → scenes → audio → final render → publish</span>
      </footer>
    </main>
  </div>;
}
