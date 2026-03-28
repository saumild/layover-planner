import { NextRequest, NextResponse } from "next/server";
import { runOrchestrator } from "@/lib/orchestrator";
import type { UserContext, ProgressEvent } from "@/lib/types";

export const maxDuration = 300; // 5 minute timeout for Vercel

export async function POST(req: NextRequest) {
  const body = (await req.json()) as UserContext;

  // Validate required fields
  const required: (keyof UserContext)[] = [
    "city",
    "airport_code",
    "arrival_time",
    "departure_time",
    "personas",
    "budget",
  ];
  for (const field of required) {
    if (!body[field]) {
      return NextResponse.json(
        { error: `Missing required field: ${field}` },
        { status: 400 }
      );
    }
  }
  if (!body.personas.length) {
    return NextResponse.json(
      { error: "Select at least one persona" },
      { status: 400 }
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(event: ProgressEvent) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
        );
      }

      try {
        const itinerary = await runOrchestrator(body, (message) => {
          send({ type: "progress", message });
        });
        send({ type: "result", data: itinerary });
      } catch (err) {
        send({
          type: "error",
          message: err instanceof Error ? err.message : "An unexpected error occurred",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
