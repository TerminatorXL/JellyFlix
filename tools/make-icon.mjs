// Draws the plugin icons that Jellyfin shows in its plugin list, and writes them as PNGs.
//
//   node tools/make-icon.mjs [--size 360]     (--size is the HEIGHT; width follows at 16:9)
//
// Why hand-rolled: an icon here is a few rectangles, and Node ships zlib, so a PNG encoder is about
// forty lines — cheaper than a dependency, and it means `npm run build:plugin` reproduces the exact
// same bytes every time. Same reasoning as the ZIP writer in build-plugin.mjs.
//
// Jellyfin draws these into a LANDSCAPE card and crops to fill, so they are 16:9 and full bleed —
// a square tile came out cropped top and bottom. Shapes are deliberately blunt: one idea per icon,
// no gradients to mush at card size.
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (name, def) => {
    const i = process.argv.indexOf(`--${name}`);
    return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : def;
};
const HEIGHT = parseInt(arg('size', '360'), 10);
const WIDTH = Math.round(HEIGHT * 16 / 9);   // Jellyfin's plugin card is landscape and crops to fill

/* --------------------------------------------------------------------------- canvas */

const BG = [16, 16, 16];
const ACCENT = [229, 9, 20];          // the JellyFlix red
const TEXT = [255, 255, 255];
const MUTED = [150, 150, 150];

function canvas(w, h) {
    return { w, h, px: new Uint8Array(w * h * 4) };
}

function blend(c, x, y, [r, g, b], alpha) {
    if (x < 0 || y < 0 || x >= c.w || y >= c.h || alpha <= 0) return;
    const i = (y * c.w + x) * 4;
    const a = Math.min(1, alpha);
    c.px[i] = Math.round(c.px[i] * (1 - a) + r * a);
    c.px[i + 1] = Math.round(c.px[i + 1] * (1 - a) + g * a);
    c.px[i + 2] = Math.round(c.px[i + 2] * (1 - a) + b * a);
    c.px[i + 3] = Math.round(c.px[i + 3] * (1 - a) + 255 * a);
}

/** A rounded rectangle, anti-aliased by sampling the corner distance. */
function roundRect(c, x, y, w, h, radius, colour, alpha = 1) {
    for (let py = Math.floor(y); py < Math.ceil(y + h); py++) {
        for (let px = Math.floor(x); px < Math.ceil(x + w); px++) {
            // Distance outside the rounded shape, in pixels; 0 inside, ~1 at the edge.
            const dx = Math.max(x + radius - px - 0.5, 0, px + 0.5 - (x + w - radius));
            const dy = Math.max(y + radius - py - 0.5, 0, py + 0.5 - (y + h - radius));
            const d = Math.sqrt(dx * dx + dy * dy) - radius;
            const cover = d <= -0.5 ? 1 : d >= 0.5 ? 0 : 0.5 - d;
            blend(c, px, py, colour, alpha * cover);
        }
    }
}

/* ---------------------------------------------------------------------------- icons */

/** Pause Info Card: the pause glyph, with the card's lines of text beside it. */
function pauseInfoCard(w, h) {
    const c = canvas(w, h);
    const u = h / 100;                                     // units are percent of the icon's height
    roundRect(c, 0, 0, w, h, 0, BG);                       // full bleed: Jellyfin rounds the card itself

    // Two pause bars on the left.
    roundRect(c, 14 * u, 25 * u, 11 * u, 50 * u, 2.5 * u, ACCENT);
    roundRect(c, 31 * u, 25 * u, 11 * u, 50 * u, 2.5 * u, ACCENT);

    // The synopsis beside them: one strong line, two quieter.
    roundRect(c, 56 * u, 32 * u, 62 * u, 8 * u, 4 * u, TEXT);
    roundRect(c, 56 * u, 48 * u, 86 * u, 6 * u, 3 * u, MUTED, 0.75);
    roundRect(c, 56 * u, 60 * u, 70 * u, 6 * u, 3 * u, MUTED, 0.55);
    return c;
}

/** Episode Picker: a list of episodes, thumbnail plus lines, the current one picked out. */
function episodePicker(w, h) {
    const c = canvas(w, h);
    const u = h / 100;
    roundRect(c, 0, 0, w, h, 0, BG);

    [10, 38, 66].forEach((top, i) => {
        const current = i === 1;
        if (current) roundRect(c, 12 * u, (top - 3) * u, 152 * u, 30 * u, 4 * u, [255, 255, 255], 0.12);
        roundRect(c, 18 * u, top * u, 40 * u, 24 * u, 3 * u, current ? ACCENT : MUTED, current ? 1 : 0.5);
        roundRect(c, 66 * u, (top + 3) * u, 62 * u, 7 * u, 3.5 * u, TEXT, current ? 1 : 0.75);
        roundRect(c, 66 * u, (top + 14) * u, 40 * u, 5 * u, 2.5 * u, MUTED, 0.6);
    });
    return c;
}

/* ------------------------------------------------------------------------ PNG encode */

const CRC_TABLE = (() => {
    const t = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        t[n] = c;
    }
    return t;
})();

function crc32(buf) {
    let c = -1;
    for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ -1) >>> 0;
}

function chunk(type, data) {
    const out = Buffer.alloc(8 + data.length + 4);
    out.writeUInt32BE(data.length, 0);
    out.write(type, 4, 'ascii');
    data.copy(out, 8);
    const crcInput = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    out.writeUInt32BE(crc32(crcInput), 8 + data.length);
    return out;
}

function png(c) {
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(c.w, 0);
    ihdr.writeUInt32BE(c.h, 4);
    ihdr[8] = 8;        // bit depth
    ihdr[9] = 6;        // colour type: RGBA
    ihdr[10] = 0;       // deflate
    ihdr[11] = 0;       // adaptive filtering
    ihdr[12] = 0;       // no interlace

    // Every scanline is prefixed with its filter byte; 0 means "none", which compresses fine here.
    const raw = Buffer.alloc(c.h * (c.w * 4 + 1));
    for (let y = 0; y < c.h; y++) {
        const at = y * (c.w * 4 + 1);
        raw[at] = 0;
        Buffer.from(c.px.buffer, y * c.w * 4, c.w * 4).copy(raw, at + 1);
    }

    return Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        chunk('IHDR', ihdr),
        chunk('IDAT', deflateSync(raw, { level: 9 })),
        chunk('IEND', Buffer.alloc(0))
    ]);
}

/* ------------------------------------------------------------------------------ main */

const ICONS = {
    'pause-info-card': pauseInfoCard,
    'episode-picker': episodePicker
};

const outDir = join(root, 'dist', 'plugin');
mkdirSync(outDir, { recursive: true });
for (const [slug, draw] of Object.entries(ICONS)) {
    const file = join(outDir, `${slug}.png`);
    const buf = png(draw(WIDTH, HEIGHT));
    writeFileSync(file, buf);
    console.log(`dist/plugin/${slug}.png: ${WIDTH}x${HEIGHT}, ${(buf.length / 1024).toFixed(1)} KiB`);
}
