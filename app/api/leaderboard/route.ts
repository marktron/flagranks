import { NextResponse } from "next/server";
import { getLeaderboard } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "200", 10);

    const flags = await getLeaderboard(Math.min(limit, 200));

    return NextResponse.json({
      flags,
      total: flags.length,
    });
  } catch (error) {
    console.error("Error getting leaderboard:", error);
    return NextResponse.json(
      { error: "Failed to get leaderboard" },
      { status: 500 }
    );
  }
}
