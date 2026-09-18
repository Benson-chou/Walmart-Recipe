"use client";

import { useMemo, useState, type ReactNode } from "react";
import type { FlyerItem } from "@/lib/types";
import {
  categorizeGroceryItem,
  isGroceryName,
  CATEGORY_INFO,
  type GroceryCategory,
} from "@/lib/grocery-categories";

type ItemGridProps = {
  items: FlyerItem[];
  selected: Set<string>;
  onToggle: (name: string) => void;
  onSelectAll: (targetNames?: string[]) => void;
  onClearAll?: () => void;
  headingAction?: ReactNode;
};

export function ItemGrid({
  items: rawItems,
  selected,
  onToggle,
  onSelectAll,
  onClearAll,
  headingAction,
}: ItemGridProps) {
  const [activeCategory, setActiveCategory] = useState<GroceryCategory>("all");

  // Filter out any non-grocery anomalies (e.g. jewelry/apparel miscategorized by flyer APIs)
  const items = useMemo(() => {
    return rawItems.filter((item) => isGroceryName(item.item_name));
  }, [rawItems]);

  // Group items by category
  const categorized = useMemo(() => {
    const map = new Map<GroceryCategory, FlyerItem[]>();
    map.set("all", items);
    for (const item of items) {
      const cat = categorizeGroceryItem(item.item_name, item.category);
      const list = map.get(cat) || [];
      list.push(item);
      map.set(cat, list);
    }
    return map;
  }, [items]);

  // Only display category pills that have at least 1 item
  const availableCategories = useMemo(() => {
    const cats: Array<{
      id: GroceryCategory;
      label: string;
      icon: string;
      count: number;
    }> = [];
    const order: GroceryCategory[] = [
      "all",
      "produce",
      "meat-seafood",
      "dairy-eggs",
      "drinks",
      "pantry",
    ];
    for (const id of order) {
      const list = categorized.get(id) || [];
      if (id === "all" || list.length > 0) {
        cats.push({
          id,
          label: CATEGORY_INFO[id].label,
          icon: CATEGORY_INFO[id].icon,
          count: list.length,
        });
      }
    }
    return cats;
  }, [categorized]);

  // Current items filtered by active category tab
  const displayedItems = useMemo(() => {
    return categorized.get(activeCategory) || items;
  }, [categorized, activeCategory, items]);

  // Selection statistics
  const selectedCount = selected.size;
  const { totalEstPrice, promoCount } = useMemo(() => {
    let sum = 0;
    let promos = 0;
    for (const item of items) {
      if (selected.has(item.item_name)) {
        if (item.price > 0) {
          sum += item.price;
        } else {
          promos++;
        }
      }
    }
    return { totalEstPrice: sum, promoCount: promos };
  }, [items, selected]);

  // Check if all displayed items in current category are selected
  const isCurrentCategoryAllSelected =
    displayedItems.length > 0 &&
    displayedItems.every((item) => selected.has(item.item_name));

  function handleCategorySelectToggle() {
    const names = displayedItems.map((item) => item.item_name);
    onSelectAll(names);
  }

  return (
    <section className="flyer-section">
      <div className="flyer-header-block">
        <div className="flyer-header-left">
          <p className="eyebrow">Walmart weekly ad</p>
          <div className="flyer-title-row">
            <h2>Discounted picks near you</h2>
            <div className="selection-badge" aria-live="polite">
              {selectedCount > 0 ? (
                <>
                  <span className="selection-count">
                    <strong>{selectedCount}</strong> {selectedCount === 1 ? "item" : "items"} selected
                  </span>
                  <span className="selection-dot" aria-hidden>
                    •
                  </span>
                  <span className="selection-price">
                    {totalEstPrice > 0 ? (
                      <>
                        Est. ${totalEstPrice.toFixed(2)}
                        {promoCount > 0 && (
                          <span className="selection-promo-extra">
                            {" "}
                            (+{promoCount} {promoCount === 1 ? "deal" : "deals"})
                          </span>
                        )}
                      </>
                    ) : (
                      "Special deals selected"
                    )}
                  </span>
                </>
              ) : (
                <span className="selection-empty">0 items selected</span>
              )}
            </div>
          </div>
        </div>

        <div className="flyer-header-actions">
          {headingAction}
          {selectedCount > 0 && (
            <button
              type="button"
              className="ghost-button flyer-action-btn"
              onClick={onClearAll ?? (() => onSelectAll([]))}
            >
              Clear selection
            </button>
          )}
          <button
            type="button"
            className="ghost-button flyer-action-btn"
            onClick={handleCategorySelectToggle}
          >
            {isCurrentCategoryAllSelected
              ? activeCategory === "all"
                ? "Deselect all"
                : `Deselect ${CATEGORY_INFO[activeCategory].label}`
              : activeCategory === "all"
              ? "Select all"
              : `Select all in ${CATEGORY_INFO[activeCategory].label}`}
          </button>
        </div>
      </div>

      {/* Category Tabs */}
      {availableCategories.length > 1 && (
        <div
          className="category-tabs-bar"
          role="tablist"
          aria-label="Grocery deal categories"
        >
          {availableCategories.map((cat) => {
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                role="tab"
                aria-selected={isActive}
                className={`category-pill ${isActive ? "active" : ""}`}
                onClick={() => setActiveCategory(cat.id)}
              >
                <span className="cat-icon">{cat.icon}</span>
                <span className="cat-label">{cat.label}</span>
                <span className="cat-count">{cat.count}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Vertical Grocery Shelf Grid */}
      {displayedItems.length === 0 ? (
        <p className="empty-state flyer-empty-copy">
          No grocery deals in this aisle right now. Try another category or refresh later.
        </p>
      ) : (
        <ul className="item-shelf-grid">
          {displayedItems.map((item) => {
            const isOn = selected.has(item.item_name);
            return (
              <li key={item.id ?? item.item_name} className="item-card-wrapper">
                <button
                  type="button"
                  className={`item-shelf-card ${isOn ? "selected" : ""}`}
                  onClick={() => onToggle(item.item_name)}
                  aria-pressed={isOn}
                >
                  {/* Floating circular select checkbox */}
                  <div
                    className={`item-check-circle ${isOn ? "checked" : ""}`}
                    aria-hidden
                  >
                    {isOn && (
                      <svg
                        className="check-svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>

                  {/* 1:1 Aspect ratio image container */}
                  <div className="item-card-image-wrap">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.image}
                      alt={item.item_name}
                      loading="lazy"
                    />
                  </div>

                  {/* Card body with price, clamped title, and deal badge */}
                  <div className="item-card-body">
                    <div className="item-card-price">
                      {item.price > 0 ? (
                        `$${item.price.toFixed(2)}`
                      ) : (
                        <span className="deal-price-badge">
                          <span className="deal-spark">✦</span> Special Deal
                        </span>
                      )}
                    </div>
                    <h3 className="item-card-title" title={item.item_name}>
                      {item.item_name}
                    </h3>
                    {item.sale_story ? (
                      <div className="item-deal-badge" title={item.sale_story}>
                        <span className="deal-spark">✦</span>
                        <span className="deal-text">{item.sale_story}</span>
                      </div>
                    ) : (
                      <div className="item-deal-spacer" aria-hidden />
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
