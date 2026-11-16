import Link from "next/link";

export default function NotFound() {
  return (
    <div className="panel p-6 max-w-xl mt-8">
      <h1 className="text-2xl">There is no page at this address</h1>
      <p className="small mt-3">The link may be mistyped or from an older version of this site. The viewer, the movers list, the spectrum tool and the Planet Nine page are all in the menu.</p>
      <div className="flex gap-2 mt-4">
        <Link className="btn btn-primary" href="/">Open the viewer</Link>
        <Link className="btn" href="/about">How it works</Link>
      </div>
    </div>
  );
}
