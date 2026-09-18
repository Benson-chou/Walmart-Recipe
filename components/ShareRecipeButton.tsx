"use client";

import { useRef, type MouseEvent } from "react";
import { ActionTooltip, useAnchoredPopup } from "@/components/ActionTooltip";

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
  const popup = useAnchoredPopup(buttonRef, { autoHideMs: 1600 });

  async function copyLink(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    const url = `${window.location.origin}${recipePath(recipeId)}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt(`Copy link for ${recipeName}`, url);
    }
    popup.show();
  }

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
      <ActionTooltip open={popup.open} anchor={popup.anchor}>
        Link Copied
      </ActionTooltip>
    </>
  );
}
