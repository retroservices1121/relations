import Link from "next/link";
import "./landing.css";

const steps = [
  { n: "01", title: "Create the world", body: "Name the show, choose the look, and set the creative rules once." },
  { n: "02", title: "Build the cast", body: "Upload your characters and lock the details that make them recognizable." },
  { n: "03", title: "Pitch an episode", body: "Give Relations the premise. It turns the idea into a scene-by-scene short." },
  { n: "04", title: "Direct, fix, publish", body: "Regenerate only the scenes you dislike, finish the edit, and export." },
];

const creatorFeatures = [
  "100 generation credits every month",
  "Persistent shows + character libraries",
  "Scene-by-scene generation and regeneration",
  "Music, captions and final assembly",
  "Social-ready MP4 export",
];

const proFeatures = [
  "175 generation credits every month",
  "Everything in Creator",
  "More active shows and characters",
  "Priority generation queue",
  "Higher production limits",
];

export default function Home() {
  return (
    <main className="relLanding">
      <nav className="relNav">
        <Link href="/" className="relLogo" aria-label="Relations home">
          <span className="relLogoMark">R</span>
          <span>Relations</span>
        </Link>
        <div className="relNavLinks">
          <a href="#product">Product</a>
          <a href="#how">How it works</a>
          <a href="#pricing">Pricing</a>
        </div>
        <Link href="/studio" className="relNavButton">Preview Studio</Link>
      </nav>

      <section className="relHero">
        <div className="relHeroCopy">
          <span className="relKicker">AI STUDIO FOR RECURRING CHARACTERS</span>
          <h1>Your characters deserve <em>a series.</em></h1>
          <p className="relHeroLead">
            Create the cast once, keep the look consistent, and turn everyday ideas into episodes people recognize before they even read the caption.
          </p>
          <div className="relHeroActions">
            <Link href="/studio" className="relPrimary">Preview Relations Studio <span>→</span></Link>
            <a href="#how" className="relTextLink">See how it works</a>
          </div>
          <div className="relHeroNote">
            <span>Persistent cast</span>
            <span>Scene-level control</span>
            <span>Built for short-form</span>
          </div>
        </div>

        <div className="relHeroArt" aria-label="A recurring animated show being built inside Relations">
          <div className="relArtBlob relBlobOne" />
          <div className="relArtBlob relBlobTwo" />
          <div className="relPhone relPhoneBack">
            <div className="relPhoneScene sceneBlue">
              <div className="relMiniPerson personOne"><i/><b/></div>
              <div className="relMiniPerson personTwo"><i/><b/></div>
              <span className="relSceneEmoji">🧳</span>
            </div>
          </div>
          <div className="relPhone relPhoneFront">
            <div className="relPhoneTop"><span>Household Nonsense</span><b>EP. 08</b></div>
            <div className="relPhoneScene sceneWarm">
              <div className="relMiniPerson personOne"><i/><b/></div>
              <div className="relMiniPerson personTwo"><i/><b/></div>
              <div className="relLuggage"><i/><i/><i/></div>
              <span className="relOverlay">POV: Packing for a weekend getaway</span>
            </div>
            <div className="relSceneStatus"><span>4 scenes</span><b>Ready to build</b></div>
          </div>
          <div className="relFloatingCard cardCast"><small>CAST LOCKED</small><strong>Joe + Danda</strong><span>Same faces. Every episode.</span></div>
          <div className="relFloatingCard cardFix"><small>SCENE 03</small><strong>Not quite?</strong><span>Regenerate just this scene ↻</span></div>
        </div>
      </section>

      <section className="relManifesto" id="product">
        <p>Most AI video tools make a clip.</p>
        <h2>Relations helps you build something people can come back to.</h2>
        <div className="relManifestoGrid">
          <article><span>01</span><h3>A cast people remember</h3><p>Save character references, proportions, personalities and visual rules so your recurring cast stays recognizable.</p></article>
          <article><span>02</span><h3>A show with its own language</h3><p>Keep the format, pacing, style, audio behavior and creative guardrails attached to the show—not buried in prompts.</p></article>
          <article><span>03</span><h3>An actual production workflow</h3><p>Review scenes, replace the weak ones, add music and overlays, then assemble the finished short without starting over.</p></article>
        </div>
      </section>

      <section className="relShowcase">
        <div className="relShowcaseCopy">
          <span className="relKicker">THE SHOW BIBLE</span>
          <h2>The part AI usually forgets.</h2>
          <p>Relations remembers the details that make a series feel like the same series next week: the cast, the visual world, the rules, the format, even what your characters should never do.</p>
          <div className="relRuleList">
            <span>Character references</span><span>Visual style</span><span>Personality</span><span>Proportions</span><span>Audio rules</span><span>Negative prompts</span><span>Aspect ratio</span><span>Episode format</span>
          </div>
        </div>
        <div className="relBibleCard">
          <div className="relBibleHead"><div><small>SHOW BIBLE</small><h3>Household Nonsense</h3></div><span>LIVE</span></div>
          <div className="relCastRow"><div className="relAvatar avatarJoe">J</div><div><b>Joe</b><small>Bearded · everyday dad · early 40s</small></div><em>LOCKED</em></div>
          <div className="relCastRow"><div className="relAvatar avatarDanda">D</div><div><b>Danda</b><small>Expressive · warm · early 40s</small></div><em>LOCKED</em></div>
          <div className="relBibleDivider" />
          <div className="relBibleSetting"><small>VISUAL WORLD</small><b>Simple hand-drawn 2D cartoon</b></div>
          <div className="relBibleSetting"><small>FORMAT</small><b>Vertical 9:16 · social short</b></div>
          <div className="relBibleSetting"><small>SHOW RULE</small><b>No dialogue · physical comedy</b></div>
        </div>
      </section>

      <section className="relHow" id="how">
        <div className="relSectionHead">
          <span className="relKicker">FROM IDEA TO EPISODE</span>
          <h2>A workflow that feels like making a show—not operating a model.</h2>
        </div>
        <div className="relSteps">
          {steps.map((step) => (
            <article key={step.n}>
              <span>{step.n}</span>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="relPricing" id="pricing">
        <div className="relSectionHead relPricingHead">
          <span className="relKicker">LAUNCH PRICING</span>
          <h2>Enough credits to make. Not “unlimited” until the bill arrives.</h2>
          <p>Credits are used for AI generation. Final assembly and exports do not burn video-generation credits. Monthly plan credits reset each billing cycle.</p>
        </div>

        <div className="relPriceGrid">
          <article className="relPriceCard">
            <div className="relPlanTop"><span>CREATOR</span><p>For building and publishing your first recurring show.</p></div>
            <div className="relPrice"><strong>$29.99</strong><span>/ month</span></div>
            <div className="relCredits"><b>100</b><div><strong>monthly credits</strong><small>≈ up to 50 sec of Seedance Fast generation at the current credit model</small></div></div>
            <ul>{creatorFeatures.map((item) => <li key={item}>{item}</li>)}</ul>
            <Link href="/studio" className="relPlanButton">Preview Creator</Link>
          </article>

          <article className="relPriceCard relPriceFeatured">
            <div className="relPopular">BEST FOR ACTIVE CREATORS</div>
            <div className="relPlanTop"><span>CREATOR PRO</span><p>For creators publishing more often or running multiple shows.</p></div>
            <div className="relPrice"><strong>$49.99</strong><span>/ month</span></div>
            <div className="relCredits"><b>175</b><div><strong>monthly credits</strong><small>≈ up to 87.5 sec of Seedance Fast generation at the current credit model</small></div></div>
            <ul>{proFeatures.map((item) => <li key={item}>{item}</li>)}</ul>
            <Link href="/studio" className="relPlanButton relPlanButtonDark">Preview Pro</Link>
          </article>
        </div>

        <div className="relCreditExplainer">
          <div><span>HOW CREDITS WORK</span><h3>Spend them where the episode needs them.</h3></div>
          <div className="relCreditExamples">
            <span><b>10 credits</b><small>≈ 5 sec video generation</small></span>
            <span><b>20 credits</b><small>≈ 10 sec video generation</small></span>
            <span><b>30 credits</b><small>≈ 15 sec video generation</small></span>
            <span><b>2–3 credits</b><small>background music generation</small></span>
          </div>
          <p>Generation equivalents are based on the current Relations credit model and can vary as models and production options change.</p>
        </div>
      </section>

      <section className="relClosing">
        <span className="relKicker">ONE CAST. A HUNDRED STORIES.</span>
        <h2>Stop making random clips.<br/>Start making a show.</h2>
        <p>Relations is being built for creators who want recurring characters, recognizable worlds, and a production workflow they can come back to every week.</p>
        <Link href="/studio" className="relPrimary relClosingButton">Preview Relations Studio <span>→</span></Link>
      </section>

      <footer className="relFooter">
        <Link href="/" className="relLogo"><span className="relLogoMark">R</span><span>Relations</span></Link>
        <span>Create your cast once. Make episodes forever.</span>
        <span>© 2026 Relations</span>
      </footer>
    </main>
  );
}
