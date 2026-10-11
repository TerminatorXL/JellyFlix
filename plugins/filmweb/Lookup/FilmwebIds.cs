using System.Globalization;
using System.Text.RegularExpressions;

namespace Jellyfin.Plugin.Filmweb.Lookup;

public static partial class FilmwebIds
{
    /// <summary>
    /// Reads a Filmweb id from what is stored on an item or typed into the Identify dialog: the
    /// number itself, or the address of the title's page, which is what people actually have at
    /// hand — the id is the last number of the title's own path segment.
    /// </summary>
    public static long? Parse(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        var digits = PageAddress().Match(value) is { Success: true } page ? page.Groups[1].Value : value.Trim();
        return long.TryParse(digits, NumberStyles.None, CultureInfo.InvariantCulture, out var id) && id > 0 ? id : null;
    }

    [GeneratedRegex(@"filmweb\.pl/[a-z]+/[^/?#]*-(\d+)(?:[/?#]|$)", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex PageAddress();
}
