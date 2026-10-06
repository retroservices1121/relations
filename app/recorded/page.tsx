import CartoonFaceWorkspace from "@/components/CartoonFaceWorkspace";
import LayeredSocialPanel from "@/components/LayeredSocialPanel";
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
              Build a low-cost layered social video, transform a trend with full-body
              characters, or apply locked cartoon heads to your own performance.
            </p>
          </div>
          <aside className={styles.heroCard}>
            <span>How this build works</span>
            <ol>
              <li><b>01</b> Choose layered, full-cartoon or locked-head production</li>
              <li><b>02</b> Build only the clips and effects you need</li>
              <li><b>03</b> Export silently for Instagram music</li>
            </ol>
          </aside>
        </header>

        <LayeredSocialPanel />
        <TrendRemakePanel />
        <CartoonFaceWorkspace />
      </div>
    </StudioShell>
  );
}

