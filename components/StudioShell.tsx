import Link from "next/link";
import styles from "./StudioShell.module.css";

type StudioSection = "home" | "episodes" | "recorded" | "music" | "series";

const navItems: Array<{ key: StudioSection; href: string; label: string; icon: React.ReactNode }> = [
  { key: "home", href: "/studio", label: "Studio home", icon: <HomeIcon /> },
  { key: "episodes", href: "/studio?series=household-nonsense", label: "Productions", icon: <GridIcon /> },
  { key: "recorded", href: "/recorded", label: "Character video", icon: <VideoIcon /> },
  { key: "music", href: "/music", label: "Music", icon: <MusicIcon /> },
];

export default function StudioShell({
  active,
  children,
  wide = false,
}: {
  active: StudioSection;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={styles.app}>
      <aside className={styles.sidebar}>
        <Link className={styles.logo} href="/studio" aria-label="Relations studio home">
          <span className={styles.logoMark}>R</span>
          <span><strong>Relations</strong><small>Creative Studio</small></span>
        </Link>

        <div className={styles.workspaceLabel}>Current series</div>
        <Link className={styles.seriesCard} href="/studio?series=household-nonsense">
          <span className={styles.seriesArtwork}><i>J</i><i>D</i></span>
          <span><strong>Household Nonsense</strong><small>Original series</small></span>
          <b>⌄</b>
        </Link>

        <Link className={styles.createButton} href="/studio?series=household-nonsense#new-production">
          <span>＋</span> New production
        </Link>

        <nav className={styles.navigation} aria-label="Studio navigation">
          <span className={styles.navLabel}>Workspace</span>
          {navItems.map((item) => (
            <Link key={item.key} href={item.href} className={active === item.key ? styles.active : ""} aria-current={active === item.key ? "page" : undefined}>
              {item.icon}<span>{item.label}</span>
            </Link>
          ))}
          <span className={styles.navLabel}>Manage</span>
          <Link href="/series" className={active === "series" ? styles.active : ""} aria-current={active === "series" ? "page" : undefined}>
            <SettingsIcon /><span>Series & cast</span>
          </Link>
        </nav>

        <div className={styles.sidebarFooter}>
          <div className={styles.planCard}><span>Creator workspace</span><strong>Production tools ready</strong><i><b /></i></div>
          <Link href="/">View public site <span>↗</span></Link>
        </div>
      </aside>

      <div className={styles.stage}>
        <header className={styles.mobileHeader}>
          <Link className={styles.mobileLogo} href="/studio"><span className={styles.logoMark}>R</span><strong>Relations</strong></Link>
          <Link href="/studio?series=household-nonsense#new-production">＋ New</Link>
        </header>
        <main className={`${styles.content} ${wide ? styles.wide : ""}`}>{children}</main>
      </div>
    </div>
  );
}

function HomeIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1z" /></svg>; }
function GridIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/></svg>; }
function VideoIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="13" height="12" rx="3"/><path d="m16 10 5-3v10l-5-3z"/></svg>; }
function MusicIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18V6l11-2v12"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/></svg>; }
function SettingsIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/></svg>; }
