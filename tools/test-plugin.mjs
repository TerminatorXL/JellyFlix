// Runs a plugin's C# unit tests in the official .NET SDK container.
//
//   node tools/test-plugin.mjs [--plugin <slug>] [-- <extra dotnet test arguments>]
//
// A plugin has tests when tests/<slug>/ holds a test project. Same container, same reason as
// tools/build-plugin.mjs: Jellyfin 12.1 targets net10.0, which is newer than most machines' SDK.
// The NuGet cache lives in a named volume so only the first run pays for the restore.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const split = process.argv.indexOf('--', 2);
const own = split > -1 ? process.argv.slice(2, split) : process.argv.slice(2);
const extra = split > -1 ? process.argv.slice(split + 1) : [];
const arg = (name, def) => {
    const i = own.indexOf(`--${name}`);
    return i > -1 && own[i + 1] && !own[i + 1].startsWith('--') ? own[i + 1] : def;
};

const slug = arg('plugin', 'filmweb');
if (!existsSync(join(root, 'tests', slug))) {
    throw new Error(`tests/${slug}/ not found — is --plugin right?`);
}
const SDK_IMAGE = 'mcr.microsoft.com/dotnet/sdk:10.0';

const mount = process.platform === 'win32'
    ? execFileSync('cygpath', ['-w', root], { encoding: 'utf8' }).trim()
    : root;
try {
    execFileSync('docker', [
        'run', '--rm',
        '-v', `${mount}:/src`,
        '-v', 'jellyflix-nuget:/root/.nuget/packages',
        '-w', `/src/tests/${slug}`,
        '-e', 'DOTNET_CLI_TELEMETRY_OPTOUT=1',
        '-e', 'DOTNET_NOLOGO=1',
        SDK_IMAGE,
        'dotnet', 'test', '--nologo', ...extra
    ], { stdio: 'inherit', env: { ...process.env, MSYS_NO_PATHCONV: '1' } });
} catch (e) {
    // dotnet test has already printed which tests failed; a Node stack trace adds nothing.
    process.exit(e.status ?? 1);
}
