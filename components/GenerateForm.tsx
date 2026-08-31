"use client";

import { AllergyMultiSelect } from "@/components/AllergyMultiSelect";

type GenerateFormProps = {
  creativity: number;
  budget: string;
  allergies: string[];
  location: string;
  error?: string | null;
  loading?: boolean;
  onCreativityChange: (value: number) => void;
  onBudgetChange: (value: string) => void;
  onAllergiesChange: (value: string[]) => void;
  onSubmit: () => void;
};

export function GenerateForm({
  creativity,
  budget,
  allergies,
  location,
  error,
  loading,
  onCreativityChange,
  onBudgetChange,
  onAllergiesChange,
  onSubmit,
}: GenerateFormProps) {
  return (
    <section className="generate-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Customize</p>
          <h2>Help the kitchen know you</h2>
        </div>
        <p className="location-chip">Postal: {location}</p>
      </div>

      <div className="generate-grid">
        <label className="field">
          <span>Creativity</span>
          <div className="slider-row">
            <input
              type="range"
              min={0}
              max={10}
              value={creativity}
              onChange={(e) => onCreativityChange(Number(e.target.value))}
            />
            <output>{creativity}</output>
          </div>
        </label>

        <label className="field">
          <span>Budget (CAD)</span>
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
      </div>

      {error ? <p className="form-error">{error}</p> : null}

      <button
        type="button"
        className="primary-button"
        onClick={onSubmit}
        disabled={loading}
      >
        {loading ? "Generating…" : "Generate recipes"}
      </button>
    </section>
  );
}
