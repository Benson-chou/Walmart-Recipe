"use client";

import type { FlyerItem } from "@/lib/types";

type ItemGridProps = {
  items: FlyerItem[];
  selected: Set<string>;
  onToggle: (name: string) => void;
  onSelectAll: () => void;
};

export function ItemGrid({ items, selected, onToggle, onSelectAll }: ItemGridProps) {
  const allSelected = items.length > 0 && items.every((item) => selected.has(item.item_name));

  return (
    <section className="flyer-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">This week&apos;s flyer</p>
          <h2>Discounted picks near you</h2>
        </div>
        <button type="button" className="ghost-button" onClick={onSelectAll}>
          {allSelected ? "Deselect all" : "Select all"}
        </button>
      </div>

      <ul className="item-grid">
        {items.map((item) => {
          const isOn = selected.has(item.item_name);
          return (
            <li key={item.id ?? item.item_name}>
              <button
                type="button"
                className={`item-tile ${isOn ? "selected" : ""}`}
                onClick={() => onToggle(item.item_name)}
                aria-pressed={isOn}
              >
                <span className="item-thumb">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.image} alt="" />
                </span>
                <span className="item-meta">
                  <span className="item-name">{item.item_name}</span>
                  <span className="item-price">${item.price.toFixed(2)}</span>
                  {item.sale_story ? <span className="item-story">{item.sale_story}</span> : null}
                </span>
                <span className="check" aria-hidden>
                  {isOn ? "✓" : ""}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
