using Jellyfin.Data.Enums;
using Jellyfin.Plugin.Filmweb.Api;
using Jellyfin.Plugin.Filmweb.Providers;
using MediaBrowser.Controller.Entities.Movies;
using MediaBrowser.Model.Entities;
using Xunit;

namespace Jellyfin.Plugin.Filmweb.Tests;

public class FilmwebMetadataMapperTests
{
    private static readonly FilmwebPreview Inception = FilmwebJson.Preview(Fixture.Read("preview"), 500891)!;

    private static FilmwebTitle Title(
        FilmwebPreview? preview = null,
        string? description = null,
        FilmwebRating? rating = null,
        FilmwebRating? critics = null,
        FilmwebDates? dates = null,
        IReadOnlyList<FilmwebPerson>? directors = null,
        IReadOnlyList<FilmwebPerson>? cast = null) =>
        new(preview ?? Inception, description, rating, critics, dates, directors ?? [], cast ?? []);

    private static Movie Map(FilmwebTitle title, bool preferOriginalTitle = false)
    {
        var movie = new Movie();
        FilmwebMetadataMapper.Apply(title, movie, preferOriginalTitle);
        return movie;
    }

    [Fact]
    public void ThePolishTitleIsTheNameAndTheOriginalStaysBesideIt()
    {
        var movie = Map(Title());

        Assert.Equal("Incepcja", movie.Name);
        Assert.Equal("Inception", movie.OriginalTitle);
    }

    [Fact]
    public void TheOriginalTitleCanBeTheNameInstead()
    {
        var movie = Map(Title(), preferOriginalTitle: true);

        Assert.Equal("Inception", movie.Name);
        Assert.Equal("Inception", movie.OriginalTitle);
    }

    [Fact]
    public void WhicheverTitleExistsIsUsedWhenTheOtherIsMissing()
    {
        Assert.Equal("Le livre muet", Map(Title(Inception with { Title = null, OriginalTitle = "Le livre muet" })).Name);
        Assert.Equal("Dom", Map(Title(Inception with { Title = "Dom", OriginalTitle = null }), preferOriginalTitle: true).Name);
    }

    [Fact]
    public void TheFullDescriptionIsTheOverview()
    {
        Assert.Equal("Pełny opis.", Map(Title(description: "Pełny opis.")).Overview);
    }

    [Fact]
    public void TheShortSynopsisStandsInWhenThereIsNoDescription()
    {
        Assert.StartsWith("Czasy, gdy technologia pozwala", Map(Title()).Overview);
    }

    [Fact]
    public void GenresYearAndProviderIdAreCarriedOver()
    {
        var movie = Map(Title());

        Assert.Equal(["Surrealistyczny", "Thriller", "Sci-Fi"], movie.Genres);
        Assert.Equal(2010, movie.ProductionYear);
        Assert.Equal("500891", movie.GetProviderId("Filmweb"));
    }

    [Theory]
    [InlineData("PL", "Poland")]
    [InlineData("FR", "France")]
    [InlineData("GB", "United Kingdom")]
    [InlineData("JP", "Japan")]
    [InlineData("KR", "South Korea")]
    [InlineData("RU", "Russia")]
    [InlineData("CN", "China")]
    [InlineData("TW", "Taiwan")]
    // Where the system's name and TMDb's differ, TMDb's is used: Jellyfin merges the production
    // locations of every provider, and two spellings of one country would both end up on the item.
    [InlineData("US", "United States of America")]
    [InlineData("CZ", "Czech Republic")]
    [InlineData("HK", "Hong Kong")]
    [InlineData("TR", "Turkey")]
    public void ACountryCodeBecomesTheNameOtherProvidersWrite(string code, string name)
    {
        Assert.Equal([name], Map(Title(Inception with { CountryCodes = [code] })).ProductionLocations);
    }

    [Theory]
    // Filmweb's own codes for countries that no longer exist, which are not ISO.
    [InlineData("XSU", "Soviet Union")]
    [InlineData("XCS", "Czechoslovakia")]
    [InlineData("XYU", "Yugoslavia")]
    [InlineData("XFY", "Yugoslavia")]
    [InlineData("XEG", "East Germany")]
    [InlineData("XWG", "Germany")]
    public void ACountryThatIsGoneStillHasAName(string code, string name)
    {
        Assert.Equal([name], Map(Title(Inception with { CountryCodes = [code] })).ProductionLocations);
    }

    [Fact]
    public void ACodeNobodyCanNameIsLeftOutRatherThanShownRaw()
    {
        var movie = Map(Title(Inception with { CountryCodes = ["PL", "XZZ", "??", "XYU", "XFY"] }));

        Assert.Equal(["Poland", "Yugoslavia"], movie.ProductionLocations);
    }

    [Fact]
    public void TheWorldPremiereIsThePremiereDate()
    {
        var premiere = new DateTime(2010, 7, 8, 0, 0, 0, DateTimeKind.Utc);
        var release = new DateTime(2010, 7, 14, 0, 0, 0, DateTimeKind.Utc);
        var polish = new DateTime(2010, 7, 30, 0, 0, 0, DateTimeKind.Utc);

        Assert.Equal(premiere, Map(Title(dates: new FilmwebDates(premiere, release, polish))).PremiereDate);
        Assert.Equal(release, Map(Title(dates: new FilmwebDates(null, release, polish))).PremiereDate);
        Assert.Equal(polish, Map(Title(dates: new FilmwebDates(null, null, polish))).PremiereDate);
        Assert.Null(Map(Title()).PremiereDate);
    }

    [Fact]
    public void TheUsersAverageIsTheCommunityRatingToOneDecimal()
    {
        Assert.Equal(8.2f, Map(Title(rating: new FilmwebRating(8.24123, 665787))).CommunityRating);
    }

    [Fact]
    public void TheCriticsAverageIsTheCriticRatingOutOfAHundred()
    {
        Assert.Equal(79f, Map(Title(critics: new FilmwebRating(7.87912, 91))).CriticRating);
    }

    [Fact]
    public void WithoutRatingsTheItemHasNone()
    {
        var movie = Map(Title());

        Assert.Null(movie.CommunityRating);
        Assert.Null(movie.CriticRating);
    }

    [Fact]
    public void PeopleAreDirectorsThenActorsInOrder()
    {
        var people = FilmwebMetadataMapper.People(Title(
            directors: [new FilmwebPerson(40896, "Christopher Nolan", null)],
            cast:
            [
                new FilmwebPerson(30, "Leonardo DiCaprio", "/00/30/30/449647_1.$.jpg"),
                new FilmwebPerson(3168, "Joseph Gordon-Levitt", null)
            ]));

        Assert.Equal(["Christopher Nolan", "Leonardo DiCaprio", "Joseph Gordon-Levitt"], people.Select(p => p.Name));
        Assert.Equal([PersonKind.Director, PersonKind.Actor, PersonKind.Actor], people.Select(p => p.Type));
        Assert.Equal([0, 1, 2], people.Select(p => p.SortOrder!.Value));
    }

    [Fact]
    public void APersonCarriesTheirPhotoAndFilmwebId()
    {
        var people = FilmwebMetadataMapper.People(Title(
            cast:
            [
                new FilmwebPerson(30, "Leonardo DiCaprio", "/00/30/30/449647_1.$.jpg"),
                new FilmwebPerson(3168, "Joseph Gordon-Levitt", null)
            ]));

        Assert.Equal("https://fwcdn.pl/ppo/00/30/30/449647_1.4.jpg", people[0].ImageUrl);
        Assert.Equal("30", people[0].GetProviderId("Filmweb"));
        Assert.Null(people[1].ImageUrl);
    }
}
