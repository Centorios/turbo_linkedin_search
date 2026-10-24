"use client";

import type { ReactNode } from "react";

type FilePickerButtonProps = {
  id: string;
  accept: string;
  disabled?: boolean;
  /** Name of the chosen file; without it the empty label is shown. */
  fileName?: string | null;
  emptyLabel?: string;
  describedBy?: string;
  onSelect: (file: File | undefined) => void;
  testIds: { input: string; browse: string; filename: string };
  /** Extra actions shown between "Buscar" and the file name. */
  children?: ReactNode;
  className?: string;
};

// The native <input type="file"> shows an English "Browse..." button that we
// cannot translate or style. It stays in the page (accessible and focusable)
// but hidden, and "Buscar" is its styled label.
export function FilePickerButton({
  id,
  accept,
  disabled = false,
  fileName = null,
  emptyLabel = "Ningún archivo seleccionado",
  describedBy,
  onSelect,
  testIds,
  children,
  className = "flex w-full max-w-xl items-center gap-3",
}: FilePickerButtonProps) {
  return (
    <div className={className}>
      <input
        id={id}
        type="file"
        accept={accept}
        disabled={disabled}
        aria-describedby={describedBy}
        data-testid={testIds.input}
        onChange={(event) => {
          const input = event.currentTarget;
          onSelect(input.files?.[0]);
          // Lets the same file be chosen again after it was removed.
          input.value = "";
        }}
        className="peer sr-only"
      />
      <label
        htmlFor={id}
        data-testid={testIds.browse}
        className="shrink-0 cursor-pointer rounded-lg bg-primary px-4 py-2 text-body-sm font-semibold text-on-primary transition-colors hover:bg-primary-hover peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
      >
        Buscar
      </label>
      {children}
      <span data-testid={testIds.filename} className="min-w-0 truncate text-body-sm text-text-muted">
        {fileName || emptyLabel}
      </span>
    </div>
  );
}
