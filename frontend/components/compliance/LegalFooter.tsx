import Link from "next/link";

import { business, legalLinks } from "@/lib/business";

export function LegalFooter() {
  return (
    <footer className="border-t border-gray-200 bg-white px-6 py-8 text-gray-900">
      <div className="mx-auto max-w-3xl space-y-3 text-sm leading-6">
        <p className="font-semibold">{business.legalName}</p>
        <p>{business.address}</p>
        <p>
          <a className="text-blue-800 underline" href={`mailto:${business.email}`}>
            {business.email}
          </a>
        </p>
        <nav aria-label="Legal" className="flex flex-wrap gap-x-4 gap-y-2">
          {legalLinks.map((item) => (
            <Link key={item.href} href={item.href} className="text-blue-800 underline">
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
