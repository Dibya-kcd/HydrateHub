import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Trash2, X } from 'lucide-react';
import { Button } from './Button';

export interface DeleteImpactItem {
  label: string;
  detail?: string;
  qtyChange?: string;
}

export interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  onConfirmWithComment?: (comment: string) => void | Promise<void>;
  onConfirmWithOptions?: (opts: { comment: string; optionalChecked: boolean }) => void | Promise<void>;
  optionalCheckboxLabel?: string;
  optionalCheckboxDefault?: boolean;
  title: string;
  subtitle?: string;
  message?: string;
  impactItems?: DeleteImpactItem[];
  warningNote?: string;
  confirmationPrompt?: string;
  rectificationPrompt?: string;
  rectificationPlaceholder?: string;
  /** Quick-fill preset reasons displayed above the reason input. */
  reasonPresets?: string[];
  /** Starting text for the comment box (lets a caller keep what was typed if the action fails). */
  initialComment?: string;
  /** When set, the confirm button stays disabled until the comment has at least this many characters. */
  commentMinLength?: number;
  confirmButtonLabel?: string;
  cancelButtonLabel?: string;
  requiresCheckbox?: boolean;
  isLoading?: boolean;
  variant?: 'danger' | 'warning' | 'primary';
  /** Icon on the confirm button; defaults to a trash can (delete dialogs). */
  confirmIcon?: React.ReactNode;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  onConfirmWithComment,
  title,
  subtitle,
  message,
  impactItems = [],
  warningNote,
  confirmationPrompt,
  rectificationPrompt,
  rectificationPlaceholder = 'Enter reason or comment for this rectification (e.g. wrong amount, duplicate, customer request)...',
  reasonPresets = [],
  confirmButtonLabel = 'Delete Permanently',
  cancelButtonLabel = 'Cancel',
  requiresCheckbox = false,
  isLoading = false,
  variant = 'danger',
  confirmIcon,
  initialComment = '',
  commentMinLength = 0,
  onConfirmWithOptions,
  optionalCheckboxLabel,
  optionalCheckboxDefault = false,
}) => {
  const [isChecked, setIsChecked] = useState(false);
  const [optionalChecked, setOptionalChecked] = useState(optionalCheckboxDefault);
  const [comment, setComment] = useState(initialComment);

  useEffect(() => {
    if (isOpen) {
      setIsChecked(false);
      setOptionalChecked(optionalCheckboxDefault);
      setComment(initialComment);
    }
  }, [isOpen, initialComment, optionalCheckboxDefault]);

  if (!isOpen) return null;

  const trimmedLen = comment.trim().length;
  const commentTooShort = Boolean(rectificationPrompt) && commentMinLength > 0 && trimmedLen < commentMinLength;
  const isConfirmDisabled = (requiresCheckbox && !isChecked) || isLoading || commentTooShort;

  const headerBg =
    variant === 'danger'
      ? 'bg-rose-50/60'
      : variant === 'warning'
        ? 'bg-amber-50/70'
        : 'bg-indigo-50/60';
  const badgeCls =
    variant === 'danger'
      ? 'bg-rose-100 text-rose-600'
      : variant === 'warning'
        ? 'bg-amber-100 text-amber-700'
        : 'bg-indigo-100 text-indigo-600';

  const handleConfirm = async () => {
    if (isConfirmDisabled) return;
    if (onConfirmWithOptions) {
      await onConfirmWithOptions({ comment: comment.trim(), optionalChecked });
    } else if (onConfirmWithComment) {
      await onConfirmWithComment(comment.trim());
    } else {
      await onConfirm();
    }
  };

  return (
    <div data-esc-close
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white border border-slate-200/90 rounded-2xl shadow-xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`px-5 py-4 border-b border-slate-100 flex items-center justify-between ${headerBg}`}>
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${badgeCls}`}>
              {variant === 'danger' ? (
                <Trash2 className="w-5 h-5" />
              ) : variant === 'warning' ? (
                <AlertTriangle className="w-5 h-5" />
              ) : (
                <CheckCircle2 className="w-5 h-5" />
              )}
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900 tracking-tight">
                {title}
              </h3>
              {subtitle && (
                <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 max-h-[65vh] overflow-y-auto">
          {message && (
            <p className="text-sm text-slate-600 leading-relaxed">{message}</p>
          )}

          {warningNote && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50/80 border border-amber-200/70 text-amber-900 text-xs leading-relaxed">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>{warningNote}</div>
            </div>
          )}

          {impactItems.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                Impacted Records &amp; Summary
              </span>
              <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-44 overflow-y-auto bg-slate-50/60">
                {impactItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="px-3 py-2 flex items-center justify-between text-xs gap-2"
                  >
                    <div className="min-w-0">
                      <span className="font-medium text-slate-800 truncate block">
                        {item.label}
                      </span>
                      {item.detail && (
                        <span className="text-slate-500 text-xs block">
                          {item.detail}
                        </span>
                      )}
                    </div>
                    {item.qtyChange && (
                      <span
                        className={`font-mono font-semibold px-2 py-0.5 rounded border shrink-0 text-xs ${
                          variant === 'danger'
                            ? 'text-rose-700 bg-rose-50 border-rose-200/60'
                            : variant === 'warning'
                              ? 'text-amber-800 bg-amber-50 border-amber-200/70'
                              : 'text-indigo-700 bg-indigo-50 border-indigo-200/70'
                        }`}
                      >
                        {item.qtyChange}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Rectification / Reason Comment Input */}
          {rectificationPrompt && (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-semibold text-slate-700 block">
                  {rectificationPrompt}
                </label>
                {commentMinLength > 0 && (
                  <span className={`text-xs font-medium tabular-nums ${commentTooShort ? 'text-amber-700' : 'text-emerald-700'}`}>
                    {trimmedLen}/{commentMinLength} min chars
                  </span>
                )}
              </div>
              {reasonPresets.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {reasonPresets.map((preset) => {
                    const active = comment.trim().toLowerCase() === preset.toLowerCase();
                    return (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setComment(preset)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                          active
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {preset}
                      </button>
                    );
                  })}
                </div>
              )}
              <textarea
                rows={2}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={rectificationPlaceholder}
                className="w-full text-sm p-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all resize-none font-sans"
              />
              {commentTooShort && (
                <p className="text-xs text-slate-500">
                  Write a short reason (at least {commentMinLength} characters) to continue.
                </p>
              )}
            </div>
          )}

          {/* Optional non-blocking action checkbox */}
          {optionalCheckboxLabel && (
            <label className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50/60 border border-amber-200/80 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={optionalChecked}
                onChange={(e) => setOptionalChecked(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded accent-rose-600 cursor-pointer"
              />
              <span className="text-xs font-medium text-slate-700 leading-snug">
                {optionalCheckboxLabel}
              </span>
            </label>
          )}

          {/* Double Confirmation Checkbox (optional) */}
          {confirmationPrompt && (
            <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isChecked}
                onChange={(e) => setIsChecked(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded accent-rose-600 cursor-pointer"
              />
              <span className="text-xs font-medium text-slate-700 leading-snug">
                {confirmationPrompt}
              </span>
            </label>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-slate-50/80 border-t border-slate-100 flex items-center justify-end gap-2.5">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={isLoading}>
            {cancelButtonLabel}
          </Button>
          <Button
            variant={variant === 'danger' ? 'danger' : 'primary'}
            size="sm"
            onClick={handleConfirm}
            isLoading={isLoading}
            disabled={isConfirmDisabled}
            leftIcon={confirmIcon ?? <Trash2 className="w-3.5 h-3.5" />}
          >
            {confirmButtonLabel}
          </Button>
        </div>
      </div>
    </div>
  );
};
