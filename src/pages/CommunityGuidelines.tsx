import { Link } from "react-router-dom";
import { GradientPageShell } from "@/components/GradientPageShell";

type GuidelinesSection = {
  title: string;
  body?: string[];
  items?: string[];
  closing?: string[];
};

const contactEmail = "hello@teatimecari.app";
const websiteUrl = "https://teatimecari.app";

const guidelinesSections: GuidelinesSection[] = [
  {
    title: "1. Our Community Standard",
    body: [
      "Tea Time Cari exists to help users share experiences, compare notes, and stay informed in a safer, more respectful environment.",
      "The goal is not harassment, revenge, bullying, public shaming, or spreading rumours.",
      "The goal is simple:",
    ],
    items: [
      "Tell the truth.",
      "Protect your privacy.",
      "Respect others.",
      "Keep the receipts.",
      "Do not put anyone at risk.",
    ],
  },
  {
    title: "2. Be Honest and Factual",
    body: [
      "You may share personal experiences, warnings, concerns, screenshots, or stories, but your posts must be truthful and based on what you personally know or can reasonably support.",
    ],
    items: [
      "Do not post false claims.",
      "Do not exaggerate facts to make someone look worse.",
      "Do not present rumours as facts.",
      "Do not make serious accusations unless you have a factual basis for them.",
      "If something is your opinion, make that clear.",
      "If something happened in the past, make the timing clear.",
    ],
    closing: [
      "Tea Time Cari is not responsible for verifying every post. You are responsible for what you share.",
    ],
  },
  {
    title: "3. Keep Receipts, But Share Carefully",
    body: [
      "Receipts can include screenshots, messages, photos, or other information that helps support your post.",
      "However, you must share receipts responsibly.",
      "Before posting, remove or hide unnecessary private details such as:",
    ],
    items: [
      "Phone numbers",
      "Home addresses",
      "Workplace details",
      "Bank details",
      "Government ID numbers",
      "Medical information",
      "Private family details",
      "Children’s names or images",
      "Private social media handles",
      "Any information that could put someone at risk",
    ],
    closing: ["Keep the core facts, but protect privacy."],
  },
  {
    title: "4. No Nudes, Leaks, or Sexual Content",
    body: [
      "Tea Time Cari has zero tolerance for nudes, leaked intimate images, revenge content, sexual images, or sexual content shared without consent.",
      "Do not post:",
    ],
    items: [
      "Nudes",
      "Sexual videos",
      "Private intimate images",
      "Revenge content",
      "Screenshots of sexual images",
      "Content involving sexual exploitation",
      "Any sexual content involving minors",
    ],
    closing: [
      "Accounts that post this type of content may be permanently banned.",
      "Serious violations may be reported to the appropriate authorities where required or appropriate.",
    ],
  },
  {
    title: "5. No Harassment or Bullying",
    body: [
      "You may share your experience, but you may not use Tea Time Cari to harass, bully, threaten, shame, or target another person.",
      "Do not:",
    ],
    items: [
      "Encourage users to attack someone",
      "Post threats",
      "Use abusive language",
      "Mock someone’s body, appearance, disability, race, religion, nationality, sexuality, or background",
      "Repeatedly target the same person without good reason",
      "Pressure other users to share private information",
      "Start campaigns to embarrass or destroy someone",
    ],
    closing: ["Speak clearly. Share honestly. Do not abuse the platform."],
  },
  {
    title: "6. No Doxxing or Private Information",
    body: ["Do not post someone’s private information.", "This includes:"],
    items: [
      "Home address",
      "Phone number",
      "Email address",
      "Government ID number",
      "Banking details",
      "Workplace address where not publicly relevant",
      "Live location",
      "Family information",
      "Private medical information",
      "Private photos taken without consent",
      "Passwords or login details",
    ],
    closing: [
      "Even if you are upset, do not expose someone’s private information.",
    ],
  },
  {
    title: "7. Anonymous Posting Rules",
    body: [
      "Tea Time Cari may allow anonymous posting.",
      "Other members won’t see your profile name, but admins may review abuse reports.",
      "Anonymous does not mean invisible to Tea Time Cari systems or authorized administrators.",
      "Anonymous posting is meant to protect users, not to give people permission to behave badly.",
      "You may not use anonymity to:",
    ],
    items: [
      "Lie",
      "Harass",
      "Threaten",
      "Defame",
      "Expose private information",
      "Post revenge content",
      "Impersonate someone",
      "Target another user",
      "Avoid consequences for harmful behaviour",
    ],
    closing: [
      "Anonymous posts may hide your identity from other users, but Tea Time Cari may still review internal records for moderation, safety, security, legal compliance, abuse prevention, and enforcement.",
      "Read the Anonymous mode explained page before relying on anonymous features.",
    ],
  },
  {
    title: "8. Respect Gender Based Spaces",
    body: [
      "Tea Time Cari may use gender based access or group visibility to help users feel safer and more comfortable.",
      "Do not lie about your gender group or create fake accounts to access areas you should not access.",
      "Do not screenshot, share, or repost content from one group into another space.",
      "Do not use subscription access to harass, monitor, or pressure users from another group.",
    ],
    closing: [
      "Access is a privilege. Misuse of access may lead to suspension or removal.",
    ],
  },
  {
    title: "9. No Sharing Outside the Platform",
    body: [
      "Content shared inside Tea Time Cari should stay inside Tea Time Cari.",
      "Do not:",
    ],
    items: [
      "Screenshot posts and share them elsewhere",
      "Repost Tea Time Cari content on social media",
      "Forward private messages",
      "Publish another user’s content outside the app",
      "Share anonymous posts in a way that exposes someone",
      "Use platform content to harass someone offline",
    ],
    closing: [
      "This rule protects users and helps keep the community private.",
      "Breaking this rule may result in suspension or permanent removal.",
    ],
  },
  {
    title: "10. Be Respectful in Comments",
    body: [
      "Comments should add context, support, or helpful information.",
      "Do not use comments to:",
    ],
    items: [
      "Insult people",
      "Mock victims",
      "Start fights",
      "Threaten anyone",
      "Encourage harassment",
      "Post sexual comments",
      "Demand private information",
      "Spam the conversation",
      "Derail serious posts",
    ],
    closing: ["Disagree respectfully or keep scrolling."],
  },
  {
    title: "11. Private Messaging Rules",
    body: [
      "If private messaging is available, use it responsibly.",
      "Do not send:",
    ],
    items: [
      "Threats",
      "Sexual content",
      "Spam",
      "Repeated unwanted messages",
      "Pressure to reveal identity",
      "Requests for private information",
      "Abusive language",
      "Screenshots from private areas",
      "Harassing or manipulative messages",
    ],
    closing: ["If someone asks you to stop messaging them, stop."],
  },
  {
    title: "12. Reporting Content",
    body: [
      "Use the report button when you see content that violates these guidelines.",
      "You should report:",
    ],
    items: [
      "Nudes or leaked intimate content",
      "Threats",
      "Harassment",
      "False or dangerous claims",
      "Doxxing",
      "Spam",
      "Impersonation",
      "Private information",
      "Content that puts someone at risk",
      "Underage or exploitative content",
    ],
    closing: [
      "You can also contact us at:",
      contactEmail,
      "Reports should be made honestly and in good faith.",
      "Do not misuse the report system to silence people you simply disagree with.",
    ],
  },
  {
    title: "13. What Happens When Rules Are Broken",
    body: [
      "Depending on the issue, Tea Time Cari may take one or more of the following actions:",
    ],
    items: [
      "Remove the content",
      "Limit visibility",
      "Issue a warning",
      "Restrict account features",
      "Suspend the account",
      "Permanently ban the account",
      "Preserve records for investigation",
      "Report serious violations where required or appropriate",
    ],
    closing: [
      "Some violations may lead to immediate permanent removal without warning.",
    ],
  },
  {
    title: "14. Account Approval and Safety Review",
    body: [
      "Tea Time Cari may review accounts before approving access.",
      "We may reject, suspend, or remove accounts if we believe there is a privacy, safety, security, legal, or community concern.",
      "Approval is not guaranteed.",
      "Users must provide accurate information during registration and must not create fake or duplicate accounts to bypass review.",
    ],
  },
  {
    title: "15. No Impersonation",
    body: [
      "Do not pretend to be someone else.",
      "Do not create accounts using another person’s name, photos, email, identity, or likeness.",
      "Do not create fake profiles to mislead the community.",
      "Impersonation may result in permanent removal.",
    ],
  },
  {
    title: "16. No Spam, Scams, or Promotions",
    body: [
      "Tea Time Cari is not a place for spam or unrelated promotion.",
      "Do not post:",
    ],
    items: [
      "Scams",
      "Fake giveaways",
      "Suspicious links",
      "Repeated advertisements",
      "Unrelated business promotions",
      "Malware or phishing links",
      "Mass copied comments or messages",
    ],
    closing: ["Accounts used for spam may be removed."],
  },
  {
    title: "17. Protect Yourself When Posting",
    body: ["Before posting, ask yourself:"],
    items: [
      "Is this true?",
      "Can I support what I am saying?",
      "Am I exposing unnecessary private information?",
      "Could this put me or someone else at risk?",
      "Have I removed phone numbers, addresses, and sensitive details?",
      "Am I sharing this to inform others, or to harm someone?",
    ],
    closing: [
      "If the post is mainly meant to embarrass, threaten, or destroy someone, do not post it.",
    ],
  },
  {
    title: "18. Content About Public Figures",
    body: [
      "Users may discuss public figures, influencers, or well known individuals, but the same rules apply.",
    ],
    items: [
      "Keep it factual.",
      "Do not post private information.",
      "Do not post sexual content.",
      "Do not harass.",
      "Do not spread false claims.",
    ],
    closing: [
      "Being known publicly does not remove someone’s right to privacy and safety.",
    ],
  },
  {
    title: "19. Safety Comes First",
    body: [
      "Tea Time Cari is not an emergency service.",
      "If you are in immediate danger, contact local emergency services or the relevant authorities.",
      "If you are dealing with threats, stalking, violence, sexual abuse, blackmail, or serious harm, seek help from trusted people and proper authorities.",
      "Do not rely on Tea Time Cari as your only source of support.",
    ],
  },
  {
    title: "20. Our Moderation Approach",
    body: [
      "Tea Time Cari will try to apply these guidelines fairly, but we may make decisions based on context, safety, risk, and available information.",
      "We may remove content even if it does not clearly violate one specific rule, if we believe it creates privacy, legal, safety, or community risk.",
      "We may also restrict accounts that repeatedly create problems, even if each individual action seems minor.",
    ],
  },
  {
    title: "21. Final Community Rule",
    body: [
      "Tea Time Cari is for real stories, thoughtful conversations, and community support.",
      "It is not for revenge.",
      "It is not for harassment.",
      "It is not for exposing private information.",
      "It is not for spreading lies.",
      "Use the platform with care.",
      "Share. Compare. Stay informed.",
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
          {paragraph === contactEmail ? (
            <a
              href={`mailto:${contactEmail}`}
              className="text-blue-600 hover:text-blue-700"
            >
              {contactEmail}
            </a>
          ) : (
            paragraph
          )}
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

export default function CommunityGuidelines() {
  return (
    <GradientPageShell maxWidth="max-w-5xl">
        <Link
          to="/"
          className="text-sm font-medium text-blue-600 hover:text-blue-700"
        >
          ← Back to home
        </Link>
        <h1 className="mt-4 text-3xl font-bold text-slate-900">
          Community Guidelines
        </h1>
        <h2 className="mt-2 text-2xl font-semibold text-slate-900">
          Tea Time Cari
        </h2>

        <dl className="mt-6 space-y-2 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
          <div>
            <dt className="inline font-semibold text-slate-900">
              Effective Date:{" "}
            </dt>
            <dd className="inline">June 4, 2026</dd>
          </div>
          <div>
            <dt className="inline font-semibold text-slate-900">Website: </dt>
            <dd className="inline">
              <a
                href={websiteUrl}
                className="text-blue-600 hover:text-blue-700"
              >
                {websiteUrl}
              </a>
            </dd>
          </div>
          <div>
            <dt className="inline font-semibold text-slate-900">Contact: </dt>
            <dd className="inline">
              <a
                href={`mailto:${contactEmail}`}
                className="text-blue-600 hover:text-blue-700"
              >
                {contactEmail}
              </a>
            </dd>
          </div>
        </dl>

        <div className="mt-8 space-y-8 text-slate-700 leading-7">
          <section>
            <p>
              Tea Time Cari is a private community built around real stories,
              shared experiences, privacy, and community support.
            </p>
            <p className="mt-3">
              These Community Guidelines explain what is allowed, what is not
              allowed, and how we expect users to treat each other.
            </p>
            <p className="mt-3">
              By using Tea Time Cari, you agree to follow these guidelines, our
              Terms and Conditions, and our Privacy Policy.
            </p>
          </section>

          {guidelinesSections.map((section) => (
            <section key={section.title}>
              <h2 className="text-xl font-semibold text-slate-900">
                {section.title}
              </h2>
              <ParagraphList paragraphs={section.body} />
              <BulletList items={section.items} />
              <ParagraphList paragraphs={section.closing} />
            </section>
          ))}
        </div>
    </GradientPageShell>
  );
}
