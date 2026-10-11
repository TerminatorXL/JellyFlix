using System.Text.RegularExpressions;

namespace Jellyfin.Plugin.Filmweb.Api;

/// <summary>
/// The API hands out image paths with a "$" where the size variant goes —
/// <c>/08/91/500891/7354571_1.$.jpg</c> — relative to a per-kind directory on the CDN. The variant
/// numbers are not ordered by size; the ones below were measured, and anything else is a 403.
/// </summary>
public static partial class FilmwebImages
{
    /// <summary>The widest a still comes in, which Jellyfin is told so it can apply its own minimum.</summary>
    public const int PhotoWidth = 900;

    private const string Cdn = "https://fwcdn.pl";

    /// <summary>500 px wide, the largest poster there is.</summary>
    public static string? Poster(string? path) => Url("fpo", path, 3);

    /// <summary>200 px wide, for the Identify dialog and the image picker.</summary>
    public static string? PosterThumbnail(string? path) => Url("fpo", path, 6);

    /// <summary>
    /// 500 px wide — or 150, for a photo uploaded before Filmweb versioned its files. Those have
    /// no "_1" before the size, come in three thumbnail sizes only, and answer 403 for anything
    /// larger; posters and stills of the same age do have their large variants.
    /// </summary>
    public static string? Person(string? path) => Url("ppo", path, path is not null && Versioned().IsMatch(path) ? 4 : 1);

    /// <summary>Up to 900 px wide, the largest still there is.</summary>
    public static string? Photo(string? path) => Url("fph", path, 1);

    /// <summary>450 px wide.</summary>
    public static string? PhotoThumbnail(string? path) => Url("fph", path, 3);

    [GeneratedRegex(@"_\d+\.\$\.")]
    private static partial Regex Versioned();

    private static string? Url(string directory, string? path, int size) =>
        string.IsNullOrEmpty(path)
            ? null
            : $"{Cdn}/{directory}/{path.TrimStart('/').Replace("$", size.ToString(System.Globalization.CultureInfo.InvariantCulture), StringComparison.Ordinal)}";
}
