namespace Jellyfin.Plugin.Filmweb.Api;

/* What the Filmweb REST API (www.filmweb.pl/api/v1) answers, reduced to the fields this plugin maps
 * onto a Jellyfin item. The shapes follow https://github.com/b44x/filmweb-api, which documents the
 * endpoints; image paths keep the API's "$" size placeholder — see FilmwebImages. */

/// <summary>One hit of /live/search. Type is film, serial, game, world, person…</summary>
public sealed record FilmwebSearchHit(long Id, string Type, string? Title);

/// <summary>/title/{id}/info — the one endpoint that carries a year next to a search hit.</summary>
public sealed record FilmwebTitleInfo(
    long Id,
    string Title,
    string? OriginalTitle,
    int? Year,
    string? Type,
    string? PosterPath);

public sealed record FilmwebPersonRef(long Id, string Name);

/// <summary>/film/{id}/preview — serials answer on the same path.</summary>
public sealed record FilmwebPreview(
    long Id,
    string? Title,
    string? OriginalTitle,
    int? Year,
    string? Type,
    IReadOnlyList<string> Genres,
    IReadOnlyList<string> CountryCodes,
    string? Synopsis,
    string? PosterPath,
    IReadOnlyList<FilmwebPersonRef> Directors,
    IReadOnlyList<FilmwebPersonRef> MainCast);

/// <summary>/film/{id}/rating and /film/{id}/critics/rating, both on a 1–10 scale.</summary>
public sealed record FilmwebRating(double Average, int Count);

public sealed record FilmwebDates(DateTime? WorldPremiere, DateTime? WorldPublicRelease, DateTime? CountryRelease);

/// <summary>/film/{id}/top-roles — person ids only, best rated role first.</summary>
public sealed record FilmwebRole(long PersonId, string Profession);

public sealed record FilmwebPerson(long Id, string Name, string? PhotoPath);

public sealed record FilmwebPhoto(long Id, string Path);

public enum FilmwebKind
{
    Film,
    Serial
}

/// <summary>A search hit with the year and poster /title/{id}/info adds to it.</summary>
public sealed record FilmwebCandidate(
    long Id,
    string Title,
    string? OriginalTitle,
    string? MatchedTitle,
    int? Year,
    string? PosterPath);

/// <summary>Everything the plugin maps onto one Jellyfin item, gathered from several endpoints.</summary>
public sealed record FilmwebTitle(
    FilmwebPreview Preview,
    string? Description,
    FilmwebRating? Rating,
    FilmwebRating? CriticsRating,
    FilmwebDates? Dates,
    IReadOnlyList<FilmwebPerson> Directors,
    IReadOnlyList<FilmwebPerson> Cast);

public sealed record FilmwebFetchOptions(bool People, int CastLimit, bool CriticsRating);
