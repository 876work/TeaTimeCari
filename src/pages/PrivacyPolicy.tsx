import { Link } from 'react-router-dom';
import { GradientPageShell } from '@/components/GradientPageShell';

type PolicySection = {
  title: string;
  body?: string[];
  subsections?: Array<{
    title: string;
    body?: string[];
    items?: string[];
  }>;
  items?: string[];
};

const contactEmail = 'hello@teatimecari.app';
const websiteUrl = 'https://teatimecari.app';

const policySections: PolicySection[] = [
  {
    title: '1. About Tea Time Cari',
    body: [
      'Tea Time Cari is a private Caribbean community platform designed to allow users to share experiences, compare notes, and stay informed in a safer and more privacy conscious environment.',
      'Our service may include account registration, profile settings, anonymous posting, private community access, moderation, reporting tools, messaging features, and subscription based access.',
      'Tea Time Cari is built around privacy, respectful sharing, anonymity, and community safety.',
    ],
  },
  {
    title: '2. Information We Collect',
    body: ['We collect only the information reasonably needed to operate, protect, improve, and moderate the service.'],
    subsections: [
      {
        title: 'Account Information',
        body: ['When you register or create an account, we may collect:'],
        items: [
          'Name or first name',
          'Username',
          'Email address',
          'Password credentials, handled securely through our authentication provider',
          'Gender group selection',
          'Account status, such as pending, approved, rejected, suspended, or active',
          'Verification status',
          'Profile settings and privacy preferences',
        ],
      },
      {
        title: 'Identity, Safety, and Verification Information',
        body: [
          'To help protect the community, we may collect information needed for account review, identity checks, approval decisions, fraud prevention, or safety moderation. This may include information submitted during registration or verification.',
          'Where possible, we limit access to this information to authorized administrators only.',
        ],
      },
      {
        title: 'User Content',
        body: ['When you use Tea Time Cari, we may collect content you choose to submit, including:'],
        items: [
          'Posts',
          'Comments',
          'Replies',
          'Reports',
          'Messages, where messaging is available',
          'Photos, screenshots, or other uploaded content',
          'Anonymous posts or anonymous activity',
          'Likes, reactions, flags, or other engagement activity',
        ],
      },
      {
        title: 'Technical and Usage Information',
        body: ['We may automatically collect limited technical information, including:'],
        items: [
          'IP address',
          'Device type',
          'Browser type',
          'Operating system',
          'Login dates and times',
          'Approximate location based on IP address',
          'Session activity',
          'Security logs',
          'Error logs',
          'Pages or features used',
          'Referral source',
        ],
      },
      {
        title: 'Payment Information',
        body: [
          'If paid features or subscriptions are offered, payments may be processed by a third party payment provider. Tea Time Cari does not store full card numbers or complete payment credentials.',
          'We may receive limited payment related information, such as:',
        ],
        items: ['Payment status', 'Subscription status', 'Transaction reference', 'Plan type', 'Billing email', 'Access period'],
      },
      {
        title: 'Communications',
        body: ['If you contact us, report an issue, request support, or respond to emails, we may collect the information you provide in that communication.'],
      },
    ],
  },
  {
    title: '3. How We Use Your Information',
    body: ['We use your information to:'],
    items: [
      'Create and manage your account',
      'Review and approve registrations',
      'Verify account access',
      'Provide the Tea Time Cari service',
      'Enable posting, commenting, reporting, and community features',
      'Support anonymous posting and privacy settings',
      'Manage gender based access and subscription based access',
      'Send account emails, such as review, approval, password reset, suspension, and security emails',
      'Moderate content and enforce community rules',
      'Investigate reports, abuse, harassment, impersonation, spam, or safety concerns',
      'Prevent fraud, unauthorized access, and misuse',
      'Improve the service, design, performance, and user experience',
      'Maintain security logs and audit records',
      'Comply with legal obligations',
      'Respond to lawful requests from authorities where required by law',
    ],
  },
  {
    title: '4. Anonymous Posting and Privacy Features',
    body: [
      'Tea Time Cari may allow users to post anonymously or hide parts of their profile.',
      'When you use anonymous features, your public identity may be hidden from other users. However, Tea Time Cari may still retain internal records that allow authorized administrators or systems to review activity for safety, moderation, security, legal compliance, or abuse prevention.',
      'Anonymous posting does not give permission to harass, defame, threaten, expose, impersonate, or unlawfully share someone else’s private information.',
      'A post made anonymously may remain anonymous publicly, but it may still be subject to review, removal, investigation, or account action if it violates our rules or applicable law.',
    ],
  },
  {
    title: '5. We Do Not Sell Your Personal Information',
    body: [
      'Tea Time Cari does not sell, rent, or trade your personal information.',
      'We do not share your personal information with advertisers or data brokers.',
      'We do not allow third parties to use your personal information for their own independent marketing purposes.',
    ],
  },
  {
    title: '6. Limited Sharing of Information',
    body: ['Although we do not sell or commercially share your personal information, limited disclosure may be necessary in specific circumstances.', 'We may share information with:'],
    subsections: [
      {
        title: 'Service Providers',
        body: [
          'We may use trusted service providers to help operate the platform, including hosting, authentication, database storage, email delivery, analytics, security, payment processing, and technical support.',
          'These providers are only allowed to process information as needed to provide services to Tea Time Cari.',
        ],
      },
      {
        title: 'Legal and Safety Requirements',
        body: ['We may disclose information where we believe in good faith that it is necessary to:'],
        items: [
          'Comply with applicable law',
          'Respond to a lawful request, court order, subpoena, or legal process',
          'Protect the safety, rights, or property of Tea Time Cari, users, or others',
          'Investigate fraud, harassment, threats, abuse, or unlawful activity',
          'Report serious violations involving sexual content, exploitation, threats, or safety risks',
          'Enforce our Terms of Service or Community Guidelines',
        ],
      },
      {
        title: 'Business Transfers',
        body: ['If Tea Time Cari is involved in a merger, acquisition, restructuring, or sale of assets, user information may be transferred as part of that transaction. If this happens, we will take reasonable steps to ensure your information remains protected.'],
      },
    ],
  },
  {
    title: '7. Content Shared by Users',
    body: [
      'Tea Time Cari is a community platform. Information you choose to post, comment, upload, or share may be visible to other users depending on your privacy settings, access permissions, gender group access, subscription status, and platform rules.',
      'You should not post:',
    ],
    items: [
      'Nudes or sexual images',
      'Private images shared without consent',
      'Bank details',
      'Government ID numbers',
      'Home addresses',
      'Phone numbers',
      'Private medical information',
      'Private family details',
      'Threats',
      'False claims',
      'Content intended to harass, shame, extort, or endanger another person',
    ],
  },
  {
    title: '8. Photos, Screenshots, and Uploaded Content',
    body: [
      'If you upload photos, screenshots, or other media, those files may be stored and processed by Tea Time Cari or our service providers.',
      'You are responsible for ensuring that any uploaded content is lawful, accurate, and does not violate another person’s rights.',
      'We may remove uploaded content if it includes prohibited material, private information, sexual content, abusive content, or content that creates safety or legal risk.',
    ],
  },
  {
    title: '9. Data Security',
    body: ['We take reasonable technical and organizational measures to protect personal information from unauthorized access, alteration, disclosure, loss, misuse, or destruction.', 'These measures may include:'],
    items: [
      'Secure authentication',
      'Access controls',
      'Role based admin access',
      'Encrypted transmission where supported',
      'Secure database storage',
      'Logging and monitoring',
      'Limited administrative access',
      'Review of suspicious activity',
      'Security focused development practices',
    ],
  },
  {
    title: '10. Account Review, Moderation, and Enforcement',
    body: ['Tea Time Cari may review registrations, user activity, reports, posts, comments, messages, and uploaded content to protect the community.', 'We may use your information to:'],
    items: ['Approve or reject accounts', 'Suspend or remove accounts', 'Investigate reports', 'Remove harmful or prohibited content', 'Limit access to features', 'Prevent repeated abuse', 'Protect users and the integrity of the platform'],
  },
  {
    title: '11. Data Retention',
    body: ['We keep personal information only for as long as reasonably necessary for the purposes described in this Privacy Policy.', 'Retention periods may depend on:'],
    items: ['Whether your account is active', 'Whether the information is needed to provide the service', 'Legal or regulatory requirements', 'Security and fraud prevention needs', 'Moderation history', 'Dispute resolution', 'Backup and audit requirements'],
  },
  {
    title: '12. Your Privacy Choices',
    body: ['Depending on the features available, you may be able to:'],
    items: [
      'Update your profile information',
      'Change privacy settings',
      'Use anonymous posting',
      'Hide certain profile details',
      'Delete your own posts',
      'Request account deletion',
      'Unsubscribe from non essential emails',
      'Request access to certain personal information',
      'Request correction of inaccurate information',
      'Request deletion of certain information, subject to legal and safety exceptions',
    ],
  },
  {
    title: '13. Email Communications',
    body: ['We may send you service related emails, including:'],
    items: ['Account under review emails', 'Account approval emails', 'Account rejection emails', 'Password reset emails', 'Email verification emails', 'Security alerts', 'Suspension or account status emails', 'Important service updates'],
  },
  {
    title: '14. Cookies and Similar Technologies',
    body: ['Tea Time Cari may use cookies, local storage, or similar technologies to:'],
    items: ['Keep users logged in', 'Maintain session security', 'Remember preferences', 'Understand basic usage', 'Improve site performance', 'Prevent abuse or fraud'],
  },
  {
    title: '15. Children and Age Restrictions',
    body: [
      'Tea Time Cari is not intended for children.',
      'Users must be at least 18 years old, or the age of majority required by applicable law, whichever is higher.',
      'We do not knowingly collect personal information from children. If we learn that a child has created an account or submitted personal information, we may delete the account and related information.',
    ],
  },
  {
    title: '16. International Users',
    body: [
      'Tea Time Cari is launching in Saint Lucia but may be accessed by users in other locations.',
      'Your information may be processed or stored in countries where our service providers operate. Where this occurs, we take reasonable steps to ensure that personal information is handled securely and in accordance with this Privacy Policy.',
    ],
  },
  {
    title: '17. Sensitive Information',
    body: [
      'Because of the nature of the service, users may voluntarily share information that could be sensitive.',
      'You should carefully consider what you post or upload. Do not share information that could put you or another person at risk.',
      'Tea Time Cari may restrict, remove, or review sensitive content if it creates privacy, safety, legal, or community risk.',
    ],
  },
  {
    title: '18. Legal Requests and Law Enforcement',
    body: [
      'We do not voluntarily disclose user data to law enforcement or government authorities unless we believe disclosure is legally required or necessary to protect safety.',
      'If we receive a lawful request for information, we may disclose information as required by applicable law.',
      'Where legally permitted, we may attempt to limit the disclosure to only the information necessary.',
    ],
  },
  {
    title: '19. No Public Sale or Public Disclosure of User Data',
    body: [
      'Tea Time Cari does not publish, sell, rent, or trade user account data.',
      'We do not publicly disclose your email address, private account details, identity verification information, or private profile information as part of normal service operation.',
      'Public visibility of content depends on what you choose to post and the settings or access rules of the platform.',
    ],
  },
  {
    title: '20. Third Party Links',
    body: [
      'Tea Time Cari may contain links to third party websites, services, payment processors, or external platforms.',
      'We are not responsible for the privacy practices, content, or security of third party websites. You should review their privacy policies before using them.',
    ],
  },
  {
    title: '21. Changes to This Privacy Policy',
    body: [
      'We may update this Privacy Policy from time to time.',
      'If we make material changes, we may notify users by email, in app notice, website notice, or another reasonable method.',
      'The updated policy will take effect when posted unless otherwise stated.',
    ],
  },
  {
    title: '22. Contact Us',
    body: ['If you have questions about this Privacy Policy, your data, or your privacy rights, contact us at:'],
  },
  {
    title: '23. Summary',
    body: ['Tea Time Cari is designed to be privacy focused.'],
    items: [
      'We do not sell your personal information.',
      'We do not share your personal information with advertisers.',
      'We use your information only to operate, secure, moderate, and improve the service.',
      'We may disclose information only when needed for service providers, legal compliance, safety, security, or enforcement.',
      'We give users privacy and anonymity tools, but users remain responsible for what they post.',
      'We aim to protect the community while respecting user privacy.',
    ],
  },
];

function ParagraphList({ paragraphs }: { paragraphs?: string[] }) {
  if (!paragraphs?.length) {
    return null;
  }

  return (
    <>
      {paragraphs.map((paragraph) => (
        <p key={paragraph} className="mt-3">
          {paragraph}
        </p>
      ))}
    </>
  );
}

function BulletList({ items }: { items?: string[] }) {
  if (!items?.length) {
    return null;
  }

  return (
    <ul className="mt-3 list-disc space-y-1 pl-6">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export default function PrivacyPolicy() {
  return (
    <GradientPageShell maxWidth="max-w-5xl">
        <Link to="/" className="text-sm font-medium text-blue-600 hover:text-blue-700">
          ← Back to home
        </Link>
        <h1 className="mt-4 text-3xl font-bold text-slate-900">Privacy Policy</h1>
        <h2 className="mt-2 text-2xl font-semibold text-slate-900">Tea Time Cari</h2>

        <dl className="mt-6 space-y-2 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
          <div>
            <dt className="inline font-semibold text-slate-900">Effective Date: </dt>
            <dd className="inline">June 4, 2026</dd>
          </div>
          <div>
            <dt className="inline font-semibold text-slate-900">Website: </dt>
            <dd className="inline">
              <a href={websiteUrl} className="text-blue-600 hover:text-blue-700">
                {websiteUrl}
              </a>
            </dd>
          </div>
          <div>
            <dt className="inline font-semibold text-slate-900">Contact: </dt>
            <dd className="inline">
              <a href={`mailto:${contactEmail}`} className="text-blue-600 hover:text-blue-700">
                {contactEmail}
              </a>
            </dd>
          </div>
        </dl>

        <div className="mt-8 space-y-8 text-slate-700 leading-7">
          <section>
            <p>
              Tea Time Cari respects your privacy. We understand that users may share personal, sensitive, or private experiences on the platform. This Privacy Policy explains what information we collect, how we use it, how we protect it, and the choices you have.
            </p>
            <p className="mt-3">
              By creating an account, using Tea Time Cari, submitting information, or interacting with our service, you agree to the practices described in this Privacy Policy.
            </p>
          </section>

          {policySections.map((section) => (
            <section key={section.title}>
              <h2 className="text-xl font-semibold text-slate-900">{section.title}</h2>
              <ParagraphList paragraphs={section.body} />
              <BulletList items={section.items} />
              {section.title === '3. How We Use Your Information' && (
                <p className="mt-3">We do not use your personal data to publicly expose your identity.</p>
              )}
              {section.title === '7. Content Shared by Users' && (
                <p className="mt-3">Tea Time Cari may remove content that violates our rules or creates legal, safety, privacy, or moderation concerns.</p>
              )}
              {section.title === '9. Data Security' && (
                <p className="mt-3">No online service can guarantee complete security. You are responsible for keeping your login credentials private and using a strong password.</p>
              )}
              {section.title === '10. Account Review, Moderation, and Enforcement' && (
                <p className="mt-3">Where appropriate, moderation decisions may be made by authorized administrators.</p>
              )}
              {section.title === '11. Data Retention' && (
                <p className="mt-3">If your account is deleted, some information may be removed or anonymized. However, we may retain limited records where necessary for legal compliance, fraud prevention, safety, dispute resolution, or enforcement of our Terms of Service.</p>
              )}
              {section.title === '12. Your Privacy Choices' && (
                <p className="mt-3">
                  To make a privacy request, contact us at{' '}
                  <a href={`mailto:${contactEmail}`} className="text-blue-600 hover:text-blue-700">
                    {contactEmail}
                  </a>
                  .
                </p>
              )}
              {section.title === '13. Email Communications' && (
                <>
                  <p className="mt-3">These emails are necessary for account security and service operation.</p>
                  <p className="mt-3">If we send marketing or promotional emails in the future, you will be able to opt out.</p>
                </>
              )}
              {section.title === '14. Cookies and Similar Technologies' && (
                <p className="mt-3">You can adjust your browser settings to block cookies, but some parts of the service may not work properly.</p>
              )}
              {section.title === '22. Contact Us' && (
                <address className="mt-3 not-italic">
                  <p>Tea Time Cari</p>
                  <p>
                    Email:{' '}
                    <a href={`mailto:${contactEmail}`} className="text-blue-600 hover:text-blue-700">
                      {contactEmail}
                    </a>
                  </p>
                  <p>
                    Website:{' '}
                    <a href={websiteUrl} className="text-blue-600 hover:text-blue-700">
                      {websiteUrl}
                    </a>
                  </p>
                </address>
              )}
              {section.subsections?.map((subsection) => (
                <section key={subsection.title} className="mt-5">
                  <h3 className="text-lg font-semibold text-slate-900">{subsection.title}</h3>
                  <ParagraphList paragraphs={subsection.body} />
                  <BulletList items={subsection.items} />
                  {subsection.title === 'User Content' && (
                    <p className="mt-3">You are responsible for the content you choose to share. You should not upload or post private information about yourself or others unless you have the right to do so.</p>
                  )}
                  {subsection.title === 'Technical and Usage Information' && (
                    <p className="mt-3">This information helps us secure the platform, prevent abuse, troubleshoot issues, and understand how the service is being used.</p>
                  )}
                </section>
              ))}
            </section>
          ))}
        </div>
    </GradientPageShell>
  );
}
