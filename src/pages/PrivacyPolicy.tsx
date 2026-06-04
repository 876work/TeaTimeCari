import { Link } from 'react-router-dom';

export default function PrivacyPolicy() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <article className="mx-auto max-w-3xl rounded-2xl bg-white p-8 shadow-sm border border-slate-200">
        <Link to="/" className="text-sm font-medium text-blue-600 hover:text-blue-700">← Back to home</Link>
        <h1 className="mt-4 text-3xl font-bold text-slate-900">Privacy Policy</h1>
        <p className="mt-2 text-sm text-slate-500">Last updated: June 4, 2026</p>

        <div className="mt-8 space-y-6 text-slate-700 leading-7">
          <section>
            <h2 className="text-xl font-semibold text-slate-900">Information we collect</h2>
            <p className="mt-2">
              TeaTime Cari collects the information you provide during registration, including your name, email,
              phone number, username, gender selection, and verification photo or ID image. We may also collect
              basic device, browser, IP address, and activity information to protect the community and support admin review.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900">How we use your information</h2>
            <p className="mt-2">
              We use your information to review applications, manage account approvals or rejections, provide access
              to the community, sync approved users with Discourse, send account-status emails, and keep the platform safe.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900">Community and third-party services</h2>
            <p className="mt-2">
              Approved account details may be shared with our Discourse community instance so your forum account can
              be created and assigned to the appropriate group. We also use service providers such as Supabase and email
              delivery providers to operate the app.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900">Data protection</h2>
            <p className="mt-2">
              We take reasonable steps to protect your information and limit access to authorized administrators and
              systems that need it to operate TeaTime Cari.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900">Contact</h2>
            <p className="mt-2">
              If you have questions about this policy, contact us through the TeaTime Cari support channels listed in the app.
            </p>
          </section>
        </div>
      </article>
    </main>
  );
}
