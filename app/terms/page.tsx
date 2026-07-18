import type { Metadata } from "next";
import Link from "next/link";
import styles from "../legal.module.css";

export const metadata: Metadata = {
  title: "Terms of Service | Decision Operations Workspace",
  description: "Terms governing use of Connector Tool and its Meta integrations.",
};

export default function TermsPage() {
  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <p className={styles.eyebrow}>Connector Tool · Legal</p>
        <h1 className={styles.title}>Terms of service</h1>
        <p className={styles.lede}>
          These terms govern your use of Decision Operations Workspace and its integrations with Meta products.
        </p>
        <div className={styles.meta}>
          <span>Effective and last updated: July 18, 2026</span>
        </div>
        <nav className={styles.nav} aria-label="Legal pages">
          <Link href="/">Open workspace</Link>
          <Link href="/privacy">Privacy policy</Link>
          <Link href="/data-deletion">Data deletion</Link>
        </nav>

        <article className={styles.document}>
          <section className={styles.section}>
            <h2>1. Authorized use</h2>
            <p>
              You may connect only accounts, advertising assets, Pages, and content that you are authorized to access or manage.
              You are responsible for complying with Meta&apos;s terms, developer policies, advertising policies, and applicable law.
            </p>
          </section>

          <section className={styles.section}>
            <h2>2. Your actions and content</h2>
            <p>
              You remain responsible for reporting decisions, budgets, content, and publishing actions initiated through the
              workspace. Review generated analysis and previews before relying on them or submitting content to Meta.
            </p>
          </section>

          <section className={styles.section}>
            <h2>3. Service availability</h2>
            <p>
              Features depend on Meta APIs, hosting services, and optional AI providers. Availability, permissions, and returned
              data can change without notice. The service is provided on an as-available basis without guarantees of uninterrupted
              operation or a particular advertising result.
            </p>
          </section>

          <section className={styles.section}>
            <h2>4. Prohibited use</h2>
            <p>
              Do not use the service to access assets without authorization, evade platform safeguards, distribute unlawful or
              infringing content, misrepresent performance data, or interfere with the service or connected platforms.
            </p>
          </section>

          <section className={styles.section}>
            <h2>5. Privacy and termination</h2>
            <p>
              Our <Link href="/privacy">Privacy Policy</Link> explains data handling. You can stop using the service at any time,
              clear the active session, and revoke Connector Tool in Facebook settings.
            </p>
          </section>

          <section className={styles.section}>
            <h2>6. Contact</h2>
            <p>
              Questions about these terms can be sent to <a href="mailto:tienhanoi2005@gmail.com">tienhanoi2005@gmail.com</a>.
            </p>
          </section>
        </article>

        <footer className={styles.footer}>
          <span>Decision Operations Workspace</span>
          <Link href="/data-deletion">Data deletion instructions</Link>
        </footer>
      </div>
    </main>
  );
}
