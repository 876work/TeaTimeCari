import React, { useId, useRef, useState } from 'react';
import {
  Heart,
  Mail,
  MessageCircle,
  ShieldCheck,
  Users,
  Instagram,
  Facebook,
  Globe,
} from 'lucide-react';

interface TextHoverEffectProps {
  text: string;
  className?: string;
}

export function TextHoverEffect({ text, className = '' }: TextHoverEffectProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const idPrefix = useId().replace(/:/g, '');
  const gradientId = `${idPrefix}-tea-text-gradient`;
  const maskId = `${idPrefix}-tea-text-mask`;
  const revealId = `${idPrefix}-tea-reveal-mask`;
  const [hovered, setHovered] = useState(false);
  const [maskPosition, setMaskPosition] = useState({ cx: '50%', cy: '50%' });

  const handleMouseMove = (event: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) {
      return;
    }

    const svgRect = svgRef.current.getBoundingClientRect();
    const cxPercentage = ((event.clientX - svgRect.left) / svgRect.width) * 100;
    const cyPercentage = ((event.clientY - svgRect.top) / svgRect.height) * 100;

    setMaskPosition({
      cx: `${cxPercentage}%`,
      cy: `${cyPercentage}%`,
    });
  };

  return (
    <svg
      ref={svgRef}
      width="100%"
      height="100%"
      viewBox="0 0 420 100"
      xmlns="http://www.w3.org/2000/svg"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onMouseMove={handleMouseMove}
      className={`select-none uppercase ${className}`}
      role="img"
      aria-label={text}
    >
      <defs>
        <linearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1="80" y1="0" x2="340" y2="100">
          <stop offset="0%" stopColor="#D6EBF5" />
          <stop offset="24%" stopColor="#7BBDDD" />
          <stop offset="50%" stopColor="#4B9EC8" />
          <stop offset="74%" stopColor="#9B6BAE" />
          <stop offset="100%" stopColor="#D96E6E" />
        </linearGradient>

        <radialGradient
          id={revealId}
          gradientUnits="userSpaceOnUse"
          r="24%"
          cx={maskPosition.cx}
          cy={maskPosition.cy}
        >
          <stop offset="0%" stopColor="white" />
          <stop offset="100%" stopColor="black" />
        </radialGradient>
        <mask id={maskId}>
          <rect x="0" y="0" width="100%" height="100%" fill={`url(#${revealId})`} />
        </mask>
      </defs>

      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="middle"
        strokeWidth="0.6"
        stroke="rgba(255,255,255,0.34)"
        fill="transparent"
        fontFamily="Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
        fontSize="40"
        fontWeight="800"
        letterSpacing="2"
        opacity={hovered ? 0.9 : 0.28}
      >
        {text}
      </text>
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="middle"
        strokeWidth="0.7"
        stroke="rgba(214,235,245,0.74)"
        fill="transparent"
        fontFamily="Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
        fontSize="40"
        fontWeight="800"
        letterSpacing="2"
        strokeDasharray="1000"
        strokeDashoffset="0"
        style={{
          animation: 'tea-footer-draw 4s ease-in-out both',
        }}
      >
        {text}
      </text>
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="middle"
        stroke={`url(#${gradientId})`}
        strokeWidth="0.9"
        mask={`url(#${maskId})`}
        fill="transparent"
        fontFamily="Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
        fontSize="40"
        fontWeight="800"
        letterSpacing="2"
      >
        {text}
      </text>
    </svg>
  );
}

export function FooterBackgroundGradient() {
  return (
    <div
      className="absolute inset-0 z-0"
      style={{
        background:
          'radial-gradient(125% 125% at 50% 10%, rgba(255,255,255,0.18) 0%, rgba(75,158,200,0.28) 42%, rgba(155,107,174,0.32) 70%, rgba(217,110,110,0.34) 100%)',
      }}
    />
  );
}

const footerLinks = [
  {
    title: 'Community',
    links: [
      { label: 'Get Started', href: '/' },
      { label: 'Community Login', href: '/community' },
      { label: 'Member Support', href: '/contact-us' },
    ],
  },
  {
    title: 'Trust & Safety',
    links: [
      { label: 'Verified Users', href: '#' },
      { label: 'Privacy Protected', href: '#' },
      { label: '24/7 Moderation', href: '#', pulse: true },
    ],
  },
];

const contactInfo = [
  {
    icon: <Mail size={18} className="text-[#D6EBF5]" />,
    text: 'Contact Support',
    href: '/contact-us',
  },
  {
    icon: <MessageCircle size={18} className="text-[#D6EBF5]" />,
    text: 'Authentic conversations',
  },
  {
    icon: <ShieldCheck size={18} className="text-[#D6EBF5]" />,
    text: 'Safe verified community',
  },
];

const socialLinks = [
  { icon: <Instagram size={20} />, label: 'Instagram', href: '#' },
  { icon: <Facebook size={20} />, label: 'Facebook', href: '#' },
  { icon: <Globe size={20} />, label: 'Website', href: '/' },
];

export function HoverFooter() {
  return (
    <footer className="relative mx-4 mb-6 mt-12 overflow-hidden rounded-3xl border border-white/25 bg-white/15 text-white shadow-2xl backdrop-blur-md sm:mx-6 lg:mx-8">
      <FooterBackgroundGradient />
      <div className="relative z-10 mx-auto max-w-7xl px-6 py-10 sm:px-10 lg:px-14 lg:py-14">
        <div className="grid grid-cols-1 gap-10 pb-10 md:grid-cols-2 lg:grid-cols-4 lg:gap-14">
          <div className="flex flex-col space-y-4">
            <div className="flex items-center space-x-3">
              <img src="/teaLogo.png" alt="Tea Time Cari" className="h-12 w-12 object-contain drop-shadow-lg" />
              <div>
                <div className="flex items-center gap-2 text-2xl font-black tracking-tight">
                  <span>Tea Time Cari</span>
                  <Heart className="h-5 w-5 fill-[#D96E6E] text-[#D96E6E]" />
                </div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/65">Sip. Share. Connect.</p>
              </div>
            </div>
            <p className="max-w-sm text-sm leading-relaxed text-white/82">
              A verified community for authentic conversations, supportive feedback, and meaningful member connections.
            </p>
            <div className="flex gap-3 text-xs font-semibold text-white/85">
              <span className="rounded-full border border-white/25 bg-white/15 px-3 py-1">Verified</span>
              <span className="rounded-full border border-white/25 bg-white/15 px-3 py-1">Moderated</span>
              <span className="rounded-full border border-white/25 bg-white/15 px-3 py-1">Private</span>
            </div>
          </div>

          {footerLinks.map((section) => (
            <div key={section.title}>
              <h4 className="mb-5 text-lg font-bold text-white">{section.title}</h4>
              <ul className="space-y-3 text-sm text-white/75">
                {section.links.map((link) => (
                  <li key={link.label} className="relative w-fit">
                    <a href={link.href} className="transition-colors hover:text-[#D6EBF5] focus:outline-none focus:ring-2 focus:ring-white/70 focus:ring-offset-2 focus:ring-offset-[#4B9EC8]">
                      {link.label}
                    </a>
                    {link.pulse && (
                      <span className="absolute -right-3 top-1 h-2 w-2 rounded-full bg-[#D96E6E] shadow-[0_0_12px_rgba(217,110,110,0.9)] animate-pulse" />
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div>
            <h4 className="mb-5 text-lg font-bold text-white">Stay Connected</h4>
            <ul className="space-y-4 text-sm text-white/75">
              {contactInfo.map((item) => (
                <li key={item.text} className="flex items-center space-x-3">
                  {item.icon}
                  {'href' in item ? (
                    <a href={item.href} className="transition-colors hover:text-[#D6EBF5] focus:outline-none focus:ring-2 focus:ring-white/70 focus:ring-offset-2 focus:ring-offset-[#4B9EC8]">
                      {item.text}
                    </a>
                  ) : (
                    <span>{item.text}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-white/35 to-transparent" />

        <div className="flex flex-col items-center justify-between gap-5 pt-8 text-sm text-white/75 md:flex-row">
          <div className="flex items-center gap-5">
            <Users className="h-4 w-4 text-[#D6EBF5]" />
            <span>Built for Tea Time Cari members</span>
          </div>

          <div className="flex space-x-5 text-white/70">
            {socialLinks.map(({ icon, label, href }) => (
              <a
                key={label}
                href={href}
                aria-label={label}
                className="rounded-full p-1 transition-colors hover:text-[#D6EBF5] focus:outline-none focus:ring-2 focus:ring-white/70"
              >
                {icon}
              </a>
            ))}
          </div>

          <p className="text-center md:text-left">&copy; {new Date().getFullYear()} Tea Time Cari. All rights reserved.</p>
        </div>
      </div>

      <div className="relative z-10 hidden h-64 -mb-24 -mt-20 opacity-90 lg:flex">
        <TextHoverEffect text="Tea Time Cari" className="w-full" />
      </div>
    </footer>
  );
}
