import React from 'react';
import { Link } from 'react-router-dom';
import { GradientPageShell } from '@/components/GradientPageShell';

type FaqCategory = {
  id: string;
  title: string;
  description: string;
  questions: {
    question: string;
    answer: React.ReactNode;
  }[];
};

const contactEmail = 'hello@teatimecari.app';

const prohibitedItems = [
  'Nudes or sexual images',
  'Leaked private content',
  'Revenge content',
  'Phone numbers',
  'Home addresses',
  'Bank details',
  'Government ID numbers',
  'Medical information',
  'Threats',
  'False claims',
  'Hate speech',
  'Harassment',
  'Private family details',
  'Content involving minors in unsafe or inappropriate ways',
  'Anything that could put someone at risk',
];

const faqCategories: FaqCategory[] = [
  {
    id: 'general',
    title: 'General',
    description: 'What Tea Time Cari is, who it is for, and how access works.',
    questions: [
      {
        question: 'What is Tea Time Cari?',
        answer: (
          <>
            <p>Tea Time Cari is a private Caribbean community where users can share experiences, compare notes, and stay informed.</p>
            <p>It is built for honest conversations, community support, and privacy conscious sharing. The goal is to help people make better informed decisions while keeping the space respectful, factual, and safe.</p>
          </>
        ),
      },
      {
        question: 'Who can join Tea Time Cari?',
        answer: (
          <>
            <p>Tea Time Cari is for users who are at least 18 years old.</p>
            <p>The service is open to approved users of different gender groups. By default, users will only see content from their own gender group unless they have approved subscription access to other areas of the platform.</p>
          </>
        ),
      },
      {
        question: 'Is Tea Time Cari a dating app?',
        answer: (
          <>
            <p>No. Tea Time Cari is not a dating app.</p>
            <p>It is a private community platform where users can share experiences, compare notes, and stay informed. The platform is designed for privacy, community support, and responsible sharing.</p>
          </>
        ),
      },
      {
        question: 'Do I need approval to join?',
        answer: (
          <>
            <p>Yes. Accounts may be reviewed before access is granted.</p>
            <p>This review process helps protect the community, reduce fake accounts, and keep the platform safer for users.</p>
            <p>Submitting a registration does not guarantee approval.</p>
          </>
        ),
      },
    ],
  },
  {
    id: 'privacy',
    title: 'Privacy & Anonymous Mode',
    description: 'How anonymity, profile visibility, and private sharing work.',
    questions: [
      {
        question: 'Can I post anonymously?',
        answer: (
          <>
            <p>Yes. Tea Time Cari may allow you to post anonymously.</p>
            <p>When Anonymous Mode is turned on, your public profile details will not be shown on that post. However, anonymous posting must still follow all Community Guidelines, Terms of Service, and privacy rules.</p>
            <p>Anonymous posting is for protection, not for harassment, false claims, or exposing others.</p>
          </>
        ),
      },
      {
        question: 'How does Anonymous Mode work?',
        answer: (
          <>
            <p>Anonymous Mode helps protect your public identity when you post.</p>
            <p>Depending on how the platform is configured, the system may create a temporary anonymous identity for added privacy. This makes it harder for other users to connect multiple anonymous posts to the same profile.</p>
            <p>Tea Time Cari may still keep internal records for safety, moderation, security, and legal compliance.</p>
          </>
        ),
      },
      {
        question: 'Can I switch back to my normal profile after posting anonymously?',
        answer: (
          <>
            <p>Yes. You may be able to turn Anonymous Mode on or off depending on the feature settings.</p>
            <p>However, once a post is made anonymously, it should remain anonymous publicly.</p>
          </>
        ),
      },
      {
        question: 'Can I hide my profile?',
        answer: (
          <>
            <p>Yes. Where available, you can adjust your privacy settings to hide certain profile details and reduce what other users can see.</p>
            <p>Some information may still be visible to Tea Time Cari administrators or systems for account management, safety, moderation, and legal compliance.</p>
          </>
        ),
      },
      {
        question: 'Can people see when I am online?',
        answer: (
          <>
            <p>Tea Time Cari may include settings to help limit visibility of your online presence.</p>
            <p>If this feature is available, you can use it to control how much of your activity is visible to other users.</p>
          </>
        ),
      },
      {
        question: 'Why does Tea Time Cari focus so much on privacy?',
        answer: (
          <>
            <p>Because privacy is central to the service.</p>
            <p>Users should be able to share experiences and stay informed without unnecessary exposure, harassment, or retaliation.</p>
            <p>Privacy protects the community, but it does not excuse harmful behaviour.</p>
          </>
        ),
      },
      {
        question: 'Are anonymous likes allowed?',
        answer: (
          <>
            <p>Tea Time Cari may allow anonymous likes or private reactions.</p>
            <p>This helps users support posts without publicly showing their identity.</p>
          </>
        ),
      },
    ],
  },
  {
    id: 'posting',
    title: 'Posting & Receipts',
    description: 'What you can post, how to share carefully, and what to avoid.',
    questions: [
      {
        question: 'Can I share photos or screenshots?',
        answer: (
          <>
            <p>Yes, but only if the content is relevant, lawful, and safe to share.</p>
            <p>You must remove or hide sensitive private information before posting. This includes phone numbers, addresses, bank details, government ID numbers, private family details, medical information, and anything that could put someone at risk.</p>
            <p>Do not post nudes, leaked images, sexual content, revenge content, or private intimate material.</p>
          </>
        ),
      },
      {
        question: 'What counts as “receipts”?',
        answer: (
          <>
            <p>Receipts are supporting details that help back up your story.</p>
            <p>Examples include screenshots, messages, photos, dates, or other relevant information. Receipts should be shared carefully and should not expose unnecessary private information.</p>
            <p>Keep the facts clear. Protect privacy where possible.</p>
          </>
        ),
      },
      {
        question: 'Is name dropping allowed?',
        answer: (
          <>
            <p>Yes, but be careful.</p>
            <p>You may mention someone where it is relevant and factual, but you must not post false claims, threats, insults, private information, or anything intended to harass or endanger someone.</p>
            <p>If you are unsure, keep identifying details limited.</p>
          </>
        ),
      },
      {
        question: 'Can I post about someone I am not dating?',
        answer: (
          <>
            <p>Yes, if the post is relevant to the community and based on real information.</p>
            <p>For example, you may share a concern, warning, or experience that was shared with you. However, do not post gossip, rumours, or claims you cannot reasonably support.</p>
          </>
        ),
      },
      {
        question: 'Can I post about something that happened years ago?',
        answer: (
          <>
            <p>Yes, but provide context.</p>
            <p>If something happened in the past, make the timing clear. Do not present old information as if it is current.</p>
            <p>Old experiences may still matter, but they should be shared responsibly and factually.</p>
          </>
        ),
      },
      {
        question: 'Can I post about celebrities, influencers, or public figures?',
        answer: (
          <>
            <p>Yes, but the same rules apply.</p>
            <p>Keep it factual, respectful, and relevant. Do not post private information, false claims, harassment, sexual content, or anything that violates the Community Guidelines.</p>
            <p>Being known publicly does not remove someone’s right to privacy and safety.</p>
          </>
        ),
      },
      {
        question: 'What if the person I posted about sees it?',
        answer: (
          <>
            <p>Tea Time Cari is built around responsible sharing.</p>
            <p>Only post what you personally know, experienced, or can reasonably support. Avoid harassment, threats, private information, insults, and unsupported accusations.</p>
            <p>Your privacy matters, but you are still responsible for what you post.</p>
          </>
        ),
      },
      {
        question: 'Will I get in trouble for posting?',
        answer: (
          <>
            <p>You are responsible for the content you share.</p>
            <p>Honest, factual sharing is allowed. False claims, harassment, doxxing, threats, leaked private content, sexual material, and privacy violations are not allowed.</p>
            <p>If a post breaks the rules, it may be removed and your account may be warned, suspended, or permanently banned.</p>
          </>
        ),
      },
      {
        question: 'Can I delete my post?',
        answer: (
          <>
            <p>Yes. Where the feature is available, you can delete your own post.</p>
            <p>Tea Time Cari may still retain limited internal records if needed for moderation, security, legal compliance, abuse prevention, or dispute handling.</p>
          </>
        ),
      },
      {
        question: 'Can I edit my post?',
        answer: (
          <>
            <p>If editing is available, you may update your post.</p>
            <p>Even after editing, your content must remain factual, respectful, and compliant with the Community Guidelines.</p>
          </>
        ),
      },
      {
        question: 'Can I post about more than one person?',
        answer: (
          <>
            <p>Yes, but keep separate stories in separate posts.</p>
            <p>This makes the information easier to understand and helps avoid confusion.</p>
          </>
        ),
      },
      {
        question: 'What should I avoid posting?',
        answer: (
          <>
            <p>Do not post:</p>
            <ul className="list-disc space-y-2 pl-5">
              {prohibitedItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </>
        ),
      },
      {
        question: 'What is the safest way to share sensitive information?',
        answer: (
          <>
            <p>Blur faces where needed. Crop screenshots. Hide phone numbers, addresses, usernames, account numbers, and other private details.</p>
            <p>Share enough to explain your experience, but do not expose unnecessary personal information.</p>
          </>
        ),
      },
    ],
  },
  {
    id: 'access',
    title: 'Access & Messaging',
    description: 'Gender group visibility, subscriptions, private messages, and sharing boundaries.',
    questions: [
      {
        question: 'Can I share posts outside Tea Time Cari?',
        answer: (
          <>
            <p>No.</p>
            <p>Content shared inside Tea Time Cari should stay inside Tea Time Cari. Do not screenshot, repost, forward, publish, or distribute another user’s content outside the platform.</p>
            <p>This protects user privacy and helps keep the community safe.</p>
          </>
        ),
      },
      {
        question: 'Can users respond to posts from another gender group?',
        answer: (
          <>
            <p>Users may be able to respond to posts outside their default gender group only if they have approved subscription access and the feature is available.</p>
            <p>All users must follow the same rules around privacy, respect, factual sharing, and community safety.</p>
          </>
        ),
      },
      {
        question: 'Is private messaging allowed?',
        answer: (
          <>
            <p>Private messaging may be available for subscribed or approved users.</p>
            <p>Messages must remain respectful. Do not use messaging to harass, threaten, pressure, spam, send sexual content, request private information, or share content outside the platform.</p>
            <p>If someone asks you to stop messaging them, stop.</p>
          </>
        ),
      },
    ],
  },
  {
    id: 'moderation',
    title: 'Moderation & Safety',
    description: 'Reports, enforcement, platform responsibility, and emergency use.',
    questions: [
      {
        question: 'How do I report a post?',
        answer: (
          <>
            <p>Use the report button on the post, if available.</p>
            <p>You can also email <a href={`mailto:${contactEmail}`} className="font-medium text-blue-500 dark:text-blue-400 hover:underline">{contactEmail}</a>.</p>
            <p>Reports involving privacy, harassment, threats, nudes, leaked content, impersonation, or safety concerns are taken seriously.</p>
          </>
        ),
      },
      {
        question: 'What happens after I report something?',
        answer: (
          <>
            <p>Tea Time Cari may review the report and take action where appropriate.</p>
            <p>Actions may include removing content, warning a user, limiting features, suspending an account, permanently banning an account, or preserving records for further review.</p>
            <p>Not every report will result in removal, but every serious report may be reviewed based on safety, privacy, legal risk, and community rules.</p>
          </>
        ),
      },
      {
        question: 'What happens if I break the rules?',
        answer: (
          <>
            <p>Depending on the issue, Tea Time Cari may remove your content, send a warning, restrict your features, suspend your account, permanently ban your account, preserve records for investigation, or report serious violations where required or appropriate.</p>
            <p>Some violations may lead to immediate removal without warning.</p>
          </>
        ),
      },
      {
        question: 'Can Tea Time Cari remove my content?',
        answer: (
          <>
            <p>Yes.</p>
            <p>Tea Time Cari may remove, restrict, or review content that violates the Community Guidelines, Terms of Service, Privacy Policy, or creates legal, privacy, moderation, or safety concerns.</p>
          </>
        ),
      },
      {
        question: 'Does Tea Time Cari verify every post?',
        answer: (
          <>
            <p>No.</p>
            <p>Tea Time Cari does not guarantee that every post is true, complete, current, or verified. Users are responsible for what they post.</p>
            <p>The platform may moderate content, but users must still use judgment when reading or sharing information.</p>
          </>
        ),
      },
      {
        question: 'Is Tea Time Cari responsible for what users post?',
        answer: (
          <>
            <p>Users are responsible for their own content.</p>
            <p>Tea Time Cari provides the platform, tools, and moderation systems, but does not endorse or confirm every user post.</p>
            <p>Content may be removed if it violates the rules or creates risk.</p>
          </>
        ),
      },
      {
        question: 'Can I use Tea Time Cari in an emergency?',
        answer: (
          <>
            <p>No.</p>
            <p>Tea Time Cari is not an emergency service. If you are in immediate danger, contact local emergency services or the appropriate authorities.</p>
            <p>If you are dealing with threats, violence, stalking, blackmail, or abuse, seek help from trusted people and proper authorities.</p>
          </>
        ),
      },
      {
        question: 'What is the golden rule?',
        answer: (
          <>
            <p>Tell the truth. Protect privacy. Keep the receipts. Respect the community.</p>
            <p>Tea Time Cari is for real stories, thoughtful conversations, and staying informed.</p>
            <p>It is not for harassment, revenge, lies, or exposing private information.</p>
          </>
        ),
      },
    ],
  },
];

const allFaqs = faqCategories.flatMap((category) =>
  category.questions.map((question) => ({ ...question, categoryId: category.id }))
);

export default function Faq() {
  const [openQuestion, setOpenQuestion] = React.useState(0);
  const activeCategory = allFaqs[openQuestion]?.categoryId ?? faqCategories[0].id;

  return (
    <GradientPageShell maxWidth="max-w-5xl">
      <div className="w-full">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
            Tea Time Cari FAQ
          </span>
          <h1 className="mt-4 text-2xl font-semibold text-center text-gray-800 lg:text-3xl dark:text-white">Have any Questions?</h1>
          <p className="mt-4 text-gray-500 dark:text-gray-300">
            Find clear answers about membership, privacy, anonymous posting, receipts, moderation, and community safety.
          </p>
        </div>

        <div className="mt-8 xl:mt-16 lg:flex lg:-mx-12">
          <div className="lg:mx-12 lg:w-72 lg:flex-shrink-0">
            <div className="sticky top-8 rounded-3xl border border-gray-100 bg-gray-50/80 p-6 shadow-sm dark:border-gray-800 dark:bg-gray-800/40">
              <h1 className="text-xl font-semibold text-gray-800 dark:text-white">Table of Content</h1>

              <div className="mt-4 space-y-4 lg:mt-8">
                {faqCategories.map((category) => (
                  <a
                    key={category.id}
                    href={`#${category.id}`}
                    className={`block hover:underline ${
                      activeCategory === category.id
                        ? 'text-blue-500 dark:text-blue-400'
                        : 'text-gray-500 dark:text-gray-300'
                    }`}
                  >
                    {category.title}
                  </a>
                ))}
              </div>

              <div className="mt-8 rounded-2xl bg-white p-4 text-sm text-gray-500 shadow-sm dark:bg-gray-900 dark:text-gray-300">
                Need more help? Email{' '}
                <a href={`mailto:${contactEmail}`} className="font-medium text-blue-500 dark:text-blue-400 hover:underline">
                  {contactEmail}
                </a>
                .
              </div>
            </div>
          </div>

          <div className="flex-1 mt-8 lg:mx-12 lg:mt-0">
            <div className="rounded-3xl border border-gray-100 bg-white p-4 shadow-xl shadow-gray-100/70 dark:border-gray-800 dark:bg-gray-900 dark:shadow-none md:p-8">
              {faqCategories.map((category) => (
                <div key={category.id} id={category.id} className="scroll-mt-8">
                  <div className="mb-8">
                    <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-500 dark:text-blue-400">{category.title}</p>
                    <p className="mt-2 max-w-2xl text-gray-500 dark:text-gray-300">{category.description}</p>
                  </div>

                  {category.questions.map((faq) => {
                    const questionIndex = allFaqs.findIndex((item) => item.question === faq.question);
                    const isOpen = openQuestion === questionIndex;

                    return (
                      <React.Fragment key={faq.question}>
                        <div>
                          <button
                            type="button"
                            className="flex w-full items-center text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-4 dark:focus-visible:ring-offset-gray-900"
                            aria-expanded={isOpen}
                            onClick={() => setOpenQuestion(isOpen ? -1 : questionIndex)}
                          >
                            {isOpen ? (
                              <svg className="flex-shrink-0 w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4"></path>
                              </svg>
                            ) : (
                              <svg xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0 w-6 h-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                              </svg>
                            )}

                            <h1 className="mx-4 text-xl text-gray-700 dark:text-white">{faq.question}</h1>
                          </button>

                          {isOpen && (
                            <div className="flex mt-8 md:mx-10">
                              <span className="border border-blue-500"></span>

                              <div className="max-w-3xl space-y-4 px-4 text-gray-500 dark:text-gray-300">
                                {faq.answer}
                              </div>
                            </div>
                          )}
                        </div>

                        <hr className="my-8 border-gray-200 dark:border-gray-700" />
                      </React.Fragment>
                    );
                  })}
                </div>
              ))}
            </div>

            <div className="mt-8 rounded-3xl bg-gradient-to-r from-[#4B9EC8] via-[#9B6BAE] to-[#D96E6E] p-8 text-center text-white shadow-xl">
              <h2 className="text-2xl font-bold">Ready to join the conversation?</h2>
              <p className="mx-auto mt-3 max-w-2xl text-white/90">
                Tea Time Cari is for real stories, thoughtful conversations, and privacy conscious community support.
              </p>
              <Link
                to="/signup"
                className="mt-6 inline-flex rounded-full bg-white px-6 py-3 font-semibold text-gray-900 shadow-lg transition hover:-translate-y-0.5 hover:bg-white/95"
              >
                Apply to Join
              </Link>
            </div>
          </div>
        </div>
      </div>
    </GradientPageShell>
  );
}
