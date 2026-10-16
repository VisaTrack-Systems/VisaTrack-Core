export const business = {
  legalName: process.env.NEXT_PUBLIC_BUSINESS_LEGAL_NAME ?? "VisaTrack Systems",
  productName: "VisaTrack",
  address: process.env.NEXT_PUBLIC_BUSINESS_ADDRESS ?? "Ottawa, Ontario, Canada",
  email: process.env.NEXT_PUBLIC_BUSINESS_CONTACT_EMAIL ?? "visatrack.support@gmail.com",
};

export const legalUpdated = "September 27, 2026";

/** `group` decides which footer column a link appears in. */
export const legalLinks = [
  { href: "/legal/privacy", label: "Privacy policy", group: "policies" },
  { href: "/legal/terms", label: "Terms of service", group: "policies" },
  { href: "/legal/refund", label: "Refund policy", group: "policies" },
  { href: "/legal/cookies", label: "Cookie policy", group: "policies" },
  { href: "/legal/licenses", label: "Font and image licenses", group: "policies" },
  { href: "/legal/sdks", label: "Third-party SDK audit", group: "more" },
  { href: "/privacy/deletion", label: "Data deletion request", group: "more" },
] as const;
