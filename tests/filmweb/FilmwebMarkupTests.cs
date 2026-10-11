using Jellyfin.Plugin.Filmweb.Api;
using Xunit;

namespace Jellyfin.Plugin.Filmweb.Tests;

public class FilmwebMarkupTests
{
    [Fact]
    public void StripsPersonLinksAndKeepsTheirText()
    {
        var plain = FilmwebMarkup.ToPlainText("Neo ([person=87]Keanu Reeves[/person]) jest hakerem.");

        Assert.Equal("Neo (Keanu Reeves) jest hakerem.", plain);
    }

    [Fact]
    public void CollapsesTheDoubledSpacesFilmwebLeavesBehind()
    {
        Assert.Equal("gwiazdorską obsadą", FilmwebMarkup.ToPlainText("  gwiazdorską  obsadą "));
    }

    [Fact]
    public void KeepsParagraphBreaks()
    {
        Assert.Equal("Pierwszy.\n\nDrugi.", FilmwebMarkup.ToPlainText("Pierwszy.\n\nDrugi."));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void NothingToShowIsNull(string? text)
    {
        Assert.Null(FilmwebMarkup.ToPlainText(text));
    }
}
