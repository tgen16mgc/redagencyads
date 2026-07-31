import type { Metadata } from "next"
import Link from "next/link"
import {
  ArrowRightIcon,
  BarChart3Icon,
  CheckIcon,
  FileTextIcon,
  LanguagesIcon,
  RadioIcon,
  SearchIcon,
  SendIcon,
  ShieldCheckIcon,
  WaypointsIcon,
} from "lucide-react"

import { LandingActionLink } from "./landing-action-link"
import styles from "./landing.module.css"

export const metadata: Metadata = {
  title: "Red Agency Ads | Decision Workspace",
  description:
    "Turn paid media performance and verified market evidence into traceable Verdicts, guarded budget moves, and client-ready action plans.",
}

const workflow = [
  ["01", "Connect", "Bring Meta performance or verified market evidence into the workspace.", "Research can start before a Meta account is connected."],
  ["02", "Diagnose", "Rank the highest-impact issue while keeping the supporting rows visible.", "Every ranking keeps the evidence that produced it."],
  ["03", "Decide", "Produce a deterministic Verdict, guarded budget move, and test priorities.", "Budget moves stop at the 20% guardrail."],
  ["04", "Deliver", "Export the client report or move a reviewed action into publishing.", "Publishing stays behind explicit review."],
]

const guarantees = [
  ["Claims stay beside their source", "Every observation keeps the ad, time window, and review state that supports it."],
  ["Missing inputs stay visibly missing", "A stale or degraded source appears as a gap instead of being silently filled."],
  ["Observation becomes an original test", "Competitor research turns into a brief in your own voice—not copied advertising."],
  ["You can tell evidence from wording", "Verified facts, assumptions, and AI-enhanced phrasing are labelled separately."],
]

const outputs = [
  ["Verdict", "Deterministic strategic conclusions", "The same evidence reproduces the same core claim, even without an AI provider."],
  ["Priority", "A ranked list of what changes next", "The highest-impact diagnosis arrives first with its supporting rows still attached."],
  ["Report", "Client-ready PDF output", "The record that produced the Verdict also produces the report—no rebuilding the story."],
  ["Language", "English and Vietnamese consistency", "One setting carries from the workspace through the exported client report."],
  ["Disclosure", "Clear provider and fallback state", "You always see which capabilities are connected, degraded, or running locally."],
]

const jobs = [
  [BarChart3Icon, "01", "Diagnose performance", "Rank what is costing money across campaigns, ad sets, and creative.", "Requires Meta"],
  [SearchIcon, "02", "Investigate competitors", "Turn verified ad-library evidence into themes, gaps, and original test briefs.", "Works without Meta"],
  [RadioIcon, "03", "Track TikTok signals", "Watch channel and video movement without mixing it with Ads Manager performance.", "Works without Meta"],
  [SendIcon, "04", "Publish with control", "Move a reviewed action into Facebook Page publishing with the decision record attached.", "Requires Meta"],
] as const

export default function LandingPage() {
  return (
    <main className={styles.page}>
      <header className={styles.navShell}>
        <nav className={styles.nav} aria-label="Main navigation">
          <Link href="/landing" className={styles.brand} aria-label="Red Agency Ads home">
            <span className={styles.brandMark} aria-hidden="true"><WaypointsIcon /></span>
            <span><strong>Red Agency Ads</strong><small>Decision Workspace</small></span>
          </Link>
          <div className={styles.navLinks}>
            <a href="#how-it-works">How it works</a>
            <a href="#evidence">Evidence</a>
            <a href="#decisions">Decisions</a>
            <a href="#use-cases">Use cases</a>
          </div>
          <LandingActionLink href="/" className={styles.navCta}>Log in</LandingActionLink>
        </nav>
      </header>

      <section id="top" className={styles.hero}>
        <div className={styles.heroField}>
          <div className={styles.photoCredit}>Photo via Unsplash</div>
          <div className={styles.heroCopy}>
            <p className={`${styles.eyebrow} ${styles.resolveOne}`}>Decision operations for paid media</p>
            <h1 className={`${styles.resolveTwo}`}>Make the next ad decision without guessing.</h1>
            <p className={`${styles.resolveThree}`}>
              Turn performance, verified competitor evidence, and TikTok signals into traceable
              Verdicts, guarded budget moves, and client-ready action plans.
            </p>
            <div className={`${styles.heroActions} ${styles.resolveFour}`}>
              <LandingActionLink href="/" className={styles.primaryCta}>Log in to workspace</LandingActionLink>
              <a href="#how-it-works" className={styles.ghostCta}>See how it works <ArrowRightIcon /></a>
            </div>
          </div>

          <div className={`${styles.heroSurface} ${styles.resolveSurface}`}>
            <iframe
              className={styles.productPreviewFrame}
              data-surface="overview"
              src="/landing/product-preview?surface=overview"
              title="Live Red Agency Ads V2 workspace preview"
              tabIndex={-1}
            />
          </div>
        </div>

        <ul className={styles.trustRail} aria-label="Workspace guarantees">
          <li><strong>Deterministic Verdicts</strong><span>Core analysis works without an AI provider</span></li>
          <li><strong>20% budget guardrail</strong><span>Recommendations protect Meta learning stability</span></li>
          <li><strong>English + Vietnamese</strong><span>One language setting from workspace to report</span></li>
        </ul>
      </section>

      <section className={styles.problemSection}>
        <h2>Dashboards show what happened. <span>Red Agency Ads shows what changes next.</span></h2>
        <div className={styles.problemGrid}>
          <article className={styles.fragmentedPanel}>
            <p className={styles.panelLabel}>Today — five surfaces, no owner</p>
            <dl>
              <div><dt>Ads Manager</dt><dd>Shows what happened, never what to change</dd></div>
              <div><dt>Spreadsheet</dt><dd>Reasoning lives in a cell nobody can audit</dd></div>
              <div><dt>Ad-library tabs</dt><dd>Research disappears when the tab closes</dd></div>
              <div><dt>AI chat</dt><dd>Confident wording with no traceable source</dd></div>
              <div><dt>Client deck</dt><dd>Rebuilt by hand every reporting cycle</dd></div>
            </dl>
            <p>Every hand-off loses the reasoning. By the time a client asks why the budget moved, the evidence is three tools away.</p>
          </article>

          <article className={styles.loopPanel}>
            <p className={styles.panelLabel}>Instead — one accountable decision loop</p>
            <ol>
              <li><span>1</span><p>Evidence enters once and keeps its source.</p></li>
              <li><span>2</span><p>The Verdict is derived, not improvised.</p></li>
              <li><span>3</span><p>The budget move is bounded before anyone sees it.</p></li>
              <li><span>4</span><p>The report and publishing action share the same record.</p></li>
            </ol>
          </article>
        </div>
      </section>

      <section id="how-it-works" className={styles.workflowSection}>
        <div className={styles.workflowCard}>
          <header className={styles.sectionLead}>
            <h2>One loop, from raw evidence to a reviewed action.</h2>
            <p>The same record moves through all four stages. Nothing is retyped, and nothing loses its provenance on the way.</p>
          </header>
          <div className={styles.workflowRail}>
            {workflow.map(([number, title, description, note]) => (
              <article key={number} className={styles.workflowStep}>
                <i aria-hidden="true" />
                <span>{number}</span>
                <h3>{title}</h3>
                <p>{description}</p>
                <small>{note}</small>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="evidence" className={styles.evidenceSection}>
        <div className={styles.evidenceVisual}>
          <iframe
            className={styles.productPreviewFrame}
            data-surface="competitor"
            src="/landing/product-preview?surface=competitor"
            title="Live Red Agency Ads V2 competitor evidence preview"
            tabIndex={-1}
          />
          <p>Competitor evidence — live V2 workspace preview</p>
        </div>
        <div className={styles.evidenceCopy}>
          <p className={styles.kicker}>Traceability</p>
          <h2>Every recommendation keeps its evidence attached.</h2>
          <ul>
            {guarantees.map(([title, description]) => (
              <li key={title}><span><CheckIcon /></span><div><h3>{title}</h3><p>{description}</p></div></li>
            ))}
          </ul>
          <LandingActionLink href="/" className={styles.inlineCta}>Log in to workspace</LandingActionLink>
        </div>
      </section>

      <section id="decisions" className={styles.decisionsSection}>
        <h2>Leave with a decision your team can defend.</h2>
        <div className={styles.decisionGrid}>
          <article className={styles.guardrailCard}>
            <p className={styles.panelLabel}>Hard ceiling</p>
            <strong>20<span>%</span></strong>
            <p>No recommended budget move exceeds twenty percent in a single step. The guardrail protects Meta learning stability.</p>
            <dl>
              <div><dt>Proposed move</dt><dd>+12%</dd></div>
              <div><dt>Guardrail ceiling</dt><dd>20%</dd></div>
              <div><dt>Review before publish</dt><dd>Required</dd></div>
            </dl>
          </article>
          <div className={styles.outputList}>
            {outputs.map(([label, title, description]) => (
              <article key={label}><span>{label}</span><div><h3>{title}</h3><p>{description}</p></div></article>
            ))}
          </div>
        </div>
      </section>

      <section id="use-cases" className={styles.useCasesSection}>
        <header className={styles.sectionLead}>
          <h2>Four jobs the workspace already does.</h2>
          <p>Two need a connected Meta account. Two do not—your team can start research before connecting anything.</p>
        </header>
        <div className={styles.jobGrid}>
          {jobs.map(([Icon, number, title, description, requirement]) => (
            <article key={number} className={styles.jobCard}>
              <div><span>{number}</span><Icon /></div>
              <h3>{title}</h3>
              <p>{description}</p>
              <small data-available={requirement === "Works without Meta"}>{requirement}</small>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.finalCta}>
        <div className={styles.finalIcon}><ShieldCheckIcon /></div>
        <h2>Stop translating dashboards into decisions by hand.</h2>
        <p>Bring the evidence, review the Verdict, and leave with the next action.</p>
        <LandingActionLink href="/" className={styles.finalButton}>Log in to Red Agency Ads</LandingActionLink>
      </section>

      <footer className={styles.footer}>
        <div className={styles.footerBrand}><span className={styles.brandMark}><WaypointsIcon /></span><div><strong>Red Agency Ads</strong><small>Decision operations for paid media</small></div></div>
        <nav aria-label="Footer navigation"><Link href="/">Log in</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link></nav>
        <div className={styles.footerMeta}><span><FileTextIcon />Client-ready output</span><span><LanguagesIcon />EN + VI</span></div>
      </footer>
    </main>
  )
}
