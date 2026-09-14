import Link from "next/link";

const features = [
  ["Create your cast once", "Upload your characters, define their look, personality and rules, then reuse them across every episode."],
  ["Turn ideas into episodes", "Start with a simple idea. Relations structures it into scenes built for short-form social video."],
  ["Keep characters consistent", "Persistent character references and show-level guardrails help your cast stay recognizable scene after scene."],
  ["Regenerate only what broke", "Fix one scene without rebuilding the whole episode. Keep the good takes and replace the weak ones."],
  ["Finish inside the studio", "Add music, captions and final assembly, then export a vertical MP4 ready for social."],
  ["Build a real series", "Relations remembers the rules of your show so every new episode starts from the same creative foundation."],
];

const steps = [
  ["01", "Create your show", "Choose the visual style, format and rules that define your series."],
  ["02", "Add your cast", "Upload your characters once and lock in how they should look and behave."],
  ["03", "Describe an episode", "Give Relations the idea. The studio turns it into a scene-by-scene production."],
  ["04", "Review and publish", "Regenerate scenes, add finishing touches, build the final video and post."],
];

export default function Home(){
  return <main className="landingPage">
    <nav className="landingNav">
      <Link href="/" className="landingBrand"><span className="brandMark">R</span><span>Relations</span></Link>
      <div className="landingNavLinks"><a href="#how-it-works">How it works</a><a href="#features">Features</a><a href="#pricing">Pricing</a></div>
      <Link href="/studio" className="navCta">Open Studio</Link>
    </nav>

    <section className="landingHero">
      <div className="heroCopy">
        <span className="heroPill">AI VIDEO STUDIO FOR RECURRING CHARACTERS</span>
        <h1>Create your cast once.<br/><span>Make episodes forever.</span></h1>
        <p>Relations turns your characters into a recurring show. Build a cast, lock your style, describe an episode and turn it into social-ready video without starting from scratch every time.</p>
        <div className="heroActions"><Link href="/studio" className="primaryCta">Start creating</Link><a href="#how-it-works" className="secondaryCta">See how it works ↓</a></div>
        <div className="heroProof"><span>✓ Persistent characters</span><span>✓ Scene-by-scene control</span><span>✓ 9:16 social video</span></div>
      </div>

      <div className="heroVisual" aria-label="Relations episode workflow preview">
        <div className="studioMockTop"><span className="mockDot"/><span>Weekend Getaway</span><b>Episode 08</b></div>
        <div className="studioMockBody">
          <div className="mockPhone">
            <div className="mockScene mockSceneOne"><span className="mockSun">☀</span><div className="mockCharacter mockJoe"><i/><b/></div><div className="mockCharacter mockDanda"><i/><b/></div><div className="mockSuitcases"><i/><i/><i/></div></div>
            <div className="mockCaption">POV: Packing for a weekend getaway</div>
          </div>
          <div className="mockTimeline">
            <span className="mockLabel">EPISODE TIMELINE</span>
            {["Packed.", "Almost done.", "One more bag.", "Do you really need that?"].map((label, i)=><div className="mockTimelineRow" key={label}><span className="mockThumb">{i+1}</span><div><b>Scene {i+1}</b><small>{label}</small></div><em>{i===3?"Ready":"Generated"}</em></div>)}
          </div>
        </div>
      </div>
    </section>

    <section className="landingStrip"><span>CHARACTER CONSISTENCY</span><i/> <span>SCENE GENERATION</span><i/> <span>MUSIC + CAPTIONS</span><i/> <span>FINAL ASSEMBLY</span><i/> <span>SOCIAL EXPORT</span></section>

    <section className="landingSection" id="how-it-works">
      <div className="landingSectionIntro"><span className="eyebrow">HOW IT WORKS</span><h2>Your show already knows the rules.</h2><p>Stop rebuilding the same characters, style and instructions every time you want to make another video.</p></div>
      <div className="stepsGrid">{steps.map(([num,title,body])=><article className="stepCard" key={num}><span>{num}</span><h3>{title}</h3><p>{body}</p></article>)}</div>
    </section>

    <section className="landingSection" id="features">
      <div className="landingSectionIntro"><span className="eyebrow">BUILT FOR SERIES, NOT ONE-OFF CLIPS</span><h2>Everything your recurring show needs.</h2></div>
      <div className="featureGrid">{features.map(([title,body],i)=><article className="featureCard" key={title}><div className="featureIcon">{["✦","▶","◎","↻","♪","∞"][i]}</div><h3>{title}</h3><p>{body}</p></article>)}</div>
    </section>

    <section className="showBibleSection">
      <div><span className="eyebrow">THE SHOW BIBLE</span><h2>Your creative rules, remembered.</h2><p>Relations keeps the important details behind your series in one place: who your characters are, how they look, how they act, the visual style, format, audio rules and more.</p><div className="showBibleTags"><span>Character references</span><span>Visual style</span><span>Personality rules</span><span>Aspect ratio</span><span>Audio behavior</span><span>Negative prompts</span></div></div>
      <div className="bibleMock"><div className="bibleHeader"><span>SHOW BIBLE</span><b>Household Nonsense</b></div><div className="bibleCast"><div className="castAvatar joeAvatar">J</div><div><b>Joe</b><small>Early 40s · bearded · everyday dad</small></div><span>LOCKED</span></div><div className="bibleCast"><div className="castAvatar dandaAvatar">D</div><div><b>Danda</b><small>Early 40s · expressive · warm style</small></div><span>LOCKED</span></div><div className="bibleRule"><small>STYLE</small><b>Simple hand-drawn 2D cartoon</b></div><div className="bibleRule"><small>FORMAT</small><b>Vertical 9:16 · short-form social</b></div><div className="bibleRule"><small>SHOW RULE</small><b>No dialogue · physical comedy</b></div></div>
    </section>

    <section className="landingSection pricingSection" id="pricing">
      <div className="landingSectionIntro"><span className="eyebrow">SIMPLE PRICING</span><h2>Built for creators who actually publish.</h2><p>Two plans. No unlimited-generation gimmicks. Use your credits where your episodes need them.</p></div>
      <div className="pricingGrid">
        <article className="priceCard"><span className="priceLabel">CREATOR</span><h3><b>$29.99</b><small>/ month</small></h3><p>For creators starting a recurring series.</p><ul><li>Persistent shows and characters</li><li>AI scene generation</li><li>Scene regeneration</li><li>Music and captions</li><li>Final MP4 export</li></ul><Link href="/studio" className="secondaryCta priceButton">Start creating</Link></article>
        <article className="priceCard featuredPrice"><span className="popularTag">MOST POPULAR</span><span className="priceLabel">CREATOR PRO</span><h3><b>$49.99</b><small>/ month</small></h3><p>For creators publishing more often.</p><ul><li>Everything in Creator</li><li>More monthly generation credits</li><li>More active shows</li><li>Priority generation queue</li><li>Expanded character library</li></ul><Link href="/studio" className="primaryCta priceButton">Go Pro</Link></article>
      </div>
    </section>

    <section className="closingCta"><span className="eyebrow">YOUR CHARACTERS HAVE MORE STORIES</span><h2>Turn them into a show.</h2><p>Create the cast once. Keep making episodes.</p><Link href="/studio" className="primaryCta">Open Relations Studio</Link></section>

    <footer className="landingFooter"><Link href="/" className="landingBrand"><span className="brandMark">R</span><span>Relations</span></Link><p>AI production for recurring character-driven social video.</p><span>© 2026 Relations</span></footer>
  </main>;
}
