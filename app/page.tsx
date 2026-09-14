"use client";

import { useEffect } from "react";

export default function Home() {
  useEffect(() => {
    window.location.href = "http://localhost:5173";
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">
      <div className="max-w-xl text-center">
        <p className="mb-3 text-sm uppercase tracking-[0.25em] text-violet-300">Species Creator</p>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Redirecting to the creator…</h1>
        <p className="mt-4 text-lg text-slate-300">
          The real editor lives in the CharacterStudio app. If you are not redirected automatically,
          open the app at <a href="http://localhost:5173" className="text-violet-300 underline">localhost:5173</a>.
        </p>
      </div>
    </main>
  );
}
