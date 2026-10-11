using Jellyfin.Plugin.Filmweb.Api;
using Jellyfin.Plugin.Filmweb.Lookup;
using MediaBrowser.Controller.Entities.TV;
using MediaBrowser.Controller.Providers;

namespace Jellyfin.Plugin.Filmweb.Providers;

public class FilmwebSeriesProvider : FilmwebProviderBase<Series, SeriesInfo>
{
    public FilmwebSeriesProvider(FilmwebTitleService titles, IHttpClientFactory httpClientFactory)
        : this(titles, httpClientFactory, FilmwebSettings.Current)
    {
    }

    internal FilmwebSeriesProvider(
        FilmwebTitleService titles,
        IHttpClientFactory httpClientFactory,
        Func<PluginConfiguration> configuration)
        : base(titles, httpClientFactory, configuration, FilmwebKind.Serial)
    {
    }
}
