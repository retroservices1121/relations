import CartoonFaceWorkspace from "@/components/CartoonFaceWorkspace";
import TrendRemakePanel from "@/components/TrendRemakePanel";
import StudioShell from "@/components/StudioShell";
import styles from "./recorded.module.css";

export default function RecordedVideoPage() {
  return (
    <StudioShell active="recorded" wide>
      <div className={`${styles.shell} ${styles.frame}`}>
        <header className={styles.hero}>
          <div>
            <span className={styles.kicker}>Recorded performance workflow</span>
            <h1>Keep the performance.<br />Change the character.</h1>
            <p>
              Transform a recorded trend with full-body characters or apply locked
              cartoon heads to your own performance. Build original low-cost episodes
              from the main Episode Studio.
            </p>
          </div>
          <aside className={styles.heroCard}>
            <span>How this build works</span>
            <ol>
              <li><b>01</b> Choose full-cartoon or locked-head production</li>
              <li><b>02</b> Upload the performance and locked references</li>
              <li><b>03</b> Export with original audio or silently</li>
            </ol>
          </aside>
        </header>

        <TrendRemakePanel />
        <CartoonFaceWorkspace />
      </div>
    </StudioShell>
  );
}

