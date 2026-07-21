import React from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Flag,
  LockKeyhole,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import { HowItWorksStepper } from "./HowItWorksStepper";
import { SiteHeader } from "./SiteHeader";
import { AdSlot } from "./Ads/AdSlot";

const trustCards = [
  {
    title: "Reviewed accounts",
    description: "Member applications are checked before community access opens.",
    Icon: UserCheck,
  },
  {
    title: "Private spaces",
    description: "Community areas are designed around privacy-conscious sharing.",
    Icon: LockKeyhole,
  },
  {
    title: "Anonymous with accountability",
    description:
      "Share sensitive experiences with privacy, while rules and review keep the space responsible.",
    Icon: ShieldCheck,
  },
  {
    title: "Report unsafe content",
    description:
      "Clear reporting paths help members flag harmful posts for review.",
    Icon: Flag,
  },
];

export function HomePage() {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-gradient-to-br from-[#4B9EC8] via-[#9B6BAE] to-[#D96E6E] px-4 py-4 sm:py-6">
      <SiteHeader />

      <div
        className="pointer-events-none absolute inset-0 overflow-hidden"
        aria-hidden="true"
      >
        <div className="absolute -left-16 top-24 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute right-0 top-44 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute bottom-16 left-1/3 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center py-12 text-center sm:py-16">
        <div className="mb-8">
          <div className="mx-auto mb-6 h-32 w-32 drop-shadow-2xl">
            <img
              src="/teaLogo.png"
              alt="Tea Time Cari"
              className="h-full w-full object-contain"
            />
          </div>
        </div>

        <h1 className="mb-6 text-5xl font-black tracking-tight text-white drop-shadow-md md:text-7xl">
          Tea Time Cari
        </h1>

        <p className="mx-auto mb-5 max-w-2xl text-xl font-light leading-relaxed text-white/95 drop-shadow-sm md:text-2xl">
          A privacy-first community for safer sharing, honest context, and
          accountable conversations.
        </p>

        <p className="mx-auto mb-8 max-w-xl text-sm font-medium leading-6 text-white/85 md:text-base">
          Tea Time Cari keeps the first step simple: apply, get reviewed, and
          join a space built to protect members before anything else.
        </p>

        <div className="mb-12 flex flex-col items-center justify-center gap-3">
          <Link
            to="/signup"
            className="inline-flex items-center justify-center rounded-full bg-white px-8 py-4 text-base font-black text-[#263f50] shadow-xl shadow-[#263f50]/20 transition hover:-translate-y-0.5 hover:bg-[#F9E3E3] hover:shadow-2xl focus:outline-none focus-visible:ring-4 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#9B6BAE]"
            aria-label="Apply to join Tea Time Cari"
          >
            Apply to join
            <ArrowRight className="ml-2 h-5 w-5" aria-hidden="true" />
          </Link>

          <p className="text-sm font-medium text-white/80">
            Reviewed membership. Privacy-conscious by design.
          </p>
        </div>

        <section
          id="about"
          className="mb-12 scroll-mt-32"
          aria-labelledby="trust-heading"
        >
          <div className="mx-auto mb-6 max-w-2xl text-center">
            <p className="mb-2 text-sm font-bold uppercase tracking-[0.28em] text-white/70">
              Built for trust
            </p>

            <h2
              id="trust-heading"
              className="text-3xl font-black tracking-tight text-white drop-shadow-sm md:text-4xl"
            >
              Safety signals before sign-up
            </h2>
          </div>

          <div className="mx-auto grid max-w-5xl grid-cols-1 gap-4 text-left sm:grid-cols-2 lg:grid-cols-4">
            {trustCards.map(({ title, description, Icon }) => (
              <article
                key={title}
                className="rounded-2xl border border-white/30 bg-white/20 p-5 text-white shadow-lg backdrop-blur-sm"
              >
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#263f50] shadow-md">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>

                <h3 className="mb-2 text-lg font-bold">{title}</h3>

                <p className="text-sm leading-6 text-white/90">
                  {description}
                </p>
              </article>
            ))}
          </div>
        </section>

        <HowItWorksStepper />

        <div className="my-10">
          <AdSlot placement="homepage" />
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium text-white/80">
            Join our growing community of approved members
          </p>

          <Link
            to="/signup"
            className="inline-flex items-center justify-center rounded-full border border-white/45 bg-white/15 px-6 py-3 text-sm font-bold text-white backdrop-blur-sm transition hover:bg-white/25 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#9B6BAE]"
          >
            Start your application
          </Link>
        </div>
      </div>
    </div>
  );
}