import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  EyeOff,
  Flag,
  Lock,
  ShieldCheck,
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

const postingGuidance = [
  {
    title: 'Share carefully',
    items: [
      'Personal experiences',
      'Relevant screenshots with private details removed',
      'Factual warnings or concerns',
      'Respectful comments',
      'Community support',
    ],
  },
  {
    title: 'Protect people',
    items: [
      'No nudes or leaked images',
      'No threats or harassment',
      'No false claims',
      'No phone numbers, addresses, IDs, or bank details',
      'No revenge content or public shaming',
    ],
  },
];

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
  const selectedStep = steps[activeStep];

  return (
    <GradientPageShell maxWidth="max-w-5xl">
      <section className="text-center" aria-labelledby="how-it-works-title">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#D6EBF5]">
          <ShieldCheck className="h-8 w-8 text-[#4B9EC8]" aria-hidden="true" />
        </div>

        <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#3382AA]">
          Privacy-first community
        </p>

        <h1
          id="how-it-works-title"
          className="mt-3 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl"
        >
          How Tea Time Cari Works
        </h1>

        <p className="mx-auto mt-3 max-w-3xl text-xl font-semibold leading-8 text-gray-800 sm:text-2xl">
          Share carefully. Compare privately. Stay informed.
        </p>

        <p className="mx-auto mt-4 max-w-3xl text-base leading-7 text-gray-600">
          Tea Time Cari is designed so approved users can share experiences with privacy, safety, and trust at the center of every step.
        </p>

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {heroBadges.map((badge) => (
            <span
              key={badge}
              className="inline-flex items-center gap-2 rounded-lg border border-[#D6EBF5] bg-[#F4FAFD] px-4 py-2 text-sm font-semibold text-gray-700"
            >
              <ShieldCheck className="h-4 w-4 text-[#4B9EC8]" aria-hidden="true" />
              {badge}
            </span>
          ))}
        </div>

        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            to="/signup"
            className="inline-flex items-center justify-center rounded-lg bg-[#4B9EC8] px-6 py-3 text-sm font-semibold text-white hover:bg-[#3382AA] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4B9EC8] focus-visible:ring-offset-2"
          >
            Join Now
            <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
          </Link>

          <Link
            to="/community-guidelines"
            className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-6 py-3 text-sm font-semibold text-gray-700 hover:border-[#4B9EC8] hover:text-[#3382AA] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4B9EC8] focus-visible:ring-offset-2"
          >
            Read the Guidelines
          </Link>
        </div>
      </section>

      <section className="mt-12" aria-labelledby="steps-title">
        <div className="text-center">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#3382AA]">
            Five simple steps
          </p>

          <h2 id="steps-title" className="mt-2 text-2xl font-bold text-gray-900 sm:text-3xl">
            From application to safer sharing
          </h2>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[0.95fr_1.35fr]">
          <ol className="space-y-2" aria-label="How Tea Time Cari works steps">
            {steps.map((step, index) => {
              const isActive = activeStep === index;

              return (
                <li key={step.title}>
                  <button
                    type="button"
                    onClick={() => setActiveStep(index)}
                    aria-current={isActive ? 'step' : undefined}
                    className={`flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4B9EC8] focus-visible:ring-offset-2 ${
                      isActive
                        ? 'border-[#4B9EC8] bg-[#F4FAFD] shadow-sm'
                        : 'border-gray-200 bg-white hover:border-[#4B9EC8]'
                    }`}
                  >
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                        isActive ? 'bg-[#4B9EC8] text-white' : 'bg-gray-100 text-gray-700'
                      }`}
                      aria-hidden="true"
                    >
                      {index + 1}
                    </span>

                    <span className="min-w-0">
                      <span className="block text-base font-bold text-gray-900">{step.title}</span>
                      <span className="mt-1 block text-sm leading-5 text-gray-600">{step.headline}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>

          <article className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8" aria-live="polite">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#D6EBF5] text-[#4B9EC8]">
              <Lock className="h-6 w-6" aria-hidden="true" />
            </div>

            <p className="mt-5 text-sm font-bold uppercase tracking-[0.2em] text-[#3382AA]">
              Step {activeStep + 1}
            </p>

            <h3 className="mt-2 text-2xl font-bold text-gray-900">{selectedStep.headline}</h3>

            <p className="mt-4 text-base leading-7 text-gray-600">{selectedStep.body}</p>

            <div className="mt-6 rounded-2xl border border-[#D6EBF5] bg-[#F4FAFD] p-4">
              <p className="flex items-start gap-3 text-sm font-semibold leading-6 text-gray-700">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#4B9EC8]" aria-hidden="true" />
                <span>
                  <span className="font-bold text-gray-900">Privacy note:</span> {selectedStep.privacyNote}
                </span>
              </p>
            </div>

            <div className="mt-6 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setActiveStep((step) => Math.max(step - 1, 0))}
                disabled={activeStep === 0}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:border-[#4B9EC8] hover:text-[#3382AA] disabled:cursor-not-allowed disabled:opacity-45 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4B9EC8] focus-visible:ring-offset-2"
              >
                Previous
              </button>

              <button
                type="button"
                onClick={() => setActiveStep((step) => Math.min(step + 1, steps.length - 1))}
                disabled={activeStep === steps.length - 1}
                className="rounded-lg bg-[#4B9EC8] px-4 py-2 text-sm font-semibold text-white hover:bg-[#3382AA] disabled:cursor-not-allowed disabled:opacity-45 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4B9EC8] focus-visible:ring-offset-2"
              >
                Next step
              </button>
            </div>
          </article>
        </div>
      </section>

      <section className="mt-12 rounded-2xl border border-gray-200 bg-gray-50 p-6 sm:p-8" aria-labelledby="privacy-foundation-title">
        <div className="max-w-3xl">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#3382AA]">
            Privacy first
          </p>

          <h2 id="privacy-foundation-title" className="mt-2 text-2xl font-bold text-gray-900 sm:text-3xl">
            Privacy is not an add-on. It is the foundation.
          </h2>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {privacyCards.map(({ title, body, Icon }) => (
            <article key={title} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <Icon className="h-7 w-7 text-[#4B9EC8]" aria-hidden="true" />
              <h3 className="mt-4 text-base font-bold text-gray-900">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-gray-600">{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-12 grid gap-6 lg:grid-cols-[1fr_0.9fr]" aria-label="Posting safety guidance">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#3382AA]">
            Posting with trust
          </p>
          <h2 className="mt-2 text-2xl font-bold text-gray-900">What to share and what to avoid</h2>

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            {postingGuidance.map((group) => (
              <div key={group.title}>
                <h3 className="text-lg font-bold text-gray-900">{group.title}</h3>
                <ul className="mt-3 space-y-3">
                  {group.items.map((item) => (
                    <li key={item} className="flex items-start gap-3 text-sm leading-6 text-gray-700">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#4B9EC8]" aria-hidden="true" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6 shadow-sm sm:p-8">
          <Users className="h-8 w-8 text-[#4B9EC8]" aria-hidden="true" />

          <h2 className="mt-4 text-2xl font-bold text-gray-900">Built with private community spaces</h2>

          <p className="mt-4 text-base leading-7 text-gray-600">
            Tea Time Cari may organize access by gender group so users can participate in spaces designed for their community. Some features or cross-group access may require approval or subscription access.
          </p>

          <div className="mt-6 grid gap-3" aria-label="Community space flow">
            {['Your group', 'Your community space', 'Privacy rules apply'].map((item, index) => (
              <div key={item} className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4 font-semibold text-gray-800">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#D6EBF5] text-sm text-[#3382AA]">
                  {index + 1}
                </span>
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-12 rounded-2xl border border-[#D6EBF5] bg-[#F4FAFD] p-6 sm:p-8" aria-labelledby="checklist-title">
        <div className="grid gap-6 lg:grid-cols-[0.75fr_1.25fr] lg:items-center">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#3382AA]">
              Before you post
            </p>

            <h2 id="checklist-title" className="mt-2 text-2xl font-bold text-gray-900">
              A simple privacy check
            </h2>
          </div>

          <ul className="grid gap-3 sm:grid-cols-2">
            {checklistItems.map((item) => (
              <li key={item} className="flex items-start gap-3 rounded-2xl bg-white p-4 text-sm font-semibold text-gray-700 shadow-sm">
                <Check className="mt-0.5 h-5 w-5 shrink-0 text-[#4B9EC8]" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mt-12 rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm sm:p-10" aria-labelledby="final-cta-title">
        <h2 id="final-cta-title" className="text-2xl font-bold text-gray-900 sm:text-3xl">
          Ready to join the community?
        </h2>

        <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-gray-600">
          Tea Time Cari is being built for privacy, real conversations, and safer sharing. Join the waitlist and be first to know when we launch.
        </p>

        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <Link to="/signup" className="inline-flex items-center justify-center rounded-lg bg-[#4B9EC8] px-6 py-3 text-sm font-semibold text-white hover:bg-[#3382AA] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4B9EC8] focus-visible:ring-offset-2">
            Join Now
          </Link>

          <Link to="/community-guidelines" className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-6 py-3 text-sm font-semibold text-gray-700 hover:border-[#4B9EC8] hover:text-[#3382AA] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4B9EC8] focus-visible:ring-offset-2">
            Read the Community Guidelines
          </Link>
        </div>
      </section>
    </GradientPageShell>
  );
}
