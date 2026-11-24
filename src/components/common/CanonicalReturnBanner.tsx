import React from 'react';
import { ArrowLeft, ShieldCheck, X } from 'lucide-react';
import { CanonicalActionIntent } from '../../types';

interface CanonicalReturnBannerProps {
  intent: CanonicalActionIntent | null;
  onReturn: () => void;
  onDismiss: () => void;
}

export const CanonicalReturnBanner: React.FC<CanonicalReturnBannerProps> = ({
  intent,
  onReturn,
  onDismiss,
}) => {
  if (!intent || !intent.returnTab) return null;

  const backLabel = intent.returnLabel || `Back to ${intent.returnTab}`;
  const actionWord =
    intent.action === 'delete'
      ? 'Deleting'
      : intent.action === 'view'
        ? 'Viewing'
        : 'Editing';

  return (
    <div
      role="region"
      aria-label="Canonical screen return bar"
      className="rounded-xl border border-sky-200 bg-sky-50/95 px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs text-sky-950 shadow-xs"
    >
      <div className="flex items-center gap-2 min-w-0">
        <ShieldCheck className="w-4 h-4 text-sky-700 shrink-0" aria-hidden="true" />
        <span className="font-semibold truncate">
          {actionWord} in canonical screen — changes sync everywhere and write to Activity Log.
        </span>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={onReturn}
          className="inline-flex items-center gap-1.5 min-h-[36px] px-3 py-1.5 rounded-lg bg-sky-700 hover:bg-sky-800 text-white font-bold text-xs cursor-pointer transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{backLabel}</span>
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="p-1.5 rounded-lg text-sky-700 hover:bg-sky-100 cursor-pointer"
          aria-label="Dismiss return banner"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};
