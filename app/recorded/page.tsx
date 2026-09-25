import Link from "next/link";
import CartoonFaceWorkspace from "@/components/CartoonFaceWorkspace";
import TrendRemakePanel from "@/components/TrendRemakePanel";
import styles from "./recorded.module.css";

export default function RecordedVideoPage() {
  return (
    <div className={styles.shell}>
      <main className={styles.frame}>
        <nav className={styles.topbar}>
          <Link className={styles.brand} href="/studio">
            <span className={styles.brandMark}>R</span>
            <span className={styles.brandText}>
              <strong>Relations</strong>
              <small>Production Studio</small>
            </span>
          </Link>
          <div className={styles.navLinks}>
            <Link href="/studio">Episode board</Link>
            <Link href="/music">Music</Link>
            <span>Character Video</span>
          </div>
        </nav>

        <header className={styles.hero}>
          <div>
            <span className={styles.kicker}>Recorded performance workflow</span>
            <h1>Keep the performance.<br />Change the character.</h1>
            <p>
              Transform a trend with full-body Joe and Danda, or apply their locked
              cartoon heads to your own recorded performance.
            </p>
          </div>
          <aside className={styles.heroCard}>
            <span>How this build works</span>
            <ol>
              <li><b>01</b> Choose full-cartoon or locked-head production</li>
              <li><b>02</b> Upload the video and character references</li>
              <li><b>03</b> Generate and download the finished edit</li>
            </ol>
          </aside>
        </header>

        <TrendRemakePanel />
        <CartoonFaceWorkspace />
      </main>
    </div>
  );
}
