using Jellyfin.Data.Enums;
using Jellyfin.Plugin.Filmweb.Providers;
using MediaBrowser.Controller.Entities;
using MediaBrowser.Controller.Entities.Movies;
using MediaBrowser.Controller.Entities.TV;
using MediaBrowser.Controller.Providers;
using MediaBrowser.Model.Entities;
using MediaBrowser.Model.Providers;
using Xunit;

namespace Jellyfin.Plugin.Filmweb.Tests;

public class FilmwebProviderTests
{
    private static readonly CancellationToken None = CancellationToken.None;

    private static FilmwebMovieProvider Movies(FakeFilmweb filmweb, PluginConfiguration? configuration = null) =>
        new(filmweb.Service(), filmweb, () => configuration ?? new PluginConfiguration());

    private static FilmwebSeriesProvider Shows(FakeFilmweb filmweb) =>
        new(filmweb.Service(), filmweb, () => new PluginConfiguration());

    private static FilmwebImageProvider Images(FakeFilmweb filmweb, PluginConfiguration? configuration = null) =>
        new(filmweb.Client(), filmweb, () => configuration ?? new PluginConfiguration());

    private static T WithId<T>(T item, string id)
        where T : IHasProviderIds
    {
        item.SetProviderId("Filmweb", id);
        return item;
    }

    private static FakeFilmweb GameOfThrones() => new FakeFilmweb()
        .Json(
            "live/search?query=Game%20of%20Thrones&pageSize=20",
            """{"searchHits":[{"id":9,"type":"film","matchedTitle":"Game of Thrones"},{"id":476848,"type":"serial","matchedTitle":"Game of Thrones"}]}""")
        .Json("title/9/info", """{"id":9,"title":"Game of Thrones","year":2011,"type":"film"}""")
        .Fixture("title/476848/info", "title-info-serial")
        .Fixture("film/476848/preview", "preview-serial");

    [Fact]
    public async Task AFilmIsFoundByNameAndYearAndMapped()
    {
        var result = await Movies(new FakeFilmweb().WithInception())
            .GetMetadata(new MovieInfo { Name = "Inception", Year = 2010 }, None);

        Assert.True(result.HasMetadata);
        Assert.Equal("Incepcja", result.Item.Name);
        Assert.Equal("Inception", result.Item.OriginalTitle);
        Assert.Equal("500891", result.Item.GetProviderId("Filmweb"));
        Assert.Equal(8.2f, result.Item.CommunityRating);
        Assert.Equal("pl", result.ResultLanguage);
        Assert.Equal("Filmweb", result.Provider);
        Assert.False(result.QueriedById);
    }

    [Fact]
    public async Task TheResultCarriesDirectorsAndCast()
    {
        var result = await Movies(new FakeFilmweb().WithInception())
            .GetMetadata(new MovieInfo { Name = "Inception", Year = 2010 }, None);

        Assert.Equal("Christopher Nolan", result.People[0].Name);
        Assert.Equal(PersonKind.Director, result.People[0].Type);
        Assert.Contains(result.People, p => p.Name == "Leonardo DiCaprio" && p.Type == PersonKind.Actor);
    }

    [Fact]
    public async Task AFilmIsFoundByItsOriginalTitleWhenTheNameFindsNothing()
    {
        var result = await Movies(new FakeFilmweb().WithInception())
            .GetMetadata(new MovieInfo { Name = "Początek", OriginalTitle = "Inception", Year = 2010 }, None);

        Assert.Equal("500891", result.Item.GetProviderId("Filmweb"));
    }

    [Fact]
    public async Task AKnownFilmwebIdSkipsTheSearch()
    {
        var filmweb = new FakeFilmweb().WithInception();

        var result = await Movies(filmweb)
            .GetMetadata(WithId(new MovieInfo { Name = "Something else entirely" }, "500891"), None);

        Assert.Equal("Incepcja", result.Item.Name);
        Assert.True(result.QueriedById);
        Assert.DoesNotContain(filmweb.Requests, r => r.StartsWith("live/search", StringComparison.Ordinal));
    }

    [Fact]
    public async Task AFilmNobodyFindsHasNoMetadata()
    {
        var result = await Movies(new FakeFilmweb().WithInception())
            .GetMetadata(new MovieInfo { Name = "Inception", Year = 1999 }, None);

        Assert.False(result.HasMetadata);
        Assert.Null(result.Item);
    }

    [Fact]
    public async Task AnIdFilmwebDoesNotKnowHasNoMetadata()
    {
        var result = await Movies(new FakeFilmweb()).GetMetadata(WithId(new MovieInfo(), "123"), None);

        Assert.False(result.HasMetadata);
    }

    [Fact]
    public async Task TheSettingsDecideTheNameAndTheCast()
    {
        var settings = new PluginConfiguration { PreferOriginalTitle = true, CastLimit = 1, FetchCriticRating = false };

        var result = await Movies(new FakeFilmweb().WithInception(), settings)
            .GetMetadata(WithId(new MovieInfo(), "500891"), None);

        Assert.Equal("Inception", result.Item.Name);
        Assert.Null(result.Item.CriticRating);
        Assert.Equal(["Christopher Nolan", "Leonardo DiCaprio"], result.People.Select(p => p.Name));
    }

    [Fact]
    public async Task PeopleCanBeLeftToAnotherProvider()
    {
        // No list at all, not an empty one: that is what lets the next provider's cast through.
        var result = await Movies(new FakeFilmweb().WithInception(), new PluginConfiguration { FetchPeople = false })
            .GetMetadata(WithId(new MovieInfo(), "500891"), None);

        Assert.True(result.HasMetadata);
        Assert.Null(result.People);
    }

    [Fact]
    public async Task ASeriesIsMatchedAgainstSerialsOnly()
    {
        var result = await Shows(GameOfThrones()).GetMetadata(new SeriesInfo { Name = "Game of Thrones" }, None);

        Assert.True(result.HasMetadata);
        Assert.Equal("Gra o tron", result.Item.Name);
        Assert.Equal("476848", result.Item.GetProviderId("Filmweb"));
        Assert.Equal(["Dramat", "Fantasy", "Przygodowy"], result.Item.Genres);
    }

    [Fact]
    public async Task IdentifyListsTheHitsWithYearAndPoster()
    {
        var results = (await Movies(new FakeFilmweb().WithInception())
            .GetSearchResults(new MovieInfo { Name = "Inception" }, None)).ToList();

        var hit = Assert.Single(results);
        Assert.Equal("Incepcja", hit.Name);
        Assert.Equal(2010, hit.ProductionYear);
        Assert.Equal("https://fwcdn.pl/fpo/08/91/500891/7354571_1.6.jpg", hit.ImageUrl);
        Assert.Equal("500891", hit.GetProviderId("Filmweb"));
        Assert.Equal("Filmweb", hit.SearchProviderName);
    }

    [Fact]
    public async Task IdentifyByIdAnswersWithThatOneTitle()
    {
        var filmweb = new FakeFilmweb().WithInception();
        var pasted = WithId(new MovieInfo { Name = "whatever" }, "https://www.filmweb.pl/film/Incepcja-2010-500891");

        var results = (await Movies(filmweb).GetSearchResults(pasted, None)).ToList();

        Assert.Equal("Incepcja", Assert.Single(results).Name);
        Assert.Equal(["title/500891/info"], filmweb.Requests);
    }

    [Fact]
    public async Task ImagesAreThePosterThenTheStills()
    {
        var images = (await Images(new FakeFilmweb().WithInception()).GetImages(WithId(new Movie(), "500891"), None)).ToList();

        Assert.Equal(7, images.Count);
        Assert.Equal(ImageType.Primary, images[0].Type);
        Assert.Equal("https://fwcdn.pl/fpo/08/91/500891/7354571_1.3.jpg", images[0].Url);
        Assert.Equal("https://fwcdn.pl/fpo/08/91/500891/7354571_1.6.jpg", images[0].ThumbnailUrl);
        Assert.Equal("pl", images[0].Language);
        Assert.All(images.Skip(1), i => Assert.Equal(ImageType.Backdrop, i.Type));
        Assert.Equal("https://fwcdn.pl/fph/08/91/500891/225032_1.1.jpg", images[1].Url);
        Assert.Equal("https://fwcdn.pl/fph/08/91/500891/225032_1.3.jpg", images[1].ThumbnailUrl);
        Assert.All(images, i => Assert.Equal("Filmweb", i.ProviderName));
    }

    [Fact]
    public async Task StillsAreDeclaredAtTheWidthTheCdnServes()
    {
        // 900 px is under Jellyfin's default minimum for a backdrop, and saying so is what lets the
        // server's own setting decide whether to download them.
        var images = (await Images(new FakeFilmweb().WithInception()).GetImages(WithId(new Movie(), "500891"), None)).ToList();

        var stills = images.Where(i => i.Type == ImageType.Backdrop).ToList();
        Assert.Equal(6, stills.Count);
        Assert.All(stills, i => Assert.Equal(900, i.Width));
    }

    [Fact]
    public async Task StillsCanBeSwitchedOff()
    {
        var filmweb = new FakeFilmweb().WithInception();

        var images = (await Images(filmweb, new PluginConfiguration { FetchBackdrops = false })
            .GetImages(WithId(new Movie(), "500891"), None)).ToList();

        Assert.Equal(ImageType.Primary, Assert.Single(images).Type);
        Assert.Equal(0, filmweb.Count("film/500891/photos"));
    }

    [Fact]
    public async Task AnItemWithoutAFilmwebIdHasNoImages()
    {
        var filmweb = new FakeFilmweb().WithInception();

        Assert.Empty(await Images(filmweb).GetImages(new Movie(), None));
        Assert.Empty(filmweb.Requests);
    }

    [Fact]
    public void ImagesAreOfferedForFilmsAndSeriesOnly()
    {
        var images = Images(new FakeFilmweb());

        Assert.True(images.Supports(new Movie()));
        Assert.True(images.Supports(new Series()));
        Assert.False(images.Supports(new Episode()));
        Assert.Equal([ImageType.Primary, ImageType.Backdrop], images.GetSupportedImages(new Movie()));
    }

    [Fact]
    public void TheIdIsAFieldOnFilmsAndOnSeries()
    {
        IExternalId film = new FilmwebMovieExternalId();
        IExternalId series = new FilmwebSeriesExternalId();

        Assert.Equal(("Filmweb", "Filmweb", ExternalIdMediaType.Movie), (film.ProviderName, film.Key, film.Type));
        Assert.Equal(("Filmweb", "Filmweb", ExternalIdMediaType.Series), (series.ProviderName, series.Key, series.Type));
        Assert.True(film.Supports(new Movie()));
        Assert.False(film.Supports(new Series()));
        Assert.True(series.Supports(new Series()));
        Assert.False(series.Supports(new Movie()));
    }

    [Fact]
    public void TheLinkGoesThroughFilmwebsOwnRedirect()
    {
        // entityLink answers 301 to the canonical /film/… or /serial/… page, so no slug has to be guessed.
        var urls = new FilmwebExternalUrlProvider();

        Assert.Equal(
            ["https://www.filmweb.pl/entityLink?entityName=film&id=500891"],
            urls.GetExternalUrls(WithId(new Movie(), "500891")));
        Assert.Equal(
            ["https://www.filmweb.pl/entityLink?entityName=film&id=476848"],
            urls.GetExternalUrls(WithId(new Series(), "476848")));
    }

    [Fact]
    public void ThereIsNoLinkWithoutAnIdOrForOtherKindsOfItem()
    {
        var urls = new FilmwebExternalUrlProvider();

        Assert.Empty(urls.GetExternalUrls(new Movie()));
        Assert.Empty(urls.GetExternalUrls(WithId(new Episode(), "700832")));
    }
}
