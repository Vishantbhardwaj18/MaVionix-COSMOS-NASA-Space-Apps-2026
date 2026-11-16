"""Live data-access verification. Run this FIRST on a machine with internet:

    cd backend && python scripts/verify_irsa.py [ra dec]

It checks, in order: (1) IRSA SIA answers and which SPHEREx collections it
serves, (2) a position query returns epochs, (3) one cutout downloads and
parses with every documented HDU, (4) JPL SBIdent and SBDB respond.
Any failure prints the exact URL so you can open it in a browser.
"""
import sys
import time

sys.path.insert(0, ".")
from app.config import settings  # noqa: E402
from app.core.irsa import irsa  # noqa: E402
from app.core.fits_tools import load_spectral_image  # noqa: E402
from app.science import jpl  # noqa: E402

ra, dec = (float(sys.argv[1]), float(sys.argv[2])) if len(sys.argv) == 3 else (270.0, 66.56)
ok = True

print(f"[1] SIA endpoint: {settings.irsa_sia_url}")
cols = irsa().list_collections()
print("    collections to try:", cols)

print(f"[2] Querying epochs at RA={ra} Dec={dec} ...")
t0 = time.time()
try:
    eps = irsa().query_epochs(ra, dec, 0.05)
    print(f"    {len(eps)} epochs in {time.time()-t0:.1f}s")
    for w in irsa().last_warnings:
        print("    WARNING:", w)
    if not eps:
        ok = False
        print("    FAILED: the archive answered but listed no images here.")
        print("    Check the release names in COSMOS_SPHEREX_COLLECTIONS against")
        print("    https://irsa.ipac.caltech.edu/data/SPHEREx/docs/ and open this in a browser:")
        print("   ", f"{settings.irsa_sia_url}?COLLECTION={cols[0]}&POS=circle+{ra}+{dec}+0.05")
    for e in eps[:5]:
        print("     ", e.date_iso, "D", e.detector, e.collection, e.access_url[:90])
except Exception as exc:
    ok = False
    print("    FAILED:", exc)
    print("    Try in a browser:", f"{settings.irsa_sia_url}?COLLECTION={cols[0]}&POS=circle+{ra}+{dec}+0.05")
    eps = []

if eps:
    print("[3] Fetching one cutout ...")
    try:
        data = irsa().fetch_cutout(eps[0].access_url, ra, dec, 300)
        si = load_spectral_image(data)
        print(f"    {len(data)/1e6:.1f} MB, shape {si.shape}, detector {si.detector}, mjd {si.mjd}")
        print("    flags:", si.flags is not None, "variance:", si.variance is not None,
              "zodi:", si.zodi is not None, "wave:", si.wave is not None, "notes:", si.notes)
        print("    wavelength at centre:", si.wavelength_at(si.shape[1] / 2, si.shape[0] / 2))
    except Exception as exc:
        ok = False
        print("    FAILED:", exc)
        print("    If the cutout URL pattern differs, open the access_url above in a browser and read the")
        print("    IBE cutout documentation: https://irsa.ipac.caltech.edu/ibe/cutouts.html")

print("[4] JPL SBIdent ...")
try:
    k = jpl.sbident(ra, dec, 60800.0, 0.1)
    print(f"    {len(k)} known bodies predicted in a 0.2 deg box")
except Exception as exc:
    ok = False
    print("    FAILED:", exc)
print("[5] JPL SBDB TNOs ...")
try:
    t = jpl.tno_elements(150)
    print(f"    {len(t)} TNOs with a > 150 AU; e.g. {t[0]['name'] if t else '-'}")
except Exception as exc:
    ok = False
    print("    FAILED:", exc)

print("\nRESULT:", "ALL LIVE CHECKS PASSED - the site will show real SPHEREx data from this machine."
      if ok else "SOME CHECKS FAILED - see above. Until they pass, the site shows the labelled synthetic sample.")
sys.exit(0 if ok else 1)
