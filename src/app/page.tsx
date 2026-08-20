import Link from "next/link";
import Image from "next/image";

import { listRuns, type RunListItem } from "@/modules/runs/list-runs";

export const dynamic = "force-dynamic";

async function latestTerminalRun(): Promise<RunListItem | null> {
  try {
    const runs = await listRuns(50);
    return (
      runs.find(
        (run) => run.verdict === "violated" || run.verdict === "satisfied",
      ) ?? null
    );
  } catch {
    return null;
  }
}

export default async function Home() {
  const latest = await latestTerminalRun();

  return (
    <main className="mx-auto w-full max-w-[1100px] px-4">
      {/* Nav */}
      <nav className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-border bg-card px-3 py-2.5 shadow-[0_8px_22px_rgba(30,40,60,0.07)]">
        <span className="flex items-center gap-2 font-extrabold tracking-tight text-ink">
          <BeakMark />
          Collision Canary
        </span>
        <div className="ml-2 flex gap-4">
          <a href="#how-it-works" className="text-sm text-ink/90 hover:text-ink">
            How it works
          </a>
          <a href="#proof" className="text-sm text-ink/90 hover:text-ink">
            Proof
          </a>
        </div>
        <Link
          href="/run"
          className="ml-auto inline-flex min-h-[44px] items-center rounded-xl bg-primary px-4 text-sm font-semibold text-white shadow-[0_6px_14px_rgba(46,139,255,0.28)] transition-colors hover:bg-primary-press"
        >
          Run a live test
        </Link>
      </nav>

      {/* Hero */}
      <section id="main" tabIndex={-1} className="px-2 pb-8 pt-12 text-center">
        <span className="mb-4 inline-block rounded-full bg-secondary px-3 py-1.5 font-mono text-[0.64rem] uppercase tracking-[0.08em] text-muted">
          Multi user bug detection
        </span>
        <h1 className="mx-auto mb-4 max-w-[600px] text-balance text-[clamp(2rem,6vw,3.25rem)] font-extrabold leading-[1.02] tracking-[-0.03em] text-ink">
          Catch the bug only two users can make.
        </h1>
        <p className="mx-auto mb-6 max-w-[52ch] text-base leading-relaxed text-muted">
          Collision Canary drives two real browsers at the exact same moment,
          then proves whether your app keeps its promise: only one person can
          grab the last seat.
        </p>
        <div className="mb-2 flex flex-wrap justify-center gap-2.5">
          <Link
            href="/run"
            className="inline-flex min-h-[44px] items-center rounded-xl bg-primary px-5 text-sm font-semibold text-white shadow-[0_6px_14px_rgba(46,139,255,0.28)] transition-colors hover:bg-primary-press"
          >
            Run the last-seat test
          </Link>
          <Link
            href="/runs"
            className="inline-flex min-h-[44px] items-center rounded-xl bg-secondary px-5 text-sm font-semibold text-ink transition-[filter] hover:brightness-95"
          >
            See a real proof
          </Link>
        </div>

        {/* Hero illustration: two browsers reach for one seat */}
        <div className="mx-auto mt-8 grid max-w-[640px] grid-cols-[1fr_auto_1fr] items-center gap-3 p-2">
          <BrowserCard name="Alice" tilt="-3deg" />
          <div className="rounded-2xl border-2 border-waiting bg-card px-4 py-3.5 text-center shadow-[0_12px_30px_rgba(245,185,59,0.20)]">
            <div className="font-mono text-[0.6rem] uppercase tracking-[0.06em] text-muted">
              Final seat
            </div>
            <div className="text-2xl font-extrabold text-ink">1</div>
            <div className="text-xs font-bold text-amber-strong">1 left</div>
          </div>
          <BrowserCard name="Bob" tilt="3deg" />
        </div>
        <p className="mt-2 text-sm text-muted">
          Both click at once. Only one should win.
        </p>
      </section>

      {/* Runs on */}
      <section className="px-2 pb-10 pt-2">
        <div className="flex flex-wrap items-center justify-center gap-x-7 gap-y-3">
          <span className="font-mono text-[0.62rem] uppercase tracking-[0.1em] text-muted">
            Runs on
          </span>
          <span className="text-base font-extrabold tracking-tight text-ink">
            Kane
          </span>
          <span className="text-base font-extrabold tracking-tight text-ink">
            Neon
          </span>
          <span className="text-base font-extrabold tracking-tight text-ink">
            Vercel
          </span>
          <span className="text-base font-extrabold tracking-tight text-ink">
            Codex
          </span>
        </div>
      </section>

      {/* Problem */}
      <section className="px-2 py-12">
        <div className="mx-auto max-w-[760px] text-center">
          <h2 className="text-balance text-[clamp(1.6rem,4.5vw,2.4rem)] font-extrabold tracking-[-0.02em] text-ink">
            Your tests pass. Your users still collide.
          </h2>
          <p className="mx-auto mt-3 max-w-[54ch] text-muted">
            Single user tests never see it. The failure only shows up when two
            people act on the same thing at the same instant, and one shared
            record says yes to both.
          </p>
        </div>
        <div className="mx-auto mt-8 max-w-[440px] rounded-2xl border border-border bg-card p-5 shadow-[0_10px_26px_rgba(30,40,60,0.08)]">
          <div className="mb-3 flex items-center justify-between">
            <span className="font-mono text-xs text-muted">one seat</span>
            <span className="rounded-full bg-[#FDE7E2] px-3 py-1 font-mono text-xs font-bold text-collision">
              two winners
            </span>
          </div>
          <TrackRow name="Alice" bar="bg-collision" pill="won" tone="win" />
          <TrackRow name="Bob" bar="bg-collision" pill="won" tone="win" />
          <p className="mt-3 text-sm text-muted">
            One seat, two winners. That is the bug.
          </p>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="scroll-mt-20 px-2 py-12">
        <div className="mx-auto max-w-[760px] text-center">
          <h2 className="text-balance text-[clamp(1.6rem,4.5vw,2.4rem)] font-extrabold tracking-[-0.02em] text-ink">
            Four steps, two real browsers.
          </h2>
        </div>
        <div className="mx-auto mt-8 grid max-w-[920px] grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Step tile="bg-accent-purple" n="1" title="Arm" body="Two live browsers open the same action and wait." />
          <Step tile="bg-accent-sky" n="2" title="Release" body="Both fire at the exact same moment." />
          <Step tile="bg-accent-indigo" n="3" title="Check" body="We test the promise against the real database." />
          <Step tile="bg-waiting" n="4" title="Repair" body="A fix packet goes to your coding agent, then re-run." />
        </div>
      </section>

      {/* Features */}
      <section className="px-2 py-12">
        <div className="mx-auto grid max-w-[960px] grid-cols-1 gap-4 md:grid-cols-3">
          <FeatureCard
            tile="bg-accent-purple"
            glyph="◑"
            k="No simulations"
            title="Real browsers"
            body="Actual Chrome sessions, driven by Kane, not scripted mocks."
          />
          <FeatureCard
            tile="bg-accent-sky"
            glyph="◷"
            k="One source of truth"
            title="Real database"
            body="A shared Neon Postgres row and a real transaction decide the winner."
          />
          <FeatureCard
            tile="bg-accent-indigo"
            glyph="✦"
            k="When it breaks"
            title="A fix packet"
            body="A redacted, hashed task your agent can act on. Then prove the fix."
          />
        </div>
      </section>

      {/* Real world band with photo */}
      <section className="px-2 py-12">
        <div className="mx-auto grid max-w-[960px] items-center gap-8 md:grid-cols-2">
          <div>
            <h2 className="text-balance text-[clamp(1.5rem,4.5vw,2.2rem)] font-extrabold tracking-[-0.02em] text-ink">
              The last seat is everywhere.
            </h2>
            <p className="mt-3 text-muted">
              The final airplane seat. The last concert ticket. One promo code
              left. Each one is a race two users can break at the same instant.
              Collision Canary makes that race visible and proves who really
              wins.
            </p>
          </div>
          <figure className="m-0">
            <div className="relative aspect-[16/11] w-full overflow-hidden rounded-2xl border border-border shadow-[0_14px_40px_rgba(30,40,60,0.12)]">
              <Image
                src="https://images.unsplash.com/photo-1618765138214-465c0399fcf2"
                alt="A single empty seat beside an airplane window"
                fill
                sizes="(max-width:768px) 100vw, 480px"
                className="object-cover"
              />
            </div>
            <figcaption className="mt-2 font-mono text-[0.66rem] text-muted">
              Photo: Rudy Dong on Unsplash
            </figcaption>
          </figure>
        </div>
      </section>

      {/* Proof (real latest run) */}
      <section id="proof" className="scroll-mt-20 px-2 py-12">
        <div className="mx-auto max-w-[760px] text-center">
          <h2 className="text-balance text-[clamp(1.6rem,4.5vw,2.4rem)] font-extrabold tracking-[-0.02em] text-ink">
            Every run is a real record.
          </h2>
          <p className="mx-auto mt-3 max-w-[52ch] text-muted">
            No screenshots, no promises. This is the most recent proof, straight
            from the database.
          </p>
        </div>
        <div className="mx-auto mt-8 max-w-[560px]">
          {latest ? <RealProofCard run={latest} /> : <NoRunsYet />}
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-2 py-10">
        <div className="mx-auto max-w-[900px] rounded-[20px] bg-ink px-6 py-12 text-center text-white">
          <h2 className="text-[clamp(1.5rem,5vw,2.2rem)] font-extrabold tracking-[-0.02em]">
            See it collide, then watch it get fixed.
          </h2>
          <p className="mx-auto mt-2 max-w-[46ch] text-[#C9CDD4]">
            Run the last-seat test on a live app in under a minute.
          </p>
          <div className="mt-5 flex justify-center">
            <Link
              href="/run"
              className="inline-flex min-h-[44px] items-center rounded-xl bg-primary px-6 text-sm font-semibold text-white shadow-[0_6px_14px_rgba(46,139,255,0.28)] transition-colors hover:bg-primary-press"
            >
              Run the last-seat test
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mx-auto flex max-w-[1100px] flex-wrap items-center justify-between gap-4 px-2 py-8 text-sm text-muted">
        <span className="flex items-center gap-2 font-extrabold text-ink">
          <BeakMark />
          Collision Canary
        </span>
        <div className="flex flex-wrap items-center gap-4">
          <a href="#how-it-works" className="hover:text-ink">
            How it works
          </a>
          <a href="#proof" className="hover:text-ink">
            Proof
          </a>
          <Link href="/runs" className="hover:text-ink">
            Runs
          </Link>
          <span className="font-mono text-xs">MIT · 2026</span>
        </div>
      </footer>
    </main>
  );
}

function BeakMark() {
  return (
    <span
      aria-hidden
      className="relative inline-block h-[18px] w-[18px] rounded-[5px] bg-waiting"
    >
      <span className="absolute left-1 top-1 h-0 w-0 border-y-[5px] border-l-[8px] border-y-transparent border-l-ink" />
    </span>
  );
}

function BrowserCard({ name, tilt }: { name: string; tilt: string }) {
  return (
    <div
      className="rounded-2xl border border-border bg-card p-2.5 shadow-[0_10px_26px_rgba(30,40,60,0.10)]"
      style={{ transform: `rotate(${tilt})` }}
    >
      <div className="mb-2 flex gap-1">
        <span className="h-[7px] w-[7px] rounded-full bg-border" />
        <span className="h-[7px] w-[7px] rounded-full bg-border" />
        <span className="h-[7px] w-[7px] rounded-full bg-border" />
      </div>
      <div className="text-sm font-bold text-ink">{name}</div>
      <div className="text-xs text-muted">books the seat</div>
      <div className="mt-2 rounded-lg bg-primary px-2 py-1.5 text-center text-xs font-semibold text-white">
        Claim
      </div>
    </div>
  );
}

function TrackRow({
  name,
  bar,
  pill,
  tone,
}: {
  name: string;
  bar: string;
  pill: string;
  tone: "win" | "reject";
}) {
  return (
    <div className="my-1.5 flex items-center gap-2">
      <span className="w-12 font-mono text-xs text-ink">{name}</span>
      <span className={`h-1.5 flex-1 rounded-full ${bar}`} />
      <span
        className={
          tone === "win"
            ? "rounded-full bg-[#DEF6EC] px-2 py-0.5 font-mono text-[0.66rem] text-verified"
            : "rounded-full bg-secondary px-2 py-0.5 font-mono text-[0.66rem] text-muted"
        }
      >
        {pill}
      </span>
    </div>
  );
}

function Step({
  tile,
  n,
  title,
  body,
}: {
  tile: string;
  n: string;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-[0_8px_20px_rgba(30,40,60,0.05)]">
      <div
        className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl text-base font-extrabold text-white ${tile}`}
      >
        {n}
      </div>
      <h3 className="text-base font-bold text-ink">{title}</h3>
      <p className="mt-1 text-sm text-muted">{body}</p>
    </div>
  );
}

function FeatureCard({
  tile,
  glyph,
  k,
  title,
  body,
}: {
  tile: string;
  glyph: string;
  k: string;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-[0_10px_26px_rgba(30,40,60,0.07)]">
      <div
        className={`flex h-10 w-10 items-center justify-center rounded-xl text-lg text-white ${tile}`}
      >
        {glyph}
      </div>
      <div className="mt-3 text-sm text-muted">{k}</div>
      <div className="text-lg font-bold text-ink">{title}</div>
      <p className="mt-2 text-sm text-muted">{body}</p>
    </div>
  );
}

function RealProofCard({ run }: { run: RunListItem }) {
  const collided = run.verdict === "violated";
  const shortId = `run_${run.id.slice(0, 4).toUpperCase()}`;

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_12px_32px_rgba(30,40,60,0.08)]">
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-4">
        <span className="font-mono text-sm text-muted">{shortId}</span>
        <span
          className={
            collided
              ? "rounded-full bg-[#FDE7E2] px-3 py-1 font-mono text-xs font-bold text-collision"
              : "rounded-full bg-[#DEF6EC] px-3 py-1 font-mono text-xs font-bold text-verified"
          }
        >
          {collided ? "Collision found" : "Verified"}
        </span>
      </div>
      <div className="px-5 py-5">
        <dl className="grid grid-cols-2 gap-y-2 font-mono text-sm">
          <dt className="text-muted">Winners</dt>
          <dd
            className={`text-right ${collided ? "text-collision" : "text-verified"}`}
          >
            {run.successfulClaims ?? 0}
          </dd>
          <dt className="text-muted">Seats left</dt>
          <dd className="text-right text-ink">{run.finalRemaining ?? 0}</dd>
        </dl>
        <Link
          href={`/runs/${run.id}`}
          className="mt-4 inline-flex min-h-[44px] items-center rounded-xl bg-secondary px-4 text-sm font-semibold text-ink transition-[filter] hover:brightness-95"
        >
          See the full proof
        </Link>
      </div>
    </div>
  );
}

function NoRunsYet() {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-10 text-center">
      <p className="font-mono text-sm text-muted">
        No proofs yet. Be the first to run one.
      </p>
      <Link
        href="/run"
        className="mt-4 inline-flex min-h-[44px] items-center rounded-xl bg-primary px-5 text-sm font-semibold text-white shadow-[0_6px_14px_rgba(46,139,255,0.28)] transition-colors hover:bg-primary-press"
      >
        Run the last-seat test
      </Link>
    </div>
  );
}
