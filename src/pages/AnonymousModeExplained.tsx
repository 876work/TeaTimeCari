import { Link } from 'react-router-dom';
import { CheckCircle2, EyeOff, FileText, ShieldCheck } from 'lucide-react';
import { GradientPageShell } from '@/components/GradientPageShell';
import {
  anonymousModeBasics,
  anonymousModeChecklist,
  anonymousModePlainLanguage,
} from '@/content/anonymousMode';

const trustCards = [
  {
    title: 'Your name is protected from members',
    body: 'When anonymous mode is available, other members do not see your profile name on supported posts or comments.',
    Icon: EyeOff,
  },
  {
    title: 'Safety review still exists',
    body: 'Authorized Tea Time Cari admins can review reports and internal records when safety or rules require it.',
    Icon: ShieldCheck,
  },
  {
    title: 'Trust comes first',
    body: 'Anonymous mode is for honest, careful sharing. It is not for harassment, doxxing, threats, or false claims.',
    Icon: FileText,
  },
];

export default function AnonymousModeExplained() {
  return (
    <GradientPageShell maxWidth="max-w-5xl">
      <article className="w-full">
        <header className="mx-auto max-w-3xl text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#D6EBF5]">
            <EyeOff className="h-8 w-8 text-[#4B9EC8]" aria-hidden="true" />
          </div>

          <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#3382AA]">
            Privacy / Trust
          </p>

          <h1 className="mt-3 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Anonymous mode explained
          </h1>

          <p className="mt-4 text-base leading-7 text-gray-600 sm:text-lg">
            Anonymous mode helps you participate with less public exposure. It is built for privacy, but it is also built on trust.
          </p>
        </header>

        <section className="mt-10 rounded-2xl border border-[#D6EBF5] bg-[#F4FAFD] p-6" aria-labelledby="short-version-title">
          <h2 id="short-version-title" className="text-2xl font-bold text-gray-900">
            The short version
          </h2>
          <p className="mt-2 text-base font-semibold text-gray-700">
            Other members will not see your profile name, but Tea Time Cari may review reports to keep the community safe.
          </p>

          <ul className="mt-5 grid gap-3">
            {anonymousModePlainLanguage.map((item) => (
              <li key={item} className="flex gap-3 text-sm leading-6 text-gray-700">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#4B9EC8]" aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-8 grid gap-5 md:grid-cols-3" aria-label="Anonymous mode trust principles">
          {trustCards.map(({ title, body, Icon }) => (
            <article key={title} className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <Icon className="h-7 w-7 text-[#4B9EC8]" aria-hidden="true" />
              <h2 className="mt-4 text-lg font-bold text-gray-900">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-gray-600">{body}</p>
            </article>
          ))}
        </section>

        <section className="mt-10 grid gap-8 lg:grid-cols-[1.1fr_0.9fr]" aria-label="Anonymous mode details">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">What this means</h2>
            <div className="mt-5 space-y-4">
              {anonymousModeBasics.map((item) => (
                <article key={item.title} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                  <h3 className="font-bold text-gray-900">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-gray-600">{item.body}</p>
                </article>
              ))}
            </div>
          </div>

          <aside className="rounded-2xl border border-gray-200 bg-gray-50 p-6">
            <h2 className="text-xl font-bold text-gray-900">Before you post anonymously</h2>
            <p className="mt-2 text-sm leading-6 text-gray-600">
              Privacy works best when everyone uses it carefully. Pause and check:
            </p>
            <ul className="mt-5 space-y-3">
              {anonymousModeChecklist.map((item) => (
                <li key={item} className="flex gap-3 text-sm leading-6 text-gray-700">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#4B9EC8]" aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </aside>
        </section>

        <section className="mt-10 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:flex sm:items-center sm:justify-between sm:gap-6" aria-labelledby="rules-title">
          <div>
            <h2 id="rules-title" className="text-xl font-bold text-gray-900">
              Need the full rules?
            </h2>
            <p className="mt-2 text-sm leading-6 text-gray-600">
              Anonymous mode is governed by the Privacy Policy, Community Guidelines, and Terms of Service.
            </p>
          </div>
          <div className="mt-5 flex flex-wrap gap-3 sm:mt-0">
            <Link to="/community-guidelines" className="rounded-lg bg-[#4B9EC8] px-5 py-3 text-sm font-semibold text-white hover:bg-[#3382AA]">
              Community Guidelines
            </Link>
            <Link to="/privacy-policy" className="rounded-lg border border-gray-300 px-5 py-3 text-sm font-semibold text-gray-700 hover:border-[#4B9EC8] hover:text-[#3382AA]">
              Privacy Policy
            </Link>
          </div>
        </section>
      </article>
    </GradientPageShell>
  );
}
