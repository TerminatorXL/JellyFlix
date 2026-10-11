using System.Globalization;
using System.Text.Json;

namespace Jellyfin.Plugin.Filmweb.Api;

/// <summary>
/// Turns the API's JSON into the models. The API is undocumented and drops any field it has no
/// value for, so every read tolerates a missing or differently typed property: a title with half
/// its fields is still worth showing, and only malformed JSON is an error.
/// </summary>
public static class FilmwebJson
{
    public static IReadOnlyList<FilmwebSearchHit> SearchHits(string json)
    {
        using var document = JsonDocument.Parse(json);
        return Items(document.RootElement, "searchHits")
            .Select(hit => (Id: Long(hit, "id"), Type: Text(hit, "type"), Title: Text(hit, "matchedTitle")))
            .Where(hit => hit.Id is not null && hit.Type is not null)
            .Select(hit => new FilmwebSearchHit(hit.Id!.Value, hit.Type!, hit.Title))
            .ToList();
    }

    public static FilmwebTitleInfo? TitleInfo(string json, long id)
    {
        using var document = JsonDocument.Parse(json);
        var root = document.RootElement;
        var title = Text(root, "title") ?? Text(root, "originalTitle");
        return title is null
            ? null
            : new FilmwebTitleInfo(
                Long(root, "id") ?? id,
                title,
                Text(root, "originalTitle"),
                Int(root, "year"),
                Text(root, "type"),
                Text(root, "posterPath"));
    }

    public static FilmwebPreview? Preview(string json, long id)
    {
        using var document = JsonDocument.Parse(json);
        var root = document.RootElement;
        if (root.ValueKind != JsonValueKind.Object)
        {
            return null;
        }

        return new FilmwebPreview(
            Long(root, "id") ?? id,
            Text(root, "title", "title"),
            Text(root, "originalTitle", "title"),
            Int(root, "year"),
            Text(root, "entityName"),
            Items(root, "genres").Select(genre => Text(genre, "name", "text")).OfType<string>().ToList(),
            Items(root, "countries").Select(country => Text(country, "code")).OfType<string>().ToList(),
            FilmwebMarkup.ToPlainText(Text(root, "plot", "synopsis") ?? Text(root, "plotOrDescriptionSynopsis")),
            Text(root, "poster", "path"),
            People(root, "directors"),
            People(root, "mainCast"));
    }

    public static string? Description(string json)
    {
        using var document = JsonDocument.Parse(json);
        return FilmwebMarkup.ToPlainText(Text(document.RootElement, "synopsis"));
    }

    public static FilmwebRating? Rating(string json)
    {
        using var document = JsonDocument.Parse(json);
        var count = Int(document.RootElement, "count") ?? 0;
        var rate = Number(document.RootElement, "rate") ?? 0;

        // A title nobody voted on comes back as a rate of 0.0, which is not a score of zero.
        return count > 0 && rate > 0 ? new FilmwebRating(rate, count) : null;
    }

    public static FilmwebDates Dates(string json)
    {
        using var document = JsonDocument.Parse(json);
        var root = document.RootElement;
        return new FilmwebDates(
            Date(root, "worldReleaseDate"),
            Date(root, "worldPublicReleaseDate"),
            Date(root, "countryPublicReleaseDate"));
    }

    public static IReadOnlyList<FilmwebRole> TopRoles(string json)
    {
        using var document = JsonDocument.Parse(json);
        return Items(document.RootElement)
            .Select(role => (Person: Long(role, "person"), Profession: Text(role, "profession")))
            .Where(role => role.Person is not null)
            .Select(role => new FilmwebRole(role.Person!.Value, role.Profession ?? "unknown"))
            .ToList();
    }

    public static FilmwebPerson? Person(string json, long id)
    {
        using var document = JsonDocument.Parse(json);
        var root = document.RootElement;
        var name = Text(root, "name");
        return name is null ? null : new FilmwebPerson(Long(root, "id") ?? id, name, Text(root, "poster", "path"));
    }

    public static IReadOnlyList<FilmwebPhoto> Photos(string json)
    {
        using var document = JsonDocument.Parse(json);
        return Items(document.RootElement)
            .Select(photo => (Id: Long(photo, "id"), Path: Text(photo, "sourcePath")))
            .Where(photo => photo.Id is not null && photo.Path is not null)
            .Select(photo => new FilmwebPhoto(photo.Id!.Value, photo.Path!))
            .ToList();
    }

    private static List<FilmwebPersonRef> People(JsonElement root, string property) =>
        Items(root, property)
            .Select(person => (Id: Long(person, "id"), Name: Text(person, "name")))
            .Where(person => person.Id is not null && person.Name is not null)
            .Select(person => new FilmwebPersonRef(person.Id!.Value, person.Name!))
            .ToList();

    /// <summary>Filmweb writes dates as integers: 20100708.</summary>
    private static DateTime? Date(JsonElement root, string property)
    {
        var value = Int(root, property, "dateInt");
        return value is not null
            && DateTime.TryParseExact(
                value.Value.ToString(CultureInfo.InvariantCulture),
                "yyyyMMdd",
                CultureInfo.InvariantCulture,
                DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal,
                out var date)
            ? date
            : null;
    }

    private static JsonElement? Find(JsonElement element, ReadOnlySpan<string> path)
    {
        foreach (var name in path)
        {
            if (element.ValueKind != JsonValueKind.Object || !element.TryGetProperty(name, out var child))
            {
                return null;
            }

            element = child;
        }

        return element;
    }

    private static string? Text(JsonElement element, params ReadOnlySpan<string> path) =>
        Find(element, path) is { ValueKind: JsonValueKind.String } found && found.GetString() is { Length: > 0 } text
            ? text
            : null;

    private static long? Long(JsonElement element, params ReadOnlySpan<string> path) =>
        Find(element, path) is { ValueKind: JsonValueKind.Number } found && found.TryGetInt64(out var value) ? value : null;

    private static int? Int(JsonElement element, params ReadOnlySpan<string> path) =>
        Find(element, path) is { ValueKind: JsonValueKind.Number } found && found.TryGetInt32(out var value) ? value : null;

    private static double? Number(JsonElement element, params ReadOnlySpan<string> path) =>
        Find(element, path) is { ValueKind: JsonValueKind.Number } found && found.TryGetDouble(out var value) ? value : null;

    private static IEnumerable<JsonElement> Items(JsonElement element, params ReadOnlySpan<string> path) =>
        Find(element, path) is { ValueKind: JsonValueKind.Array } found ? found.EnumerateArray().ToList() : [];
}
