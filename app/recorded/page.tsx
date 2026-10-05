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
      </div>
    </StudioShell>
  );
}
