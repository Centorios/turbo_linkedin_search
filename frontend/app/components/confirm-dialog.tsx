"use client";

import { useEffect, useId, useRef, type KeyboardEvent } from "react";
import { AlertIcon, SpinnerIcon } from "./icons";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** Shows a spinner on the confirm button and blocks closing while a request runs. */
  isBusy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

// Confirmation for destructive actions, in place of the browser's window.confirm.
// Focus starts on "Cancelar" (the safe choice), stays trapped between the two
// buttons, and returns to the element that opened the dialog.
export function ConfirmDialog({
  open, title, description, confirmLabel, cancelLabel = "Cancelar", isBusy = false, onConfirm, onCancel,
}: ConfirmDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    cancelRef.current?.focus();
    return () => {
      if (opener?.isConnected) opener.focus();
    };
  }, [open]);

  if (!open) return null;

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape" && !isBusy) {
      event.stopPropagation();
      onCancel();
      return;
    }
    if (event.key !== "Tab") return;
    const first = cancelRef.current;
    const last = confirmRef.current;
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div
      data-testid="confirm-dialog-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isBusy) onCancel();
      }}
    >
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        data-testid="confirm-dialog"
        onKeyDown={handleKeyDown}
        className="my-auto w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-xl"
      >
        <div className="flex items-start gap-4">
          <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-danger-surface text-danger">
            <AlertIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 id={titleId} className="text-headline-lg text-text">{title}</h2>
            <p id={descriptionId} className="mt-2 text-body-sm leading-relaxed text-text-muted">{description}</p>
          </div>
        </div>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            ref={cancelRef}
            type="button"
            data-testid="confirm-dialog-cancel"
            disabled={isBusy}
            onClick={onCancel}
            className="focus-ring rounded-lg border border-border bg-surface px-4 py-2 text-body-sm font-semibold text-text transition-colors hover:bg-subtle disabled:cursor-not-allowed disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            data-testid="confirm-dialog-confirm"
            disabled={isBusy}
            onClick={onConfirm}
            className="focus-ring flex items-center justify-center gap-2 rounded-lg bg-danger px-4 py-2 text-body-sm font-semibold text-on-primary transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isBusy && <SpinnerIcon className="h-4 w-4" />}
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
