import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import {
  BarChart3Icon,
  CheckIcon,
  FileCheck2Icon,
  LanguagesIcon,
  SearchIcon,
  ShieldCheckIcon,
  WaypointsIcon,
} from "lucide-react"

import { LandingActionLink } from "./landing-action-link"
import { LandingSpotlight } from "./landing-spotlight"
import styles from "./landing.module.css"

export const metadata: Metadata = {
  title: "Decision Workspace | Evidence to action",
  description:
    "Diagnose Meta performance, trace the evidence, and turn campaign data into a client-ready decision and action plan.",
}

const workflow = [
  {
    title: "Connect",
    description: "Bring Meta performance or verified competitor evidence into one accountable workspace.",
    icon: WaypointsIcon,
  },
  {
    title: "Diagnose",
    description: "Rank the highest-impact issue while keeping the supporting rows visible.",
    icon: BarChart3Icon,
  },
  {
    title: "Decide",
    description: "Generate a deterministic Verdict with guarded budget moves and test priorities.",
    icon: ShieldCheckIcon,
  },
  {
    title: "Deliver",
    description: "Export a client-ready report or move a reviewed action into publishing.",
    icon: FileCheck2Icon,
  },
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
        <div className={styles.heroCopy}>
          <p className={`${styles.eyebrow} ${styles.resolveOne}`}>Decision Operations Workspace</p>
          <h1 className={`${styles.heroTitle} ${styles.resolveTwo}`}>
            From ad evidence to action.
          </h1>
          <p className={`${styles.heroBody} ${styles.resolveThree}`}>
            Diagnose Meta performance, trace the evidence, and publish a client-ready action plan from one workspace.
          </p>
          <div className={`${styles.heroActions} ${styles.resolveFour}`}>
            <LandingActionLink href="/" className={styles.primaryCta}>
              Open workspace
            </LandingActionLink>
            <a href="#workflow" className={styles.secondaryCta}>
              See the workflow
            </a>
          </div>
        </div>

        <div className={`${styles.heroVisual} ${styles.resolveVisual}`}>
          <LandingSpotlight>
            <Image
              src="/landing/workspace-overview.png"
              alt="Decision Workspace overview showing jobs and live capability states"
              width={1184}
              height={1000}
              priority
              className={styles.productImage}
            />
          </LandingSpotlight>
          <p className={styles.imageCaption}>Live capability states keep unavailable sources honest.</p>
        </div>
      </section>

      <section className={styles.proofRail} aria-label="Product guarantees">
        <div>
          <strong>Deterministic Verdicts</strong>
          <span>Local analysis works without an AI provider.</span>
        </div>
        <div>
          <strong>20% budget guardrail</strong>
          <span>Recommendations protect Meta learning stability.</span>
        </div>
        <div>
          <strong>English and Vietnamese</strong>
          <span>Interface and client report language stay aligned.</span>
        </div>
      </section>

      <section id="workflow" className={`${styles.section} ${styles.scrollReveal}`}>
        <div className={styles.sectionHeading}>
          <h2>One operating loop, not five disconnected tools.</h2>
          <p>
            Each workspace moves from source truth to a reviewed action without losing the reason behind it.
          </p>
        </div>

        <div className={styles.workflowRail}>
          {workflow.map((item) => {
            const Icon = item.icon
            return (
              <article key={item.title} className={styles.workflowStep}>
                <span className={styles.workflowIcon} aria-hidden="true">
                  <Icon />
                </span>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </article>
            )
          })}
        </div>
      </section>

      <section id="evidence" className={`${styles.evidenceSection} ${styles.scrollReveal}`}>
        <div className={styles.evidenceCopy}>
          <SearchIcon className={styles.sectionIcon} aria-hidden="true" />
          <h2>Every recommendation keeps its evidence attached.</h2>
          <p>
            Investigate campaign performance or verified competitor signals without turning assumptions into facts.
          </p>
          <ul>
            {evidencePromises.map((promise) => (
              <li key={promise}>
                <CheckIcon aria-hidden="true" />
                <span>{promise}</span>
              </li>
            ))}
          </ul>
        </div>

        <LandingSpotlight className={styles.evidenceVisual}>
          <Image
            src="/landing/competitor-evidence.png"
            alt="Competitor evidence workspace with verified notes, themes, gaps, and original test briefs"
            width={1184}
            height={1307}
            className={styles.productImage}
          />
        </LandingSpotlight>
      </section>

      <section id="output" className={`${styles.section} ${styles.scrollReveal}`}>
        <div className={styles.sectionHeading}>
          <h2>The output is a decision your team can defend.</h2>
          <p>Clear state, guarded recommendations, and a report that is ready for the client conversation.</p>
        </div>

        <div className={styles.decisionGrid}>
          <article className={styles.decisionMain}>
            <div>
              <h3>The workspace tells the truth about its own capability state.</h3>
              <p>Available, paused, degraded, and connection-required sources stay explicit before analysis begins.</p>
            </div>
            <Image
              src="/landing/workspace-overview.png"
              alt="Capability status and workspace job overview"
              width={1184}
              height={1000}
              priority
              className={styles.decisionImage}
            />
          </article>

          <article className={`${styles.decisionCell} ${styles.guardrailCell}`}>
            <span className={styles.cellIcon} aria-hidden="true">
              <ShieldCheckIcon />
            </span>
            <strong>20%</strong>
            <h3>Guarded budget moves</h3>
            <p>No recommendation exceeds the learning-stability limit.</p>
          </article>

          <article className={styles.decisionCell}>
            <span className={styles.cellIcon} aria-hidden="true">
              <FileCheck2Icon />
            </span>
            <h3>Client-ready PDF</h3>
            <p>Performance story, evidence, actions, and appendices leave as one report.</p>
          </article>

          <article className={styles.decisionCell}>
            <span className={styles.cellIcon} aria-hidden="true">
              <LanguagesIcon />
            </span>
            <h3>One language setting</h3>
            <p>English or Vietnamese carries from interface copy into the generated report.</p>
          </article>
        </div>
      </section>

      <section className={`${styles.finalCta} ${styles.scrollReveal}`}>
        <div>
          <h2>Stop translating dashboards into decisions by hand.</h2>
          <p>Bring the evidence, review the Verdict, and leave with the next action.</p>
        </div>
        <LandingActionLink href="/" className={styles.primaryCta}>
          Open workspace
        </LandingActionLink>
      </section>

      <footer className={styles.footer}>
        <span>Decision Workspace</span>
        <span>Evidence to action</span>
      </footer>
    </main>
  )
}
