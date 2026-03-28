"use client";

import { useState } from "react";
import LayoverForm from "@/components/LayoverForm";
import ItineraryDisplay from "@/components/ItineraryDisplay";
import type { UserContext, Itinerary, ProgressEvent } from "@/lib/types";

type AppState = "form" | "loading" | "result" | "error";

export default function Home() {
  const [state, setState] = useState<AppState>("form");
  const [progressMessages, setProgressMessages] = useState<string[]>([]);
  const [itinerary, setItinerary] = useState<Itinerary | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(ctx: UserContext) {
    setState("loading");
    setProgressMessages(["Initializing your layover planner..."]);
    setItinerary(null);
    setErrorMsg("");

    try {
      const response = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ctx),
      });

      if (!response.ok || !response.body) {
        throw new Error("Failed to start planning. Please try again.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6)) as ProgressEvent;
            if (event.type === "progress") {
              setProgressMessages((prev) => [...prev, event.message]);
            } else if (event.type === "result") {
              setItinerary(event.data);
              setState("result");
            } else if (event.type === "error") {
              setErrorMsg(event.message);
              setState("error");
            }
          } catch {
            // malformed SSE line — skip
          }
        }
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "An unexpected error occurred."
      );
      setState("error");
    }
  }

  function handleReset() {
    setState("form");
    setProgressMessages([]);
    setItinerary(null);
    setErrorMsg("");
  }

  return (
    <main className="min-h-screen bg-slate-900">
      {/* Hero */}
      <div className="bg-gradient-to-b from-slate-950 to-slate-900 border-b border-slate-800">
        <div className="max-w-2xl mx-auto px-4 py-12 text-center">
          <div className="text-5xl mb-4">✈️</div>
          <h1 className="text-4xl font-bold text-white tracking-tight">
            Layover Planner
          </h1>
          <p className="mt-3 text-slate-400 text-lg">
            AI-powered itineraries to make the most of your time between flights
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-10">
        {state === "form" && (
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 sm:p-8">
            <h2 className="text-lg font-semibold text-white mb-6">
              Tell us about your layover
            </h2>
            <LayoverForm onSubmit={handleSubmit} loading={false} />
          </div>
        )}

        {state === "loading" && (
          <div className="space-y-6">
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-8 text-center">
              <div className="text-4xl mb-4 animate-bounce">🗺️</div>
              <h2 className="text-xl font-semibold text-white mb-2">
                Planning your itinerary
              </h2>
              <p className="text-slate-400 text-sm">
                Our AI agents are exploring the city for you...
              </p>
            </div>

            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 space-y-3">
              {progressMessages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-3 text-sm transition-opacity ${
                    i === progressMessages.length - 1
                      ? "text-white"
                      : "text-slate-500"
                  }`}
                >
                  {i === progressMessages.length - 1 ? (
                    <span className="w-4 h-4 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin shrink-0" />
                  ) : (
                    <span className="text-emerald-500 shrink-0">✓</span>
                  )}
                  {msg}
                </div>
              ))}
            </div>
          </div>
        )}

        {state === "result" && itinerary && (
          <ItineraryDisplay itinerary={itinerary} onReset={handleReset} />
        )}

        {state === "error" && (
          <div className="bg-slate-800/50 border border-red-500/20 rounded-2xl p-8 text-center space-y-4">
            <div className="text-4xl">⚠️</div>
            <h2 className="text-xl font-semibold text-white">
              Something went wrong
            </h2>
            <p className="text-slate-400 text-sm max-w-sm mx-auto">{errorMsg}</p>
            <button
              onClick={handleReset}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl transition"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
