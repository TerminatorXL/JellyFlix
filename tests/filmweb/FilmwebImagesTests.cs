using Jellyfin.Plugin.Filmweb.Api;
using Xunit;

namespace Jellyfin.Plugin.Filmweb.Tests;

public class FilmwebImagesTests
{
    [Fact]
    public void PosterIsTheLargestVariantTheCdnServes()
    {
        Assert.Equal(
            "https://fwcdn.pl/fpo/08/91/500891/7354571_1.3.jpg",
            FilmwebImages.Poster("/08/91/500891/7354571_1.$.jpg"));
    }

    [Fact]
    public void PosterThumbnailIsASmallVariant()
    {
        Assert.Equal(
            "https://fwcdn.pl/fpo/08/91/500891/7354571_1.6.jpg",
            FilmwebImages.PosterThumbnail("/08/91/500891/7354571_1.$.jpg"));
    }

    [Fact]
    public void PersonPhotoComesFromThePersonDirectory()
    {
        Assert.Equal(
            "https://fwcdn.pl/ppo/00/30/30/449647_1.4.jpg",
            FilmwebImages.Person("/00/30/30/449647_1.$.jpg"));
    }

    [Fact]
    public void AnOlderPersonPhotoIsOnlyThereSmall()
    {
        // Photos uploaded before Filmweb versioned its files — no "_1" before the size — exist in
        // three thumbnail sizes and nothing larger; asking for the big one is a 403.
        Assert.Equal(
            "https://fwcdn.pl/ppo/06/18/10618/342343.1.jpg",
            FilmwebImages.Person("/06/18/10618/342343.$.jpg"));
    }

    [Fact]
    public void StillComesFromThePhotoDirectory()
    {
        Assert.Equal(
            "https://fwcdn.pl/fph/08/91/500891/225032_1.1.jpg",
            FilmwebImages.Photo("/08/91/500891/225032_1.$.jpg"));
        Assert.Equal(
            "https://fwcdn.pl/fph/08/91/500891/225032_1.3.jpg",
            FilmwebImages.PhotoThumbnail("/08/91/500891/225032_1.$.jpg"));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    public void NoPathIsNoUrl(string? path)
    {
        Assert.Null(FilmwebImages.Poster(path));
        Assert.Null(FilmwebImages.Person(path));
        Assert.Null(FilmwebImages.Photo(path));
    }
}
