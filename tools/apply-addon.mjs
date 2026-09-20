// Uploads dist/jellyflix-addon.user.js into the server's JavaScript Injector plugin — the same place
// an admin would paste it (Dashboard > Plugins > JavaScript Injector > the script's textarea).
//
//   node tools/apply-addon.mjs [--name "JellyFlix add-on"] [--private] [--disable] [--remove]
//   tools/pw.sh tools/apply-addon.mjs              # from inside the Docker network
//   JF_URL=https://server JF_TOKEN=xxx node tools/apply-addon.mjs
//
//   --private   mark the entry as requiring authentication: the plugin then serves it from
//               /JavaScriptInjector/private.js, fetched through ApiClient after login, instead of
//               the public bundle loaded with <script defer>
//   --disable   upload it but leave it switched off
//   --remove    delete the entry instead of uploading
//
// Saving this configuration makes Jellyfin restart. Other scripts in the plugin are left alone.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const PLUGIN_ID = 'f5a34f7b2e8a4e6aa7223a216a81b374';      // JavaScript Injector
const BASE = process.env.JF_URL || 'http://localhost:8096';
const TOKEN = process.env.JF_TOKEN || readFileSync(join(root, '_test', 'token.txt'), 'utf8').trim();
const auth = { Authorization: `MediaBrowser Token="${TOKEN}"` };

const arg = (name, def) => {
    const i = process.argv.indexOf(`--${name}`);
    return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : def;
};
const flag = name => process.argv.includes(`--${name}`);

const name = arg('name', 'JellyFlix add-on');
const remove = flag('remove');
const script = remove ? '' : readFileSync(join(root, 'dist', 'jellyflix-addon.user.js'), 'utf8');

const configUrl = `${BASE}/Plugins/${PLUGIN_ID}/Configuration`;
const res = await fetch(configUrl, { headers: auth });
if (!res.ok) {
    console.error(`Cannot read the plugin config (${res.status}). Is "JavaScript Injector" installed?`);
    console.error(`Repository: https://raw.githubusercontent.com/n00bcodr/jellyfin-plugins/main/12/manifest.json`);
    process.exit(1);
}
const config = await res.json();
const scripts = (config.CustomJavaScripts || []).filter(s => s.Name !== name);

if (!remove) {
    scripts.push({
        Name: name,
        Script: script,
        Enabled: !flag('disable'),
        RequiresAuthentication: flag('private')
    });
}
config.CustomJavaScripts = scripts;

const post = await fetch(configUrl, {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify(config)
});
if (!post.ok) {
    console.error('Failed to update the plugin config:', post.status, await post.text());
    process.exit(1);
}
console.log(remove
    ? `Removed "${name}" from JavaScript Injector. ${scripts.length} script(s) left.`
    : `Uploaded "${name}" (${(script.length / 1024).toFixed(1)} KiB, ${flag('private') ? 'private' : 'public'}`
      + `${flag('disable') ? ', disabled' : ''}). The server is restarting.`);
