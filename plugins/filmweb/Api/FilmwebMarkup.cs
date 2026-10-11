using System.Text.RegularExpressions;

namespace Jellyfin.Plugin.Filmweb.Api;

/// <summary>
/// Filmweb texts carry BBCode-like links — <c>[person=87]Keanu Reeves[/person]</c> — that mean
/// nothing outside the site.
/// </summary>
public static partial class FilmwebMarkup
{
    public static string? ToPlainText(string? text)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            return null;
        }

        // Removing a tag in the middle of "a  [x]b[/x]" leaves the double spaces Filmweb's editors
        // also type by hand; only runs of spaces are collapsed, so paragraph breaks survive.
        var plain = Spaces().Replace(Tag().Replace(text, string.Empty), " ").Trim();
        return plain.Length == 0 ? null : plain;
    }

    [GeneratedRegex(@"\[/?[a-z]+(?:=[^\]]*)?\]", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex Tag();

    [GeneratedRegex(@"[ \t]{2,}")]
    private static partial Regex Spaces();
}
