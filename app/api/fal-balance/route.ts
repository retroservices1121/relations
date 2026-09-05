import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const key = process.env.FAL_KEY;
    if (!key) {
      return NextResponse.json({ error: "FAL_KEY is not configured on the server." }, { status: 500 });
    }

    const response = await fetch("https://api.fal.ai/v1/account/billing?expand=credits", {
      headers: { Authorization: `Key ${key}` },
      cache: "no-store",
    });

    const data = await response.json();
    if (!response.ok) {
      return NextResponse.json(
        { error: data?.detail || data?.message || "Could not load fal credit balance." },
        { status: response.status },
      );
    }

    return NextResponse.json({
      balance: data?.credits?.current_balance ?? null,
      currency: data?.credits?.currency || "USD",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load fal credit balance." },
      { status: 500 },
    );
  }
}
