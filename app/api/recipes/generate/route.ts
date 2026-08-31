import { NextResponse } from "next/server";
import { generateRecipes } from "@/lib/recipes";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const items: string[] = Array.isArray(body.items) ? body.items : [];
    const budget = Number(body.budget);
    const allergies = typeof body.allergies === "string" ? body.allergies : "None";
    const creativity = Number(body.creativity) || 0;

    if (items.length === 0) {
      return NextResponse.json(
        { message: "Please select at least one item" },
        { status: 400 }
      );
    }
    if (Number.isNaN(budget) || budget < 0) {
      return NextResponse.json({ message: "Invalid budget" }, { status: 400 });
    }

    const recipes = await generateRecipes({
      items,
      budget,
      allergies,
      creativity,
    });

    if (!recipes.length) {
      return NextResponse.json(
        { message: "No recipes were generated. Please try again!" },
        { status: 500 }
      );
    }

    return NextResponse.json({ recipes });
  } catch {
    return NextResponse.json({ message: "Server Error" }, { status: 500 });
  }
}
