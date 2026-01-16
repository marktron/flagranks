import { NextResponse } from "next/server";
import { seedDatabase } from "@/lib/db";

// Seed endpoint - should only be called once during initial setup
// In production, protect this with authentication or remove it
export async function POST() {
  try {
    const result = await seedDatabase();
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error seeding database:", error);
    return NextResponse.json(
      { error: "Failed to seed database" },
      { status: 500 }
    );
  }
}
