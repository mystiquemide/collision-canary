import type { Metadata } from "next";
import Link from "next/link";

import { ActorLab } from "./actor-lab";

export const metadata: Metadata = {
  title: "Actor lab · Collision Canary",
};

export default function LabPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[520px] flex-col items-center justify-center px-4 py-10">
      <Link
        href="/"
        className="mb-6 flex items-center gap-2 font-extrabold tracking-tight text-ink"
      >
        <span
          aria-hidden
          className="relative inline-block h-[18px] w-[18px] rounded-[5px] bg-waiting"
        >
          <span className="absolute left-1 top-1 h-0 w-0 border-y-[5px] border-l-[8px] border-y-transparent border-l-ink" />
        </span>
        Collision Canary
      </Link>
      <ActorLab />
    </main>
  );
}
