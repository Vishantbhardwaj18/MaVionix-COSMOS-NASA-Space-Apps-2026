# Putting COSMOS online

The site is two services: the API (`backend/`, Python) and the website (`frontend/`, Node). The
website forwards `/api/*` to the API, so visitors only ever talk to one address and no CORS setup
is needed. The website finds the API through one runtime setting, `COSMOS_API_URL`.

Whatever host you use, do these three things after the first deploy:

1. Open `https://<your-site>/api/status`. `"serving": "spherex"` means the server can reach IRSA.
   `"serving": "synthetic"` means it cannot, and visitors will see the labelled sample.
2. Open the north ecliptic pole field once so its cutouts are cached.
3. Set `NEXT_PUBLIC_SITE_URL` to the public address so link previews work, then rebuild the website.

## One machine with Docker

```bash
git clone <your-repository> && cd mavionix-cosmos
docker compose up --build -d
```

The website is on port 3000 and the API docs on port 8000. Put a reverse proxy with HTTPS (Caddy,
nginx, or a tunnel) in front of port 3000. Port 8000 does not need to be public; remove its `ports`
line in `docker-compose.yml` if you like.

Warm the cache for the showcase fields so the first visitor does not wait:

```bash
for f in "ra=270&dec=66.56" "ra=90&dec=-66.56" "ra=45&dec=15" "ra=86&dec=28.9"; do
  curl -s "http://localhost:3000/api/sky/epochs?$f" > /dev/null
done
```

## Render

`render.yaml` describes both services. In Render choose New, then Blueprint, and pick the
repository. This blueprint has not been run end to end by us, so check both services after the
first deploy: the website's `COSMOS_API_URL` should hold the API service's internal address. Free
instances sleep when idle, which makes the first request slow, and have no persistent disk, so the
cutout cache is lost on restart. Add a disk mounted at `/cache` on a paid plan to keep it.

## Website on Vercel, API elsewhere

1. Deploy `backend/` as a Docker service on any host (Render, Railway, Fly, a VM).
2. Import `frontend/` into Vercel and set `COSMOS_API_URL=https://<your-api-address>`.
3. Serverless functions have short time limits, and a field seen for the first time can take up
   to a minute. If first lookups time out, bypass the proxy: set
   `NEXT_PUBLIC_API_URL=https://<your-api-address>` on Vercel and
   `COSMOS_CORS_ORIGINS=https://<your-site-address>` on the API, then redeploy both.

## A stand with no internet

`./run.sh demo` or `COSMOS_MODE=demo docker compose up`. Every screen works and is labelled as
sample data.

To show real data without a connection, visit your fields while online with a persistent cache
directory, then go offline with `COSMOS_ALLOW_SYNTHETIC_FALLBACK=false`. Cached cutouts are reused,
but the list of visits is still requested from IRSA each time the server restarts, so keep the
server running between warming and showing.

## Running it responsibly

- The API identifies itself to IRSA with a descriptive User-Agent, downloads at most four cutouts
  at a time, and caches every cutout on disk. JPL orbit tables are cached for 24 hours.
- Each client is limited to 120 data requests a minute (`COSMOS_RATE_LIMIT_PER_MIN`). The limit is
  kept in memory per worker process; put a real rate limiter in your reverse proxy for a busy site.
- Behind a proxy, the API trusts `X-Forwarded-For` to tell clients apart. Do not expose port 8000
  directly to the internet in that setup.
- Clear old cutouts when the disk fills: `find /cache -name '*.fits' -mtime +14 -delete`.
- Logs carry a request id that is also returned in the `X-Request-ID` header, so a visitor's error
  report can be matched to a log line.
