"use client";

import { useMemo } from "react";
import type { ShoppingList } from "@/lib/shopping-list";

type ShoppingListPanelProps = {
  list: ShoppingList;
  checkedKeys: Set<string>;
  onToggleItem: (key: string) => void;
  onCopy: () => void;
  copied: boolean;
  recipeCount: number;
  assumePantry: boolean;
  onAssumePantryChange: (value: boolean) => void;
};

export function ShoppingListPanel({
  list,
  checkedKeys,
  onToggleItem,
  onCopy,
  copied,
  recipeCount,
  assumePantry,
  onAssumePantryChange,
}: ShoppingListPanelProps) {
  const remaining = useMemo(
    () => list.buy.filter((item) => !checkedKeys.has(item.key)).length,
    [list.buy, checkedKeys]
  );

  const emptyPlan = recipeCount === 0;
  const nothingToBuy = !emptyPlan && list.buy.length === 0;

  return (
    <section className="plan-list-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Shopping list</p>
          <h2>What to buy</h2>
        </div>
        {list.buy.length > 0 ? (
          <button type="button" className="ghost-button" onClick={onCopy}>
            {copied ? "Copied" : "Copy list"}
          </button>
        ) : null}
      </div>

      <label className="plan-pantry-toggle">
        <input
          type="checkbox"
          checked={assumePantry}
          onChange={(e) => onAssumePantryChange(e.target.checked)}
        />
        <span>
          Assume pantry staples
          <span className="plan-buy-meta">
            Hide salt, pepper, water, and cooking oils
          </span>
        </span>
      </label>

      {emptyPlan ? (
        <p className="empty-state">
          Check recipes to build one shopping list. Items on sale this week are
          tagged so you can grab them with the rest of the cart.
        </p>
      ) : nothingToBuy ? (
        <p className="form-success plan-all-covered">
          Pantry staples cover this plan. Turn that off if you need to buy oil,
          salt, or pepper.
        </p>
      ) : (
        <>
          <div className="plan-list-summary" aria-live="polite">
            <span>
              <strong>{remaining}</strong>{" "}
              {remaining === 1 ? "item" : "items"} left
            </span>
            <span className="selection-dot" aria-hidden>
              •
            </span>
            <span>{list.buy.length} total</span>
            {list.estimatedDealTotal > 0 ? (
              <>
                <span className="selection-dot" aria-hidden>
                  •
                </span>
                <span>Est. ${list.estimatedDealTotal.toFixed(2)} on sale</span>
              </>
            ) : null}
          </div>

          <ul className="plan-buy-list">
            {list.buy.map((item) => {
              const checked = checkedKeys.has(item.key);
              return (
                <li key={item.key}>
                  <label className={`plan-buy-row ${checked ? "checked" : ""}`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggleItem(item.key)}
                    />
                    <span className="plan-buy-copy">
                      <span className="plan-buy-name">{item.display}</span>
                      {item.recipes.length > 1 ? (
                        <span className="plan-buy-meta">
                          Used in {item.recipes.length} recipes
                        </span>
                      ) : null}
                      {item.deal ? (
                        <span className="plan-deal-hint">
                          On sale: {item.deal.item_name}
                          {item.deal.price > 0
                            ? ` · $${item.deal.price.toFixed(2)}`
                            : ""}
                          {item.deal.sale_story
                            ? ` · ${item.deal.sale_story}`
                            : ""}
                        </span>
                      ) : null}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
