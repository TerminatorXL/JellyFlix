using System.Globalization;
using Jellyfin.Data.Enums;
using Jellyfin.Plugin.Filmweb.Api;
using MediaBrowser.Controller.Entities;
using MediaBrowser.Model.Entities;

namespace Jellyfin.Plugin.Filmweb.Providers;

/// <summary>Where each Filmweb field lands on a Jellyfin item.</summary>
public static class FilmwebMetadataMapper
{
    /// <summary>
    /// Country names the system would spell differently from TMDb, and Filmweb's own codes for
    /// countries that are gone, which are not ISO and which nothing else can name. West Germany is
    /// "Germany" because that is what TMDb files its films under.
    /// </summary>
    private static readonly Dictionary<string, string> CountryNames = new(StringComparer.OrdinalIgnoreCase)
    {
        ["US"] = "United States of America",
        ["CZ"] = "Czech Republic",
        ["HK"] = "Hong Kong",
        ["TR"] = "Turkey",
        ["XSU"] = "Soviet Union",
        ["XCS"] = "Czechoslovakia",
        ["XYU"] = "Yugoslavia",
        ["XFY"] = "Yugoslavia",
        ["XEG"] = "East Germany",
        ["XWG"] = "Germany"
    };

    public static void Apply(FilmwebTitle title, BaseItem item, bool preferOriginalTitle)
    {
        var preview = title.Preview;

        item.Name = preferOriginalTitle
            ? preview.OriginalTitle ?? preview.Title
            : preview.Title ?? preview.OriginalTitle;
        item.OriginalTitle = preview.OriginalTitle ?? preview.Title;
        item.Overview = title.Description ?? preview.Synopsis;
        item.Genres = preview.Genres.ToArray();
        item.ProductionYear = preview.Year;
        item.ProductionLocations = preview.CountryCodes.Select(CountryName).OfType<string>().Distinct().ToArray();
        item.PremiereDate = title.Dates?.WorldPremiere ?? title.Dates?.WorldPublicRelease ?? title.Dates?.CountryRelease;

        // Filmweb votes 1–10 like Jellyfin's community rating; its critics do too, where Jellyfin's
        // critic rating is a percentage.
        item.CommunityRating = title.Rating is null ? null : (float)Math.Round(title.Rating.Average, 1);
        item.CriticRating = title.CriticsRating is null ? null : (float)Math.Round(title.CriticsRating.Average * 10);

        item.SetProviderId(Plugin.ProviderName, preview.Id.ToString(CultureInfo.InvariantCulture));
    }

    /// <summary>Directors first, then the cast, numbered in that order.</summary>
    public static IReadOnlyList<PersonInfo> People(FilmwebTitle title)
    {
        var people = new List<PersonInfo>();
        people.AddRange(title.Directors.Select(person => Person(person, PersonKind.Director)));
        people.AddRange(title.Cast.Select(person => Person(person, PersonKind.Actor)));
        for (var i = 0; i < people.Count; i++)
        {
            people[i].SortOrder = i;
        }

        return people;
    }

    private static PersonInfo Person(FilmwebPerson person, PersonKind kind)
    {
        var info = new PersonInfo
        {
            Name = person.Name,
            Type = kind,
            ImageUrl = FilmwebImages.Person(person.PhotoPath)
        };
        info.SetProviderId(Plugin.ProviderName, person.Id.ToString(CultureInfo.InvariantCulture));
        return info;
    }

    /// <summary>
    /// Filmweb gives codes; Jellyfin's production locations are names. English ones, spelled the
    /// way TMDb spells them: Jellyfin merges the locations of every provider, so a second spelling
    /// of the same country would sit on the item beside the first. A code nothing can name is left
    /// out — "XZZ" among an item's countries helps nobody.
    /// </summary>
    private static string? CountryName(string code)
    {
        if (CountryNames.TryGetValue(code, out var name))
        {
            return name;
        }

        if (code.Length != 2 || !char.IsAsciiLetter(code[0]) || !char.IsAsciiLetter(code[1]))
        {
            return null;
        }

        try
        {
            return new RegionInfo(code).EnglishName;
        }
        catch (ArgumentException)
        {
            return null;
        }
    }
}
