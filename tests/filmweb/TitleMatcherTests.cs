using Jellyfin.Plugin.Filmweb.Api;
using Jellyfin.Plugin.Filmweb.Lookup;
using Xunit;

namespace Jellyfin.Plugin.Filmweb.Tests;

public class TitleMatcherTests
{
    private static FilmwebCandidate Hit(long id, string title, string? original, int? year, string? matched = null) =>
        new(id, title, original, matched ?? title, year, null);

    [Fact]
    public void PrefersTheHitWhoseTitleAndYearBothMatch()
    {
        FilmwebCandidate[] hits =
        [
            Hit(1281, "Wiedźmin", "Wiedźmin", 2001),
            Hit(10043627, "Wiedźmin: Syreny z głębin", "The Witcher: Sirens of the Deep", 2025),
            Hit(1, "Wiedźmin", "The Witcher", 2025)
        ];

        Assert.Equal(1, TitleMatcher.Pick(hits, "Wiedźmin", 2025)!.Id);
    }

    [Fact]
    public void AYearOffByOneStillMatches()
    {
        // Release years differ by country; a file named after the Polish premiere is the usual case.
        FilmwebCandidate[] hits = [Hit(500891, "Incepcja", "Inception", 2010)];

        Assert.Equal(500891, TitleMatcher.Pick(hits, "Inception", 2011)!.Id);
        Assert.Equal(500891, TitleMatcher.Pick(hits, "Inception", 2009)!.Id);
    }

    [Fact]
    public void WithAYearTheFirstHitOfThatYearWinsEvenUnderAnotherTitle()
    {
        FilmwebCandidate[] hits =
        [
            Hit(5, "Leon", "Leon", 1990),
            Hit(671, "Leon zawodowiec", "Léon", 1994)
        ];

        Assert.Equal(671, TitleMatcher.Pick(hits, "Leon: The Professional", 1994)!.Id);
    }

    [Fact]
    public void WithAYearNothingFromAnotherYearIsAccepted()
    {
        // A wrong film's metadata is worse than none: the user can still pick one by hand.
        FilmwebCandidate[] hits = [Hit(500891, "Incepcja", "Inception", 2010)];

        Assert.Null(TitleMatcher.Pick(hits, "Inception", 2015));
    }

    [Fact]
    public void WithoutAYearTheTitleHasToMatchExactly()
    {
        FilmwebCandidate[] hits =
        [
            Hit(10, "Gra o tron: Ostatnia warta", "Game of Thrones: The Last Watch", 2019),
            Hit(476848, "Gra o tron", "Game of Thrones", 2011)
        ];

        Assert.Equal(476848, TitleMatcher.Pick(hits, "Game of Thrones", null)!.Id);
        Assert.Equal(476848, TitleMatcher.Pick(hits, "Gra o tron", null)!.Id);
        Assert.Null(TitleMatcher.Pick(hits, "Game of Throne", null));
    }

    [Fact]
    public void TitlesAreComparedWithoutCaseAccentsOrPunctuation()
    {
        FilmwebCandidate[] hits = [Hit(867501, "Wiedźmin: Zmora Wilka", "The Witcher: Nightmare of the Wolf", 2021)];

        Assert.NotNull(TitleMatcher.Pick(hits, "wiedzmin zmora wilka", null));
        Assert.NotNull(TitleMatcher.Pick(hits, "The Witcher - Nightmare of the Wolf", null));
    }

    [Fact]
    public void TheTitleTheSearchMatchedOnCountsToo()
    {
        // Filmweb matches alternative titles that neither the Polish nor the original title carries.
        FilmwebCandidate[] hits =
        [
            Hit(7603, "Matrix Reaktywacja", "The Matrix Reloaded", 2003, matched: "Matrix Reloaded")
        ];

        Assert.Equal(7603, TitleMatcher.Pick(hits, "Matrix Reloaded", null)!.Id);
    }

    [Fact]
    public void AnExactTitleWhoseYearFilmwebDoesNotKnowStillMatches()
    {
        FilmwebCandidate[] hits = [Hit(9, "Dom", "Dom", null)];

        Assert.Equal(9, TitleMatcher.Pick(hits, "Dom", 1958)!.Id);
    }

    [Fact]
    public void AHitWithoutAYearIsNotTakenOnADifferentTitle()
    {
        FilmwebCandidate[] hits = [Hit(9, "Dom zły", "Dom zły", null)];

        Assert.Null(TitleMatcher.Pick(hits, "Dom", 1958));
    }

    [Fact]
    public void NothingToChooseFromIsNothing()
    {
        Assert.Null(TitleMatcher.Pick([], "Inception", 2010));
        Assert.Null(TitleMatcher.Pick([Hit(1, "Incepcja", "Inception", 2010)], " ", 2010));
    }
}
