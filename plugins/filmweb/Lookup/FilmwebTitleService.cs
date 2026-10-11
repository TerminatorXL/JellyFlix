using Jellyfin.Plugin.Filmweb.Api;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.Filmweb.Lookup;

/// <summary>
/// The two things a provider asks of Filmweb, each of which takes several requests: "which titles
/// could this be?" and "everything about this title". No endpoint answers either on its own —
/// a search hit has no year, and a title's synopsis, ratings, dates and cast each live at their own
/// address.
/// </summary>
public sealed class FilmwebTitleService
{
    /// <summary>
    /// How many hits of a search are looked up. Each costs a request, and Filmweb orders by
    /// relevance, so the title is at the top or it is not in the list at all.
    /// </summary>
    private const int MaxCandidates = 8;
    private const string Actors = "actors";

    private readonly FilmwebClient _client;
    private readonly ILogger<FilmwebTitleService> _logger;

    public FilmwebTitleService(FilmwebClient client, ILogger<FilmwebTitleService> logger)
    {
        _client = client;
        _logger = logger;
    }

    /// <summary>Hits of the given kind, in Filmweb's order, with the year and poster added.</summary>
    public async Task<IReadOnlyList<FilmwebCandidate>> SearchAsync(string? name, FilmwebKind kind, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            return [];
        }

        var type = kind == FilmwebKind.Serial ? "serial" : "film";
        var hits = (await _client.SearchAsync(name, cancellationToken).ConfigureAwait(false))
            .Where(hit => hit.Type == type)
            .Take(MaxCandidates)
            .ToList();
        var infos = await Task.WhenAll(hits.Select(hit =>
            Optional(() => _client.GetTitleInfoAsync(hit.Id, cancellationToken), "the info", hit.Id))).ConfigureAwait(false);

        return hits
            .Zip(infos, (hit, info) => info is null ? null : Candidate(info, hit.Title))
            .OfType<FilmwebCandidate>()
            .ToList();
    }

    /// <summary>
    /// The hit a library item is about, or null when none is a safe match. The names are tried in
    /// turn: the one on the item is often another provider's translation, which Filmweb may title
    /// differently, while the original title is the one both sides agree on.
    /// </summary>
    public async Task<FilmwebCandidate?> FindAsync(IReadOnlyList<string?> names, int? year, FilmwebKind kind, CancellationToken cancellationToken)
    {
        foreach (var name in names)
        {
            var hits = await SearchAsync(name, kind, cancellationToken).ConfigureAwait(false);
            if (TitleMatcher.Pick(hits, name, year) is { } match)
            {
                return match;
            }
        }

        return null;
    }

    public async Task<FilmwebCandidate?> GetCandidateAsync(long id, CancellationToken cancellationToken) =>
        await _client.GetTitleInfoAsync(id, cancellationToken).ConfigureAwait(false) is { } info ? Candidate(info, null) : null;

    /// <summary>
    /// Null when Filmweb has no such title. The preview is the title: without it there is nothing
    /// to map, so its failure is the caller's failure. Everything else is an extra, and a broken
    /// rating endpoint must not cost a refresh its synopsis — those are logged and left out.
    /// </summary>
    public async Task<FilmwebTitle?> GetTitleAsync(long id, FilmwebFetchOptions options, CancellationToken cancellationToken)
    {
        var preview = await _client.GetPreviewAsync(id, cancellationToken).ConfigureAwait(false);
        if (preview is null)
        {
            return null;
        }

        var description = Optional(() => _client.GetDescriptionAsync(id, cancellationToken), "the description", id);
        var rating = Optional(() => _client.GetRatingAsync(id, cancellationToken), "the rating", id);
        var critics = options.CriticsRating
            ? Optional(() => _client.GetCriticsRatingAsync(id, cancellationToken), "the critics' rating", id)
            : Task.FromResult<FilmwebRating?>(null);
        var dates = Optional(() => _client.GetDatesAsync(id, cancellationToken), "the dates", id);
        var directors = options.People
            ? PeopleAsync(preview.Directors.Select(d => (d.Id, (string?)d.Name)), cancellationToken)
            : Task.FromResult<IReadOnlyList<FilmwebPerson>>([]);
        var cast = CastAsync(id, preview, options.People ? options.CastLimit : 0, cancellationToken);
        await Task.WhenAll(description, rating, critics, dates, directors, cast).ConfigureAwait(false);

        return new FilmwebTitle(preview, description.Result, rating.Result, critics.Result, dates.Result, directors.Result, cast.Result);
    }

    /// <summary>
    /// The two leads the preview names, in billing order, then the best rated roles. Filmweb has
    /// no endpoint for a cast in billing order, and none at all for the characters played.
    /// </summary>
    private async Task<IReadOnlyList<FilmwebPerson>> CastAsync(long id, FilmwebPreview preview, int limit, CancellationToken cancellationToken)
    {
        if (limit <= 0)
        {
            return [];
        }

        var cast = preview.MainCast.Select(lead => (lead.Id, Name: (string?)lead.Name)).ToList();
        if (cast.Count < limit)
        {
            var roles = await Optional(() => _client.GetTopRolesAsync(id, cancellationToken)!, "the top roles", id).ConfigureAwait(false) ?? [];
            cast.AddRange(roles
                .Where(role => role.Profession == Actors && cast.All(known => known.Id != role.PersonId))
                .Select(role => role.PersonId)
                .Distinct()
                .Select(personId => (personId, (string?)null)));
        }

        return await PeopleAsync(cast.Take(limit), cancellationToken).ConfigureAwait(false);
    }

    /// <summary>
    /// Looks each person up for their photo — and, for a role, their name. Someone whose page is
    /// gone keeps the name the preview gave; without one there is nobody to show.
    /// </summary>
    private async Task<IReadOnlyList<FilmwebPerson>> PeopleAsync(IEnumerable<(long Id, string? Name)> people, CancellationToken cancellationToken)
    {
        var looked = await Task.WhenAll(people.Select(async person =>
            await Optional(() => _client.GetPersonAsync(person.Id, cancellationToken), "the person", person.Id).ConfigureAwait(false)
            ?? (person.Name is null ? null : new FilmwebPerson(person.Id, person.Name, null)))).ConfigureAwait(false);

        return looked.OfType<FilmwebPerson>().ToList();
    }

    private static FilmwebCandidate Candidate(FilmwebTitleInfo info, string? matchedTitle) =>
        new(info.Id, info.Title, info.OriginalTitle, matchedTitle, info.Year, info.PosterPath);

    private async Task<T?> Optional<T>(Func<Task<T?>> read, string what, long id)
        where T : class
    {
        try
        {
            return await read().ConfigureAwait(false);
        }
        catch (HttpRequestException e)
        {
            _logger.LogWarning("Filmweb: could not read {What} of {Id}, carrying on without it: {Reason}", what, id, e.Message);
            return null;
        }
    }
}
