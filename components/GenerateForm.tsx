"use client";

import { AllergyMultiSelect } from "@/components/AllergyMultiSelect";
import { COOKING_TIERS, type CookingTierId } from "@/lib/cooking-tier";

type GenerateFormProps = {
  tier: CookingTierId;
  budget: string;
  allergies: string[];
  styleRequest: string;
  location: string;
  error?: string | null;
  loading?: boolean;
  onTierChange: (value: CookingTierId) => void;
  onBudgetChange: (value: string) => void;
  onAllergiesChange: (value: string[]) => void;
  onStyleRequestChange: (value: string) => void;
  onSubmit: () => void;
};

export function GenerateForm({
  tier,
  budget,
  allergies,
  styleRequest,
  location,
  error,
  loading,
  onTierChange,
  onBudgetChange,
  onAllergiesChange,
  onStyleRequestChange,
  onSubmit,
}: GenerateFormProps) {
  return (
    <section className="generate-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Customize</p>
          <h2>Help the kitchen know you</h2>
        </div>
        <p className="location-chip">ZIP: {location}</p>
      </div>

      <div className="generate-grid">
        <div className="field field-wide">
          <span id="tier-group-label">Cooking vibe</span>
          <div
            className="tier-grid"
            role="radiogroup"
            aria-labelledby="tier-group-label"
          >
            {COOKING_TIERS.map((item) => {
              const isSelected = tier === item.id;
              return (
                <button
                  type="button"
                  key={item.id}
                  role="radio"
                  aria-checked={isSelected}
                  className={`tier-card ${isSelected ? "selected" : ""}`}
                  onClick={() => onTierChange(item.id)}
                >
                  <div className="tier-card-top">
                    <span className="tier-icon">{item.icon}</span>
                    <span className="tier-radio-indicator">
                      <span className="tier-radio-dot" />
                    </span>
                  </div>
                  <div className="tier-card-body">
                    <p className="tier-title">{item.label}</p>
                    <p className="tier-subtitle">{item.subtitle}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <label className="field">
          <span>Budget (USD)</span>
          <input
            type="number"
            min={0}
            step="0.01"
            value={budget}
            onChange={(e) => onBudgetChange(e.target.value)}
            required
          />
        </label>

        <div className="field field-wide">
          <span>Allergies</span>
          <AllergyMultiSelect value={allergies} onChange={onAllergiesChange} />
        </div>

        <label className="field field-wide">
          <span>Other requests</span>
          <textarea
            value={styleRequest}
            onChange={(e) => onStyleRequestChange(e.target.value)}
            placeholder="e.g. healthy & light, one-pan, oven bake, high protein, under 30 minutes…"
            rows={3}
            maxLength={400}
          />
          <span className="field-hint">
            Optional cooking style — healthy vs heavy, oven vs skillet, spice level, etc.
          </span>
        </label>
      </div>

      {error ? <p className="form-error">{error}</p> : null}

      <button
        type="button"
        className="primary-button"
        onClick={onSubmit}
        disabled={loading}
      >
        {loading ? "Cooking up ideas…" : "Generate recipes"}
      </button>
    </section>
  );
}
