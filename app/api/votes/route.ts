import { NextResponse } from "next/server";
import { recordVotes } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { votes } = body;

    if (!Array.isArray(votes) || votes.length === 0) {
      return NextResponse.json(
        { error: "votes array is required" },
        { status: 400 }
      );
    }

    // Validate each vote
    for (const vote of votes) {
      if (!vote.winnerId || !vote.loserId) {
        return NextResponse.json(
          { error: "Each vote must have winnerId and loserId" },
          { status: 400 }
        );
      }
    }

    // Limit batch size
    const limitedVotes = votes.slice(0, 50);

    const result = await recordVotes(limitedVotes);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error recording votes:", error);
    return NextResponse.json(
      { error: "Failed to record votes" },
      { status: 500 }
    );
  }
}
