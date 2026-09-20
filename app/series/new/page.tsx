import Link from "next/link";
import SeriesBuilder from "@/components/SeriesBuilder";
import styles from "../series.module.css";

export default function NewSeriesPage(){return <main className={styles.shell}><div className={styles.frame}><nav className={styles.nav}><Link href="/series">← Series Library</Link><b>New Series</b></nav><section className={styles.hero}><div><span>SERIES SETUP</span><h1>Build the show bible first.</h1><p>Define the cast and production rules once. Every episode will inherit them without touching Household Nonsense.</p></div></section><SeriesBuilder/></div></main>}
