/**
 * Written by Thomas Conway.
 * NO SIGNAL — a bunker assistant for Hackyard Yard #6 (Offline).
 * Paints the "days since last online" plate and downloads it as a PNG.
 * The canvas is the preview and the file. Nothing is uploaded.
 */

import { quietCaption } from './time';

const WIDTH = 1200;
const HEIGHT = 675;

/** Draw the plate. Call after VT323 and Share Tech Mono have loaded. */
export function paintBadge(canvas: HTMLCanvasElement, days: number | null, now: Date): void {
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.fillStyle = '#140c06';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const glow = ctx.createRadialGradient(600, 300, 40, 600, 340, 620);
  glow.addColorStop(0, 'rgba(255, 176, 40, 0.18)');
  glow.addColorStop(1, 'rgba(0, 0, 0, 0.45)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  strokeRound(ctx, 36, 36, WIDTH - 72, HEIGHT - 72, 28, '#ffbf3c', 8);
  strokeRound(ctx, 54, 54, WIDTH - 108, HEIGHT - 108, 18, 'rgba(255, 191, 60, 0.4)', 2);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffbf3c';
  ctx.font = '54px VT323, monospace';
  ctx.fillText('NO SIGNAL', 88, 130);

  ctx.textAlign = 'right';
  ctx.font = '28px "Share Tech Mono", monospace';
  ctx.fillStyle = '#d7a35a';
  ctx.fillText('HY-6  ·  OFFLINE', WIDTH - 88, 124);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffe7bf';
  ctx.font = '250px VT323, monospace';
  const numeral = days == null ? '—' : String(days).padStart(2, '0');
  ctx.fillText(numeral, WIDTH / 2, 400);

  ctx.font = '32px "Share Tech Mono", monospace';
  ctx.fillStyle = '#ffbf3c';
  ctx.fillText('DAYS SINCE LAST ONLINE', WIDTH / 2, 460);
  ctx.fillText(quietCaption(days), WIDTH / 2, 510);

  ctx.font = '24px "Share Tech Mono", monospace';
  ctx.fillStyle = '#a87830';
  const stamped = now
    .toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    })
    .toUpperCase();
  ctx.textAlign = 'left';
  ctx.fillText(`STAMPED  ${stamped}`, 88, 590);
  ctx.textAlign = 'right';
  ctx.fillText('ON DEVICE ONLY', WIDTH - 88, 590);

  // Phosphor scanlines, drawn last so they sit on the glass.
  ctx.fillStyle = 'rgba(0, 0, 0, 0.16)';
  for (let y = 28; y < HEIGHT - 28; y += 4) {
    ctx.fillRect(28, y, WIDTH - 56, 1);
  }
}

/** Download whatever is currently painted. */
export function downloadBadge(canvas: HTMLCanvasElement, days: number | null): void {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `no-signal-days-${days == null ? 'unknown' : String(days)}.png`;
    link.click();
    URL.revokeObjectURL(url);
  }, 'image/png');
}

function strokeRound(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  color: string,
  line: number,
): void {
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = line;
  ctx.roundRect(x, y, width, height, radius);
  ctx.stroke();
}
