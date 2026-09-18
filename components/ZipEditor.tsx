"use client";

import { useState } from "react";
import { parseStoredZip } from "@/lib/zip-preference";

type ZipEditorProps = {
  location: string;
  busy?: boolean;
  error?: string | null;
  onCommit: (zip: string) => void;
};

export function ZipEditor({
  location,
  busy,
  error,
  onCommit,
}: ZipEditorProps) {
  const [draft, setDraft] = useState(location);
  const nextZip = parseStoredZip(draft);
  const unchanged = nextZip === location;

  return (
    <div className="zip-editor">
      <form
        className="location-chip location-chip-form"
        onSubmit={(event) => {
          event.preventDefault();
          onCommit(draft);
        }}
      >
        <label>
          <span>ZIP</span>
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={10}
            disabled={busy}
            aria-label="ZIP code for weekly ad"
            aria-invalid={Boolean(error)}
          />
        </label>
        <button
          type="submit"
          className="ghost-button flyer-action-btn"
          disabled={busy || unchanged}
        >
          {busy ? "Updating…" : "Update"}
        </button>
      </form>
      {error ? <p className="form-error zip-editor-error">{error}</p> : null}
    </div>
  );
}
