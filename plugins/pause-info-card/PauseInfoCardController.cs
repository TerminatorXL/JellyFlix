using System.Globalization;
using System.Reflection;
using System.Text;
using System.Text.Json;
using Jellyfin.Plugin.PauseInfoCard.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Jellyfin.Plugin.PauseInfoCard;

/// <summary>
/// Serves the add-on bundle, prefixed with the Dashboard settings as window.JELLYFLIX_ADDON_CONFIG.
/// </summary>
[ApiController]
[Route("PauseInfoCard")]
public class PauseInfoCardController : ControllerBase
{
    private const string ResourceName = "Jellyfin.Plugin.PauseInfoCard.addon.js";
    private static string? _bundle;

    /// <summary>
    /// The bundle, embedded in this assembly and read once.
    /// </summary>
    private static string Bundle =>
        _bundle ??= ReadResource();

    private static string ReadResource()
    {
        using var stream = Assembly.GetExecutingAssembly().GetManifestResourceStream(ResourceName)
            ?? throw new InvalidOperationException($"{ResourceName} is not embedded in the assembly");
        using var reader = new StreamReader(stream, Encoding.UTF8);
        return reader.ReadToEnd();
    }

    /// <summary>
    /// GET /PauseInfoCard/addon.js
    ///
    /// Anonymous on purpose: this is loaded by a &lt;script src&gt; tag, which cannot carry an
    /// Authorization header. It gives away nothing — the file is the same bundle published in the
    /// repository, and it reads the viewer's own session at runtime through window.ApiClient.
    /// </summary>
    [HttpGet("addon.js")]
    [AllowAnonymous]
    [Produces("application/javascript")]
    public ActionResult GetAddonScript()
    {
        var plugin = Plugin.Instance;
        if (plugin is null || !plugin.Configuration.Enabled)
        {
            return Content("/* Pause Info Card is disabled in the plugin settings. */",
                "application/javascript; charset=utf-8");
        }

        var script = new StringBuilder()
            .Append("/* Pause Info Card ")
            .Append(plugin.Version?.ToString() ?? "?")
            .Append(" — settings from Dashboard > Plugins > Pause Info Card */\n")
            /* MERGED into the global, not assigned over it. Two plugins from this repository can be
             * installed at once, each serving its own settings ahead of its own bundle; a plain
             * assignment would mean whichever loaded second wiped the other's configuration. Only
             * top-level keys collide (each module owns one), so a shallow merge is enough. */
            .Append("(function(c){var g=window.JELLYFLIX_ADDON_CONFIG=window.JELLYFLIX_ADDON_CONFIG||{};")
            .Append("for(var k in c){if(Object.prototype.hasOwnProperty.call(c,k))g[k]=c[k];}})(")
            .Append(BuildConfigJson(plugin.Configuration))
            .Append(");\n")
            .Append(Bundle)
            .ToString();

        return Content(script, "application/javascript; charset=utf-8");
    }

    /// <summary>
    /// GET /PauseInfoCard/status
    ///
    /// One URL that answers "why do I not see anything?" on a server nobody can attach a debugger to.
    /// If this 404s, the plugin is not running at all — almost always a server that was not restarted
    /// after the install. If it answers and `injected` is 0, the middleware is seeing index.html but
    /// declining to touch it, and `lastOutcome` says why.
    /// </summary>
    [HttpGet("status")]
    [AllowAnonymous]
    [Produces("application/json")]
    public ActionResult GetStatus()
    {
        var plugin = Plugin.Instance;
        return new JsonResult(new
        {
            plugin = "Pause Info Card",
            version = plugin?.Version?.ToString(),
            enabled = plugin?.Configuration.Enabled,
            bundleBytes = Bundle.Length,
            indexRequestsSeen = ScriptInjectionStartupFilter.IndexRequestsSeen,
            injected = ScriptInjectionStartupFilter.Injections,
            lastOutcome = ScriptInjectionStartupFilter.LastOutcome
        });
    }

    /// <summary>
    /// Maps the C# configuration onto the shape the bundle's registry merges over module defaults.
    /// Only the keys the Dashboard exposes are written, so anything not surfaced here keeps the
    /// module default rather than being overwritten with a C# zero value.
    /// </summary>
    private static string BuildConfigJson(PluginConfiguration config) =>
        JsonSerializer.Serialize(new Dictionary<string, object>(StringComparer.Ordinal)
        {
            ["debug"] = config.Debug,
            ["pauseInfo"] = new Dictionary<string, object>(StringComparer.Ordinal)
            {
                ["enabled"] = config.PauseInfoEnabled,
                ["delayMs"] = Math.Clamp(config.PauseInfoDelayMs, 0, 10000),
                ["dim"] = config.PauseInfoDim,
                ["showLogo"] = config.PauseInfoShowLogo,
                ["showOverview"] = config.PauseInfoShowOverview,
                ["showRemaining"] = config.PauseInfoShowRemaining
            },
            ["rowTags"] = new Dictionary<string, object>(StringComparer.Ordinal)
            {
                ["enabled"] = config.RowTagsEnabled
            },
            ["scrollVar"] = new Dictionary<string, object>(StringComparer.Ordinal)
            {
                ["enabled"] = config.ScrollVarEnabled
            },
            ["cardMeta"] = new Dictionary<string, object>(StringComparer.Ordinal)
            {
                ["enabled"] = config.CardMetaEnabled
            }
        });
}
