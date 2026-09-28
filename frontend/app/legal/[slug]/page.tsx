import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PolicyBody, policySlugs, policyTitles, type PolicySlug } from "@/components/compliance/PolicyBody";
import { LegalDocument } from "@/components/compliance/LegalDocument";

export function generateStaticParams() {
  return policySlugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  if (!isPolicySlug(slug)) {
    return { title: "Legal" };
  }
  return { title: policyTitles[slug] };
}

export default async function LegalPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!isPolicySlug(slug)) {
    notFound();
  }

  return (
    <LegalDocument title={policyTitles[slug]}>
      <PolicyBody slug={slug} />
    </LegalDocument>
  );
}

function isPolicySlug(slug: string): slug is PolicySlug {
  return (policySlugs as readonly string[]).includes(slug);
}
