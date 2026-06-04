import { Link } from 'react-router-dom';

export default function TermsOfService() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <article className="mx-auto max-w-3xl rounded-2xl bg-white p-8 shadow-sm border border-slate-200">
        <Link to="/" className="text-sm font-medium text-blue-600 hover:text-blue-700">← Back to home</Link>
        <h1 className="mt-4 text-3xl font-bold text-slate-900">Terms of Service</h1>
        <p className="mt-2 text-sm text-slate-500">Last updated: June 4, 2026</p>

        <div className="mt-8 space-y-6 text-slate-700 leading-7">
          <section>
            <h2 className="text-xl font-semibold text-slate-900">Respectful participation</h2>
            <p className="mt-2">
              TeaTime Cari is built for respectful, authentic conversation. You agree to treat other members with dignity,
              avoid harassment, and follow community moderation decisions.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900">Account review and access</h2>
            <p className="mt-2">
              New accounts require admin approval. We may approve, reject, suspend, or remove accounts when needed to
              protect the community or enforce these terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900">User content</h2>
            <p className="mt-2">
              You are responsible for what you post. Do not upload content that is unlawful, abusive, misleading,
              invasive of another person’s privacy, or otherwise harmful to the community.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900">Community systems</h2>
            <p className="mt-2">
              Approved users may receive access to our Discourse community. Your use of the community forum must also
              follow these terms and any forum-specific moderation rules.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900">Changes</h2>
            <p className="mt-2">
              We may update these terms as the service evolves. Continued use of TeaTime Cari means you accept the
              current terms.
            </p>
          </section>
        </div>
      </article>
    </main>
  );
}
