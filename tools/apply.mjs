// Uploads dist/jellyflix.css into the test server's Branding > Custom CSS
// (the same place an admin would paste it: Dashboard > General > Custom CSS).
// Usage: node tools/apply.mjs [path/to/file.css] [--clear]
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.JF_URL || 'http://localhost:8096';
const TOKEN = process.env.JF_TOKEN || readFileSync(join(root, '_test', 'token.txt'), 'utf8').trim();
const auth = { Authorization: `MediaBrowser Token="${TOKEN}"` };

const clear = process.argv.includes('--clear');
const file = process.argv.slice(2).find(a => !a.startsWith('--')) || join(root, 'dist', 'jellyflix.css');
const css = clear ? '' : readFileSync(file, 'utf8');

const branding = await (await fetch(`${BASE}/System/Configuration/branding`, { headers: auth })).json();
branding.CustomCss = css;
const res = await fetch(`${BASE}/System/Configuration/branding`, {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify(branding)
});
if (!res.ok) {
    console.error('Failed to update branding:', res.status, await res.text());
    process.exit(1);
}
console.log(clear ? 'Custom CSS cleared.' : `Custom CSS applied (${(css.length / 1024).toFixed(1)} KiB) from ${file}`);
