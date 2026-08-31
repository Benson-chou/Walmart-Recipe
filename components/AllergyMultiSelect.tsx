"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ALLERGEN_OPTIONS, isKnownAllergen, splitAllergies } from "@/lib/allergies";

type AllergyMultiSelectProps = {
  value: string[];
  onChange: (next: string[]) => void;
  id?: string;
};

export function AllergyMultiSelect({
  value,
  onChange,
  id,
}: AllergyMultiSelectProps) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const rootRef = useRef<HTMLDivElement>(null);
  const otherInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const { custom } = splitAllergies(value);
  const [otherEnabled, setOtherEnabled] = useState(custom.length > 0);
  const [otherDraft, setOtherDraft] = useState("");

  useEffect(() => {
    if (custom.length > 0) setOtherEnabled(true);
  }, [custom.length]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  useEffect(() => {
    if (open && otherEnabled) {
      otherInputRef.current?.focus();
    }
  }, [open, otherEnabled]);

  function toggleKnown(option: string) {
    if (value.includes(option)) {
      onChange(value.filter((item) => item !== option));
    } else {
      onChange([...value, option]);
    }
  }

  function removeItem(item: string) {
    const next = value.filter((entry) => entry !== item);
    onChange(next);
    if (!next.some((entry) => !isKnownAllergen(entry))) {
      setOtherEnabled(false);
      setOtherDraft("");
    }
  }

  function addOther(raw: string) {
    const pieces = raw
      .split(/[,;]/)
      .map((part) => part.trim())
      .filter(Boolean);

    if (!pieces.length) return;

    const next = [...value];
    for (const piece of pieces) {
      const known = ALLERGEN_OPTIONS.find(
        (option) => option.toLowerCase() === piece.toLowerCase()
      );
      const label = known ?? piece;
      if (!next.some((item) => item.toLowerCase() === label.toLowerCase())) {
        next.push(label);
      }
    }
    onChange(next);
    setOtherDraft("");
    setOtherEnabled(true);
  }

  function toggleOther(checked: boolean) {
    setOtherEnabled(checked);
    if (!checked) {
      onChange(value.filter((item) => isKnownAllergen(item)));
      setOtherDraft("");
    }
  }

  const summary =
    value.length === 0
      ? "Select allergies"
      : value.length <= 2
        ? value.join(", ")
        : `${value.slice(0, 2).join(", ")} +${value.length - 2}`;

  return (
    <div className={`allergy-select ${open ? "open" : ""}`} ref={rootRef}>
      <button
        type="button"
        id={controlId}
        className="allergy-select-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className={value.length ? "allergy-summary" : "allergy-placeholder"}>
          {summary}
        </span>
        <span className="allergy-caret" aria-hidden>
          ▾
        </span>
      </button>

      {open ? (
        <div className="allergy-menu" role="listbox" aria-multiselectable>
          <ul className="allergy-option-list">
            {ALLERGEN_OPTIONS.map((option) => {
              const selected = value.includes(option);
              return (
                <li key={option} role="option" aria-selected={selected}>
                  <label className="allergy-option">
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleKnown(option)}
                    />
                    <span>{option}</span>
                  </label>
                </li>
              );
            })}
            <li role="option" aria-selected={otherEnabled}>
              <label className="allergy-option">
                <input
                  type="checkbox"
                  checked={otherEnabled}
                  onChange={(e) => toggleOther(e.target.checked)}
                />
                <span>Other</span>
              </label>
            </li>
          </ul>

          {otherEnabled ? (
            <div className="allergy-other-row">
              <input
                ref={otherInputRef}
                type="text"
                className="allergy-other-input"
                value={otherDraft}
                onChange={(e) => setOtherDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addOther(otherDraft);
                  }
                }}
                placeholder="Type another allergy"
                maxLength={40}
                aria-label="Other allergy"
              />
              <button
                type="button"
                className="allergy-other-add"
                disabled={!otherDraft.trim()}
                onClick={() => addOther(otherDraft)}
              >
                Add
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {value.length > 0 ? (
        <div className="allergy-chips">
          {value.map((item) => (
            <button
              key={item}
              type="button"
              className="allergy-chip"
              onClick={() => removeItem(item)}
              aria-label={`Remove ${item}`}
            >
              <span>{item}</span>
              <span aria-hidden>×</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
