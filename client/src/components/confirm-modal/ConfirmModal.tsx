"use client";

import { Modal, Button } from "@devdigest/ui";

export function ConfirmModal({
  title,
  body,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
}: {
  title: string;
  body: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      width={420}
      title={title}
      onClose={onCancel}
      footer={
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <Button kind="secondary" size="sm" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button kind="danger" size="sm" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <div style={{ padding: "16px 24px", fontSize: 14, color: "var(--text-secondary)" }}>
        {body}
      </div>
    </Modal>
  );
}
