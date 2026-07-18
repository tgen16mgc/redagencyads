import type { Metadata } from "next";
import Link from "next/link";
import styles from "../legal.module.css";

export const metadata: Metadata = {
  title: "Privacy Policy | Decision Operations Workspace",
  description: "How Connector Tool handles Meta account and advertising data.",
};

const updatedAt = "July 18, 2026";

export default function PrivacyPolicyPage() {
  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <p className={styles.eyebrow}>Connector Tool · Legal</p>
        <h1 className={styles.title}>Privacy policy</h1>
        <p className={styles.lede}>
          This policy explains how Decision Operations Workspace handles information when you connect a Meta account,
          analyze advertising performance, or publish content through Meta products.
        </p>
        <div className={styles.meta}>
          <span>Effective and last updated: {updatedAt}</span>
          <span>Operator: Tien Duong</span>
        </div>
        <nav className={styles.nav} aria-label="Legal pages">
          <Link href="/">Open workspace</Link>
          <Link href="/terms">Terms of service</Link>
          <Link href="/data-deletion">Data deletion</Link>
        </nav>

        <article className={styles.document}>
          <section className={styles.section}>
            <h2>1. Information we process</h2>
            <ul>
              <li>Meta account identifiers and names used to validate the connected account.</li>
              <li>Ad accounts, campaigns, ad sets, ads, delivery metrics, performance breakdowns, and creative previews you request.</li>
              <li>Facebook Pages, Instagram-linked assets, permissions, and content you choose to preview, publish, or schedule.</li>
              <li>Workspace preferences and drafts stored locally in your browser, such as language, custom KPIs, charts, and publishing drafts.</li>
              <li>Technical request metadata and error information produced by our hosting and service providers.</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2>2. How we use information</h2>
            <p>
              We use the information only to authenticate your Meta connection, retrieve the reports and assets you request,
              generate analysis, support publishing actions you initiate, secure the service, and diagnose failures.
            </p>
          </section>

          <section className={styles.section}>
            <h2>3. Token storage and retention</h2>
            <p>
              Meta access tokens are validated on the server, encrypted, and stored in an HttpOnly session cookie for up to
              12 hours. The application does not maintain a user-account database or permanently store your Meta reports.
              Browser-only preferences and drafts remain on your device until you clear them. Infrastructure providers may
              retain limited request and error logs according to their own retention policies.
            </p>
          </section>

          <section className={styles.section}>
            <h2>4. When information is shared</h2>
            <p>
              We send requests to Meta APIs to provide the features you select. Hosting providers process requests needed to
              operate the service. If you invoke an AI-assisted feature, the selected workspace context may be sent to the
              configured AI provider solely to generate the requested analysis. We do not sell personal information or Meta data.
            </p>
          </section>

          <section className={styles.section}>
            <h2>5. Your choices and deletion</h2>
            <p>
              You can clear the encrypted session from the workspace, remove Connector Tool from Facebook&apos;s Apps and Websites
              settings, and clear site data in your browser. See the <Link href="/data-deletion">data deletion instructions</Link>
              for the complete process.
            </p>
          </section>

          <section className={styles.section}>
            <h2>6. Security</h2>
            <p>
              We use encrypted, secure, HttpOnly cookies and server-side API requests to reduce token exposure. No online service
              can guarantee absolute security, so you should revoke access immediately if you believe your Meta account or session
              has been compromised.
            </p>
          </section>

          <section className={styles.section}>
            <h2>7. Contact and changes</h2>
            <p>
              Questions or deletion requests can be sent to <a href="mailto:tienhanoi2005@gmail.com">tienhanoi2005@gmail.com</a>.
              We may update this policy when the product or legal requirements change, and the updated date will appear on this page.
            </p>
          </section>
        </article>

        <footer className={styles.footer}>
          <span>Decision Operations Workspace</span>
          <a href="mailto:tienhanoi2005@gmail.com">tienhanoi2005@gmail.com</a>
        </footer>
      </div>
    </main>
  );
}
