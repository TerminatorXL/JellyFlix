namespace Jellyfin.Plugin.Filmweb.Providers;

internal static class FilmwebSettings
{
    /// <summary>
    /// The Dashboard settings as they are right now. Read on every call rather than captured, so a
    /// save takes effect on the next refresh without a restart.
    /// </summary>
    public static readonly Func<PluginConfiguration> Current =
        () => Plugin.Instance?.Configuration ?? new PluginConfiguration();
}
