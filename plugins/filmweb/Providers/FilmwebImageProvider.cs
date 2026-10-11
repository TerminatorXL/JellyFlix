using Jellyfin.Plugin.Filmweb.Api;
using Jellyfin.Plugin.Filmweb.Lookup;
using MediaBrowser.Common.Net;
using MediaBrowser.Controller.Entities;
using MediaBrowser.Controller.Entities.Movies;
using MediaBrowser.Controller.Entities.TV;
using MediaBrowser.Controller.Providers;
using MediaBrowser.Model.Entities;
using MediaBrowser.Model.Providers;

namespace Jellyfin.Plugin.Filmweb.Providers;

/// <summary>
/// The Polish poster and the title's stills. Only for an item that already has a Filmweb id — the
/// metadata provider or Identify puts it there — because an image picked by a name match that
/// nobody confirmed would be a guess twice over.
/// </summary>
public class FilmwebImageProvider : IRemoteImageProvider
{
    private readonly FilmwebClient _client;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly Func<PluginConfiguration> _configuration;

    public FilmwebImageProvider(FilmwebClient client, IHttpClientFactory httpClientFactory)
        : this(client, httpClientFactory, FilmwebSettings.Current)
    {
    }

    internal FilmwebImageProvider(
        FilmwebClient client,
        IHttpClientFactory httpClientFactory,
        Func<PluginConfiguration> configuration)
    {
        _client = client;
        _httpClientFactory = httpClientFactory;
        _configuration = configuration;
    }

    public string Name => Plugin.ProviderName;

    public bool Supports(BaseItem item) => item is Movie or Series;

    public IEnumerable<ImageType> GetSupportedImages(BaseItem item) => [ImageType.Primary, ImageType.Backdrop];

    public async Task<IEnumerable<RemoteImageInfo>> GetImages(BaseItem item, CancellationToken cancellationToken)
    {
        if (FilmwebIds.Parse(item.GetProviderId(Plugin.ProviderName)) is not { } id)
        {
            return [];
        }

        var images = new List<RemoteImageInfo>();
        var preview = await _client.GetPreviewAsync(id, cancellationToken).ConfigureAwait(false);
        if (FilmwebImages.Poster(preview?.PosterPath) is { } poster)
        {
            images.Add(new RemoteImageInfo
            {
                ProviderName = Name,
                Type = ImageType.Primary,
                Url = poster,
                ThumbnailUrl = FilmwebImages.PosterThumbnail(preview?.PosterPath),
                Language = "pl"
            });
        }

        if (_configuration().FetchBackdrops)
        {
            foreach (var photo in await _client.GetPhotosAsync(id, cancellationToken).ConfigureAwait(false))
            {
                images.Add(new RemoteImageInfo
                {
                    ProviderName = Name,
                    Type = ImageType.Backdrop,
                    Url = FilmwebImages.Photo(photo.Path),
                    ThumbnailUrl = FilmwebImages.PhotoThumbnail(photo.Path),
                    // The honest number: it is below Jellyfin's default minimum for a backdrop, and
                    // declaring it is what lets the library's own setting decide.
                    Width = FilmwebImages.PhotoWidth
                });
            }
        }

        return images;
    }

    public Task<HttpResponseMessage> GetImageResponse(string url, CancellationToken cancellationToken) =>
        _httpClientFactory.CreateClient(NamedClient.Default).GetAsync(url, cancellationToken);
}
