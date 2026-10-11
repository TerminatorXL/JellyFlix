using Jellyfin.Plugin.Filmweb.Lookup;
using Xunit;

namespace Jellyfin.Plugin.Filmweb.Tests;

public class FilmwebIdsTests
{
    [Theory]
    [InlineData("500891", 500891)]
    [InlineData(" 500891 ", 500891)]
    // What people paste into the Identify dialog: the address of the title's page.
    [InlineData("https://www.filmweb.pl/film/Incepcja-2010-500891", 500891)]
    [InlineData("https://www.filmweb.pl/serial/Gra+o+tron-2011-476848#top", 476848)]
    [InlineData("https://www.filmweb.pl/film/Incepcja-2010-500891/cast/actors", 500891)]
    public void ReadsTheIdFromANumberOrAPageAddress(string value, long expected)
    {
        Assert.Equal(expected, FilmwebIds.Parse(value));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("tt1375666")]
    [InlineData("-5")]
    [InlineData("0")]
    [InlineData("https://www.filmweb.pl/")]
    public void AnythingElseIsNotAnId(string? value)
    {
        Assert.Null(FilmwebIds.Parse(value));
    }
}
