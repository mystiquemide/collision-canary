"use client";

import { useState } from "react";

export function CopyButton({
  text,
  label = "Copy",
  copiedLabel = "Copied",
}: {
  text: string;
  label?: string;
  copiedLabel?: string;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          setCopied(false);
        }
      }}
      className="inline-flex min-h-[44px] items-center rounded-xl bg-primary px-4 text-sm font-semibold text-white shadow-[0_6px_14px_rgba(46,139,255,0.28)] transition-colors hover:bg-primary-press"
    >
      {copied ? copiedLabel : label}
    </button>
  );
}
