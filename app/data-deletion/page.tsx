import type { Metadata } from "next";
import Link from "next/link";
import styles from "../legal.module.css";

export const metadata: Metadata = {
  title: "Data Deletion | Decision Operations Workspace",
  description: "Instructions for removing Connector Tool access and local workspace data.",
};

export default function DataDeletionPage() {
  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <p className={styles.eyebrow}>Connector Tool · Account controls</p>
        <h1 className={styles.title}>Delete your data</h1>
        <p className={styles.lede}>
          Connector Tool does not maintain a permanent user database. Follow these steps to remove the active session,
          revoke Meta access, and erase browser-stored workspace data.
        </p>
        <div className={styles.meta}>
          <span>Last updated: July 18, 2026</span>
        </div>
        <nav className={styles.nav} aria-label="Legal pages">
          <Link href="/">Open workspace</Link>
          <Link href="/privacy">Privacy policy</Link>
          <Link href="/terms">Terms of service</Link>
        </nav>

        <article className={styles.document}>
          <section className={styles.section}>
            <h2>1. Clear the Connector Tool session</h2>
            <p>
              Open the workspace and select <strong>Clear session</strong>. This removes the encrypted Meta access-token cookie
              from the browser. The cookie also expires automatically after 12 hours.
            </p>
          </section>

          <section className={styles.section}>
            <h2>2. Revoke Meta access</h2>
            <ol>
              <li>Open Facebook Settings &amp; privacy, then Settings.</li>
              <li>Open Apps and Websites.</li>
              <li>Select Connector Tool and choose Remove.</li>
            </ol>
            <p>This revokes the app&apos;s continuing access at Meta and invalidates the connection.</p>
          </section>

          <section className={styles.section}>
            <h2>3. Remove browser-stored workspace data</h2>
            <p>
              Clear site data for <strong>redagencyads.vercel.app</strong> in your browser to delete locally stored preferences,
              KPI configurations, chart settings, drafts, and recent publishing references.
            </p>
          </section>

          <section className={styles.section}>
            <h2>4. Request assistance</h2>
            <p>
              If you need help confirming deletion, email <a href="mailto:tienhanoi2005@gmail.com">tienhanoi2005@gmail.com</a>
              with the subject &quot;Connector Tool data deletion.&quot; Do not send passwords, access tokens, or private media files.
            </p>
          </section>
        </article>

        <footer className={styles.footer}>
          <span>Decision Operations Workspace</span>
          <Link href="/privacy">Read the privacy policy</Link>
        </footer>
      </div>
    </main>
  );
}
