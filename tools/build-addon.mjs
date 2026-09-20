// Concatenates the add-on sources into dist/jellyflix-addon.user.js.
//
// Bundle order — addons/header.js (the userscript metadata block), then one shared IIFE holding
// addons/core/*.js, addons/mods/*.js and addons/90-boot.js, each sorted by file name. Core files
// build the JFX namespace, module files call JFX.register(), and the boot file calls JFX.start().
//
// Three substitutions happen on the way:
//   __VERSION__                 -> the version from package.json
//   __BUILD__                   -> a 12-hex content hash of the assembled sources. addons/core/
//                                  00-namespace.js compares it against a copy that is already
//                                  running, which is the only way to tell "the very same file was
//                                  injected twice" (stand down) from "this is an upgrade" (take
//                                  over). A version string cannot: during development both copies
//                                  are 1.0.0.
//   '@@css:mods/foo.css@@'      -> the contents of addons/mods/foo.css as a JS string literal,
//                                  so a module's baseline stylesheet can be authored as real CSS
//                                  (editor highlighting, no escaping) and still ship inline.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const addonsDir = join(root, 'addons');
const distDir = join(root, 'dist');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

const read = (...parts) => readFileSync(join(addonsDir, ...parts), 'utf8').replace(/\r\n/g, '\n');
const listJs = dir => existsSync(join(addonsDir, dir))
    ? readdirSync(join(addonsDir, dir)).filter(f => f.endsWith('.js')).sort().map(f => `${dir}/${f}`)
    : [];

const arg = (name, def) => {
    const i = process.argv.indexOf(`--${name}`);
    return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : def;
};

/* A bundle is the core plus a chosen set of modules. 'all' is the complete userscript; a plugin
 * builds its own, carrying only the modules it owns. The name matters at runtime: two bundles with
 * DIFFERENT names share one framework (the second joins the first), two with the SAME name are the
 * same plugin and the newer build replaces the older. See core/00-namespace.js. */
const bundleName = arg('bundle', 'all');
const modFilter = arg('mods', '');
const outPath = arg('out', 'dist/jellyflix-addon.user.js');

const coreFiles = listJs('core');
const namespaceFile = coreFiles.shift();          // 00-namespace.js decides whether the rest runs
const modFiles = listJs('mods').filter(f =>
    !modFilter || modFilter.split(',').some(prefix => f.includes(prefix.trim())));
if (modFilter && !modFiles.length) throw new Error(`--mods ${modFilter} matched no file in addons/mods/`);

const files = [namespaceFile, ...coreFiles, ...modFiles, '90-boot.js'];

// A stylesheet becomes an array of one-line literals rather than one giant escaped string, so the
// built userscript stays readable (and diffable) when someone opens it in Tampermonkey.
function cssLiteral(css) {
    const lines = css.replace(/\r\n/g, '\n').replace(/\s+$/, '').split('\n');
    return '[\n' + lines.map(l => `        ${JSON.stringify(l)}`).join(',\n') + "\n    ].join('\\n')";
}

const inlined = [];
function substitute(source, label) {
    return source.replace(/'@@css:([^']+)@@'/g, (_, rel) => {
        const path = join(addonsDir, rel);
        if (!existsSync(path)) throw new Error(`${label}: @@css:${rel}@@ does not exist`);
        inlined.push(rel);
        return cssLiteral(readFileSync(path, 'utf8'));
    });
}

const section = f => `/* ==== ${f} ==== */\n${substitute(read(f), f).trim()}\n`;

/* core/10-* … core/50-* are skipped wholesale when this bundle is joining a framework another
 * bundle already installed. Without this guard the joining copy would re-assign JFX.util,
 * JFX.api and JFX.player on the SHARED object — handing the running modules a brand-new player
 * that nobody is subscribed to, which is exactly as broken as it sounds. See JFX_JOINED in
 * core/00-namespace.js. */
const body = [
    section(namespaceFile),
    'if (!JFX_JOINED) {',
    coreFiles.map(section).join('\n'),
    '}',
    modFiles.map(section).join('\n'),
    section('90-boot.js')
].join('\n');

const header = substitute(read('header.js'), 'header.js').trim()
    .replace(/__VERSION__/g, pkg.version);

// Hashed BEFORE __BUILD__ is substituted, or the value would depend on itself.
const build = createHash('sha256').update(pkg.version + '\n' + header + '\n' + body).digest('hex').slice(0, 12);

const out = [
    header,
    '',
    `/*! Generated from addons/ (${files.length} modules, ${inlined.length} stylesheets). Build ${build}.`,
    ' *  Do not edit this file — edit addons/**.js and run `npm run build`. */',
    '(function () {',
    "'use strict';",
    '',
    body.replace(/__VERSION__/g, pkg.version).replace(/__BUILD__/g, build).replace(/__BUNDLE__/g, bundleName),
    '})();',
    ''
].join('\n');

const leftover = out.match(/@@css:[^@]+@@/g);
if (leftover) throw new Error(`unresolved placeholders: ${leftover.join(', ')}`);

const target = join(root, outPath);
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, out);
console.log(`${outPath}: bundle "${bundleName}", ${modFiles.length} module(s)`
    + ` [${modFiles.map(f => f.replace('mods/', '')).join(', ')}], build ${build}, ${(out.length / 1024).toFixed(1)} KiB`);
