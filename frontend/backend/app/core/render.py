"""Turn calibrated images into display PNGs (asinh stretch) and reproject
one epoch onto another's pixel grid for differencing."""
from __future__ import annotations

import base64
import io

import numpy as np
from PIL import Image
from scipy.ndimage import map_coordinates

from .fits_tools import SpectralImage


def asinh_stretch(img: np.ndarray, lo_pct: float = 1.0, hi_pct: float = 99.5, a: float = 0.1) -> np.ndarray:
    finite = np.isfinite(img)
    if not finite.any():
        return np.zeros(img.shape, dtype=np.uint8)
    lo, hi = np.percentile(img[finite], [lo_pct, hi_pct])
    if hi <= lo:
        hi = lo + 1e-6
    x = np.clip((img - lo) / (hi - lo), 0, 1)
    y = np.arcsinh(x / a) / np.arcsinh(1 / a)
    y[~finite] = 0
    return (y * 255).astype(np.uint8)


def diverging_stretch(diff: np.ndarray, sigma: float, span: float = 5.0) -> np.ndarray:
    """Map a difference image to an RGB diverging ramp (blue negative, red positive)."""
    x = np.clip(diff / (span * sigma), -1, 1)
    x[~np.isfinite(x)] = 0
    r = np.clip(1 + x, 0, 1)
    b = np.clip(1 - x, 0, 1)
    g = 1 - np.abs(x)
    rgb = np.stack([r, g, b], axis=-1)
    return (rgb * 255).astype(np.uint8)


def to_png_b64(arr: np.ndarray, upscale: int = 1) -> str:
    im = Image.fromarray(np.flipud(arr))  # FITS origin is bottom-left
    if upscale > 1:
        im = im.resize((im.width * upscale, im.height * upscale), Image.NEAREST)
    buf = io.BytesIO()
    im.save(buf, format="PNG", optimize=True)
    return base64.b64encode(buf.getvalue()).decode()


def reproject_to(src: SpectralImage, src_img: np.ndarray, ref: SpectralImage) -> np.ndarray:
    """Bilinear reprojection of `src_img` (on src.wcs) onto ref.wcs grid.

    Uses the full WCS (no small-angle approximation). Pixels outside the source
    footprint become NaN so they are excluded from differencing.
    """
    ny, nx = ref.shape
    yy, xx = np.mgrid[0:ny, 0:nx]
    world = ref.wcs.pixel_to_world(xx.ravel(), yy.ravel())
    sx, sy = src.wcs.world_to_pixel(world)
    coords = np.vstack([sy, sx])
    out = map_coordinates(np.nan_to_num(src_img), coords, order=1, mode="constant", cval=np.nan)
    return out.reshape(ny, nx)
