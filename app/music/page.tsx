import Link from "next/link";
import MusicStudio from "../../components/MusicStudio";

export default function MusicPage() {
  return <main>
    <header>
      <div>
        <span className="eyebrow">RELATIONS STUDIO</span>
        <h1>Music Studio</h1>
        <p>Original instrumental background music for social posts and promos.</p>
      </div>
      <Link href="/" className="statusPill">← Episode Library</Link>
    </header>
    <MusicStudio />
  </main>;
}
