import { Flag, LoaderCircle } from 'lucide-react';
import { useLayoutEffect, useRef } from 'react';

type CaseFlagButtonProps = {
  caseNumber: string;
  flagged: boolean;
  saving?: boolean;
  onToggle: () => void;
  onFocusRemoved?: () => void;
};

export function CaseFlagButton({ caseNumber, flagged, saving = false, onToggle, onFocusRemoved }: CaseFlagButtonProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    const button = buttonRef.current;
    return () => {
      if (button && document.activeElement === button) onFocusRemoved?.();
    };
  }, [onFocusRemoved]);

  return (
    <button
      ref={buttonRef}
      type="button"
      aria-label={`${flagged ? 'Unflag' : 'Flag'} case ${caseNumber}`}
      aria-pressed={flagged}
      aria-busy={saving}
      title={flagged ? 'Remove your personal flag' : 'Flag for your attention, visible only to you'}
      aria-disabled={saving}
      onClick={(event) => {
        event.stopPropagation();
        if (saving) return;
        onToggle();
      }}
      className={`inline-flex min-h-9 shrink-0 items-center justify-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 aria-disabled:cursor-wait aria-disabled:opacity-60 ${
        flagged
          ? 'border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100'
          : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-900'
      }`}
    >
      {saving ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : (
        <Flag className={`h-4 w-4 ${flagged ? 'fill-amber-500 text-amber-700' : ''}`} aria-hidden="true" />
      )}
      {flagged ? 'Flagged' : 'Flag'}
    </button>
  );
}
