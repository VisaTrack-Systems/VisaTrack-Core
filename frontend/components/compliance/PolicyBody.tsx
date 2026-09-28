import Link from "next/link";

import { business } from "@/lib/business";

import { CookieSettings } from "./CookieSettings";
import { LegalSection } from "./LegalDocument";

export const policySlugs = ["privacy", "terms", "refund", "cookies", "licenses", "sdks"] as const;

export type PolicySlug = (typeof policySlugs)[number];

export const policyTitles: Record<PolicySlug, string> = {
  privacy: "Privacy policy",
  terms: "Terms of service",
  refund: "Refund policy",
  cookies: "Cookie policy",
  licenses: "Font and image licenses",
  sdks: "Third-party SDK audit",
};

export function PolicyBody({ slug }: { slug: PolicySlug }) {
  if (slug === "privacy") return <PrivacyBody />;
  if (slug === "terms") return <TermsBody />;
  if (slug === "refund") return <RefundBody />;
  if (slug === "cookies") return <CookiesBody />;
  if (slug === "licenses") return <LicensesBody />;
  return <SdkBody />;
}

function PrivacyBody() {
  return (
    <>
      <LegalSection heading="What VisaTrack is">
        <p>
          {business.productName} is case-management software for immigration consulting firms and
          their clients. {business.legalName} operates it from {business.address}. The firm that
          invites you is responsible for the legal advice on your matter. VisaTrack does not
          provide legal advice and does not decide visa applications.
        </p>
      </LegalSection>
      <LegalSection heading="Information we collect, and why">
        <p>We collect only what the product needs to run a case file:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Name, email, and a password you choose, so you can sign in.</li>
          <li>Organization membership and role, so the right people see the right cases.</li>
          <li>Optional phone number, only if you add one so the firm can call you about the case.</li>
          <li>Documents, messages, milestones, and invoices the firm stores on the case.</li>
          <li>
            A bug report you choose to send: the page path, the time, your description, and a
            screenshot only if you attach one. We do not attach your IP address, browser language,
            or user agent.
          </li>
        </ul>
        <p>
          Account setup does not ask for a date of birth, government ID number, or marketing
          profile. Case documents may still contain identity information because the immigration
          file needs them.
        </p>
      </LegalSection>
      <LegalSection heading="Children">
        <p>
          You must be 18 or older to create an account. If a case includes information about
          someone under 18, the parent or legal guardian must consent before that information is
          added. We do not knowingly collect a child’s information from the child.
        </p>
      </LegalSection>
      <LegalSection heading="How long we keep it">
        <p>
          Case records stay for as long as the firm needs them for the matter and for legal
          retention. You can ask for access, correction, or deletion. A deletion request is
          completed unless a legal hold applies to the records. Submit one from{" "}
          <Link href="/privacy/deletion" className="text-blue-800 underline">
            the deletion request page
          </Link>{" "}
          or from Profile after you sign in.
        </p>
      </LegalSection>
      <LegalSection heading="Who else receives information">
        <p>
          Card numbers are entered on Stripe Checkout, not stored by VisaTrack. Email is sent
          through Resend. Documents are stored in the firm’s configured object storage. If a
          lawyer turns on the case assistant, excerpts are sent to the model provider that firm
          chose. We do not sell personal information and we do not run advertising SDKs. The{" "}
          <Link href="/legal/sdks" className="text-blue-800 underline">
            SDK audit
          </Link>{" "}
          lists each service.
        </p>
      </LegalSection>
    </>
  );
}

function TermsBody() {
  return (
    <>
      <LegalSection heading="The service">
        <p>
          VisaTrack lets a firm and its clients track documents, status, appointments, and
          invoices. It does not guarantee an immigration outcome, a processing time, or that a
          form is ready to file. Output from the case assistant is a draft for the lawyer to
          review. It is not legal advice.
        </p>
      </LegalSection>
      <LegalSection heading="Reviews">
        <p>
          VisaTrack does not publish customer reviews, star ratings, or testimonials. Do not treat
          anything in the product as a review of a firm or of an immigration program.
        </p>
      </LegalSection>
      <LegalSection heading="Accounts">
        <p>
          An invitation is required. When you activate an account you confirm that you accept
          these terms and the privacy policy, and that you are 18 or older or the parent or
          guardian for any child whose information will be on the account. Those boxes start
          unchecked.
        </p>
      </LegalSection>
      <LegalSection heading="Fees">
        <p>
          Charges are the invoices your firm creates. Each invoice shows professional fees, tax,
          and the total before you pay. VisaTrack does not add a separate checkout surcharge. See
          the{" "}
          <Link href="/legal/refund" className="text-blue-800 underline">
            refund policy
          </Link>
          .
        </p>
      </LegalSection>
    </>
  );
}

function RefundBody() {
  return (
    <>
      <LegalSection heading="What you are charged">
        <p>
          The amount due is the invoice total. That total is professional fees plus the tax rate
          entered on the invoice. There is no extra VisaTrack fee added at card checkout. If a
          government filing fee is billed, it is its own invoice line, not folded into a
          professional-fee description.
        </p>
      </LegalSection>
      <LegalSection heading="Refunds">
        <p>
          Ask the firm, or email {business.email}, to review a charge. Payments taken in error are
          refunded. Work the firm has already performed, and government fees already paid to an
          authority, are refunded only when the firm or that authority agrees. We do not keep a
          hidden remainder after a refunded invoice.
        </p>
      </LegalSection>
      <LegalSection heading="Cards">
        <p>
          Card entry is hosted by Stripe. VisaTrack stores the invoice and payment status, not the
          full card number.
        </p>
      </LegalSection>
    </>
  );
}

function CookiesBody() {
  return (
    <>
      <LegalSection heading="Essential cookie">
        <p>
          The sign-in cookie named visatrack_refresh keeps your session. It is strictly necessary
          for an account you asked to open. Rejecting other cookies does not turn this one off.
        </p>
      </LegalSection>
      <LegalSection heading="Optional cookies">
        <p>
          VisaTrack does not set analytics, advertising, or social-media cookies. Choosing “Allow
          all” only records that choice so a future optional tool can run. Choosing “Essential
          only” blocks that. The choice is stored in local storage under visatrack-cookie-consent,
          which is not sent to the server.
        </p>
      </LegalSection>
      <CookieSettings />
    </>
  );
}

function LicensesBody() {
  return (
    <>
      <LegalSection heading="Fonts">
        <p>
          Geist Sans and Geist Mono are used under the SIL Open Font License. Next.js downloads
          them at build time and serves them from this site, so the pages do not call Google Fonts
          in the browser. The interface also falls back to Arial and Helvetica, which ship with
          the operating system.
        </p>
      </LegalSection>
      <LegalSection heading="Icons and code">
        <p>
          Interface icons are from Lucide, used under the ISC license. The application source is
          under the MIT license in the repository. We do not ship stock photographs. Diagrams and
          marks in the product are original files in this repository.
        </p>
      </LegalSection>
    </>
  );
}

function SdkBody() {
  return (
    <>
      <LegalSection heading="Audit">
        <p>
          Reviewed {business.productName} on September 27, 2026. No advertising, session-replay, or
          analytics SDK is loaded in the browser. Optional tools stay off until cookie consent is
          “Allow all”, and none are connected today.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-gray-300">
                <th className="py-2 pr-4 font-semibold">Service</th>
                <th className="py-2 pr-4 font-semibold">Role</th>
                <th className="py-2 font-semibold">Data</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-200">
                <td className="py-2 pr-4">Session cookie</td>
                <td className="py-2 pr-4">Sign-in</td>
                <td className="py-2">Session token. Essential.</td>
              </tr>
              <tr className="border-b border-gray-200">
                <td className="py-2 pr-4">Stripe Checkout</td>
                <td className="py-2 pr-4">Card payment</td>
                <td className="py-2">Card data stays at Stripe. Used only when you pay.</td>
              </tr>
              <tr className="border-b border-gray-200">
                <td className="py-2 pr-4">Resend</td>
                <td className="py-2 pr-4">Email delivery</td>
                <td className="py-2">Recipient address and the message. Server-side.</td>
              </tr>
              <tr className="border-b border-gray-200">
                <td className="py-2 pr-4">Object storage</td>
                <td className="py-2 pr-4">Case documents</td>
                <td className="py-2">Files the firm uploads. Server-side.</td>
              </tr>
              <tr className="border-b border-gray-200">
                <td className="py-2 pr-4">Model provider</td>
                <td className="py-2 pr-4">Optional lawyer assistant</td>
                <td className="py-2">Case excerpts, only after the firm connects a key.</td>
              </tr>
              <tr>
                <td className="py-2 pr-4">Geist via next/font</td>
                <td className="py-2 pr-4">Typography</td>
                <td className="py-2">No browser request to a font host.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </LegalSection>
    </>
  );
}
