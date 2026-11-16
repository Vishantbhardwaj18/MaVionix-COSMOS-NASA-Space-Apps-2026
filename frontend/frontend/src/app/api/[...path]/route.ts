// Same-origin proxy to the COSMOS API.
// The browser only ever talks to this site, so there is no CORS setup and the API address is a
// runtime setting (COSMOS_API_URL) instead of something baked into the JavaScript bundle.
import type { NextRequest } from "next/server";

const RAW = (process.env.COSMOS_API_URL ?? "http://localhost:8000").replace(/\/+$/, "");
const UPSTREAM = /^https?:\/\//.test(RAW) ? RAW : `http://${RAW}`;   // accept a bare host:port
const PASS = ["content-type", "content-disposition", "cache-control", "retry-after", "x-request-id"];

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const url = `${UPSTREAM}/api/${path.map(encodeURIComponent).join("/")}${req.nextUrl.search}`;
  try {
    const r = await fetch(url, {
      headers: { "x-forwarded-for": req.headers.get("x-forwarded-for") ?? "", accept: req.headers.get("accept") ?? "*/*" },
      cache: "no-store",
      signal: AbortSignal.timeout(180_000), // first look at a field downloads every cutout from IRSA
    });
    const headers = new Headers();
    for (const h of PASS) { const v = r.headers.get(h); if (v) headers.set(h, v); }
    return new Response(r.body, { status: r.status, headers });
  } catch (e) {
    const timedOut = e instanceof Error && e.name === "TimeoutError";
    return Response.json(
      { detail: timedOut ? "The data server took too long to answer. Try again; results are cached once fetched."
                         : "The data server is not running or cannot be reached. Start the API, then reload." },
      { status: timedOut ? 504 : 502 },
    );
  }
}
