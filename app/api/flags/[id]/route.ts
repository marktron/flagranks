import { NextResponse } from "next/server";
import { getFlagById } from "@/lib/db";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const flagId = parseInt(id, 10);

    if (isNaN(flagId)) {
      return NextResponse.json(
        { error: "Invalid flag ID" },
        { status: 400 }
      );
    }

    const flag = await getFlagById(flagId);

    if (!flag) {
      return NextResponse.json(
        { error: "Flag not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(flag);
  } catch (error) {
    console.error("Error getting flag:", error);
    return NextResponse.json(
      { error: "Failed to get flag" },
      { status: 500 }
    );
  }
}
