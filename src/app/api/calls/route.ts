import { NextResponse } from "next/server";
import { processCall } from "@/lib/process-call";

export async function POST(req: Request) {
  const body = await req.json();
  const transcript = typeof body.transcript === "string" ? body.transcript.trim() : "";

  if (!transcript) {
    return NextResponse.json({ error: "Missing transcript." }, { status: 400 });
  }

  try {
    const result = await processCall(transcript);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
