import { FileText } from "lucide-react";
import Link from "next/link";

import { buttonClasses } from "@/design-system/components/ui";
import { business } from "@/lib/business";

/**
 * Public site header shared by the landing page and the legal pages.
 * The brand links back to the landing page from anywhere it is shown.
 */
export function SiteHeader({ title = business.productName }: { title?: string }) {
  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-600 text-white">
            <FileText className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="text-xl font-semibold tracking-tight text-gray-900">{title}</span>
        </Link>
        <nav aria-label="Site" className="flex items-center gap-5">
          <Link href="/legal/privacy" className="text-sm font-medium text-gray-700 hover:text-primary-700">
            Privacy
          </Link>
          {/* A link, not a button: the landing page's form owns the only "Sign in" button. */}
          <Link href="/#sign-in" className={buttonClasses("primary")}>
            Sign in
          </Link>
        </nav>
      </div>
    </header>
  );
}
