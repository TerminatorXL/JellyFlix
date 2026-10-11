using System.Globalization;
using System.Text;
using Jellyfin.Plugin.Filmweb.Api;

namespace Jellyfin.Plugin.Filmweb.Lookup;

/// <summary>
/// Decides which search hit — if any — is the title a library item is about, when nobody is there
/// to choose. Filmweb's search is an autocomplete: it always answers with something, and the
/// second hit for "incepcja" is a biopic of Ingeborg Bachmann. So a hit has to earn its place, and
/// when none does the item is left alone: a wrong film's synopsis and rating are worse than none,
/// and Identify is one click away.
/// </summary>
public static class TitleMatcher
{
    /// <param name="candidates">Hits in Filmweb's own order of relevance.</param>
    /// <param name="name">What Jellyfin read from the file or folder name.</param>
    /// <param name="year">The year from the name, when there was one.</param>
    public static FilmwebCandidate? Pick(IReadOnlyList<FilmwebCandidate> candidates, string? name, int? year)
    {
        var wanted = Normalize(name);
        if (wanted.Length == 0)
        {
            return null;
        }

        bool SameTitle(FilmwebCandidate hit) =>
            Normalize(hit.Title) == wanted || Normalize(hit.OriginalTitle) == wanted || Normalize(hit.MatchedTitle) == wanted;

        if (year is null)
        {
            return candidates.FirstOrDefault(SameTitle);
        }

        // Off by one is still the same film: release years differ between countries, and a file is
        // as likely to be named after the Polish premiere as after the first one.
        bool SameYear(FilmwebCandidate hit) => hit.Year is not null && Math.Abs(hit.Year.Value - year.Value) <= 1;

        return candidates.FirstOrDefault(hit => SameTitle(hit) && (hit.Year is null || SameYear(hit)))
            ?? candidates.FirstOrDefault(SameYear);
    }

    /// <summary>Lower case, no accents, no punctuation: "Wiedźmin: Zmora Wilka" → "wiedzmin zmora wilka".</summary>
    private static string Normalize(string? title)
    {
        if (string.IsNullOrWhiteSpace(title))
        {
            return string.Empty;
        }

        var normalized = new StringBuilder(title.Length);
        foreach (var c in title.ToLowerInvariant().Normalize(NormalizationForm.FormD))
        {
            if (CharUnicodeInfo.GetUnicodeCategory(c) == UnicodeCategory.NonSpacingMark)
            {
                continue;
            }

            // "ł" is a letter of its own, not an "l" with a mark, so decomposition leaves it alone.
            var folded = c == 'ł' ? 'l' : c;
            if (char.IsLetterOrDigit(folded))
            {
                normalized.Append(folded);
            }
            else if (normalized.Length > 0 && normalized[^1] != ' ')
            {
                normalized.Append(' ');
            }
        }

        return normalized.ToString().TrimEnd();
    }
}
