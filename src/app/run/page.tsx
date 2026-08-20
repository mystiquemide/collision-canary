import type { Metadata } from "next";

import { AppHeader } from "@/app/_components/app-header";
import { RunLauncher } from "./run-launcher";

export const metadata: Metadata = {
  title: "New run · Collision Canary",
};

export default function RunPage() {
  return (
    <main className="mx-auto w-full max-w-[1200px] px-4 pb-16">
      <AppHeader active="run" />
      <section id="main" tabIndex={-1} className="mx-auto mt-10 max-w-[640px]">
        <h1 className="text-[clamp(1.6rem,4.5vw,2.2rem)] font-extrabold tracking-[-0.02em] text-ink">
          Start a paired run
        </h1>
        <p className="mb-6 mt-2 text-muted">
          Two browsers, one shared seat. We check that only one can win.
        </p>
        <RunLauncher />
      </section>
    </main>
  );
}
