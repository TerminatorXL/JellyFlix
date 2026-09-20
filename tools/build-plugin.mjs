// Builds one of this repository's Jellyfin plugins and packages it the way the catalogue expects.
//
//   node tools/build-plugin.mjs [--plugin <slug>] [--version 1.0.0.0] [--no-build] [--base <url>]
//
// A plugin is a directory under plugins/ containing a plugin.json (guid, name, assembly, slug,
// targetAbi, the catalogue text) next to its C# project. Adding a second plugin means adding a
// directory — this script and manifest.json already handle any number of them, keyed by guid.
//
// Produces:
//   dist/plugin/<slug>_<version>.zip   the DLL + meta.json, which is what a server unpacks
//   manifest.json                      the repository file users paste into Jellyfin, one entry
//                                      per plugin, existing entries left alone
//
// The C# is compiled in the official .NET SDK container, so nothing has to be installed on the host
// beyond Docker — the same reason tools/pw.sh runs Playwright in a container. Jellyfin 12.1 targets
// net10.0, which is newer than most machines' SDK.
//
// Run `npm run build` first: the add-on bundle is embedded into the DLL as a resource, so the zip is
// only ever as fresh as dist/jellyflix-addon.user.js.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { deflateRawSync } from 'node:zlib';
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (name, def) => {
    const i = process.argv.indexOf(`--${name}`);
    return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : def;
};
const flag = name => process.argv.includes(`--${name}`);

const slug = arg('plugin', 'pause-info-card');
const pluginDir = join(root, 'plugins', slug);
if (!existsSync(join(pluginDir, 'plugin.json'))) {
    throw new Error(`plugins/${slug}/plugin.json not found — is --plugin right?`);
}
const info = JSON.parse(readFileSync(join(pluginDir, 'plugin.json'), 'utf8'));

const version = arg('version', '1.0.0.0');
/* The zip is committed under dist/plugin/, so raw.githubusercontent serves it the moment the repo is
 * pushed — no GitHub Release to cut, and "add this repository URL" works straight away. Point --base
 * at a releases URL instead if you would rather attach the zip to a tag. */
const releaseBase = arg('base', 'https://raw.githubusercontent.com/TerminatorXL/JellyFlix/main/dist/plugin');
const SDK_IMAGE = 'mcr.microsoft.com/dotnet/sdk:10.0';

const bundle = join(root, 'dist', 'jellyflix-addon.user.js');
if (!existsSync(bundle)) throw new Error('dist/jellyflix-addon.user.js is missing — run `npm run build` first');

/* ------------------------------------------------------------------ compile */

if (!flag('no-build')) {
    // -v needs a Windows-style path on Git Bash; `pwd -W` gives one, and MSYS_NO_PATHCONV stops the
    // shell from mangling the container-side path.
    const mount = process.platform === 'win32'
        ? execFileSync('cygpath', ['-w', root], { encoding: 'utf8' }).trim()
        : root;
    console.log(`Compiling in ${SDK_IMAGE} …`);
    execFileSync('docker', [
        'run', '--rm',
        '-v', `${mount}:/src`,
        '-w', `/src/plugins/${slug}`,
        '-e', 'DOTNET_CLI_TELEMETRY_OPTOUT=1',
        '-e', 'DOTNET_NOLOGO=1',
        SDK_IMAGE,
        'dotnet', 'build', '-c', 'Release', `-p:PluginVersion=${version}`
    ], { stdio: 'inherit', env: { ...process.env, MSYS_NO_PATHCONV: '1' } });
}

const dll = join(pluginDir, 'bin', 'Release', 'net10.0', `${info.assembly}.dll`);
if (!existsSync(dll)) throw new Error(`${dll} is missing — the build did not produce a DLL`);

/* ------------------------------------------------------------------ package */

const meta = {
    category: info.category,
    changelog: readFileSync(join(pluginDir, 'CHANGELOG.md'), 'utf8').trim(),
    description: info.description,
    guid: info.guid,
    name: info.name,
    overview: info.overview,
    owner: info.owner,
    targetAbi: info.targetAbi,
    timestamp: new Date().toISOString().replace(/\.\d+Z$/, '.0000000Z'),
    version,
    status: 'Active',
    autoUpdate: false,
    /* Relative to the plugin's own folder, so it resolves the same under Docker's /config and
     * a native install's /var/lib/jellyfin. The catalogue has no folder yet, so it uses the
     * manifest entry's imageUrl instead — both come from the same PNG. */
    imagePath: 'icon.png',
    assemblies: []
};

const iconPath = join(root, 'dist', 'plugin', info.slug + '.png');
if (!existsSync(iconPath)) throw new Error(iconPath + ' is missing — run node tools/make-icon.mjs');

/* A minimal ZIP writer: two deflated entries, no directories, no zip64. Node ships zlib but no zip,
 * and pulling a dependency in for 150 lines of well-specified format would be worse. */
const CRC_TABLE = (() => {
    const table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        table[n] = c;
    }
    return table;
})();

function crc32(buf) {
    let c = -1;
    for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ -1) >>> 0;
}

function zip(entries) {
    const chunks = [];
    const central = [];
    let offset = 0;

    for (const { name, data } of entries) {
        const nameBuf = Buffer.from(name, 'utf8');
        const deflated = deflateRawSync(data, { level: 9 });
        const crc = crc32(data);

        const local = Buffer.alloc(30);
        local.writeUInt32LE(0x04034b50, 0);
        local.writeUInt16LE(20, 4);            // version needed
        local.writeUInt16LE(0, 6);             // flags
        local.writeUInt16LE(8, 8);             // method: deflate
        local.writeUInt16LE(0, 10);            // time
        local.writeUInt16LE(0x2821, 12);       // date (2020-01-01, so the zip is reproducible)
        local.writeUInt32LE(crc, 14);
        local.writeUInt32LE(deflated.length, 18);
        local.writeUInt32LE(data.length, 22);
        local.writeUInt16LE(nameBuf.length, 26);
        local.writeUInt16LE(0, 28);
        chunks.push(local, nameBuf, deflated);

        const header = Buffer.alloc(46);
        header.writeUInt32LE(0x02014b50, 0);
        header.writeUInt16LE(20, 4);           // version made by
        header.writeUInt16LE(20, 6);           // version needed
        header.writeUInt16LE(0, 8);
        header.writeUInt16LE(8, 10);
        header.writeUInt16LE(0, 12);
        header.writeUInt16LE(0x2821, 14);
        header.writeUInt32LE(crc, 16);
        header.writeUInt32LE(deflated.length, 20);
        header.writeUInt32LE(data.length, 24);
        header.writeUInt16LE(nameBuf.length, 28);
        header.writeUInt32LE(0, 42);           // patched below: local header offset
        header.writeUInt32LE(offset, 42);
        central.push(header, nameBuf);

        offset += local.length + nameBuf.length + deflated.length;
    }

    const centralBuf = Buffer.concat(central);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(entries.length, 8);
    end.writeUInt16LE(entries.length, 10);
    end.writeUInt32LE(centralBuf.length, 12);
    end.writeUInt32LE(offset, 16);

    return Buffer.concat([...chunks, centralBuf, end]);
}

const zipBuf = zip([
    { name: `${info.assembly}.dll`, data: readFileSync(dll) },
    { name: 'icon.png', data: readFileSync(iconPath) },
    { name: 'meta.json', data: Buffer.from(JSON.stringify(meta, null, 2) + '\n', 'utf8') }
]);

const outDir = join(root, 'dist', 'plugin');
mkdirSync(outDir, { recursive: true });
const zipName = `${info.slug}_${version}.zip`;
const zipPath = join(outDir, zipName);
writeFileSync(zipPath, zipBuf);

/* Jellyfin verifies the download against an MD5 of the zip — not a security boundary, a corruption
 * check, which is why the algorithm is what it is. */
const checksum = createHash('md5').update(zipBuf).digest('hex');

/* ----------------------------------------------------------------- manifest */

const manifestPath = join(root, 'manifest.json');
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : [];
let entry = manifest.find(p => p.guid === info.guid);
if (!entry) {
    entry = { guid: info.guid, versions: [] };
    manifest.push(entry);
}
// The catalogue text lives in plugin.json, so a rename lands everywhere from one edit.
entry.name = meta.name;
entry.description = meta.description;
entry.overview = meta.overview;
entry.owner = meta.owner;
entry.category = meta.category;
entry.imageUrl = releaseBase + '/' + info.slug + '.png';
entry.versions = entry.versions.filter(v => v.version !== version);
entry.versions.unshift({
    version,
    changelog: meta.changelog,
    targetAbi: info.targetAbi,
    sourceUrl: `${releaseBase}/${zipName}`,
    checksum,
    timestamp: meta.timestamp
});
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

console.log(`dist/plugin/${zipName}: ${(statSync(zipPath).size / 1024).toFixed(1)} KiB, md5 ${checksum}`);
console.log(`manifest.json: ${meta.name} ${version} -> ${entry.versions[0].sourceUrl}`);
console.log(`manifest.json holds ${manifest.length} plugin(s): ${manifest.map(p => p.name).join(', ')}`);
