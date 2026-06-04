import { Link } from 'react-router-dom';

type TermsSection = {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
  footer?: string[];
};

const contactEmail = 'hello@teatimecari.app';
const websiteUrl = 'https://teatimecari.app';

const termsSections: TermsSection[] = [
  {
    title: 'About Tea Time Cari',
    paragraphs: [
      'Tea Time Cari is a private Caribbean community platform designed to help users share experiences, compare notes, and stay informed in a more private and thoughtful way.',
      'The platform may allow users to post, comment, report content, interact with other users, subscribe to additional access, and use privacy or anonymity features.',
      'Tea Time Cari is not a court, law enforcement agency, investigation service, dating service, background check service, or emergency response service. We do not verify every claim made by users.',
    ],
  },
  {
    title: 'Eligibility',
    paragraphs: [
      'You must be at least 18 years old to use Tea Time Cari.',
      'By using the service, you confirm that:',
    ],
    bullets: [
      'You are at least 18 years old.',
      'The information you provide is accurate.',
      'You are using the service for lawful purposes.',
      'You will follow these Terms, our Privacy Policy, and any Community Guidelines.',
      'You will not use Tea Time Cari to harass, threaten, defame, expose, exploit, or endanger anyone.',
    ],
    footer: [
      'We may refuse, suspend, or terminate access if we believe a user does not meet these requirements.',
    ],
  },
  {
    title: 'Account Registration and Approval',
    paragraphs: [
      'To use certain features, you may need to create an account and submit information for review.',
      'Tea Time Cari may manually or automatically review accounts before approval. We reserve the right to approve, reject, suspend, or remove accounts at our discretion, especially where we believe there is a safety, privacy, legal, moderation, or community concern.',
      'Submitting a registration does not guarantee approval.',
      'You are responsible for keeping your login details secure. You must not share your account, sell your account, transfer your account, or allow another person to use your account.',
      'You must notify us immediately if you believe your account has been accessed without permission.',
    ],
  },
  {
    title: 'User Responsibilities',
    paragraphs: [
      'You are responsible for anything you post, upload, send, comment, report, or share through Tea Time Cari.',
      'You agree that you will not:',
    ],
    bullets: [
      'Post false, misleading, or malicious claims.',
      'Post content you know or reasonably should know is untrue.',
      'Harass, bully, threaten, intimidate, shame, or target another person.',
      'Post private information without permission.',
      'Post nudes, sexual images, revenge content, intimate images, or explicit material.',
      'Post someone’s home address, phone number, ID number, bank details, private workplace details, private family details, or medical information.',
      'Impersonate another person.',
      'Create fake accounts.',
      'Use the service to stalk, monitor, blackmail, extort, or pressure anyone.',
      'Encourage violence, self harm, discrimination, or unlawful activity.',
      'Upload malware, spam, scams, or harmful code.',
      'Attempt to access another user’s account or private information.',
      'Misuse the report system.',
      'Screenshot, repost, publish, or distribute private platform content outside Tea Time Cari without permission.',
    ],
  },
  {
    title: 'User Content',
    paragraphs: [
      '“User Content” means anything submitted, posted, uploaded, displayed, commented, messaged, or shared by users, including text, images, screenshots, reports, comments, replies, usernames, and profile content.',
      'You retain ownership of the content you create, but by posting or uploading User Content to Tea Time Cari, you grant Tea Time Cari a limited, worldwide, non exclusive, royalty free licence to host, store, display, reproduce, moderate, remove, process, and distribute that content as necessary to operate and protect the service.',
      'This licence exists only for the purpose of running, securing, moderating, improving, and enforcing the service.',
      'You confirm that you have the right to post the content you submit and that your content does not violate the rights of any person or any applicable law.',
    ],
  },
  {
    title: 'Truthful and Factual Sharing',
    paragraphs: [
      'Tea Time Cari is intended for honest, factual sharing and community support.',
      'You must not use the platform to spread lies, rumours without basis, revenge content, or unsupported accusations.',
      'If you post about another person, you should:',
    ],
    bullets: [
      'Keep the post factual.',
      'Avoid exaggeration.',
      'Avoid threats or insults.',
      'Avoid sharing unnecessary personal details.',
      'Avoid posting content that could put someone at risk.',
      'Make clear when something is your opinion or personal experience.',
      'Only share screenshots, photos, or receipts that you have the right to share.',
    ],
    footer: [
      'Tea Time Cari may remove content that creates legal, safety, privacy, or moderation concerns.',
    ],
  },
  {
    title: 'Anonymous Posting',
    paragraphs: [
      'Tea Time Cari may allow anonymous posting or privacy features.',
      'Anonymous posting may hide your public profile information from other users, but it does not make your activity invisible to Tea Time Cari systems or authorized administrators.',
      'We may retain internal records for moderation, safety, security, legal compliance, fraud prevention, and enforcement.',
      'Anonymous posting must not be used to harass, defame, threaten, expose, impersonate, or unlawfully share private information about another person.',
      'If you abuse anonymous features, we may remove content, restrict access, suspend your account, or permanently ban you.',
    ],
  },
  {
    title: 'Prohibited Content',
    paragraphs: ['The following content is not allowed:'],
    bullets: [
      'Nudes or sexual images',
      'Revenge porn or intimate images shared without consent',
      'Images of minors in sexual, suggestive, exploitative, or unsafe contexts',
      'Threats of violence',
      'Harassment or bullying',
      'Doxxing',
      'Private contact details',
      'Banking or financial information',
      'Government issued ID numbers',
      'Private medical information',
      'Hate speech',
      'False claims presented as fact',
      'Content encouraging self harm',
      'Blackmail or extortion',
      'Spam, scams, or fraudulent content',
      'Content that violates another person’s intellectual property rights',
      'Content that violates any law',
    ],
    footer: ['We may remove prohibited content without notice.'],
  },
  {
    title: 'Content Moderation',
    paragraphs: [
      'Tea Time Cari may review, moderate, restrict, remove, or disable content at any time.',
      'We may take action if content appears to violate these Terms, our Privacy Policy, Community Guidelines, applicable law, or the safety of the community.',
      'Moderation actions may include:',
    ],
    bullets: [
      'Warning a user',
      'Removing content',
      'Limiting features',
      'Suspending an account',
      'Permanently banning an account',
      'Restricting access to certain areas',
      'Preserving information for investigation',
      'Reporting serious unlawful activity where required or appropriate',
    ],
    footer: ['We are not required to publish, preserve, or restore any content.'],
  },
  {
    title: 'Reporting Content',
    paragraphs: [
      'Users may report content that appears to violate these Terms, our Community Guidelines, privacy rights, safety standards, or applicable law.',
      `You may report content through the platform or by emailing ${contactEmail}.`,
      'Reports should be honest and made in good faith.',
      'Misusing the reporting system to silence, harass, or target another user may result in account action.',
    ],
  },
  {
    title: 'No Tolerance for Nudes, Leaks, or Revenge Content',
    paragraphs: [
      'Tea Time Cari has zero tolerance for nudes, leaked intimate images, revenge content, sexual exploitation, or non consensual intimate content.',
      'Any account found posting or distributing this type of content may be permanently banned.',
      'Where appropriate, Tea Time Cari may preserve relevant records and report serious violations to the appropriate authorities.',
    ],
  },
  {
    title: 'Privacy and Data Protection',
    paragraphs: [
      'Your use of Tea Time Cari is also governed by our Privacy Policy.',
      'We do not sell, rent, or trade user personal information.',
      'However, we may use, process, or disclose limited information where necessary to operate the service, comply with the law, protect users, investigate abuse, use trusted service providers, or enforce these Terms.',
      'You are also responsible for protecting your own privacy and the privacy of others when using the platform.',
    ],
  },
  {
    title: 'Sharing Content Outside the Platform',
    paragraphs: [
      'You must not screenshot, repost, publish, forward, distribute, or share private Tea Time Cari content outside the platform without permission.',
      'This rule protects the privacy and safety of users.',
      'Violating this rule may result in suspension or permanent removal.',
    ],
  },
  {
    title: 'Subscriptions and Paid Features',
    paragraphs: [
      'Tea Time Cari may offer paid features, subscriptions, or paid access to certain areas or functions.',
      'Where paid features are available, prices, billing terms, renewal terms, cancellation terms, and access limits will be shown before purchase.',
      'By purchasing a paid feature, you authorize the payment provider to charge the selected payment method.',
      'Tea Time Cari may use third party payment processors. We do not store full payment card details.',
      'Unless otherwise stated, subscription fees are non refundable except where required by law or where Tea Time Cari chooses to issue a refund at its discretion.',
      'Access to paid features may be removed if payment fails, a subscription expires, or your account is suspended or terminated.',
    ],
  },
  {
    title: 'Gender Based Access and Community Areas',
    paragraphs: [
      'Tea Time Cari may organize content, visibility, or access based on gender group, subscription status, account type, or platform rules.',
      'You agree not to misrepresent your identity, gender group, or account information to gain unauthorized access to community areas.',
      'We may remove access if we believe information was misrepresented or if access creates safety, privacy, or community concerns.',
    ],
  },
  {
    title: 'Messaging and User Interactions',
    paragraphs: [
      'If private messaging or direct communication is available, you must use it respectfully.',
      'You must not use messaging to:',
    ],
    bullets: [
      'Harass another user',
      'Send threats',
      'Send sexual content',
      'Pressure another user',
      'Spam another user',
      'Request private information',
      'Share content from Tea Time Cari outside the platform',
      'Impersonate someone else',
      'Send abusive or manipulative messages',
    ],
    footer: ['Tea Time Cari may review reports involving messages and take action where appropriate.'],
  },
  {
    title: 'Intellectual Property',
    paragraphs: [
      'Tea Time Cari, including its name, logo, design, branding, graphics, software, content, layout, and platform features, belongs to Tea Time Cari or its licensors.',
      'You may not copy, reproduce, modify, distribute, reverse engineer, or misuse our intellectual property without written permission.',
      'You may not use the Tea Time Cari name or logo in a way that suggests endorsement, partnership, or ownership without permission.',
    ],
  },
  {
    title: 'Feedback and Suggestions',
    paragraphs: [
      'If you send us ideas, feedback, suggestions, or improvements, you agree that Tea Time Cari may use them without payment or obligation to you.',
    ],
  },
  {
    title: 'Third Party Services',
    paragraphs: [
      'Tea Time Cari may use third party services for hosting, authentication, email delivery, payments, analytics, storage, security, and other operational needs.',
      'Your use of third party services may also be governed by their own terms and privacy policies.',
      'Tea Time Cari is not responsible for third party websites, platforms, services, or content that we do not control.',
    ],
  },
  {
    title: 'No Professional Advice',
    paragraphs: [
      'Tea Time Cari does not provide legal, medical, psychological, financial, relationship, security, or professional advice.',
      'Content on the platform is user generated and may not be accurate, complete, verified, or suitable for your situation.',
      'You should use your own judgment and seek professional advice where needed.',
    ],
  },
  {
    title: 'No Guarantee of Accuracy',
    paragraphs: [
      'Tea Time Cari does not guarantee that user content is true, accurate, complete, current, or verified.',
      'Users are responsible for the content they submit.',
      'We may remove or restrict content, but we are not obligated to investigate every claim, monitor every interaction, or verify every post.',
    ],
  },
  {
    title: 'Safety and Emergencies',
    paragraphs: [
      'Tea Time Cari is not an emergency service.',
      'If you are in immediate danger, contact local emergency services or the appropriate authorities.',
      'Do not rely on Tea Time Cari to respond to emergencies, threats, abuse, or urgent safety issues.',
    ],
  },
  {
    title: 'Platform Availability',
    paragraphs: [
      'We may update, change, suspend, restrict, or discontinue any part of Tea Time Cari at any time.',
      'We do not guarantee that the service will always be available, uninterrupted, secure, or error free.',
      'We may perform maintenance, updates, or changes without notice.',
    ],
  },
  {
    title: 'Account Suspension and Termination',
    paragraphs: ['We may suspend, restrict, or terminate your account if we believe:'],
    bullets: [
      'You violated these Terms.',
      'You violated our Privacy Policy or Community Guidelines.',
      'You posted prohibited content.',
      'You misused anonymous features.',
      'You threatened or harassed another user.',
      'You shared content outside the platform.',
      'You created safety, privacy, security, or legal risk.',
      'Your account information is false or misleading.',
      'Your account is associated with fraud, spam, or abuse.',
      'We are required to do so by law.',
    ],
    footer: [`You may also request account deletion by contacting us at ${contactEmail}.`],
  },
  {
    title: 'Limitation of Liability',
    paragraphs: [
      'To the fullest extent permitted by law, Tea Time Cari, its owners, operators, employees, contractors, agents, and service providers will not be liable for:',
    ],
    bullets: [
      'User generated content',
      'False or misleading posts by users',
      'User disputes',
      'Emotional distress caused by user content',
      'Loss of data',
      'Unauthorized access beyond our reasonable control',
      'Service interruptions',
      'Losses caused by third party providers',
      'Actions taken for moderation, suspension, or enforcement',
      'Your use or inability to use the service',
    ],
    footer: ['Tea Time Cari is provided on an “as is” and “as available” basis.'],
  },
  {
    title: 'Indemnity',
    paragraphs: [
      'You agree to defend, indemnify, and hold harmless Tea Time Cari, its owners, operators, employees, contractors, agents, and service providers from any claims, losses, damages, liabilities, costs, or expenses arising from:',
    ],
    bullets: [
      'Your use of the service',
      'Your User Content',
      'Your violation of these Terms',
      'Your violation of another person’s rights',
      'Your unlawful conduct',
      'Your misuse of anonymous posting, messaging, or platform features',
    ],
  },
  {
    title: 'Disputes Between Users',
    paragraphs: [
      'Tea Time Cari is not responsible for disputes between users.',
      'We may choose to moderate, restrict, remove content, or suspend accounts, but we are not required to resolve personal disputes, relationship disputes, or disagreements between users.',
    ],
  },
  {
    title: 'Changes to These Terms',
    paragraphs: [
      'We may update these Terms from time to time.',
      'If we make material changes, we may notify users by email, website notice, in app notice, or another reasonable method.',
      'Your continued use of Tea Time Cari after updated Terms are posted means you accept the updated Terms.',
    ],
  },
  {
    title: 'Governing Law',
    paragraphs: [
      'These Terms are governed by the laws of Saint Lucia, unless another jurisdiction is required by applicable law.',
      'Any disputes relating to these Terms or Tea Time Cari shall be handled in the courts or appropriate legal forum of Saint Lucia, unless applicable law requires otherwise.',
    ],
  },
  {
    title: 'Severability',
    paragraphs: ['If any part of these Terms is found to be invalid or unenforceable, the remaining sections will continue to apply.'],
  },
  {
    title: 'Entire Agreement',
    paragraphs: [
      'These Terms, together with our Privacy Policy and any Community Guidelines, form the entire agreement between you and Tea Time Cari regarding your use of the service.',
    ],
  },
  {
    title: 'Contact Us',
    paragraphs: ['If you have questions about these Terms, contact us at:'],
    bullets: ['Tea Time Cari', `Email: ${contactEmail}`, `Website: ${websiteUrl}`],
  },
];

export default function TermsOfService() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <article className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <Link to="/" className="text-sm font-medium text-blue-600 hover:text-blue-700">
          ← Back to home
        </Link>
        <header className="mt-4 space-y-3 border-b border-slate-200 pb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">Terms and Conditions</p>
          <h1 className="text-3xl font-bold text-slate-900">Tea Time Cari</h1>
          <dl className="grid gap-2 text-sm text-slate-600 sm:grid-cols-3">
            <div>
              <dt className="font-semibold text-slate-900">Effective Date</dt>
              <dd>June 4, 2026</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-900">Website</dt>
              <dd>
                <a href={websiteUrl} className="text-blue-600 hover:text-blue-700">
                  {websiteUrl}
                </a>
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-900">Contact</dt>
              <dd>
                <a href={`mailto:${contactEmail}`} className="text-blue-600 hover:text-blue-700">
                  {contactEmail}
                </a>
              </dd>
            </div>
          </dl>
          <div className="space-y-4 text-slate-700 leading-7">
            <p>
              These Terms and Conditions govern your access to and use of Tea Time Cari, including our website, app,
              community features, posting tools, anonymous posting features, messaging features, subscription features,
              and related services.
            </p>
            <p>
              By creating an account, accessing Tea Time Cari, posting content, commenting, messaging, subscribing, or
              otherwise using the service, you agree to these Terms.
            </p>
            <p>If you do not agree to these Terms, you must not use Tea Time Cari.</p>
          </div>
        </header>

        <div className="mt-8 space-y-8 text-slate-700 leading-7">
          {termsSections.map((section, index) => (
            <section key={section.title}>
              <h2 className="text-xl font-semibold text-slate-900">
                {index + 1}. {section.title}
              </h2>
              {section.paragraphs?.map((paragraph) => (
                <p key={paragraph} className="mt-2">
                  {paragraph}
                </p>
              ))}
              {section.bullets ? (
                <ul className="mt-3 list-disc space-y-1 pl-6">
                  {section.bullets.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
              {section.footer?.map((paragraph) => (
                <p key={paragraph} className="mt-2">
                  {paragraph}
                </p>
              ))}
            </section>
          ))}
        </div>
      </article>
    </main>
  );
}
