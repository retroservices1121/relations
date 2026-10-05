import MusicStudio from "../../components/MusicStudio";
import StudioShell from "../../components/StudioShell";
import styles from "./music.module.css";

export default function MusicPage() {
  return <StudioShell active="music"><div className={styles.page}>
    <header className={styles.hero}>
      <div>
        <span className={styles.kicker}>AUDIO WORKSPACE</span>
        <h1>Give every story<br/>its own rhythm.</h1>
        <p>Create original instrumental music for episodes, social posts, and series campaigns.</p>
      </div>
      <aside><span>Designed for your edit</span><strong>Generate, preview, and download without leaving the studio.</strong></aside>
    </header>
    <section className={styles.musicPanel}><MusicStudio /></section>
  </div></StudioShell>;
}
