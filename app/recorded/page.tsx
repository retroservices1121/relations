import Link from "next/link";
import CartoonFaceWorkspace from "@/components/CartoonFaceWorkspace";

export default function RecordedVideoPage() {
  return (
    <main>
      <Link className="backLink" href="/studio">← Production Studio</Link>
      <div className="workspaceTop">
        <div>
          <span className="eyebrow">RECORDED VIDEO</span>
          <h1>Cartoon Face Video</h1>
          <p>Keep your real performance and audio, then replace your faces with the locked Household Nonsense characters.</p>
        </div>
      </div>
      <CartoonFaceWorkspace />
    </main>
  );
}
