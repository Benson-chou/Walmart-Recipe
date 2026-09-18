"use client";

import { useRef, useSyncExternalStore, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { ActionTooltip, useAnchoredPopup } from "@/components/ActionTooltip";
import {
  addRecipesToMealPlan,
  getMealPlanServerSnapshot,
  getMealPlanSnapshot,
  removeRecipesFromMealPlan,
  subscribeMealPlan,
} from "@/lib/meal-plan-store";
import { recipePlanKey } from "@/lib/shopping-list";
import type { Recipe } from "@/lib/types";

type AddToMealPlanButtonProps = {
  recipe: Recipe;
  navigate?: boolean;
  variant?: "icon" | "button";
};

function PlanCheckIcon({ checked }: { checked: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <rect
        x="3.5"
        y="3.5"
        width="17"
        height="17"
        rx="4"
        fill={checked ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="2.1"
      />
      {checked ? (
        <polyline
          points="8 12.2 11 15.2 16.4 9"
          stroke="#fff"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}
    </svg>
  );
}

export function AddToMealPlanButton({
  recipe,
  navigate = false,
  variant = "icon",
}: AddToMealPlanButtonProps) {
  const router = useRouter();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popup = useAnchoredPopup(buttonRef, { autoHideMs: 1600 });
  const plan = useSyncExternalStore(
    subscribeMealPlan,
    getMealPlanSnapshot,
    getMealPlanServerSnapshot
  );

  const inPlan = plan.recipes.some(
    (row) => recipePlanKey(row) === recipePlanKey(recipe)
  );

  function onClick(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (inPlan) {
      removeRecipesFromMealPlan([recipe]);
      return;
    }

    addRecipesToMealPlan([recipe]);
    if (navigate) {
      router.push("/plan");
      return;
    }
    popup.show();
  }

  const label = inPlan
    ? "In this week's meal plan"
    : "Add to this week's meal plan";

  if (variant === "button") {
    return (
      <>
        <button
          ref={buttonRef}
          type="button"
          className={`ghost-button share-text-button plan-check-text${inPlan ? " is-checked" : ""}`}
          onClick={onClick}
          aria-pressed={inPlan}
        >
          <PlanCheckIcon checked={inPlan} />
          {inPlan ? "In this week's meals" : "Add to this week's meals"}
        </button>
        <ActionTooltip open={popup.open} anchor={popup.anchor}>
          Added to meal plan
        </ActionTooltip>
      </>
    );
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={`icon-button plan-check-button${inPlan ? " is-checked" : ""}`}
        onClick={onClick}
        aria-pressed={inPlan}
        aria-label={label}
        title={label}
      >
        <PlanCheckIcon checked={inPlan} />
      </button>
      <ActionTooltip open={popup.open} anchor={popup.anchor}>
        Added to meal plan
      </ActionTooltip>
    </>
  );
}
