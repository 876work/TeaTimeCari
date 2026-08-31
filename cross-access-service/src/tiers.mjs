// Monetization catalog — research brief §6 ("Tiered cross-access" + "Verified badge").
//
// `source` values here intentionally match the ones already used by the admin
// quick-grant panel (stripe_24h / stripe_3day / stripe_monthly) so a grant looks
// identical in the Grants table whether it was created by an admin or bought
// through the storefront. `admin_comp` and `demo` stay admin-only tools, not
// storefront products.
//
// Prices are illustrative dummy numbers, not a pricing recommendation.

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export const CROSS_ACCESS_TIERS = [
  {
    id: "peek_24h",
    source: "stripe_24h",
    label: "24-Hour Peek",
    tagline: "A short look at the other side.",
    priceCents: 999,
    durationMs: 24 * HOUR,
  },
  {
    id: "pass_3day",
    source: "stripe_3day",
    label: "3-Day Pass",
    tagline: "The original cross-access pass.",
    priceCents: 2999,
    durationMs: 3 * DAY,
    featured: true,
  },
  {
    id: "monthly",
    source: "stripe_monthly",
    label: "Monthly All-Access",
    tagline: "Uninterrupted access, billed monthly.",
    priceCents: 5999,
    durationMs: 30 * DAY,
  },
];

/**
 * Members who bought the Verified+ badge get a loyalty discount on cross-access —
 * a concrete example, called out in the brief, of the KYC pipeline and the
 * cross-access mechanism reinforcing each other instead of staying siloed.
 */
export const VERIFIED_PLUS_DISCOUNT = 0.15;

export const VERIFIED_PLUS_PRODUCT = {
  id: "verified_plus",
  label: "Verified+",
  tagline: "Gold checkmark, priority in search, 15% off every cross-access tier.",
  priceCents: 1499,
  recurring: false,
};

export function priceForTier(tier, user) {
  const discounted = user?.verified === "plus";
  const cents = discounted ? Math.round(tier.priceCents * (1 - VERIFIED_PLUS_DISCOUNT)) : tier.priceCents;
  return { cents, discounted, originalCents: tier.priceCents };
}

export function formatUsd(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}

export function findTier(id) {
  return CROSS_ACCESS_TIERS.find((t) => t.id === id) || null;
}
