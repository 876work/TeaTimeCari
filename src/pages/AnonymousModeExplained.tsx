import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, EyeOff, FileText, ShieldCheck } from 'lucide-react';
import { GradientPageShell } from '@/components/GradientPageShell';
import {
  anonymousModeBasics,
  anonymousModeChecklist,
  anonymousModePlainLanguage,
} from '@/content/anonymousMode';

const trustCards = [
  {
    title: 'Public identity protection',
    body: 'Anonymous mode can hide your profile name from other members on supported posts or comments.',
    Icon: EyeOff,
  },
  {
    title: 'Moderation still applies',
    body: 'Anonymous posts can be reported, reviewed, removed, or used for enforcement when rules are broken.',
    Icon: ShieldCheck,
  },
  {
    title: 'Rules still matter',
    body: 'Use anonymous mode for honest, privacy-conscious sharing—not abuse, doxxing, threats, or false claims.',
    Icon: FileText,
  },
];

export default function AnonymousModeExplained() {
  return (
    <GradientPageShell maxWidth="max-w-5xl">
      <article className="w-full overflow-hidden rounded-[2rem] border border-white/70 bg-white/90 shadow-2xl shadow-slate-200/70 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90 dark:shadow-none">
        <section className="relative overflow-hidden bg-gradient-to-br from-[#11263F] via-[#395F8E] to-[#9B6BAE] px-6 py-12 text-white sm:px-10 lg:px-14">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.2),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(217,111,127,0.35),transparent_28%)]" />
          <div className="relative max-w-3xl">
            <span className="inline-flex rounded-full bg-white/15 px-4 py-2 text-sm font-bold uppercase tracking-[0.18em] ring-1 ring-white/25">
              Privacy / Trust
            </span>
            <h1 className="mt-5 text-4xl font-black tracking-tight sm:text-5xl">Anonymous mode explained</h1>
            <p className="mt-5 text-lg leading-8 text-white/90">
              Anonymous mode can help you participate with less public exposure. It does not mean Tea Time Cari cannot review activity when safety, moderation, legal compliance, or enforcement requires it.
            </p>
          </div>
        </section>

        <section className="px-6 py-10 sm:px-10 lg:px-14">
          <div className="rounded-3xl border border-[#D96F7F]/25 bg-[#FFF7F8] p-6 text-slate-800 shadow-sm dark:border-[#D96F7F]/40 dark:bg-[#2A1720] dark:text-slate-100">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <div className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#D96F7F] text-white shadow-lg shadow-[#D96F7F]/25">
                <AlertTriangle className="h-6 w-6" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-950 dark:text-white">The short version</h2>
                <p className="mt-2 text-lg font-semibold text-slate-800 dark:text-slate-100">
                  Other members won’t see your profile name, but admins may review abuse reports.
                </p>
                <ul className="mt-5 grid gap-3">
                  {anonymousModePlainLanguage.map((item) => (
                    <li key={item} className="flex gap-3 text-sm leading-6 text-slate-700 dark:text-slate-200">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#3382AA]" aria-hidden="true" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {trustCards.map(({ title, body, Icon }) => (
              <div key={title} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                <Icon className="h-8 w-8 text-[#4B9EC8]" aria-hidden="true" />
                <h2 className="mt-4 text-lg font-bold text-slate-950 dark:text-white">{title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{body}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
            <section>
              <h2 className="text-2xl font-black text-slate-950 dark:text-white">What this means in practice</h2>
              <div className="mt-5 space-y-4">
                {anonymousModeBasics.map((item) => (
                  <div key={item.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950/70">
                    <h3 className="font-bold text-slate-950 dark:text-white">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{item.body}</p>
                  </div>
                ))}
              </div>
            </section>

            <aside className="rounded-3xl border border-[#4B9EC8]/25 bg-[#F4FBFF] p-6 dark:border-[#4B9EC8]/40 dark:bg-[#102231]">
              <h2 className="text-xl font-black text-slate-950 dark:text-white">Before you post anonymously</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                Anonymous posting works best when members use it carefully. Pause and check:
              </p>
              <ul className="mt-5 space-y-3">
                {anonymousModeChecklist.map((item) => (
                  <li key={item} className="flex gap-3 text-sm leading-6 text-slate-700 dark:text-slate-200">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#4B9EC8]" aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </aside>
          </div>

          <div className="mt-10 rounded-3xl bg-gradient-to-r from-[#4B9EC8] via-[#7D78B4] to-[#D96F7F] p-1">
            <div className="rounded-[1.35rem] bg-white p-6 dark:bg-slate-950 sm:flex sm:items-center sm:justify-between sm:gap-6">
              <div>
                <h2 className="text-xl font-black text-slate-950 dark:text-white">Need the full rules?</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                  Anonymous mode is governed by the Privacy Policy, Community Guidelines, and Terms of Service.
                </p>
              </div>
              <div className="mt-5 flex flex-wrap gap-3 sm:mt-0">
                <Link to="/community-guidelines" className="rounded-full bg-[#11263F] px-5 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5">
                  Community Guidelines
                </Link>
                <Link to="/privacy-policy" className="rounded-full border border-slate-200 px-5 py-3 text-sm font-bold text-slate-700 transition hover:-translate-y-0.5 dark:border-slate-700 dark:text-slate-100">
                  Privacy Policy
                </Link>
              </div>
            </div>
          </div>
        </section>
      </article>
    </GradientPageShell>
  );
}
