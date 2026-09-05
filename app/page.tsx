import Link from "next/link";
import { episodes } from "../data/episodes";

export default function Home(){
  return <main>
    <header><div><span className="eyebrow">JOE + DANDA</span><h1>Relations Studio</h1><p>Cartoon-first short-form relationship video production.</p></div><div className="statusPill">Studio V1</div></header>
    <section className="stats"><div><b>{episodes.length}</b><span>Episodes ready</span></div><div><b>9:16</b><span>Master format</span></div><div><b>Seedance</b><span>Generation engine</span></div></section>
    <div className="sectionHeading"><div><span className="eyebrow">PRODUCTION QUEUE</span><h2>Episode Library</h2></div><p>Open an episode to generate its scenes individually.</p></div>
    <div className="grid">{episodes.map((e,i)=><Link className="episodeLink" href={`/episodes/${e.id}`} key={e.id}><article><span className="num">EP {String(i+1).padStart(2,"0")}</span><h3>{e.title}</h3><p>{e.hook}</p><footer><span>{e.scenes.length} scenes</span><span>{e.scenes.reduce((a,s)=>a+s.duration,0)} sec</span><span className="openLabel">Open →</span></footer></article></Link>)}</div>
  </main>
}
