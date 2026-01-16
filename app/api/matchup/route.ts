import { NextResponse } from "next/server";
import { getMatchup } from "@/lib/db";

export async function GET(request: Request) {
  try {
    // Get excluded IDs from query params (client-side tracking of recent pairs)
    const { searchParams } = new URL(request.url);
    const excludeParam = searchParams.get("exclude");
    const excludeIds = excludeParam
      ? excludeParam.split(",").map((id) => parseInt(id, 10)).filter(Boolean)
      : [];

    const { flagA, flagB } = await getMatchup(excludeIds);

    return NextResponse.json({
      a: {
        id: flagA.id,
        svg_url: flagA.svg_url,
        country_name: flagA.country_name,
      },
      b: {
        id: flagB.id,
        svg_url: flagB.svg_url,
        country_name: flagB.country_name,
      },
      matchupId: `${Math.min(flagA.id, flagB.id)}-${Math.max(flagA.id, flagB.id)}`,
    });
  } catch (error) {
    console.error("Error getting matchup:", error);
    return NextResponse.json(
      { error: "Failed to get matchup" },
      { status: 500 }
    );
  }
}
