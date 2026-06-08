import React from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  EyeOff,
  Flag,
  Lock,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import { GradientPageShell } from '@/components/GradientPageShell';

type Step = {
  title: string;
  headline: string;
  body: string;
  privacyNote: string;
};

const steps: Step[] = [
  {
    title: 'Apply to Join',
    headline: 'Start with a private application',
    body: 'Create your account with the details needed for review. Your personal information helps us protect the community and is not shown publicly on your profile.',
    privacyNote: 'Your full name, email, and phone number are not displayed on your public profile.',
  },
  {
    title: 'Account Review',
    headline: 'We review before access is granted',
    body: 'Tea Time Cari reviews new registrations before users enter the community. This helps reduce fake accounts, protect privacy, and keep the space safer for everyone.',
    privacyNote: 'Approval helps protect the community before conversations begin.',
  },
  {
    title: 'Choose Your Privacy',
    headline: 'Control how you show up',
    body: 'Once approved, you can manage your profile settings and choose how you participate. Where available, anonymous posting gives you more control over what other users see.',
    privacyNote: 'Anonymous posting can hide your public profile details, but community rules still apply.',
  },
  {
    title: 'Share and Compare',
    headline: 'Post responsibly, compare carefully',
    body: 'Share experiences, screenshots, and details that help others stay informed. Keep it factual, remove private information, and avoid anything that could put someone at risk.',
    privacyNote: 'Blur phone numbers, addresses, IDs, bank details, and private personal information before posting.',
  },
  {
    title: 'Report and Stay Informed',
    headline: 'Help keep the community safe',
    body: 'Users can report posts, comments, or behavior that breaks the rules. Tea Time Cari uses moderation to help protect privacy, reduce harm, and keep the space respectful.',
    privacyNote: 'Reports help us respond to privacy, safety, harassment, or content concerns.',
  },
];

const privacyCards = [
  {
    title: 'Your personal details stay private',
    body: 'Your full name, email, and phone number are not shown publicly on your profile.',
    Icon: Lock,
  },
  {
    title: 'Anonymous posting may be available',
    body: 'You can choose to post with additional privacy where this feature is available.',
    Icon: EyeOff,
  },
  {
    title: 'Content stays inside the platform',
    body: 'Users are not allowed to screenshot, repost, or share community content outside Tea Time Cari.',
    Icon: ShieldCheck,
  },
  {
    title: 'Reports are taken seriously',
    body: 'Privacy violations, harassment, leaked content, and unsafe behavior can be reported for review.',
    Icon: Flag,
  },
];

const contentTabs = {
  allowed: {
    label: 'Allowed',
    eyebrow: 'Share carefully',
    items: [
      'Personal experiences',
      'Relevant screenshots with private details removed',
      'Factual warnings or concerns',
      'Respectful comments',
      'Community support',
    ],
  },
  notAllowed: {
    label: 'Not Allowed',
    eyebrow: 'Protect people',
    items: [
      'Nudes or leaked images',
      'Threats or harassment',
      'False claims',
      'Phone numbers, addresses, IDs, or bank details',
      'Revenge content or public shaming',
    ],
  },
} as const;

type ContentTab = keyof typeof contentTabs;

const checklistItems = [
  'Is it true?',
  'Can you support it?',
  'Did you remove private details?',
  'Could this put someone at risk?',
  'Are you sharing to inform, not to harm?',
];

const heroBadges = ['Private by design', 'Account review required', 'Anonymous posting available'];

export default function HowItWorks() {
  const [activeStep, setActiveStep] = React.useState(0);
  const [activeTab, setActiveTab] = React.useState<ContentTab>('allowed');

  const selectedStep = steps[activeStep];
  const selectedTab = contentTabs[activeTab];

  return (
    <GradientPageShell maxWidth="max-w-6xl" cardClassName="relative overflow-hidden">
      <div
        className="pointer-events-none absolute left-1/2 top-10 h-48 w-48 -translate-x-1/2 rounded-full bg-[#D96F7F]/10 blur-3xl"
        aria-hidden="true"
      />

      <section className="relative text-center" aria-labelledby="how-it-works-title">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full bg-[#F8E8EE] px-4 py-2 text-sm font-bold text-[#9B3F61] ring-1 ring-[#D96F7F]/20">
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          Privacy-first community
        </div>

        <h1
          id="how-it-works-title"
          className="mt-5 text-4xl font-black tracking-tight text-[#11263F] sm:text-5xl lg:text-6xl"
        >
          How Tea Time Cari Works
        </h1>

        <p className="mx-auto mt-4 max-w-3xl text-2xl font-bold leading-tight text-[#11263F] sm:text-3xl">
          Share carefully. Compare privately. Stay informed.
        </p>

        <p className="mx-auto mt-5 max-w-3xl text-base leading-8 text-slate-600 sm:text-lg">
          Tea Time Cari is designed to help approved users share experiences, compare notes, and stay informed with privacy at the center of every step.
        </p>

        <div className="mt-7 flex flex-wrap justify-center gap-3">
          {heroBadges.map((badge) => (
            <span
              key={badge}
              className="inline-flex items-center gap-2 rounded-full border border-[#4B9EC8]/15 bg-[#F4FAFD] px-4 py-2 text-sm font-bold text-[#11263F] shadow-sm"
            >
              <ShieldCheck className="h-4 w-4 text-[#3382AA]" aria-hidden="true" />
              {badge}
            </span>
          ))}
        </div>

        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            to="/signup"
            className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-[#D96F7F] via-[#B78DB5] to-[#5CA4C8] px-6 py-3 text-sm font-black text-white shadow-lg shadow-[#2E6F91]/20 transition hover:-translate-y-0.5 hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4B9EC8] focus-visible:ring-offset-2"
          >
            Join Now
            <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
          </Link>

          <Link
            to="/community-guidelines"
            className="inline-flex items-center justify-center rounded-full border border-[#4B9EC8]/20 bg-white px-6 py-3 text-sm font-black text-[#11263F] shadow-sm transition hover:-translate-y-0.5 hover:border-[#9B6BAE]/30 hover:text-[#9B6BAE] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4B9EC8] focus-visible:ring-offset-2"
          >
            Read the Guidelines
          </Link>
        </div>
      </section>

      <section className="relative mt-14" aria-labelledby="steps-title">
        <div className="mb-6 text-center">
          <p className="text-sm font-bold uppercase tracking-[0.24em] text-[#3382AA]">
            Five simple steps
          </p>

          <h2
            id="steps-title"
            className="mt-2 text-3xl font-black tracking-tight text-[#11263F] sm:text-4xl"
          >
            From application to safer sharing
          </h2>
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.95fr_1.35fr]">
          <div className="rounded-[2rem] bg-gradient-to-br from-[#F4FAFD] via-white to-[#FDF1F3] p-3 shadow-inner shadow-[#11263F]/5">
            <ol className="space-y-2" aria-label="How Tea Time Cari works steps">
              {steps.map((step, index) => {
                const isActive = activeStep === index;

                return (
                  <li key={step.title}>
                    <button
                      type="button"
                      onClick={() => setActiveStep(index)}
                      aria-current={isActive ? 'step' : undefined}
                      className={`group flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4B9EC8] focus-visible:ring-offset-2 ${
                        isActive
                          ? 'border-[#4B9EC8]/30 bg-white shadow-lg shadow-[#4B9EC8]/10'
                          : 'border-transparent bg-white/60 hover:border-[#B78DB5]/25 hover:bg-white'
                      }`}
                    >
                      <span
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-black transition ${
                          isActive
                            ? 'bg-gradient-to-br from-[#D96F7F] to-[#5CA4C8] text-white shadow-md'
                            : 'bg-[#EAF5FA] text-[#3382AA] group-hover:bg-[#F8E8EE] group-hover:text-[#9B3F61]'
                        }`}
                        aria-hidden="true"
                      >
                        {index + 1}
                      </span>

                      <span className="min-w-0">
                        <span className="block text-base font-black text-[#11263F]">
                          {step.title}
                        </span>
                        <span className="mt-1 block text-sm leading-5 text-slate-600">
                          {step.headline}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>

          <article
            className="relative overflow-hidden rounded-[2rem] border border-[#4B9EC8]/10 bg-white p-6 shadow-xl shadow-[#11263F]/10 sm:p-8"
            aria-live="polite"
          >
            <div
              className="absolute right-0 top-0 h-32 w-32 rounded-bl-full bg-gradient-to-br from-[#4B9EC8]/15 to-[#D96F7F]/15"
              aria-hidden="true"
            />

            <div className="relative">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F8E8EE] text-[#9B3F61] shadow-sm">
                <Lock className="h-7 w-7" aria-hidden="true" />
              </div>

              <p className="mt-6 text-sm font-bold uppercase tracking-[0.24em] text-[#3382AA]">
                Step {activeStep + 1}
              </p>

              <h3 className="mt-2 text-3xl font-black tracking-tight text-[#11263F]">
                {selectedStep.headline}
              </h3>

              <p className="mt-4 text-base leading-8 text-slate-600">
                {selectedStep.body}
              </p>

              <div className="mt-6 rounded-2xl border border-[#4B9EC8]/15 bg-[#F4FAFD] p-4">
                <p className="flex items-start gap-3 text-sm font-semibold leading-6 text-[#11263F]">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#3382AA]" aria-hidden="true" />
                  <span>
                    <span className="font-black">Privacy note:</span> {selectedStep.privacyNote}
                  </span>
                </p>
              </div>

              <div className="mt-6 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setActiveStep((step) => Math.max(step - 1, 0))}
                  disabled={activeStep === 0}
                  className="rounded-full border border-slate-200 px-4 py-2 text-sm font-bold text-[#11263F] transition hover:border-[#4B9EC8]/40 disabled:cursor-not-allowed disabled:opacity-45 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4B9EC8] focus-visible:ring-offset-2"
                >
                  Previous
                </button>

                <button
                  type="button"
                  onClick={() => setActiveStep((step) => Math.min(step + 1, steps.length - 1))}
                  disabled={activeStep === steps.length - 1}
                  className="rounded-full bg-[#11263F] px-4 py-2 text-sm font-bold text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4B9EC8] focus-visible:ring-offset-2"
                >
                  Next step
                </button>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section className="mt-14" aria-labelledby="privacy-foundation-title">
        <div className="rounded-[2rem] bg-[#11263F] p-6 text-white shadow-xl shadow-[#11263F]/20 sm:p-8">
          <div className="max-w-3xl">
            <p className="text-sm font-bold uppercase tracking-[0.24em] text-[#9BD3EA]">
              Privacy first
            </p>

            <h2
              id="privacy-foundation-title"
              className="mt-2 text-3xl font-black tracking-tight sm:text-4xl"
            >
              Privacy is not an add on. It is the foundation.
            </h2>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {privacyCards.map(({ title, body, Icon }) => (
              <article
                key={title}
                className="rounded-3xl border border-white/10 bg-white/10 p-5 backdrop-blur"
              >
                <Icon className="h-7 w-7 text-[#F5A3AD]" aria-hidden="true" />
                <h3 className="mt-4 text-lg font-black">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-white/78">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section
        className="mt-14 grid gap-6 lg:grid-cols-[1fr_0.9fr]"
        aria-label="Posting safety guidance"
      >
        <div className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-xl shadow-[#11263F]/10 sm:p-8">
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Allowed and not allowed content">
            {(Object.keys(contentTabs) as ContentTab[]).map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={activeTab === tab}
                aria-controls={`content-panel-${tab}`}
                id={`content-tab-${tab}`}
                onClick={() => setActiveTab(tab)}
                className={`rounded-full px-5 py-2.5 text-sm font-black transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4B9EC8] focus-visible:ring-offset-2 ${
                  activeTab === tab
                    ? tab === 'allowed'
                      ? 'bg-[#E8F7EF] text-[#17663C]'
                      : 'bg-[#FCECEF] text-[#9B3F61]'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {contentTabs[tab].label}
              </button>
            ))}
          </div>

          <div
            role="tabpanel"
            id={`content-panel-${activeTab}`}
            aria-labelledby={`content-tab-${activeTab}`}
            className="mt-6"
          >
            <p className="text-sm font-bold uppercase tracking-[0.24em] text-[#3382AA]">
              {selectedTab.eyebrow}
            </p>

            <h2 className="mt-2 text-3xl font-black tracking-tight text-[#11263F]">
              {selectedTab.label}
            </h2>

            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {selectedTab.items.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-700"
                >
                  {activeTab === 'allowed' ? (
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#249457]" aria-hidden="true" />
                  ) : (
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#D96F7F]" aria-hidden="true" />
                  )}
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="rounded-[2rem] bg-gradient-to-br from-[#F4FAFD] to-[#FDF1F3] p-6 shadow-xl shadow-[#11263F]/10 sm:p-8">
          <Users className="h-9 w-9 text-[#3382AA]" aria-hidden="true" />

          <h2 className="mt-4 text-3xl font-black tracking-tight text-[#11263F]">
            Built with private community spaces
          </h2>

          <p className="mt-4 text-base leading-8 text-slate-600">
            Tea Time Cari may organize access by gender group so users can participate in spaces designed for their community. Some features or cross group access may require approval or subscription access.
          </p>

          <div className="mt-6 grid gap-3" aria-label="Community space flow">
            {['Your group', 'Your community space', 'Privacy rules apply'].map((item, index) => (
              <div
                key={item}
                className="flex items-center gap-3 rounded-2xl bg-white/80 p-4 font-black text-[#11263F] shadow-sm"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#11263F] text-sm text-white">
                  {index + 1}
                </span>
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section
        className="mt-14 rounded-[2rem] border border-[#4B9EC8]/10 bg-white p-6 shadow-xl shadow-[#11263F]/10 sm:p-8"
        aria-labelledby="checklist-title"
      >
        <div className="grid gap-8 lg:grid-cols-[0.75fr_1.25fr] lg:items-center">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.24em] text-[#3382AA]">
              Before you post
            </p>

            <h2
              id="checklist-title"
              className="mt-2 text-3xl font-black tracking-tight text-[#11263F]"
            >
              Before you post, check this first
            </h2>
          </div>

          <ul className="grid gap-3 sm:grid-cols-2">
            {checklistItems.map((item) => (
              <li
                key={item}
                className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm font-bold text-slate-700"
              >
                <Check className="mt-0.5 h-5 w-5 shrink-0 text-[#3382AA]" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section
        className="mt-14 rounded-[2rem] bg-gradient-to-r from-[#D96F7F] via-[#B78DB5] to-[#5CA4C8] p-1 shadow-xl shadow-[#2E6F91]/15"
        aria-labelledby="final-cta-title"
      >
        <div className="rounded-[1.8rem] bg-white/92 p-6 text-center sm:p-10">
          <h2
            id="final-cta-title"
            className="text-3xl font-black tracking-tight text-[#11263F] sm:text-4xl"
          >
            Ready to join the community?
          </h2>

          <p className="mx-auto mt-4 max-w-2xl text-base leading-8 text-slate-600">
            Tea Time Cari is being built for privacy, real conversations, and safer sharing. Join the waitlist and be first to know when we launch.
          </p>

          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              to="/signup"
              className="inline-flex items-center justify-center rounded-full bg-[#11263F] px-6 py-3 text-sm font-black text-white shadow-lg transition hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4B9EC8] focus-visible:ring-offset-2"
            >
              Join Now
            </Link>

            <Link
              to="/community-guidelines"
              className="inline-flex items-center justify-center rounded-full border border-[#4B9EC8]/20 bg-white px-6 py-3 text-sm font-black text-[#11263F] shadow-sm transition hover:-translate-y-0.5 hover:text-[#9B6BAE] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4B9EC8] focus-visible:ring-offset-2"
            >
              Read the Community Guidelines
            </Link>
          </div>
        </div>
      </section>
    </GradientPageShell>
  );
}