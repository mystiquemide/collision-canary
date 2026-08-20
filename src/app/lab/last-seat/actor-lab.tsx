"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/* The mount effect reads client-only URL state (query params plus the hash
   token, which never reaches the server), so a one-time setState inside it is
   intentional and runs once. */
/* eslint-disable react-hooks/set-state-in-effect */

type Phase =
  | "loading"
  | "invalid"
  | "ready"
  | "arming"
  | "waiting"
  | "claiming"
  | "won"
  | "seat_taken"
  | "error";

type Ctx = { runId: string; actor: string; token: string };

export function ActorLab() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [actorName, setActorName] = useState("Actor");
  const [message, setMessage] = useState<string | null>(null);
  const [arrived, setArrived] = useState<{ a: number; e: number } | null>(null);
  const [seatsLeft, setSeatsLeft] = useState<number | null>(null);
  const ctx = useRef<Ctx | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const runId = params.get("runId") ?? "";
    const actor = params.get("actor") ?? "";
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const token = hash.get("token") ?? "";

    if (!runId || !actor || !token) {
      setPhase("invalid");
      return;
    }

    ctx.current = { runId, actor, token };
    setActorName(actor === "alice" ? "Alice" : actor === "bob" ? "Bob" : actor);
    setPhase("ready");

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const api = useCallback((path: string, method: string) => {
    const c = ctx.current;
    if (!c) throw new Error("missing context");
    return fetch(`/api/v1/runs/${c.runId}/actors/${c.actor}/${path}`, {
      method,
      headers: { Authorization: `Bearer ${c.token}` },
    });
  }, []);

  const claim = useCallback(async () => {
    setPhase("claiming");
    try {
      const res = await api("claim", "POST");
      const body = await res.json().catch(() => null);
      const outcome = body?.data?.outcome;
      if (outcome === "succeeded") {
        setSeatsLeft(body.data.remaining ?? 0);
        setMessage(body.data.message ?? "You claimed the final seat.");
        setPhase("won");
      } else if (outcome === "rejected") {
        setSeatsLeft(body.data.remaining ?? 0);
        setMessage(body.data.message ?? "The final seat was already claimed.");
        setPhase("seat_taken");
      } else {
        setMessage(body?.error?.message ?? "The claim could not be verified.");
        setPhase("error");
      }
    } catch {
      setMessage("The claim could not be completed. Please try again.");
      setPhase("error");
    }
  }, [api]);

  const startPolling = useCallback(() => {
    let tries = 0;
    pollRef.current = setInterval(async () => {
      tries += 1;
      try {
        const res = await api("barrier", "GET");
        const body = await res.json().catch(() => null);
        const snap = body?.data;
        if (snap) {
          setArrived({ a: snap.arrivedCount, e: snap.expectedCount });
          if (snap.released) {
            if (pollRef.current) clearInterval(pollRef.current);
            void claim();
          }
        }
      } catch {
        /* transient, keep polling */
      }
      if (tries > 60 && pollRef.current) {
        clearInterval(pollRef.current);
        setMessage("Timed out waiting for the other actor.");
        setPhase("error");
      }
    }, 1200);
  }, [api, claim]);

  const arm = useCallback(async () => {
    setPhase("arming");
    setMessage(null);
    try {
      const res = await api("arm", "POST");
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.data) {
        setMessage(body?.error?.message ?? "The actor could not be armed.");
        setPhase("error");
        return;
      }
      const snap = body.data.snapshot;
      if (snap) setArrived({ a: snap.arrivedCount, e: snap.expectedCount });
      if (snap?.released) {
        void claim();
      } else {
        setPhase("waiting");
        startPolling();
      }
    } catch {
      setMessage("The actor could not be armed. Please try again.");
      setPhase("error");
    }
  }, [api, claim, startPolling]);

  return (
    <div className="w-full rounded-2xl border border-border bg-card p-6 shadow-[0_14px_40px_rgba(30,40,60,0.10)]">
      <div className="mb-4 flex items-center justify-between">
        <span className="font-mono text-[0.66rem] uppercase tracking-[0.08em] text-muted">
          Last-seat booking
        </span>
        <span className="font-mono text-xs text-ink">Actor: {actorName}</span>
      </div>

      {phase === "loading" ? (
        <p className="font-mono text-sm text-muted">Loading actor...</p>
      ) : null}

      {phase === "invalid" ? (
        <p className="rounded-xl bg-[#FBEECB] px-4 py-3 text-sm text-ink">
          This actor link is missing its token. Open the link exactly as it was
          given when the run was created.
        </p>
      ) : null}

      {phase !== "loading" && phase !== "invalid" ? (
        <>
          <div className="mb-4 flex items-center gap-4">
            <div className="rounded-xl border-2 border-waiting bg-card px-4 py-3 text-center">
              <div className="font-mono text-[0.58rem] uppercase tracking-[0.06em] text-muted">
                Final seat
              </div>
              <div className="text-xl font-extrabold text-ink">
                {seatsLeft ?? 1}
              </div>
            </div>
            <p className="text-sm text-muted">
              {actorName} and one other browser will try to claim this shared
              seat at the same moment.
            </p>
          </div>

          {phase === "ready" ? (
            <button
              type="button"
              onClick={arm}
              className="inline-flex min-h-[44px] items-center rounded-xl bg-primary px-5 text-sm font-semibold text-white shadow-[0_6px_14px_rgba(46,139,255,0.28)] transition-colors hover:bg-primary-press"
            >
              Arm claim
            </button>
          ) : null}

          {phase === "arming" ? (
            <p className="font-mono text-sm text-muted">Arming...</p>
          ) : null}

          {phase === "waiting" ? (
            <div>
              <p className="font-mono text-sm font-semibold uppercase tracking-[0.05em] text-amber-strong">
                Waiting for the other browser
              </p>
              {arrived ? (
                <p className="mt-1 font-mono text-xs text-muted">
                  Barrier arrivals {arrived.a} of {arrived.e}
                </p>
              ) : null}
            </div>
          ) : null}

          {phase === "claiming" ? (
            <p className="font-mono text-sm text-muted">Claiming the seat...</p>
          ) : null}

          {phase === "won" ? (
            <p className="rounded-xl bg-[#DEF6EC] px-4 py-3 text-sm font-semibold text-verified">
              {message} Seats left: {seatsLeft ?? 0}.
            </p>
          ) : null}

          {phase === "seat_taken" ? (
            <p className="rounded-xl bg-secondary px-4 py-3 text-sm text-ink">
              {message}
            </p>
          ) : null}

          {phase === "error" ? (
            <div className="rounded-xl bg-[#FDE7E2] px-4 py-3">
              <p className="text-sm text-collision">{message}</p>
              <button
                type="button"
                onClick={arm}
                className="mt-3 inline-flex min-h-[44px] items-center rounded-xl bg-secondary px-4 text-sm font-semibold text-ink transition-[filter] hover:brightness-95"
              >
                Try again
              </button>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
