import Link from "next/link";
import { episodes } from "../data/episodes";
import { dbConfigured, getBuiltEpisodeIds, getPostedEpisodeIds } from "../lib/db";
import PostedToggle from "../components/PostedToggle";

export const dynamic = "force-dynamic";

export default async function Home(){
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
  const builtCount = episodes.filter((episode) => builtIds.has(episode.id)).length;
  const postedCount = episodes.filter((episode) => postedIds.has(episode.id)).length;

  return <main>
    <header><div><span className="eyebrow">JOE + DANDA</span><h1>Relations Studio</h1><p>Cartoon-first short-form relationship video production.</p></div><div className="statusPill">Studio V1</div></header>
    <section className="stats"><div><b>{episodes.length}</b><span>Episodes ready</span></div><div><b>{builtCount}</b><span>Episodes built</span></div><div><b>{postedCount}</b><span>Posted to social</span></div><div><b>9:16</b><span>Master format</span></div></section>
    <div className="sectionHeading"><div><span className="eyebrow">PRODUCTION QUEUE</span><h2>Episode Library</h2></div><p>Built episodes are marked automatically. Mark an episode posted after you publish it to social.</p></div>
    <div className="grid">{episodes.map((e,i)=>{
      const built = builtIds.has(e.id);
      const posted = postedIds.has(e.id);
      return <Link className="episodeLink" href={`/episodes/${e.id}`} key={e.id}><article className={built ? "episodeBuilt" : ""}>
        <div className="episodeTop"><span className="num">EP {String(i+1).padStart(2,"0")}</span>{built && <span className="builtBadge" aria-label="Episode built">✓ Built</span>}</div>
        <h3>{e.title}</h3><p>{e.hook}</p>
        <PostedToggle episodeId={e.id} initialPosted={posted} />
        <footer><span>{e.scenes.length} scenes</span><span>{e.scenes.reduce((a,s)=>a+s.duration,0)} sec</span><span className="openLabel">Open →</span></footer>
      </article></Link>;
    })}</div>
  </main>
}
