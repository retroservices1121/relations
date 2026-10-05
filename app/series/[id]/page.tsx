import SeriesProductionSettings from "@/components/SeriesProductionSettings";
import Link from "next/link";
import { notFound } from "next/navigation";
import { dbConfigured, getSeries } from "@/lib/db";
import styles from "../series.module.css";
import StudioShell from "@/components/StudioShell";

export const dynamic="force-dynamic";
export default async function SeriesDetail({params}:{params:Promise<{id:string}>}){const{id}=await params;const series=dbConfigured()?await getSeries(id):null;if(!series)notFound();return <StudioShell active="series"><div className={styles.shell}><Link className={styles.back} href="/series">← All series</Link><section className={styles.seriesHeader}><span>{series.locked?"PROTECTED ORIGINAL":"SERIES WORKSPACE"}</span><h1>{series.title}</h1><p>{series.description}</p><div className={styles.castChips}>{series.characters.map((character)=><span key={character.key}>{character.name}</span>)}</div></section><SeriesProductionSettings series={series}/><p className={styles.workspaceLink}><Link href={`/studio?series=${encodeURIComponent(series.id)}`}>Return to production workspace →</Link></p></div></StudioShell>}
