import Link from "next/link";

import { business, legalLinks } from "@/lib/business";

const policyLinks = legalLinks.filter((item) => item.group === "policies");
const moreLinks = legalLinks.filter((item) => item.group === "more");

const headingClasses = "text-xs font-semibold uppercase tracking-wide text-gray-200";
const linkClasses =
  "rounded-sm text-gray-300 transition-colors hover:text-white hover:underline " +
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400";

export function LegalFooter() {
  return (
    <footer className="bg-navy-900 px-6 py-8 text-xs leading-5 text-gray-300">
      <div className="mx-auto grid max-w-5xl gap-8 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-sm font-semibold text-gray-400">{business.legalName}</p>
        </div>

        <section aria-labelledby="footer-contact-heading" className="space-y-2">
          <h2 id="footer-contact-heading" className={headingClasses}>Contact</h2>
          <p>{business.address}</p>
          <p>
            <a className={linkClasses} href={`mailto:${business.email}`}>
              {business.email}
            </a>
          </p>
        </section>

        <nav aria-labelledby="footer-policies-heading" className="space-y-2">
          <h2 id="footer-policies-heading" className={headingClasses}>Policies &amp; licenses</h2>
          <FooterLinkList links={policyLinks} />
        </nav>

        <nav aria-labelledby="footer-more-heading" className="space-y-2">
          <h2 id="footer-more-heading" className={headingClasses}>More</h2>
          <FooterLinkList links={moreLinks} />
        </nav>
      </div>
    </footer>
  );
}

function FooterLinkList({ links }: { links: ReadonlyArray<{ href: string; label: string }> }) {
  return (
    <ul className="space-y-1.5">
      {links.map((item) => (
        <li key={item.href}>
          <Link href={item.href} className={linkClasses}>
            {item.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}
