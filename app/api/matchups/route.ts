import { NextResponse } from "next/server";
import { getMatchups, getFlagIdByIso2 } from "@/lib/db";
import { headers } from "next/headers";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    // Get count (default 10, max 20)
    const countParam = searchParams.get("count");
    const count = Math.min(Math.max(parseInt(countParam || "10", 10) || 10, 1), 20);

    // Get excluded IDs from query params
    const excludeParam = searchParams.get("exclude");
    const excludeIds = excludeParam
      ? excludeParam.split(",").map((id) => parseInt(id, 10)).filter(Boolean)
      : [];

    // Get user's country (but don't exclude it - let them vote on their own flag)
    const headersList = await headers();
    const userCountry = headersList.get("x-vercel-ip-country");
    let userFlagId: number | null = null;
    if (userCountry) {
      userFlagId = await getFlagIdByIso2(userCountry);
    }

    const matchups = await getMatchups(count, excludeIds);

    return NextResponse.json(
      {
        userFlagId,
        matchups: matchups.map((m) => ({
          a: {
            id: m.flagA.id,
            svg_url: m.flagA.svg_url,
            country_name: m.flagA.country_name,
          },
          b: {
            id: m.flagB.id,
            svg_url: m.flagB.svg_url,
            country_name: m.flagB.country_name,
          },
          matchupId: `${Math.min(m.flagA.id, m.flagB.id)}-${Math.max(m.flagA.id, m.flagB.id)}`,
          stats: m.stats,
        })),
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=300",
        },
      }
    );
  } catch (error) {
    console.error("Error getting matchups:", error);
    const message = error instanceof Error ? error.message : "Failed to get matchups";
    const isLocalDbError = message.includes("Database not available");
    return NextResponse.json(
      { error: message, isLocalDevError: isLocalDbError },
      { status: isLocalDbError ? 503 : 500 }
    );
  }
}
