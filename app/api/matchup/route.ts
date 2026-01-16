import { NextResponse } from "next/server";
import { getMatchup, getFlagIdByIso2 } from "@/lib/db";
import { headers } from "next/headers";

export async function GET(request: Request) {
  try {
    // Get excluded IDs from query params (client-side tracking of recent pairs)
    const { searchParams } = new URL(request.url);
    const excludeParam = searchParams.get("exclude");
    const excludeIds = excludeParam
      ? excludeParam.split(",").map((id) => parseInt(id, 10)).filter(Boolean)
      : [];

    // Exclude user's own country based on Vercel geolocation
    const headersList = await headers();
    const userCountry = headersList.get("x-vercel-ip-country");
    if (userCountry) {
      const userFlagId = await getFlagIdByIso2(userCountry);
      if (userFlagId && !excludeIds.includes(userFlagId)) {
        excludeIds.push(userFlagId);
      }
    }

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
    const message = error instanceof Error ? error.message : "Failed to get matchup";
    const isLocalDbError = message.includes("Database not available");
    return NextResponse.json(
      { error: message, isLocalDevError: isLocalDbError },
      { status: isLocalDbError ? 503 : 500 }
    );
  }
}
