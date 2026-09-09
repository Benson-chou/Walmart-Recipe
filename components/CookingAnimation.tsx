"use client";

import { useEffect, useState } from "react";
import { type CookingTierId, getCookingTier } from "@/lib/cooking-tier";

export type CookingAnimationProps = {
  tier?: CookingTierId;
  selectedItems?: string[];
};

const CHEF_STEPS = [
  { icon: "🛒", text: "Gathering your selected Walmart weekly deals..." },
  { icon: "📖", text: "Querying Food.com catalog for high-rated matches..." },
  { icon: "🍳", text: "Sautéing ideas & matching flavor profiles..." },
  { icon: "⚖️", text: "Balancing portions, cooking temps & timing..." },
  { icon: "🧑‍🍳", text: "Sous-chef agent auditing allergies & culinary science..." },
  { icon: "🍽️", text: "Plating your personalized 3-recipe menu..." },
];

export function CookingAnimation({ tier = "simple", selectedItems = [] }: CookingAnimationProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const activeTier = getCookingTier(tier);

  useEffect(() => {
    const timer = setInterval(() => {
      setStepIndex((prev) => (prev + 1) % CHEF_STEPS.length);
    }, 2600);
    return () => clearInterval(timer);
  }, []);

  const currentStep = CHEF_STEPS[stepIndex];
  const itemsPreview =
    selectedItems.length > 0
      ? selectedItems.slice(0, 4).join(", ") +
        (selectedItems.length > 4 ? ` +${selectedItems.length - 4} more` : "")
      : null;

  return (
    <section className="cooking-loading-card" aria-live="polite" aria-busy="true">
      {/* Animated Skillet & Food Stage */}
      <div className="cooking-stage">
        <svg
          className="cooking-svg"
          viewBox="0 0 200 160"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Flame / Stove Glow */}
          <ellipse
            cx="90"
            cy="138"
            rx="52"
            ry="7"
            className="cooking-stove-glow"
          />

          {/* Steam wisps */}
          <g className="cooking-steam-group">
            <path
              d="M75 80 C70 65, 80 55, 74 40 C70 30, 78 22, 73 14"
              className="cooking-steam-wisp steam-1"
              stroke="#cbd5e1"
              strokeWidth="2.8"
              strokeLinecap="round"
            />
            <path
              d="M92 78 C88 62, 98 52, 91 38 C86 28, 94 18, 89 10"
              className="cooking-steam-wisp steam-2"
              stroke="#cbd5e1"
              strokeWidth="3.2"
              strokeLinecap="round"
            />
            <path
              d="M108 82 C103 68, 114 58, 107 44 C102 34, 110 24, 105 16"
              className="cooking-steam-wisp steam-3"
              stroke="#cbd5e1"
              strokeWidth="2.8"
              strokeLinecap="round"
            />
          </g>

          {/* Tossing food morsels */}
          <g className="cooking-food-particles">
            {/* Green broccoli / herb floret */}
            <g className="cooking-morsel morsel-1">
              <circle cx="82" cy="72" r="5.5" fill="#22c55e" />
              <circle cx="87" cy="70" r="4.5" fill="#16a34a" />
              <rect x="83" y="75" width="2.5" height="4" rx="1" fill="#15803d" />
            </g>

            {/* Carrot coin */}
            <g className="cooking-morsel morsel-2">
              <ellipse cx="102" cy="70" rx="5.5" ry="4" fill="#f97316" />
              <ellipse cx="102" cy="70" rx="3" ry="2" fill="#ea580c" />
            </g>

            {/* Golden protein / potato cube */}
            <g className="cooking-morsel morsel-3">
              <rect
                x="68"
                y="71"
                width="8"
                height="8"
                rx="2"
                fill="#eab308"
                transform="rotate(15 72 75)"
              />
            </g>

            {/* Red pepper / tomato slice */}
            <g className="cooking-morsel morsel-4">
              <path
                d="M93 72 C98 69, 103 72, 105 76 C101 77, 96 76, 93 72 Z"
                fill="#ef4444"
              />
            </g>
          </g>

          {/* The Skillet Pan */}
          <g className="cooking-pan-group">
            {/* Handle */}
            <path
              d="M136 104 C152 98, 172 88, 184 80 C187 84, 184 90, 178 95 C164 105, 146 112, 134 114 Z"
              fill="#334155"
              stroke="#1e293b"
              strokeWidth="1.5"
            />
            {/* Handle grip detail */}
            <path
              d="M156 94 C166 89, 175 83, 181 79"
              stroke="#64748b"
              strokeWidth="1.8"
              strokeLinecap="round"
            />

            {/* Pan outer base */}
            <ellipse
              cx="90"
              cy="114"
              rx="46"
              ry="16"
              fill="#1e293b"
            />
            {/* Pan inner bowl */}
            <ellipse
              cx="90"
              cy="110"
              rx="44"
              ry="13.5"
              fill="#334155"
            />
            {/* Pan sizzle surface */}
            <ellipse
              cx="90"
              cy="111"
              rx="38"
              ry="10.5"
              fill="#0f172a"
            />
            {/* Sizzle oil reflection */}
            <ellipse
              cx="87"
              cy="112"
              rx="28"
              ry="6"
              fill="#fbbf24"
              opacity="0.3"
            />

            {/* Sizzle sparkles */}
            <circle cx="78" cy="110" r="1.2" fill="#fef08a" className="sizzle-spark s1" />
            <circle cx="94" cy="113" r="1.4" fill="#fef08a" className="sizzle-spark s2" />
            <circle cx="104" cy="109" r="1.2" fill="#fef08a" className="sizzle-spark s3" />
          </g>
        </svg>
      </div>

      {/* Narrative & Step Messaging */}
      <div className="cooking-text-wrap">
        <div className="cooking-tier-pill">
          <span className="tier-pill-icon">{activeTier.icon}</span>
          <span className="tier-pill-label">{activeTier.label}</span>
        </div>

        <h3 className="cooking-heading">Cooking up your recipes…</h3>

        <div className="cooking-step-container">
          <div key={stepIndex} className="cooking-step-item">
            <span className="step-icon" aria-hidden>{currentStep.icon}</span>
            <span className="step-text">{currentStep.text}</span>
          </div>
        </div>

        {itemsPreview && (
          <p className="cooking-ingredients-ticker">
            <span className="ticker-label">In the pan:</span> {itemsPreview}
          </p>
        )}
      </div>

      {/* Progress track */}
      <div className="cooking-progress-bar" aria-hidden>
        <div className="cooking-progress-shimmer" />
      </div>
    </section>
  );
}
