import Link from "next/link";
import CartoonFaceWorkspace from "@/components/CartoonFaceWorkspace";
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
            <span>Cartoon Face Video</span>
          </div>
        </nav>

        <header className={styles.hero}>
          <div>
            <span className={styles.kicker}>Recorded performance workflow</span>
            <h1>Keep the performance.<br />Change the character.</h1>
            <p>
              Turn a recorded clip into a Household Nonsense scene with the exact locked
              Joe and Danda cartoon heads, then combine it with costume stills.
            </p>
          </div>
          <aside className={styles.heroCard}>
            <span>How this build works</span>
            <ol>
              <li><b>01</b> Upload your live-action opening</li>
              <li><b>02</b> Apply the locked character heads</li>
              <li><b>03</b> Add stills and export one video</li>
            </ol>
          </aside>
        </header>

        <CartoonFaceWorkspace />
      </main>
    </div>
  );
}
