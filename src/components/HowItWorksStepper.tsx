import React from 'react';
import { ArrowRight, Check, RotateCcw } from 'lucide-react';

interface HowItWorksStepperProps {
  onGetStarted: () => void;
}

interface Step {
  label: string;
  description: string;
  title: string;
  body: string;
  pills: string[];
}

const steps: Step[] = [
  {
    label: 'Private Profile',
    description: 'Start with privacy first.',
    title: 'Create Your Private Profile',
    body: 'Create your Tea Time Cari account and choose how you want to show up. Your profile is built with privacy and community safety in mind.',
    pills: ['Username based', 'Privacy settings', 'Account review', 'Community access'],
  },
  {
    label: 'Safe Sharing',
    description: 'Share, browse, and compare notes.',
    title: 'Share or Browse Safely',
    body: 'Once approved, you can read posts, share your own experience, comment, and compare notes with others in your community. Tea Time Cari is built for factual sharing, privacy, and respectful conversations.',
    pills: ['Read community posts', 'Share responsibly', 'Anonymous posting', 'Report unsafe content'],
  },
  {
    label: 'Stay Informed',
    description: 'Real stories. Better awareness.',
    title: 'Stay Informed',
    body: 'Tea Time Cari helps users stay informed through real experiences, community support, and privacy first tools. The goal is not drama. The goal is safer conversations, better awareness, and stronger community support.',
    pills: ['Privacy first', 'Gender based spaces', 'Respectful moderation', 'Stronger together'],
  },
];

export function HowItWorksStepper({ onGetStarted }: HowItWorksStepperProps) {
  const [activeStep, setActiveStep] = React.useState(0);
  const isComplete = activeStep === steps.length;
  const currentStep = steps[Math.min(activeStep, steps.length - 1)];

  const handleBack = () => {
    setActiveStep((step) => Math.max(step - 1, 0));
  };

  const handleNext = () => {
    setActiveStep((step) => Math.min(step + 1, steps.length - 1));
  };

  const handleFinish = () => {
    setActiveStep(steps.length);
  };

  const handleReset = () => {
    setActiveStep(0);
  };

  return (
    <section className="mb-12 mt-2 text-left" aria-labelledby="how-it-works-heading">
      <div className="mx-auto max-w-5xl rounded-[2rem] border border-white/25 bg-white/15 p-5 shadow-2xl backdrop-blur-md md:p-8">
        <div className="mb-8 text-center">
          <p className="mb-2 text-sm font-bold uppercase tracking-[0.3em] text-white/70">Privacy-first community</p>
          <h2 id="how-it-works-heading" className="text-3xl font-black tracking-tight text-white drop-shadow-sm md:text-4xl">
            How Tea Time Cari Works
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-base font-light leading-relaxed text-white/90 md:text-lg">
            A simple, private way to share, compare, and stay informed.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.4fr)] md:gap-8">
          <ol className="space-y-4" aria-label="Tea Time Cari setup steps">
            {steps.map((step, index) => {
              const isActive = activeStep === index;
              const isFinishedStep = activeStep > index;

              return (
                <li key={step.label} className="relative md:pb-2">
                  {index < steps.length - 1 && (
                    <span
                      className="absolute left-5 top-12 hidden h-[calc(100%-1rem)] w-px bg-white/25 md:block"
                      aria-hidden="true"
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => setActiveStep(index)}
                    aria-current={isActive ? 'step' : undefined}
                    className={`group relative flex w-full items-start rounded-2xl border p-4 text-left transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#9B6BAE] ${
                      isActive
                        ? 'border-white/55 bg-white/25 shadow-lg'
                        : 'border-white/20 bg-white/10 hover:border-white/40 hover:bg-white/15'
                    }`}
                  >
                    <span
                      className={`mr-4 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-sm font-black shadow-md ring-2 ring-white/40 ${
                        isActive
                          ? 'bg-gradient-to-br from-[#E89494] via-[#D96E6E] to-[#4B9EC8] text-white'
                          : isFinishedStep
                            ? 'bg-white text-[#D96E6E]'
                            : 'bg-white/20 text-white'
                      }`}
                      aria-hidden="true"
                    >
                      {isFinishedStep ? <Check className="h-5 w-5" /> : index + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="block text-base font-bold text-white">Step {index + 1}: {step.label}</span>
                        {isActive && (
                          <span className="rounded-full bg-white/20 px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-wide text-white">
                            Current
                          </span>
                        )}
                      </span>
                      <span className="mt-1 block text-sm leading-5 text-white/80">{step.description}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>

          <div className="rounded-[1.5rem] border border-white/25 bg-white/95 p-6 text-gray-900 shadow-xl md:p-8">
            {isComplete ? (
              <div className="flex min-h-[360px] flex-col justify-center">
                <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[#E89494] via-[#D96E6E] to-[#4B9EC8] text-white shadow-lg">
                  <Check className="h-7 w-7" aria-hidden="true" />
                </div>
                <h3 className="text-2xl font-black tracking-tight text-gray-950 md:text-3xl">You’re ready for Tea Time Cari</h3>
                <p className="mt-4 text-base leading-7 text-gray-700">
                  A private community is taking shape in Saint Lucia. Create your account, follow the rules, and help keep the space respectful, factual, and safe.
                </p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={onGetStarted}
                    className="group inline-flex items-center justify-center rounded-full bg-gradient-to-r from-[#D96E6E] to-[#4B9EC8] px-6 py-3 font-bold text-white shadow-lg transition-all duration-200 hover:scale-105 hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D96E6E] focus-visible:ring-offset-2"
                  >
                    <span className="mr-2">Get Started</span>
                    <ArrowRight className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-1" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={handleReset}
                    className="inline-flex items-center justify-center rounded-full border border-gray-200 bg-white px-6 py-3 font-bold text-gray-700 transition-all duration-200 hover:border-[#D96E6E] hover:text-[#D96E6E] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D96E6E] focus-visible:ring-offset-2"
                    aria-label="Reset how Tea Time Cari works stepper to step 1"
                  >
                    <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
                    Reset
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex min-h-[360px] flex-col">
                <div>
                  <div className="mb-5 inline-flex rounded-full bg-[#F9E3E3] px-4 py-2 text-sm font-bold text-[#BC5050]">
                    Step {activeStep + 1} of {steps.length}
                  </div>
                  <h3 className="text-2xl font-black tracking-tight text-gray-950 md:text-3xl">{currentStep.title}</h3>
                  <p className="mt-4 text-base leading-7 text-gray-700">{currentStep.body}</p>
                  <div className="mt-6 flex flex-wrap gap-2" aria-label={`Step ${activeStep + 1} features`}>
                    {currentStep.pills.map((pill) => (
                      <span
                        key={pill}
                        className="rounded-full border border-[#F9E3E3] bg-gradient-to-r from-[#F9E3E3] to-white px-3 py-1.5 text-sm font-semibold text-[#8A3D69]"
                      >
                        {pill}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-auto flex flex-col gap-3 pt-10 sm:flex-row sm:items-center sm:justify-between">
                  {activeStep > 0 ? (
                    <button
                      type="button"
                      onClick={handleBack}
                      className="inline-flex items-center justify-center rounded-full border border-gray-200 bg-white px-5 py-3 font-bold text-gray-700 transition-all duration-200 hover:border-[#4B9EC8] hover:text-[#3382AA] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4B9EC8] focus-visible:ring-offset-2"
                    >
                      Back
                    </button>
                  ) : (
                    <span aria-hidden="true" />
                  )}

                  {activeStep === steps.length - 1 ? (
                    <button
                      type="button"
                      onClick={handleFinish}
                      className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-[#D96E6E] to-[#4B9EC8] px-6 py-3 font-bold text-white shadow-lg transition-all duration-200 hover:scale-105 hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D96E6E] focus-visible:ring-offset-2"
                    >
                      Finish
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleNext}
                      className="group inline-flex items-center justify-center rounded-full bg-gradient-to-r from-[#D96E6E] to-[#4B9EC8] px-6 py-3 font-bold text-white shadow-lg transition-all duration-200 hover:scale-105 hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D96E6E] focus-visible:ring-offset-2"
                    >
                      <span className="mr-2">Next</span>
                      <ArrowRight className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-1" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
