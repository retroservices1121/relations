import SeriesProductionSettings from "@/components/SeriesProductionSettings";
import Link from "next/link";
import { notFound } from "next/navigation";
import { dbConfigured, getSeries } from "@/lib/db";
import styles from "../series.module.css";

export const dynamic="force-dynamic";
export default async function SeriesDetail({params}:{params:Promise<{id:string}>}){const{id}=await params;const series=dbConfigured()?await getSeries(id):null;if(!series)notFound();return <main className={styles.shell}><div className={styles.frame}><nav className={styles.nav}><Link href="/series">← Series Library</Link><Link href="/studio">Production Studio</Link></nav><section className={styles.seriesHeader}><span>{series.locked?"PROTECTED ORIGINAL":"SERIES WORKSPACE"}</span><h1>{series.title}</h1><p>{series.description}</p><div className={styles.castChips}>{series.characters.map((character)=><span key={character.key}>{character.name}</span>)}</div></section><SeriesProductionSettings series={series}/><p><Link href={`/studio?series=${encodeURIComponent(series.id)}`}>Open production and create episodes →</Link></p></div></main>}
