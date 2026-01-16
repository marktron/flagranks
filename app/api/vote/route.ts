import { NextResponse } from "next/server";
import { recordVote } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { winnerId, loserId } = body;

    if (!winnerId || !loserId) {
      return NextResponse.json(
        { error: "winnerId and loserId are required" },
        { status: 400 }
      );
    }

    const result = await recordVote(winnerId, loserId);

    // Determine which flag was A and B based on IDs
    const minId = Math.min(winnerId, loserId);
    const winnerIsA = winnerId === minId;

    return NextResponse.json({
      pairing: {
        aName: winnerIsA ? result.winner.country_name : result.loser.country_name,
        bName: winnerIsA ? result.loser.country_name : result.winner.country_name,
        aPct: result.pairing.a_pct,
        bPct: result.pairing.b_pct,
        n: result.pairing.n_total,
      },
      winner: {
        id: result.winner.id,
        country_name: result.winner.country_name,
        smoothed_score: result.winner.smoothed_score,
      },
      loser: {
        id: result.loser.id,
        country_name: result.loser.country_name,
        smoothed_score: result.loser.smoothed_score,
      },
    });
  } catch (error) {
    console.error("Error recording vote:", error);
    return NextResponse.json(
      { error: "Failed to record vote" },
      { status: 500 }
    );
  }
}
