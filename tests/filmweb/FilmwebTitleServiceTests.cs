using System.Net;
using Jellyfin.Plugin.Filmweb.Api;
using Xunit;

namespace Jellyfin.Plugin.Filmweb.Tests;

public class FilmwebTitleServiceTests
{
    private const string WitcherSearch = "live/search?query=Wied%C5%BAmin&pageSize=20";
    private static readonly CancellationToken None = CancellationToken.None;
    private static readonly FilmwebFetchOptions Everything = new(People: true, CastLimit: 10, CriticsRating: true);

    private static string Info(long id, string title, int year, string type) =>
        $$"""{"id":{{id}},"title":"{{title}}","originalTitle":"{{title}} (orig)","year":{{year}},"type":"{{type}}","posterPath":"/p/{{id}}.$.jpg"}""";

    private static FakeFilmweb Witcher() => new FakeFilmweb()
        .Fixture(WitcherSearch, "search")
        .Json("title/1281/info", Info(1281, "Wiedźmin", 2001, "film"))
        .Json("title/867501/info", Info(867501, "Wiedźmin: Zmora Wilka", 2021, "film"))
        .Json("title/10043627/info", Info(10043627, "Wiedźmin: Syreny z głębin", 2025, "film"))
        .Json("title/10118674/info", Info(10118674, "Wiedźmia matka", 2024, "film"))
        .Json("title/724464/info", Info(724464, "Wiedźmin", 2019, "serial"))
        .Json("title/119350/info", Info(119350, "Wiedźmin", 2002, "serial"))
        .Json("title/857518/info", Info(857518, "Wiedźmin: Rodowód krwi", 2022, "serial"))
        .Json("title/866662/info", Info(866662, "Wiedźmin: Za kulisami odcinków", 2020, "serial"));

    [Fact]
    public async Task SearchForAFilmKeepsOnlyFilmsInFilmwebsOrder()
    {
        var hits = await Witcher().Service().SearchAsync("Wiedźmin", FilmwebKind.Film, None);

        Assert.Equal([1281, 867501, 10043627, 10118674], hits.Select(h => h.Id));
    }

    [Fact]
    public async Task SearchForASeriesKeepsOnlySerials()
    {
        var hits = await Witcher().Service().SearchAsync("Wiedźmin", FilmwebKind.Serial, None);

        Assert.Equal([724464, 119350, 857518, 866662], hits.Select(h => h.Id));
    }

    [Fact]
    public async Task ASearchHitCarriesTheYearAndPosterItsInfoAdds()
    {
        var hits = await Witcher().Service().SearchAsync("Wiedźmin", FilmwebKind.Film, None);

        Assert.Equal(
            new FilmwebCandidate(867501, "Wiedźmin: Zmora Wilka", "Wiedźmin: Zmora Wilka (orig)", "Wiedźmin: Zmora Wilka", 2021, "/p/867501.$.jpg"),
            hits[1]);
    }

    [Fact]
    public async Task AHitWhoseInfoHasGoneIsLeftOut()
    {
        var filmweb = new FakeFilmweb()
            .Fixture(WitcherSearch, "search")
            .Json("title/867501/info", Info(867501, "Wiedźmin: Zmora Wilka", 2021, "film"));

        var hits = await filmweb.Service().SearchAsync("Wiedźmin", FilmwebKind.Film, None);

        Assert.Equal([867501], hits.Select(h => h.Id));
    }

    [Fact]
    public async Task SearchLooksUpNoMoreThanEightHits()
    {
        var twelve = string.Join(",", Enumerable.Range(1, 12).Select(i => $$"""{"id":{{i}},"type":"film","matchedTitle":"Film {{i}}"}"""));
        var filmweb = new FakeFilmweb().Json("live/search?query=Film&pageSize=20", $$"""{"searchHits":[{{twelve}}]}""");
        for (var i = 1; i <= 12; i++)
        {
            filmweb.Json($"title/{i}/info", Info(i, $"Film {i}", 2000 + i, "film"));
        }

        var hits = await filmweb.Service().SearchAsync("Film", FilmwebKind.Film, None);

        Assert.Equal(Enumerable.Range(1, 8).Select(i => (long)i), hits.Select(h => h.Id));
        Assert.Equal(8, filmweb.Requests.Count(r => r.StartsWith("title/", StringComparison.Ordinal)));
    }

    [Fact]
    public async Task ANamelessSearchFindsNothing()
    {
        var filmweb = new FakeFilmweb();

        Assert.Empty(await filmweb.Service().SearchAsync(null, FilmwebKind.Film, None));
        Assert.Empty(filmweb.Requests);
    }

    [Fact]
    public async Task FindPicksTheHitThatMatchesNameAndYear()
    {
        var found = await Witcher().Service().FindAsync(["Wiedźmin"], 2019, FilmwebKind.Serial, None);

        Assert.Equal(724464, found!.Id);
    }

    [Fact]
    public async Task FindIsNothingWhenNoHitFits()
    {
        Assert.Null(await Witcher().Service().FindAsync(["Wiedźmin"], 1985, FilmwebKind.Film, None));
    }

    [Fact]
    public async Task FindTriesTheNextNameWhenTheFirstFindsNothing()
    {
        // The name on the item is often another provider's translation; the original title is the
        // one both sides agree on.
        var filmweb = Witcher();

        var found = await filmweb.Service().FindAsync(["Zabójca potworów", null, "Wiedźmin"], 2019, FilmwebKind.Serial, None);

        Assert.Equal(724464, found!.Id);
    }

    [Fact]
    public async Task FindStopsAtTheFirstNameThatMatches()
    {
        var filmweb = Witcher();

        await filmweb.Service().FindAsync(["Wiedźmin", "The Witcher"], 2019, FilmwebKind.Serial, None);

        Assert.Equal(1, filmweb.Requests.Count(r => r.StartsWith("live/search", StringComparison.Ordinal)));
    }

    [Fact]
    public async Task ACandidateCanBeLookedUpByItsId()
    {
        var candidate = await new FakeFilmweb().WithInception().Service().GetCandidateAsync(500891, None);

        Assert.Equal(
            new FilmwebCandidate(500891, "Incepcja", "Inception", null, 2010, "/08/91/500891/7354571_1.$.jpg"),
            candidate);
    }

    [Fact]
    public async Task ATitleBringsTogetherPreviewDescriptionRatingsAndDates()
    {
        var title = await new FakeFilmweb().WithInception().Service().GetTitleAsync(500891, Everything, None);

        Assert.Equal("Incepcja", title!.Preview.Title);
        Assert.StartsWith("Cobb (Leonardo DiCaprio)", title.Description);
        Assert.Equal(665787, title.Rating!.Count);
        Assert.Equal(91, title.CriticsRating!.Count);
        Assert.Equal(new DateTime(2010, 7, 8, 0, 0, 0, DateTimeKind.Utc), title.Dates!.WorldPremiere);
    }

    [Fact]
    public async Task ATitleFilmwebDoesNotKnowIsNothingAndCostsOneRequest()
    {
        var filmweb = new FakeFilmweb();

        Assert.Null(await filmweb.Service().GetTitleAsync(42, Everything, None));
        Assert.Equal(["film/42/preview"], filmweb.Requests);
    }

    [Fact]
    public async Task DirectorsComeWithTheirPhotos()
    {
        var title = await new FakeFilmweb().WithInception().Service().GetTitleAsync(500891, Everything, None);

        Assert.Equal([new FilmwebPerson(40896, "Christopher Nolan", "/08/96/40896/3.$.jpg")], title!.Directors);
    }

    [Fact]
    public async Task CastStartsWithTheLeadsThenTheBestRatedRolesWithoutRepeats()
    {
        var options = Everything with { CastLimit = 4 };

        var title = await new FakeFilmweb().WithInception().Service().GetTitleAsync(500891, options, None);

        Assert.Equal(
            [
                new FilmwebPerson(30, "Leonardo DiCaprio", "/00/30/30/449647_1.$.jpg"),
                new FilmwebPerson(3168, "Joseph Gordon-Levitt", "/31/68/3168/1.$.jpg"),
                new FilmwebPerson(57104, "Tom Hardy", "/71/04/57104/2.$.jpg"),
                new FilmwebPerson(84517, "Elliot Page", null)
            ],
            title!.Cast);
    }

    [Fact]
    public async Task ALeadWhosePageIsGoneKeepsTheNameThePreviewGave()
    {
        var filmweb = new FakeFilmweb()
            .Fixture("film/500891/preview", "preview")
            .Fixture("person/30/preview", "person");

        var title = await filmweb.Service().GetTitleAsync(500891, Everything with { CastLimit = 2 }, None);

        Assert.Equal(
            [
                new FilmwebPerson(30, "Leonardo DiCaprio", "/00/30/30/449647_1.$.jpg"),
                new FilmwebPerson(3168, "Joseph Gordon-Levitt", null)
            ],
            title!.Cast);
    }

    [Fact]
    public async Task ARoleWhosePersonIsGoneIsLeftOut()
    {
        // top-roles carries ids only, so without the person's page there is no name to show.
        var filmweb = new FakeFilmweb()
            .Json("film/7/preview", """{"id":7,"title":{"title":"Siedem"}}""")
            .Json("film/7/top-roles", """[{"person":1,"profession":"actors"},{"person":2,"profession":"actors"}]""")
            .Json("person/2/preview", """{"id":2,"name":"Druga Osoba"}""");

        var title = await filmweb.Service().GetTitleAsync(7, Everything, None);

        Assert.Equal([new FilmwebPerson(2, "Druga Osoba", null)], title!.Cast);
    }

    [Fact]
    public async Task OnlyActorsAreTakenFromTheTopRoles()
    {
        var filmweb = new FakeFilmweb()
            .Json("film/7/preview", """{"id":7,"title":{"title":"Siedem"}}""")
            .Json("film/7/top-roles", """[{"person":1,"profession":"director"},{"person":2,"profession":"actors"}]""")
            .Json("person/1/preview", """{"id":1,"name":"Reżyser"}""")
            .Json("person/2/preview", """{"id":2,"name":"Aktorka"}""");

        var title = await filmweb.Service().GetTitleAsync(7, Everything, None);

        Assert.Equal([new FilmwebPerson(2, "Aktorka", null)], title!.Cast);
    }

    [Fact]
    public async Task ACastLimitOfZeroAsksForNoActors()
    {
        var filmweb = new FakeFilmweb().WithInception();

        var title = await filmweb.Service().GetTitleAsync(500891, Everything with { CastLimit = 0 }, None);

        Assert.Empty(title!.Cast);
        Assert.Single(title.Directors);
        Assert.Equal(0, filmweb.Count("film/500891/top-roles"));
        Assert.Equal(0, filmweb.Count("person/30/preview"));
    }

    [Fact]
    public async Task WithPeopleSwitchedOffNobodyIsLookedUp()
    {
        var filmweb = new FakeFilmweb().WithInception();

        var title = await filmweb.Service().GetTitleAsync(500891, Everything with { People = false }, None);

        Assert.Empty(title!.Directors);
        Assert.Empty(title.Cast);
        Assert.Equal("Incepcja", title.Preview.Title);
        Assert.DoesNotContain(filmweb.Requests, r => r.StartsWith("person/", StringComparison.Ordinal));
        Assert.Equal(0, filmweb.Count("film/500891/top-roles"));
    }

    [Fact]
    public async Task TheCriticsRatingIsNotAskedForWhenSwitchedOff()
    {
        var filmweb = new FakeFilmweb().WithInception();

        var title = await filmweb.Service().GetTitleAsync(500891, Everything with { CriticsRating = false }, None);

        Assert.Null(title!.CriticsRating);
        Assert.NotNull(title.Rating);
        Assert.Equal(0, filmweb.Count("film/500891/critics/rating"));
    }

    [Fact]
    public async Task ABrokenRatingDoesNotCostTheRestOfTheMetadata()
    {
        var filmweb = new FakeFilmweb()
            .Status("film/500891/rating", HttpStatusCode.InternalServerError, times: 3)
            .WithInception();

        var title = await filmweb.Service().GetTitleAsync(500891, Everything, None);

        Assert.Null(title!.Rating);
        Assert.Equal("Incepcja", title.Preview.Title);
        Assert.NotNull(title.CriticsRating);
        Assert.NotEmpty(title.Cast);
    }

    [Fact]
    public async Task ABrokenPreviewIsAnError()
    {
        // Without the preview there is nothing to map, and a refresh must not look like "no such title".
        var filmweb = new FakeFilmweb().Status("film/500891/preview", HttpStatusCode.InternalServerError);

        await Assert.ThrowsAsync<HttpRequestException>(() => filmweb.Service().GetTitleAsync(500891, Everything, None));
    }
}
