using System.Globalization;
using System.Text;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.PauseInfoCard.Services;

/// <summary>
/// Appends one &lt;script&gt; tag to the web client's index.html as it is served.
///
/// Why a response-rewriting middleware and not a patched file on disk: the official Docker image
/// ships jellyfin-web read-only inside the container, and any file edit would be undone by the next
/// server update. Rewriting the response leaves the installation untouched.
///
/// It runs FIRST in the pipeline (Use before next), so it sees the response before anything else
/// writes it.
/// </summary>
public class ScriptInjectionStartupFilter : IStartupFilter
{
    private const string BodyClose = "</body>";

    private static ILogger<ScriptInjectionStartupFilter>? _logger;

    /// <summary>Counters behind GET /PauseInfoCard/status, so a remote install can be diagnosed with one URL.</summary>
    public static int IndexRequestsSeen { get; private set; }

    public static int Injections { get; private set; }

    public static string LastOutcome { get; private set; } = "no index.html request seen yet";

    public ScriptInjectionStartupFilter(ILogger<ScriptInjectionStartupFilter> logger)
    {
        _logger = logger;
    }

    public Action<IApplicationBuilder> Configure(Action<IApplicationBuilder> next) => builder =>
    {
        _logger?.LogInformation("Pause Info Card: index.html middleware installed");
        builder.Use(InjectAsync);
        next(builder);
    };

    private static async Task InjectAsync(HttpContext context, RequestDelegate next)
    {
        var plugin = Plugin.Instance;
        if (!IsWebIndex(context.Request.Path))
        {
            await next(context).ConfigureAwait(false);
            return;
        }

        IndexRequestsSeen++;

        if (plugin is null || !plugin.Configuration.Enabled)
        {
            Record("skipped: the plugin is disabled in its settings");
            await next(context).ConfigureAwait(false);
            return;
        }

        /* Ask for this one document UNCOMPRESSED.
         *
         * Jellyfin gzips index.html for anything that sends Accept-Encoding, which every browser does
         * and curl does not — so a hand test with curl sees plain HTML and a real page load does not.
         * Rewriting a gzip stream as text is how you corrupt every page load, so the header comes off
         * for the duration of this request and goes straight back on afterwards. The cost is one
         * uncompressed 7 KB document per page load; the alternative is inflate-inject-deflate, which
         * is a great deal more code to get wrong.
         *
         * Swapping IHttpResponseBodyFeature, not just Response.Body. Static files are normally sent
         * with SendFileAsync, which writes to the connection directly and would sail straight past a
         * plain Body swap — leaving the page correct but un-injected. Replacing the feature disables
         * that fast path. */
        var acceptEncoding = context.Request.Headers.AcceptEncoding;
        context.Request.Headers.Remove("Accept-Encoding");

        /* And ask for it UNCONDITIONALLY.
         *
         * The browser revalidates index.html with If-None-Match, the static-file middleware compares
         * against the ETag of the file ON DISK — which this plugin never changes — and answers 304
         * with an empty body. The browser then keeps rendering whatever it cached, which for anyone
         * who opened Jellyfin before installing the plugin is a copy with no script tag in it. It
         * would never pick the tag up, no matter how many times the server injected it correctly.
         *
         * Dropping the conditional headers forces a full 200 that can actually be rewritten. */
        var ifNoneMatch = context.Request.Headers.IfNoneMatch;
        var ifModifiedSince = context.Request.Headers.IfModifiedSince;
        context.Request.Headers.Remove("If-None-Match");
        context.Request.Headers.Remove("If-Modified-Since");

        var originalFeature = context.Features.Get<IHttpResponseBodyFeature>();
        using var buffer = new MemoryStream();
        context.Features.Set<IHttpResponseBodyFeature>(new StreamResponseBodyFeature(buffer));

        try
        {
            await next(context).ConfigureAwait(false);
        }
        finally
        {
            context.Features.Set(originalFeature);
            if (acceptEncoding.Count > 0)
            {
                context.Request.Headers.AcceptEncoding = acceptEncoding;
            }

            if (ifNoneMatch.Count > 0)
            {
                context.Request.Headers.IfNoneMatch = ifNoneMatch;
            }

            if (ifModifiedSince.Count > 0)
            {
                context.Request.Headers.IfModifiedSince = ifModifiedSince;
            }
        }

        buffer.Seek(0, SeekOrigin.Begin);
        var body = originalFeature?.Stream ?? context.Response.Body;

        var contentType = context.Response.ContentType ?? string.Empty;
        var encoding = context.Response.Headers.ContentEncoding.ToString();

        // Belt and braces: Accept-Encoding was removed above, so this should not trigger — but if
        // something in the pipeline compresses anyway, copying it out untouched is the only safe move.
        // Decoding it to inject a tag would be a fine way to corrupt every page load.
        if (context.Response.StatusCode != StatusCodes.Status200OK
            || !contentType.Contains("text/html", StringComparison.OrdinalIgnoreCase)
            || !string.IsNullOrEmpty(encoding))
        {
            Record(string.Create(CultureInfo.InvariantCulture,
                $"passed through untouched: status={context.Response.StatusCode} type=\"{contentType}\" encoding=\"{encoding}\" bytes={buffer.Length}"));
            await buffer.CopyToAsync(body).ConfigureAwait(false);
            return;
        }

        var html = await new StreamReader(buffer, Encoding.UTF8).ReadToEndAsync().ConfigureAwait(false);
        var close = html.LastIndexOf(BodyClose, StringComparison.OrdinalIgnoreCase);
        if (close < 0)
        {
            Record(string.Create(CultureInfo.InvariantCulture,
                $"no </body> in the {html.Length}-character response, left alone"));
            await body.WriteAsync(Encoding.UTF8.GetBytes(html)).ConfigureAwait(false);
            return;
        }

        /* A RELATIVE src, so a sub-path install keeps working: the document is /web/index.html, so
         * ../PauseInfoCard/addon.js resolves to /PauseInfoCard/addon.js — and under /jellyfin/web/ it
         * resolves to /jellyfin/PauseInfoCard/addon.js, which is exactly right.
         * The cache-buster covers the configuration too, so saving settings in the Dashboard is
         * enough to make every browser pick the new config up. */
        var tag = $"\n<!-- Pause Info Card -->\n<script defer src=\"../PauseInfoCard/addon.js?v={Stamp(plugin)}\"></script>\n";
        var patched = string.Concat(html.AsSpan(0, close), tag, html.AsSpan(close));

        /* The validators describe the file on disk, not what we just sent. Leaving them on would let
         * the browser cache this document and then revalidate straight back into a 304 — and one
         * uninstall later it would still be rendering an injected page. index.html is 7 KB; making
         * it non-cacheable costs nothing and keeps the tag in step with the plugin. */
        context.Response.Headers.Remove("ETag");
        context.Response.Headers.Remove("Last-Modified");
        context.Response.Headers.CacheControl = "no-cache, no-store, must-revalidate";

        var bytes = Encoding.UTF8.GetBytes(patched);
        context.Response.ContentLength = bytes.Length;
        await body.WriteAsync(bytes).ConfigureAwait(false);

        Injections++;
        if (Injections == 1)
        {
            _logger?.LogInformation("Pause Info Card: injected the add-on script tag into {Path}", context.Request.Path);
        }

        Record("injected");
    }

    private static void Record(string outcome)
    {
        if (!string.Equals(LastOutcome, outcome, StringComparison.Ordinal))
        {
            LastOutcome = outcome;
            if (!outcome.Equals("injected", StringComparison.Ordinal))
            {
                _logger?.LogWarning("Pause Info Card: {Outcome}", outcome);
            }
        }
    }

    /// <summary>`/web/`, `/web/index.html` and the bare `/web` — the three ways the client is asked for.</summary>
    private static bool IsWebIndex(PathString path)
    {
        var value = path.Value;
        if (string.IsNullOrEmpty(value))
        {
            return false;
        }

        return value.EndsWith("/web/index.html", StringComparison.OrdinalIgnoreCase)
            || value.EndsWith("/web/", StringComparison.OrdinalIgnoreCase)
            || value.EndsWith("/web", StringComparison.OrdinalIgnoreCase);
    }

    private static string Stamp(Plugin plugin) =>
        plugin.Version?.ToString()
        + "-"
        + plugin.Configuration.GetHashCode().ToString("x8", CultureInfo.InvariantCulture);
}
