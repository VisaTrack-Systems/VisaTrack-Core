export const business = {
  legalName: process.env.NEXT_PUBLIC_BUSINESS_LEGAL_NAME ?? "VisaTrack Systems",
  productName: "VisaTrack",
  address: process.env.NEXT_PUBLIC_BUSINESS_ADDRESS ?? "Ottawa, Ontario, Canada",
  email: process.env.NEXT_PUBLIC_BUSINESS_CONTACT_EMAIL ?? "visatrack.support@gmail.com",
};

export const legalUpdated = "September 27, 2026";

export const legalLinks = [
  { href: "/legal/privacy", label: "Privacy policy" },
  { href: "/legal/terms", label: "Terms of service" },
  { href: "/legal/refund", label: "Refund policy" },
  { href: "/legal/cookies", label: "Cookie policy" },
  { href: "/legal/licenses", label: "Font and image licenses" },
  { href: "/legal/sdks", label: "Third-party SDK audit" },
  { href: "/privacy/deletion", label: "Data deletion request" },
] as const;
