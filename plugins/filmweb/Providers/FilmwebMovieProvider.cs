using Jellyfin.Plugin.Filmweb.Api;
using Jellyfin.Plugin.Filmweb.Lookup;
using MediaBrowser.Controller.Entities.Movies;
using MediaBrowser.Controller.Providers;

namespace Jellyfin.Plugin.Filmweb.Providers;

public class FilmwebMovieProvider : FilmwebProviderBase<Movie, MovieInfo>
{
    public FilmwebMovieProvider(FilmwebTitleService titles, IHttpClientFactory httpClientFactory)
        : this(titles, httpClientFactory, FilmwebSettings.Current)
    {
    }

    internal FilmwebMovieProvider(
        FilmwebTitleService titles,
        IHttpClientFactory httpClientFactory,
        Func<PluginConfiguration> configuration)
        : base(titles, httpClientFactory, configuration, FilmwebKind.Film)
    {
    }
}
