/**
 * UI Primitives: Shared, Clio-inspired building blocks (buttons, form fields,
 * cards, badges, tables, alerts) styled with the tokens in app/globals.css.
 *
 * Every primitive is a thin wrapper around the matching native element: all
 * native props (onClick, type, disabled, aria-*, ref, ...) pass straight
 * through, and an extra `className` is appended after the defaults. Swapping
 * `<button className="...">` for `<Button>` therefore changes styling only.
 */

import { ChevronLeft, ChevronRight, type LucideIcon } from "lucide-react";
import type {
  ComponentProps,
  HTMLAttributes,
  ReactNode,
} from "react";

/** Joins class names, skipping empty values. */
export function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

// ── Buttons ─────────────────────────────────────────────────────────────────

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "danger-subtle";
export type ButtonSize = "sm" | "md";

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 rounded-md font-medium whitespace-nowrap " +
  "transition-colors disabled:cursor-not-allowed disabled:opacity-60";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-primary-600 text-white shadow-card hover:bg-primary-700 disabled:hover:bg-primary-600",
  secondary:
    "border border-gray-300 bg-white text-gray-700 shadow-card hover:bg-gray-50 hover:text-gray-900 disabled:hover:bg-white",
  ghost: "text-gray-600 hover:bg-gray-100 hover:text-gray-900 disabled:hover:bg-transparent",
  danger: "bg-red-600 text-white shadow-card hover:bg-red-700 disabled:hover:bg-red-600",
  /** Outlined destructive action for table rows, where a solid red button would be too loud. */
  "danger-subtle": "border border-red-200 bg-white text-red-700 hover:bg-red-50 disabled:hover:bg-white",
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
};

/** Returns button classes, for links or elements that must look like a button. */
export function buttonClasses(variant: ButtonVariant = "primary", size: ButtonSize = "md") {
  return cx(BUTTON_BASE, BUTTON_VARIANTS[variant], BUTTON_SIZES[size]);
}

type ButtonProps = ComponentProps<"button"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

/**
 * Note: like a native <button>, `type` defaults to "submit" inside a form.
 * Keep the existing `type` attribute when migrating a button.
 */
export function Button({ variant = "primary", size = "md", className, ...props }: ButtonProps) {
  return <button className={cx(buttonClasses(variant, size), className)} {...props} />;
}

// ── Form fields ─────────────────────────────────────────────────────────────

const FIELD_BASE =
  "block w-full rounded-md border border-gray-300 bg-white text-gray-900 shadow-card " +
  "placeholder:text-gray-500 transition-colors " +
  "focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 " +
  "disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500 " +
  "aria-[invalid=true]:border-red-500 aria-[invalid=true]:focus:ring-red-500/20";

const FIELD_SIZE = "px-3 py-2 text-sm";
/** Smaller fields for dense table rows and toolbars. */
const FIELD_SIZE_COMPACT = "px-2.5 py-1.5 text-xs";

/** Shared field classes, for inputs that cannot use the components below. */
export const fieldClasses = cx(FIELD_BASE, FIELD_SIZE);

/**
 * Fields always fill their container (`w-full`). To make one narrower, wrap
 * it in an element with the width you want rather than passing a width class.
 */
type FieldProps = { compact?: boolean };

export function Input({ compact = false, className, ...props }: ComponentProps<"input"> & FieldProps) {
  return <input className={cx(FIELD_BASE, compact ? FIELD_SIZE_COMPACT : FIELD_SIZE, className)} {...props} />;
}

export function Select({ compact = false, className, ...props }: ComponentProps<"select"> & FieldProps) {
  return <select className={cx(FIELD_BASE, compact ? FIELD_SIZE_COMPACT : FIELD_SIZE, "pr-8", className)} {...props} />;
}

export function Textarea({ compact = false, className, ...props }: ComponentProps<"textarea"> & FieldProps) {
  return <textarea className={cx(FIELD_BASE, compact ? FIELD_SIZE_COMPACT : FIELD_SIZE, className)} {...props} />;
}

export function Label({ className, ...props }: ComponentProps<"label">) {
  return <label className={cx("mb-1.5 block text-sm font-medium text-gray-700", className)} {...props} />;
}

/** Small helper or error text shown under a field. */
export function FieldHint({ error = false, className, ...props }: ComponentProps<"p"> & { error?: boolean }) {
  return (
    <p className={cx("mt-1.5 text-xs", error ? "text-red-600" : "text-gray-500", className)} {...props} />
  );
}

// ── Cards ───────────────────────────────────────────────────────────────────

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx("rounded-md border border-gray-200 bg-white shadow-card", className)} {...props} />;
}

type CardHeaderProps = Omit<HTMLAttributes<HTMLDivElement>, "title"> & {
  title: ReactNode;
  description?: ReactNode;
  /** Buttons or links shown on the right side of the header. */
  actions?: ReactNode;
};

export function CardHeader({ title, description, actions, className, ...props }: CardHeaderProps) {
  return (
    <div
      className={cx("flex items-start justify-between gap-4 border-b border-gray-200 px-5 py-4", className)}
      {...props}
    >
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        {description ? <p className="mt-0.5 text-sm text-gray-500">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx("px-5 py-4", className)} {...props} />;
}

// ── Stat cards ──────────────────────────────────────────────────────────────

type StatCardProps = {
  label: string;
  value: ReactNode;
  icon: LucideIcon;
  /** Icon colour class. Each dashboard metric keeps its own colour. */
  iconClassName?: string;
  /** Small supporting line under the value. */
  hint?: string;
};

/** Headline metric tile used across dashboards. */
export function StatCard({ label, value, icon: Icon, iconClassName = "text-primary-600", hint }: StatCardProps) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-gray-600">{label}</p>
        <Icon className={cx("h-6 w-6 shrink-0", iconClassName)} aria-hidden="true" />
      </div>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-gray-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-gray-500">{hint}</p> : null}
    </Card>
  );
}

// ── Badges ──────────────────────────────────────────────────────────────────

export type Tone = "neutral" | "primary" | "success" | "warning" | "danger";

const BADGE_TONES: Record<Tone, string> = {
  neutral: "bg-gray-100 text-gray-700 ring-gray-200",
  primary: "bg-primary-50 text-primary-700 ring-primary-200",
  success: "bg-green-50 text-green-700 ring-green-200",
  warning: "bg-amber-50 text-amber-800 ring-amber-200",
  danger: "bg-red-50 text-red-700 ring-red-200",
};

export function Badge({ tone = "neutral", className, ...props }: ComponentProps<"span"> & { tone?: Tone }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset",
        BADGE_TONES[tone],
        className
      )}
      {...props}
    />
  );
}

// ── Tables ──────────────────────────────────────────────────────────────────

/** Bordered, horizontally scrollable table container. */
export function Table({ className, ...props }: ComponentProps<"table">) {
  return (
    <div className="overflow-x-auto rounded-md border border-gray-200 bg-white">
      <table className={cx("min-w-full text-sm", className)} {...props} />
    </div>
  );
}

export function TableHead({ className, ...props }: ComponentProps<"thead">) {
  return <thead className={cx("border-b border-gray-200 bg-gray-50", className)} {...props} />;
}

export function TableBody({ className, ...props }: ComponentProps<"tbody">) {
  return <tbody className={cx("divide-y divide-gray-200", className)} {...props} />;
}

export function TableRow({ className, ...props }: ComponentProps<"tr">) {
  return <tr className={cx("transition-colors hover:bg-gray-50", className)} {...props} />;
}

export function Th({ className, ...props }: ComponentProps<"th">) {
  return (
    <th
      scope="col"
      className={cx(
        "px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500",
        className
      )}
      {...props}
    />
  );
}

export function Td({ className, ...props }: ComponentProps<"td">) {
  return <td className={cx("px-4 py-3 text-gray-700", className)} {...props} />;
}

// ── Alerts ──────────────────────────────────────────────────────────────────

const ALERT_TONES: Record<Tone, string> = {
  neutral: "border-gray-200 bg-gray-50 text-gray-700",
  primary: "border-primary-200 bg-primary-50 text-primary-800",
  success: "border-green-200 bg-green-50 text-green-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  danger: "border-red-200 bg-red-50 text-red-700",
};

/** Inline message banner. Danger alerts default to role="alert" so screen readers announce them. */
export function Alert({ tone = "neutral", className, role, ...props }: ComponentProps<"div"> & { tone?: Tone }) {
  return (
    <div
      role={role ?? (tone === "danger" ? "alert" : undefined)}
      className={cx("rounded-md border px-4 py-3 text-sm", ALERT_TONES[tone], className)}
      {...props}
    />
  );
}

// ── Pagination ──────────────────────────────────────────────────────────────

type PaginationProps = {
  /** Current page, starting at 1. */
  page: number;
  totalPages: number;
  /** Left-hand summary, e.g. "1–15 of 42". */
  summary: ReactNode;
  onPageChange: (page: number) => void;
};

/** Table footer with a row summary and previous/next page buttons. */
export function Pagination({ page, totalPages, summary, onPageChange }: PaginationProps) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-gray-200 px-5 py-2.5 text-sm text-gray-600">
      <span>{summary}</span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page === 1}
          className="rounded-md p-1 text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-transparent"
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="px-2 text-xs">
          Page {page} of {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page === totalPages}
          className="rounded-md p-1 text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-transparent"
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
