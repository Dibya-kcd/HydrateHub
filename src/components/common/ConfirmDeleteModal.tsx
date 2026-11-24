import React from 'react';
import { ConfirmModal, DeleteImpactItem } from '../ui/ConfirmModal';

export type { DeleteImpactItem };

export interface ConfirmDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onConfirmWithComment?: (comment: string) => void | Promise<void>;
  title: string;
  subtitle?: string;
  impactItems?: DeleteImpactItem[];
  warningNote?: string;
  confirmationPrompt?: string;
  confirmButtonLabel?: string;
  rectificationPrompt?: string;
  rectificationPlaceholder?: string;
  reasonPresets?: string[];
  commentMinLength?: number;
}

export const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  onConfirmWithComment,
  title,
  subtitle,
  impactItems = [],
  warningNote,
  confirmationPrompt = 'I understand this action will reverse or delete these records and cannot be undone.',
  confirmButtonLabel = 'Permanently Delete',
  rectificationPrompt,
  rectificationPlaceholder,
  reasonPresets,
  commentMinLength = 0,
}) => {
  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      onConfirmWithComment={onConfirmWithComment}
      title={title}
      subtitle={subtitle}
      impactItems={impactItems}
      warningNote={warningNote}
      confirmationPrompt={confirmationPrompt}
      confirmButtonLabel={confirmButtonLabel}
      requiresCheckbox={Boolean(confirmationPrompt)}
      rectificationPrompt={rectificationPrompt}
      rectificationPlaceholder={rectificationPlaceholder}
      reasonPresets={reasonPresets}
      commentMinLength={commentMinLength}
      variant="danger"
    />
  );
};
