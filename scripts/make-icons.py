#!/usr/bin/env python3
"""Written by Thomas Conway.
Draws the NO SIGNAL icons: amber signal bars with the carrier crossed out.
The mark sits inside the central 80% so a maskable icon keeps its corners.
"""

import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "icons"


def chunk(tag: bytes, data: bytes) -> bytes:
    return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)


def write_png(path: Path, size: int) -> None:
    rows = bytearray()
    for y in range(size):
        rows.append(0)
        for x in range(size):
            rows.extend(pixel(x, y, size))
    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(bytes(rows), 9))
    png += chunk(b"IEND", b"")
    path.write_bytes(png)


def pixel(x: int, y: int, size: int) -> tuple[int, int, int, int]:
    """Background, a faint phosphor disc, three bars, and a slash."""
    nx = x / (size - 1)
    ny = y / (size - 1)
    color = (20, 12, 6, 255)

    dx = nx - 0.5
    dy = ny - 0.52
    dist = (dx * dx + dy * dy) ** 0.5
    if 0.30 < dist < 0.335:
        color = (255, 191, 60, 255)

    bars = ((0.38, 0.62), (0.48, 0.48), (0.58, 0.34))
    for left, top in bars:
        if left <= nx <= left + 0.055 and top <= ny <= 0.70:
            color = (255, 191, 60, 255)

    # Line from (0.30, 0.74) to (0.72, 0.28).
    if near_segment(nx, ny, 0.30, 0.74, 0.72, 0.28, 0.018):
        color = (255, 90, 54, 255)
    return color


def near_segment(px: float, py: float, x1: float, y1: float, x2: float, y2: float, width: float) -> bool:
    vx, vy = x2 - x1, y2 - y1
    length = (vx * vx + vy * vy) ** 0.5 or 1
    t = max(0.0, min(1.0, ((px - x1) * vx + (py - y1) * vy) / (length * length)))
    qx, qy = x1 + t * vx, y1 + t * vy
    return ((px - qx) ** 2 + (py - qy) ** 2) ** 0.5 <= width


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    write_png(OUT / "icon-192.png", 192)
    write_png(OUT / "icon-512.png", 512)


if __name__ == "__main__":
    main()
