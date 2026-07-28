import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { WaypointsIcon } from "lucide-react"

import { LandingActionLink } from "./landing-action-link"
import styles from "./landing.module.css"

export const metadata: Metadata = {
  title: "Decision Workspace | Evidence to action",
  description:
    "Diagnose Meta performance, trace the evidence, and turn campaign data into a client-ready decision and action plan.",
}

const workflow = [
  {
    number: "01",
    label: "Input",
    title: "Connect",
    description: "Bring Meta performance or verified competitor evidence into one accountable workspace.",
  },
  {
    number: "02",
    label: "Signal",
    title: "Diagnose",
    description: "Rank the highest-impact issue while keeping the supporting rows visible.",
  },
  {
    number: "03",
    label: "Verdict",
    title: "Decide",
    description: "Generate a deterministic Verdict with guarded budget moves and test priorities.",
  },
  {
    number: "04",
    label: "Action",
    title: "Deliver",
    description: "Export a client-ready report or move a reviewed action into publishing.",
  },
]

const guarantees = [
  ["Deterministic Verdicts", "Local analysis works without an AI provider."],
  ["20% budget guardrail", "Recommendations protect Meta learning stability."],
  ["English and Vietnamese", "Interface and client report language stay aligned."],
]

const evidencePromises = [
  "Local rules own the strategic claim, even when AI improves the wording.",
  "Unavailable and degraded sources stay visible instead of appearing successful.",
  "Budget recommendations respect a 20% learning-stability guardrail.",
]

export default function LandingPage() {
  return (
    <main className={styles.page}>
      <header className={styles.navShell}>
        <nav className={styles.nav} aria-label="Main navigation">
          <Link href="/landing" className={styles.brand} aria-label="Decision Workspace landing page">
            <span className={styles.brandMark} aria-hidden="true">
              <WaypointsIcon />
            </span>
            <span>Decision Workspace</span>
          </Link>

          <div className={styles.navLinks}>
            <a href="#workflow">Workflow</a>
            <a href="#evidence">Evidence</a>
            <a href="#output">Output</a>
          </div>

          <LandingActionLink href="/" className={styles.navCta}>
            Open workspace
          </LandingActionLink>
        </nav>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroGrid}>
          <div className={styles.heroCopy}>
            <p className={`${styles.kicker} ${styles.resolveOne}`}>Decision operations workspace</p>
            <h1 className={`${styles.heroTitle} ${styles.resolveTwo}`}>From ad evidence to action.</h1>
            <p className={`${styles.heroBody} ${styles.resolveThree}`}>
              Diagnose Meta performance, trace the evidence, and publish a client-ready action plan from one workspace.
            </p>
            <div className={`${styles.heroActions} ${styles.resolveFour}`}>
              <LandingActionLink href="/" className={styles.primaryCta}>
                Open workspace
              </LandingActionLink>
              <a href="#workflow" className={styles.textCta}>
                See the workflow
              </a>
            </div>
          </div>

          <div className={`${styles.heroVisual} ${styles.resolveVisual}`}>
            <span className={styles.heroTrace} aria-hidden="true" />
            <div className={`${styles.productFrame} ${styles.heroProductFrame}`}>
              <Image
                src="/landing/workspace-overview.png"
                alt="Decision Workspace overview showing jobs and live capability states"
                width={1184}
                height={1000}
                priority
                className={styles.productImage}
              />
            </div>
          </div>
        </div>

        <div className={styles.proofRail} aria-label="Product guarantees">
          {guarantees.map(([title, description]) => (
            <div key={title}>
              <strong>{title}</strong>
              <span>{description}</span>
            </div>
          ))}
        </div>
      </section>

      <section id="workflow" className={styles.section}>
        <div className={styles.sectionLead}>
          <div>
            <p className={styles.kicker}>A single accountable loop</p>
            <h2>One operating loop, not five disconnected tools.</h2>
          </div>
          <p>Each workspace moves from source truth to a reviewed action without losing the reason behind it.</p>
        </div>

        <div className={styles.workflowRail}>
          {workflow.map((item) => (
            <article key={item.title} className={styles.workflowStep}>
              <span className={styles.workflowNode} aria-hidden="true" />
              <p className={styles.workflowMeta}>{item.number} / {item.label}</p>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="evidence" className={styles.evidenceSection}>
        <div className={styles.evidenceCopy}>
          <p className={styles.kicker}>Evidence remains visible</p>
          <h2>Every recommendation keeps its evidence attached.</h2>
          <p>
            Investigate campaign performance or verified competitor signals without turning assumptions into facts.
          </p>
          <ul>
            {evidencePromises.map((promise) => (
              <li key={promise}>
                <span aria-hidden="true">✓</span>
                <p>{promise}</p>
              </li>
            ))}
          </ul>
        </div>

        <div className={styles.evidenceStage}>
          <div className={`${styles.productFrame} ${styles.evidenceProductFrame}`}>
            <Image
              src="/landing/competitor-evidence.png"
              alt="Competitor evidence workspace with verified notes, themes, gaps, and original test briefs"
              width={1184}
              height={1307}
              className={styles.productImage}
            />
          </div>
          <aside className={`${styles.evidenceNote} ${styles.noteOne}`}>
            <strong>Traceable claim</strong>
            <span>Conclusions stay beside the rows, sources, and review state that support them.</span>
          </aside>
          <aside className={`${styles.evidenceNote} ${styles.noteTwo}`}>
            <strong>Honest capability</strong>
            <span>Missing inputs appear as missing, never as a false success state.</span>
          </aside>
        </div>
      </section>

      <section id="output" className={`${styles.section} ${styles.outputSection}`}>
        <div className={styles.sectionLead}>
          <div>
            <p className={styles.kicker}>Output with a review trail</p>
            <h2>The output is a decision your team can defend.</h2>
          </div>
          <p>Clear state, guarded recommendations, and a report that is ready for the client conversation.</p>
        </div>

        <div className={styles.outputStage}>
          <div className={`${styles.productFrame} ${styles.outputProductFrame}`}>
            <Image
              src="/landing/workspace-overview.png"
              alt="Workspace overview with capability states and available decision jobs"
              width={1184}
              height={1000}
              priority
              className={styles.productImage}
            />
          </div>

          <article className={styles.guardrailCell}>
            <strong>20%</strong>
            <h3>Guarded budget moves</h3>
            <p>No recommendation exceeds the learning-stability limit.</p>
          </article>

          <div className={styles.outputMeta}>
            <article>
              <h3>Client-ready PDF</h3>
              <p>Performance story, evidence, actions, and appendices leave as one report.</p>
            </article>
            <article>
              <h3>One language setting</h3>
              <p>English or Vietnamese carries from interface copy into the generated report.</p>
            </article>
          </div>
        </div>
      </section>

      <section className={styles.finalCta}>
        <span className={styles.ctaOrbit} aria-hidden="true" />
        <div className={styles.finalCtaCopy}>
          <p className={styles.kicker}>The next action stays visible</p>
          <h2>Stop translating dashboards into decisions by hand.</h2>
          <p>Bring the evidence, review the Verdict, and leave with the next action.</p>
          <LandingActionLink href="/" className={styles.primaryCta}>
            Open workspace
          </LandingActionLink>
        </div>
        <div className={`${styles.productFrame} ${styles.ctaProductFrame}`}>
          <Image
            src="/landing/workspace-overview.png"
            alt="Decision Workspace overview"
            width={1184}
            height={1000}
            priority
            className={styles.productImage}
          />
        </div>
      </section>

      <footer className={styles.footer}>
        <span>Decision Workspace</span>
        <span>Evidence to action</span>
      </footer>
    </main>
  )
}
