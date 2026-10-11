using Jellyfin.Plugin.Filmweb.Api;
using Xunit;

namespace Jellyfin.Plugin.Filmweb.Tests;

public class FilmwebJsonTests
{
    [Fact]
    public void SearchHitsKeepTheirTypeSoTheCallerCanFilter()
    {
        var hits = FilmwebJson.SearchHits(Fixture.Read("search"));

        Assert.Equal(20, hits.Count);
        Assert.Equal(new FilmwebSearchHit(1281, "film", "Wiedźmin"), hits[0]);
        Assert.Equal(new FilmwebSearchHit(724464, "serial", "Wiedźmin"), hits[1]);
        // A "world" hit carries matchedName instead of matchedTitle.
        Assert.Equal(new FilmwebSearchHit(30, "world", null), hits[2]);
    }

    [Fact]
    public void SearchWithoutHitsIsEmpty()
    {
        Assert.Empty(FilmwebJson.SearchHits("""{"total":0}"""));
    }

    [Fact]
    public void TitleInfoCarriesTheYearAndPoster()
    {
        var info = FilmwebJson.TitleInfo(Fixture.Read("title-info"), 500891);

        Assert.Equal(
            new FilmwebTitleInfo(500891, "Incepcja", "Inception", 2010, "film", "/08/91/500891/7354571_1.$.jpg"),
            info);
    }

    [Fact]
    public void TitleInfoOfASerialSaysSo()
    {
        var info = FilmwebJson.TitleInfo(Fixture.Read("title-info-serial"), 476848);

        Assert.Equal("serial", info!.Type);
        Assert.Equal("Gra o tron", info.Title);
        Assert.Equal(2011, info.Year);
    }

    [Fact]
    public void TitleInfoWithoutATitleIsNothing()
    {
        Assert.Null(FilmwebJson.TitleInfo("""{"year":1999}""", 1));
    }

    [Fact]
    public void PreviewReadsTitlesYearAndType()
    {
        var preview = FilmwebJson.Preview(Fixture.Read("preview"), 500891)!;

        Assert.Equal(500891, preview.Id);
        Assert.Equal("Incepcja", preview.Title);
        Assert.Equal("Inception", preview.OriginalTitle);
        Assert.Equal(2010, preview.Year);
        Assert.Equal("film", preview.Type);
        Assert.Equal("/08/91/500891/7354571_1.$.jpg", preview.PosterPath);
    }

    [Fact]
    public void PreviewReadsGenresAndCountries()
    {
        var preview = FilmwebJson.Preview(Fixture.Read("preview"), 500891)!;

        Assert.Equal(["Surrealistyczny", "Thriller", "Sci-Fi"], preview.Genres);
        Assert.Equal(["US", "GB"], preview.CountryCodes);
    }

    [Fact]
    public void PreviewReadsDirectorsAndMainCast()
    {
        var preview = FilmwebJson.Preview(Fixture.Read("preview"), 500891)!;

        Assert.Equal([new FilmwebPersonRef(40896, "Christopher Nolan")], preview.Directors);
        Assert.Equal(
            [new FilmwebPersonRef(30, "Leonardo DiCaprio"), new FilmwebPersonRef(3168, "Joseph Gordon-Levitt")],
            preview.MainCast);
    }

    [Fact]
    public void PreviewReadsTheShortSynopsis()
    {
        var preview = FilmwebJson.Preview(Fixture.Read("preview"), 500891)!;

        Assert.StartsWith("Czasy, gdy technologia pozwala", preview.Synopsis);
    }

    [Fact]
    public void PreviewOfASerialSaysSo()
    {
        var preview = FilmwebJson.Preview(Fixture.Read("preview-serial"), 476848)!;

        Assert.Equal("serial", preview.Type);
        Assert.Equal("Gra o tron", preview.Title);
        Assert.Equal("Game of Thrones", preview.OriginalTitle);
    }

    [Fact]
    public void PreviewToleratesEverythingBeingAbsent()
    {
        var preview = FilmwebJson.Preview("""{"plotOrDescriptionSynopsis":""}""", 7)!;

        Assert.Equal(7, preview.Id);
        Assert.Null(preview.Title);
        Assert.Null(preview.Synopsis);
        Assert.Empty(preview.Genres);
        Assert.Empty(preview.Directors);
    }

    [Fact]
    public void DescriptionComesBackAsPlainText()
    {
        Assert.Equal(
            "Cobb (Leonardo DiCaprio) kradnie sekrety z cudzych snów. Tym razem ma wszczepić myśl, "
            + "a pomaga mu Arthur (Joseph Gordon-Levitt).",
            FilmwebJson.Description(Fixture.Read("description")));
    }

    [Fact]
    public void RatingReadsAverageAndVoteCount()
    {
        var rating = FilmwebJson.Rating(Fixture.Read("rating"))!;

        Assert.Equal(8.24123, rating.Average, 5);
        Assert.Equal(665787, rating.Count);
    }

    [Fact]
    public void CriticsRatingHasTheSameShape()
    {
        var rating = FilmwebJson.Rating(Fixture.Read("critics-rating"))!;

        Assert.Equal(7.87912, rating.Average, 5);
        Assert.Equal(91, rating.Count);
    }

    [Fact]
    public void ARatingNobodyVotedOnIsNoRating()
    {
        // What Filmweb sends for an obscure title: a rate of 0.0, which is not a score of zero.
        Assert.Null(FilmwebJson.Rating("""{"count":0,"rate":0.0,"countWantToSee":0}"""));
    }

    [Fact]
    public void DatesAreParsedFromFilmwebsIntegerFormat()
    {
        var dates = FilmwebJson.Dates(Fixture.Read("dates"));

        Assert.Equal(new DateTime(2010, 7, 8, 0, 0, 0, DateTimeKind.Utc), dates.WorldPremiere);
        Assert.Equal(DateTimeKind.Utc, dates.WorldPremiere!.Value.Kind);
        Assert.Equal(new DateTime(2010, 7, 14, 0, 0, 0, DateTimeKind.Utc), dates.WorldPublicRelease);
        Assert.Equal(new DateTime(2010, 7, 30, 0, 0, 0, DateTimeKind.Utc), dates.CountryRelease);
    }

    [Fact]
    public void AMissingOrImpossibleDateIsNull()
    {
        var dates = FilmwebJson.Dates("""{"worldReleaseDate":{"dateInt":20101399},"countryPublicReleaseDate":{}}""");

        Assert.Null(dates.WorldPremiere);
        Assert.Null(dates.WorldPublicRelease);
        Assert.Null(dates.CountryRelease);
    }

    [Fact]
    public void TopRolesKeepFilmwebsOrder()
    {
        var roles = FilmwebJson.TopRoles(Fixture.Read("top-roles"));

        Assert.Equal(20, roles.Count);
        Assert.Equal(new FilmwebRole(30, "actors"), roles[0]);
        Assert.Equal(new FilmwebRole(3168, "actors"), roles[1]);
    }

    [Fact]
    public void PersonReadsNameAndPhoto()
    {
        Assert.Equal(
            new FilmwebPerson(30, "Leonardo DiCaprio", "/00/30/30/449647_1.$.jpg"),
            FilmwebJson.Person(Fixture.Read("person"), 30));
    }

    [Fact]
    public void PhotosReadTheirPaths()
    {
        var photos = FilmwebJson.Photos(Fixture.Read("photos"));

        Assert.Equal(6, photos.Count);
        Assert.Equal(new FilmwebPhoto(225032, "/08/91/500891/225032_1.$.jpg"), photos[0]);
    }
}
