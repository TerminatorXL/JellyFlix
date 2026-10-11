using System.Globalization;
using Jellyfin.Plugin.Filmweb.Lookup;
using MediaBrowser.Controller.Entities;
using MediaBrowser.Controller.Entities.Movies;
using MediaBrowser.Controller.Entities.TV;
using MediaBrowser.Controller.Providers;
using MediaBrowser.Model.Entities;
using MediaBrowser.Model.Providers;

namespace Jellyfin.Plugin.Filmweb.Providers;

/* An external id is what makes "Filmweb" a field in the metadata editor and in the Identify dialog.
 * Jellyfin wants one class per kind of item, hence two that differ in a type. */

public class FilmwebMovieExternalId : IExternalId
{
    public string ProviderName => Plugin.ProviderName;

    public string Key => Plugin.ProviderName;

    public ExternalIdMediaType? Type => ExternalIdMediaType.Movie;

    public bool Supports(IHasProviderIds item) => item is Movie;
}

public class FilmwebSeriesExternalId : IExternalId
{
    public string ProviderName => Plugin.ProviderName;

    public string Key => Plugin.ProviderName;

    public ExternalIdMediaType? Type => ExternalIdMediaType.Series;

    public bool Supports(IHasProviderIds item) => item is Series;
}

/// <summary>The "Filmweb" link among an item's external links.</summary>
public class FilmwebExternalUrlProvider : IExternalUrlProvider
{
    public string Name => Plugin.ProviderName;

    public IEnumerable<string> GetExternalUrls(BaseItem item)
    {
        if (item is Movie or Series && FilmwebIds.Parse(item.GetProviderId(Plugin.ProviderName)) is { } id)
        {
            // A real page address has the title's slug in it — /film/Incepcja-2010-500891 — which
            // this would have to rebuild. entityLink is Filmweb's own redirect to it, and it takes a
            // serial under "film" too.
            yield return "https://www.filmweb.pl/entityLink?entityName=film&id=" + id.ToString(CultureInfo.InvariantCulture);
        }
    }
}
