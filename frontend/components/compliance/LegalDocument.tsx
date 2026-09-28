import type { ReactNode } from "react";

import { business, legalUpdated } from "@/lib/business";

import { LegalFooter } from "./LegalFooter";

export function LegalDocument({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <article className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-gray-800">
          Last updated {legalUpdated}. {business.legalName}, {business.address}. Contact{" "}
          <a className="text-blue-800 underline" href={`mailto:${business.email}`}>
            {business.email}
          </a>
          .
        </p>
        <div className="mt-8 space-y-8 text-base leading-7">{children}</div>
      </article>
      <LegalFooter />
    </div>
  );
}

export function LegalSection({
  heading,
  children,
}: {
  heading: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="text-xl font-semibold text-gray-900">{heading}</h2>
      <div className="mt-2 space-y-3 text-gray-900">{children}</div>
    </section>
  );
}
