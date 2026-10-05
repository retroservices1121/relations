import Link from "next/link";
import { dbConfigured, listSeries } from "@/lib/db";
import styles from "./series.module.css";
import StudioShell from "@/components/StudioShell";

export const dynamic="force-dynamic";
export default async function SeriesPage(){const series=dbConfigured()?await listSeries().catch(()=>[]):[];return <StudioShell active="series"><div className={styles.shell}><section className={styles.hero}><div><span>SHOW LIBRARY</span><h1>Series & cast</h1><p>Manage each show’s cast, visual identity, screenplay rules, format, and production settings in one place.</p></div><Link href="/series/new">Create new series</Link></section><div className={styles.grid}>{series.map((item)=><article className={styles.card} key={item.id}><span className={item.locked?styles.locked:""}>{item.locked?"PROTECTED ORIGINAL":"CUSTOM SERIES"}</span><h2>{item.title}</h2><p>{item.description||"No description yet."}</p><div className={styles.meta}><span>{item.characters.length} characters</span><span>{item.format}</span><span>{item.musicMode==="household-theme"?"Original theme":"No locked theme"}</span></div><div className={styles.cardLinks}><Link href={`/studio?series=${encodeURIComponent(item.id)}`}>Open workspace</Link><Link href={`/series/${item.id}`}>Series settings →</Link></div></article>)}</div></div></StudioShell>}
