using System.Globalization;
using Jellyfin.Plugin.Filmweb.Api;
using Jellyfin.Plugin.Filmweb.Lookup;
using MediaBrowser.Common.Net;
using MediaBrowser.Controller.Entities;
using MediaBrowser.Controller.Providers;
using MediaBrowser.Model.Entities;
using MediaBrowser.Model.Providers;

namespace Jellyfin.Plugin.Filmweb.Providers;

/// <summary>
/// What the film and the series provider share, which is everything but the Jellyfin types and the
/// kind of Filmweb title they accept: a serial's metadata lives at the same addresses as a film's.
/// </summary>
public abstract class FilmwebProviderBase<TItem, TLookup> : IRemoteMetadataProvider<TItem, TLookup>
    where TItem : BaseItem, IHasLookupInfo<TLookup>, new()
    where TLookup : ItemLookupInfo, new()
{
    /// <summary>The settings page caps it too; this is for a hand-edited XML.</summary>
    private const int MaxCast = 20;

    private readonly FilmwebTitleService _titles;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly Func<PluginConfiguration> _configuration;
    private readonly FilmwebKind _kind;

    protected FilmwebProviderBase(
        FilmwebTitleService titles,
        IHttpClientFactory httpClientFactory,
        Func<PluginConfiguration> configuration,
        FilmwebKind kind)
    {
        _titles = titles;
        _httpClientFactory = httpClientFactory;
        _configuration = configuration;
        _kind = kind;
    }

    public string Name => Plugin.ProviderName;

    /// <summary>
    /// The Identify dialog. A Filmweb id — or a pasted page address — answers with that one title;
    /// otherwise every hit is listed, because here a person is choosing and should see them all.
    /// </summary>
    public async Task<IEnumerable<RemoteSearchResult>> GetSearchResults(TLookup searchInfo, CancellationToken cancellationToken)
    {
        IReadOnlyList<FilmwebCandidate> candidates;
        if (FilmwebIds.Parse(searchInfo.GetProviderId(Plugin.ProviderName)) is { } id)
        {
            candidates = await _titles.GetCandidateAsync(id, cancellationToken).ConfigureAwait(false) is { } known ? [known] : [];
        }
        else
        {
            candidates = await _titles.SearchAsync(searchInfo.Name, _kind, cancellationToken).ConfigureAwait(false);
        }

        return candidates.Select(candidate =>
        {
            var result = new RemoteSearchResult
            {
                Name = candidate.Title,
                ProductionYear = candidate.Year,
                ImageUrl = FilmwebImages.PosterThumbnail(candidate.PosterPath),
                SearchProviderName = Name
            };
            result.SetProviderId(Plugin.ProviderName, candidate.Id.ToString(CultureInfo.InvariantCulture));
            return result;
        });
    }

    /// <summary>
    /// A refresh. An item that already carries a Filmweb id is fetched by it; one that does not is
    /// matched by name and year, and left alone when no hit is a safe match.
    /// </summary>
    public async Task<MetadataResult<TItem>> GetMetadata(TLookup info, CancellationToken cancellationToken)
    {
        var result = new MetadataResult<TItem>();

        var id = FilmwebIds.Parse(info.GetProviderId(Plugin.ProviderName));
        var queriedById = id is not null;
        id ??= (await _titles.FindAsync([info.Name, info.OriginalTitle], info.Year, _kind, cancellationToken).ConfigureAwait(false))?.Id;
        if (id is null)
        {
            return result;
        }

        var configuration = _configuration();
        var options = new FilmwebFetchOptions(
            configuration.FetchPeople,
            Math.Clamp(configuration.CastLimit, 0, MaxCast),
            configuration.FetchCriticRating);
        var title = await _titles.GetTitleAsync(id.Value, options, cancellationToken).ConfigureAwait(false);
        if (title is null)
        {
            return result;
        }

        result.Item = new TItem();
        result.HasMetadata = true;
        result.QueriedById = queriedById;
        result.Provider = Name;
        result.ResultLanguage = "pl";
        FilmwebMetadataMapper.Apply(title, result.Item, configuration.PreferOriginalTitle);
        // With people switched off the list stays null rather than empty: Jellyfin takes an item's
        // people from the first provider that has any, and null is what says "not from me".
        foreach (var person in FilmwebMetadataMapper.People(title))
        {
            result.AddPerson(person);
        }

        return result;
    }

    public Task<HttpResponseMessage> GetImageResponse(string url, CancellationToken cancellationToken) =>
        _httpClientFactory.CreateClient(NamedClient.Default).GetAsync(url, cancellationToken);
}
