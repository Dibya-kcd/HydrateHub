import React from 'react';
import { Check, Hourglass } from 'lucide-react';

interface SettingsPhoneToastProps {
  isSaving: boolean;
  toastMessage: string | null;
}

export const SettingsPhoneToast: React.FC<SettingsPhoneToastProps> = ({ isSaving, toastMessage }) =>
  isSaving || toastMessage ? (
    <div className="hh-inv-toast" role="status">
      {isSaving ? (
        <Hourglass size={16} className="text-amber-300 shrink-0" />
      ) : (
        <Check size={16} className="text-emerald-300 shrink-0" />
      )}
      <span className="truncate">{isSaving ? 'Saving settings to database...' : toastMessage}</span>
    </div>
  ) : null;
