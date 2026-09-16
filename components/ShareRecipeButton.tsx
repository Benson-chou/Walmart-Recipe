"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { createPortal } from "react-dom";

type ShareRecipeButtonProps = {
  recipeId: string;
  recipeName: string;
  variant?: "icon" | "button";
};

export function recipePath(recipeId: string) {
  return `/recipe/${recipeId}`;
}

function ShareIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.15"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" x2="12" y1="2" y2="15" />
    </svg>
  );
}

export function ShareRecipeButton({
  recipeId,
  recipeName,
  variant = "button",
}: ShareRecipeButtonProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [copied, setCopied] = useState(false);
  const [anchor, setAnchor] = useState<{ top: number; left: number } | null>(null);
  const copiedTimer = useRef<number | null>(null);

  function updateAnchor() {
    const el = buttonRef.current;
    if (!el) return;
    const icon = el.querySelector("svg");
    const rect = (icon ?? el).getBoundingClientRect();
    setAnchor({ top: rect.top, left: rect.left + rect.width / 2 });
  }

  useEffect(() => {
    return () => {
      if (copiedTimer.current) window.clearTimeout(copiedTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!copied) return;
    updateAnchor();
    function onReposition() {
      updateAnchor();
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") hidePopup();
    }
    window.addEventListener("scroll", onReposition, true);
    window.addEventListener("resize", onReposition);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("scroll", onReposition, true);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [copied]);

  function hidePopup() {
    setCopied(false);
    setAnchor(null);
    if (copiedTimer.current) window.clearTimeout(copiedTimer.current);
  }

  async function copyLink(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    const url = `${window.location.origin}${recipePath(recipeId)}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt(`Copy link for ${recipeName}`, url);
    }
    updateAnchor();
    setCopied(true);
    if (copiedTimer.current) window.clearTimeout(copiedTimer.current);
    copiedTimer.current = window.setTimeout(() => {
      setCopied(false);
      setAnchor(null);
    }, 1600);
  }

  const popup =
    copied && anchor && typeof document !== "undefined"
      ? createPortal(
          <div
            className="share-copied-tooltip-anchor"
            style={{ top: anchor.top, left: anchor.left }}
          >
            <div className="share-copied-tooltip" role="status">
              Link Copied
            </div>
          </div>,
          document.body
        )
      : null;

  const button =
    variant === "icon" ? (
      <button
        ref={buttonRef}
        type="button"
        className="icon-button share-icon-button"
        onClick={copyLink}
        aria-label="Share recipe"
        title="Share"
      >
        <ShareIcon />
      </button>
    ) : (
      <button
        ref={buttonRef}
        type="button"
        className="ghost-button share-text-button"
        onClick={copyLink}
      >
        <ShareIcon />
        Share
      </button>
    );

  return (
    <>
      {button}
      {popup}
    </>
  );
}
