"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

export type TooltipAnchor = { top: number; left: number };

export function getButtonAnchor(button: HTMLElement | null): TooltipAnchor | null {
  if (!button) return null;
  const icon = button.querySelector("svg");
  const rect = (icon ?? button).getBoundingClientRect();
  return { top: rect.top, left: rect.left + rect.width / 2 };
}

type UseAnchoredPopupOptions = {
  autoHideMs?: number;
  interactive?: boolean;
};

export function useAnchoredPopup(
  buttonRef: RefObject<HTMLElement | null>,
  options: UseAnchoredPopupOptions = {}
) {
  const { autoHideMs, interactive = false } = options;
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<TooltipAnchor | null>(null);
  const timer = useRef<number | null>(null);

  const updateAnchor = useCallback(() => {
    const next = getButtonAnchor(buttonRef.current);
    if (next) setAnchor(next);
  }, [buttonRef]);

  const hide = useCallback(() => {
    setOpen(false);
    setAnchor(null);
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  function show() {
    updateAnchor();
    setOpen(true);
    if (timer.current) window.clearTimeout(timer.current);
    if (autoHideMs) {
      timer.current = window.setTimeout(() => {
        setOpen(false);
        setAnchor(null);
      }, autoHideMs);
    }
  }

  useEffect(() => {
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, []);

  useEffect(() => {
    if (!open) return;

    function onReposition() {
      updateAnchor();
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") hide();
    }
    function onPointerDown(event: PointerEvent) {
      if (!interactive) return;
      const target = event.target as Node | null;
      if (buttonRef.current?.contains(target)) return;
      const tooltip = document.querySelector("[data-action-tooltip='true']");
      if (tooltip?.contains(target)) return;
      hide();
    }

    window.addEventListener("scroll", onReposition, true);
    window.addEventListener("resize", onReposition);
    window.addEventListener("keydown", onKeyDown);
    if (interactive) window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("scroll", onReposition, true);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("keydown", onKeyDown);
      if (interactive) window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open, interactive, autoHideMs, buttonRef, updateAnchor, hide]);

  return { open, anchor, show, hide, updateAnchor };
}

type ActionTooltipProps = {
  open: boolean;
  anchor: TooltipAnchor | null;
  interactive?: boolean;
  children: ReactNode;
};

export function ActionTooltip({
  open,
  anchor,
  interactive = false,
  children,
}: ActionTooltipProps) {
  if (!open || !anchor || typeof document === "undefined") return null;

  return createPortal(
    <div
      className={`share-copied-tooltip-anchor${interactive ? " is-interactive" : ""}`}
      style={{ top: anchor.top, left: anchor.left }}
      data-action-tooltip="true"
    >
      <div className="share-copied-tooltip" role="status">
        {children}
      </div>
    </div>,
    document.body
  );
}
