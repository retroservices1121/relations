import Link from "next/link";
import SeriesBuilder from "@/components/SeriesBuilder";
import styles from "../series.module.css";
import StudioShell from "@/components/StudioShell";

export default function NewSeriesPage(){return <StudioShell active="series"><div className={styles.shell}><Link className={styles.back} href="/series">← All series</Link><section className={styles.hero}><div><span>SERIES SETUP</span><h1>Create a recognizable world.</h1><p>Define the cast and production rules once. Every episode will inherit the same creative direction.</p></div></section><SeriesBuilder/></div></StudioShell>}
