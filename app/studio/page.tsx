import Link from "next/link";
import { notFound } from "next/navigation";
import { episodes as baseEpisodes } from "../../data/episodes";
import { extraEpisodes } from "../../data/extraEpisodes";
import { musicalEpisodes } from "../../data/musicalEpisodes";
import { episodeOverrides } from "../../data/episodeOverrides";
import { newEpisodes } from "../../data/newEpisodes";
import type { Episode } from "../../data/episodes";
import { dbConfigured, getBuiltEpisodeIds, getPostedEpisodeIds, listCustomEpisodes, listSeries } from "../../lib/db";
import PostedToggle from "../../components/PostedToggle";
import NewEpisodeComposer from "../../components/NewEpisodeComposer";
import DeleteQueuedEpisode from "../../components/DeleteQueuedEpisode";
import styles from "./studio.module.css";

export const dynamic="force-dynamic";
const originals:Episode[]=[...baseEpisodes.map(item=>episodeOverrides[item.id]??item),...extraEpisodes,...newEpisodes,...musicalEpisodes];

function EpisodeCard({episode,index,built,posted}:{episode:Episode;index:number;built:boolean;posted:boolean}) {
  const duration=episode.scenes.reduce((sum,scene)=>sum+scene.duration,0);
  return <article className={styles.card}>
    <div className={styles.cardTop}><span className={styles.episodeNo}>EP {String(index+1).padStart(2,"0")}</span><span className={`${styles.status} ${posted?styles.published:built?styles.ready:""}`}>{posted?"Published":built?"Ready":"In production"}</span></div>
    <Link href={`/episodes/${episode.id}`}><h3>{episode.title}</h3><p>{episode.hook}</p></Link>
    <div className={styles.cardMeta}><span className={styles.metaPill}>{episode.scenes.length} scenes</span><span className={styles.metaPill}>{duration} sec</span></div>
    <div className={styles.cardActions}><PostedToggle episodeId={episode.id} initialPosted={posted}/>{episode.id.startsWith("custom-")&&!built&&!posted&&<DeleteQueuedEpisode episodeId={episode.id} title={episode.title}/>}<Link className={styles.open} href={`/episodes/${episode.id}`}>Open episode →</Link></div>
  </article>;
}

export default async function Studio({searchParams}:{searchParams:Promise<{series?:string}>}) {
  const {series:selectedId}=await searchParams;
  const [series,customEpisodes,built,posted]=dbConfigured()?await Promise.all([listSeries(),listCustomEpisodes(),getBuiltEpisodeIds(),getPostedEpisodeIds()]):[[],[],[],[]];
  const selected=selectedId?series.find(item=>item.id===selectedId):undefined;
  if(selectedId&&!selected) notFound();
  const episodes:Episode[]=selected?[...customEpisodes.filter(item=>item.seriesId===selected.id),...(selected.id==="household-nonsense"?originals:[])]:[];
  const builtIds=new Set(built),postedIds=new Set(posted);
  const indexed=episodes.map((episode,index)=>({episode,index}));
  const lanes=[
    {title:"In production",items:indexed.filter(({episode})=>!builtIds.has(episode.id))},
    {title:"Ready to publish",items:indexed.filter(({episode})=>builtIds.has(episode.id)&&!postedIds.has(episode.id))},
    {title:"Published",items:indexed.filter(({episode})=>postedIds.has(episode.id))},
  ];
  return <div className={styles.shell}><main className={styles.frame}>
    <nav className={styles.topbar}><div className={styles.brand}><div className={styles.brandMark}>R</div><div className={styles.brandText}><strong>Relations</strong><span>Production Studio</span></div></div><div className={styles.nav}><Link href="/">Public site</Link><Link href="/series">Manage Series</Link><Link href="/series/new">Create Series</Link></div></nav>
    {!selected?<><section className={styles.hero}><div className={styles.heroCopy}><span className={styles.kicker}>Your production studio</span><h1>Choose a series to work on.</h1><p>Each series has its own cast, screenplay rules, episodes, and saved production assets.</p><div className={styles.studioActions}><Link href="/series" className={styles.secondaryAction}>Manage Series</Link><Link href="/series/new" className={styles.primaryAction}>Create Series →</Link></div></div><aside className={styles.heroPanel}><div><span className={styles.heroPanelLabel}>YOUR WORKSPACE</span><strong>One studio. A separate home for every show.</strong><p>Open a series to write episodes and manage its production queue.</p></div></aside></section>
      <section><div className={styles.sectionHead}><div><span className={styles.kicker}>Series library</span><h2>Continue a show</h2></div></div><div className={styles.seriesGrid}>{series.map(item=>{const count=customEpisodes.filter(episode=>episode.seriesId===item.id).length+(item.id==="household-nonsense"?originals.length:0);return <article className={styles.seriesCard} key={item.id}><span className={styles.kicker}>{item.locked?"Original series":"Series"}</span><h3>{item.title}</h3><p>{item.description||"Add a description in series settings."}</p><div className={styles.cardMeta}><span className={styles.metaPill}>{count} episodes</span><span className={styles.metaPill}>{item.characters.length} characters</span></div><Link href={`/studio?series=${encodeURIComponent(item.id)}`}>Open production →</Link></article>})}</div>{series.length===0&&<p>Create your first series to start producing episodes.</p>}</section>
    </>:<><section className={styles.selectedHero}><Link href="/studio">← All series</Link><span className={styles.kicker}>Series production</span><h1>{selected.title}</h1><p>{selected.description}</p><div className={styles.studioActions}><Link href={`/series/${selected.id}`} className={styles.secondaryAction}>Manage this series</Link><Link href="/series/new" className={styles.primaryAction}>Create Series</Link></div></section>
      <NewEpisodeComposer seriesId={selected.id} seriesTitle={selected.title}/>
      <section className={styles.metrics} aria-label="Series overview"><div className={styles.metric}><b>{episodes.length}</b><span>episodes</span></div><div className={styles.metric}><b>{episodes.filter(episode=>builtIds.has(episode.id)).length}</b><span>finished builds</span></div><div className={styles.metric}><b>{episodes.filter(episode=>postedIds.has(episode.id)).length}</b><span>published</span></div><div className={styles.metric}><b>{selected.characters.length}</b><span>characters</span></div></section>
      <section><div className={styles.sectionHead}><div><span className={styles.kicker}>Production board</span><h2>{selected.title} episodes</h2></div></div><div className={styles.lanes}>{lanes.map(lane=><div className={styles.lane} key={lane.title}><div className={styles.laneHead}><div className={styles.laneTitle}><span className={styles.laneDot}/>{lane.title}</div><span className={styles.laneCount}>{lane.items.length}</span></div><div className={styles.cards}>{lane.items.length?lane.items.map(({episode,index})=><EpisodeCard key={episode.id} episode={episode} index={index} built={builtIds.has(episode.id)} posted={postedIds.has(episode.id)}/>):<div className={styles.empty}>Nothing here yet.</div>}</div></div>)}</div></section>
    </>}
  </main></div>;
}
