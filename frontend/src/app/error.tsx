"use client";
import Link from "next/link";
import { useEffect } from "react";

export default function PageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div className="panel p-6 max-w-xl mt-8">
      <h1 className="text-2xl">This page stopped working</h1>
      <p className="small mt-3">Something in the page failed while drawing. Your search is still in the address bar, so trying again usually brings it back.</p>
      <div className="flex gap-2 mt-4">
        <button className="btn btn-primary" onClick={reset}>Try again</button>
        <Link className="btn" href="/">Go to the start page</Link>
      </div>
      {error.digest && <p className="note mt-4">Reference: {error.digest}</p>}
    </div>
  );
}
