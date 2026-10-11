using System.Globalization;
using System.Net;
using System.Text.Json;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.Filmweb.Api;

/// <summary>
/// A client for the REST API the Filmweb website itself uses, www.filmweb.pl/api/v1 — the subset
/// of https://github.com/b44x/filmweb-api this plugin needs, ported to C#.
///
/// The API is unofficial and unauthenticated, so this is deliberately a polite guest: answers are
/// remembered for an hour, no more than four requests are in flight at once, and a 429 or a 5xx is
/// waited out instead of hammered. A library scan asks about the same actors over and over, which
/// is what the cache is really for.
/// </summary>
public sealed class FilmwebClient : IDisposable
{
    private const string BaseUrl = "https://www.filmweb.pl/api/v1/";
    private const string UserAgent = "Mozilla/5.0 (compatible; JellyFlix-Filmweb/1.0; +https://github.com/TerminatorXL/JellyFlix)";
    private const int MaxAttempts = 3;
    private const int MaxInFlight = 4;
    private const int SearchPageSize = 20;

    private static readonly TimeSpan RememberFor = TimeSpan.FromHours(1);
    private static readonly TimeSpan AttemptTimeout = TimeSpan.FromSeconds(15);
    private static readonly TimeSpan LongestWait = TimeSpan.FromSeconds(30);

    private readonly Func<HttpClient> _httpClient;
    private readonly ILogger<FilmwebClient> _logger;
    private readonly Func<TimeSpan, CancellationToken, Task> _delay;
    private readonly MemoryCache _cache = new(new MemoryCacheOptions { SizeLimit = 5000 });
    private readonly SemaphoreSlim _gate = new(MaxInFlight, MaxInFlight);

    /// <param name="httpClient">Hands out a client per request, the way IHttpClientFactory does.</param>
    /// <param name="delay">How to wait between retries; replaced in tests so they do not sleep.</param>
    public FilmwebClient(
        Func<HttpClient> httpClient,
        ILogger<FilmwebClient> logger,
        Func<TimeSpan, CancellationToken, Task>? delay = null)
    {
        _httpClient = httpClient;
        _logger = logger;
        _delay = delay ?? Task.Delay;
    }

    /// <summary>The autocomplete search of filmweb.pl. Hits are of every type; the caller filters.</summary>
    public async Task<IReadOnlyList<FilmwebSearchHit>> SearchAsync(string query, CancellationToken cancellationToken)
    {
        query = query.Trim();
        if (query.Length == 0)
        {
            return [];
        }

        var path = $"live/search?query={Uri.EscapeDataString(query)}&pageSize={SearchPageSize.ToString(CultureInfo.InvariantCulture)}";
        return await GetAsync(path, FilmwebJson.SearchHits, cancellationToken).ConfigureAwait(false) ?? [];
    }

    public Task<FilmwebTitleInfo?> GetTitleInfoAsync(long id, CancellationToken cancellationToken) =>
        GetAsync($"title/{Id(id)}/info", json => FilmwebJson.TitleInfo(json, id), cancellationToken);

    /// <summary>Serials answer on the /film/ paths too, here and below.</summary>
    public Task<FilmwebPreview?> GetPreviewAsync(long id, CancellationToken cancellationToken) =>
        GetAsync($"film/{Id(id)}/preview", json => FilmwebJson.Preview(json, id), cancellationToken);

    public Task<string?> GetDescriptionAsync(long id, CancellationToken cancellationToken) =>
        GetAsync($"film/{Id(id)}/description", FilmwebJson.Description, cancellationToken);

    public Task<FilmwebRating?> GetRatingAsync(long id, CancellationToken cancellationToken) =>
        GetAsync($"film/{Id(id)}/rating", FilmwebJson.Rating, cancellationToken);

    public Task<FilmwebRating?> GetCriticsRatingAsync(long id, CancellationToken cancellationToken) =>
        GetAsync($"film/{Id(id)}/critics/rating", FilmwebJson.Rating, cancellationToken);

    public Task<FilmwebDates?> GetDatesAsync(long id, CancellationToken cancellationToken) =>
        GetAsync<FilmwebDates>($"film/{Id(id)}/dates", FilmwebJson.Dates, cancellationToken);

    public async Task<IReadOnlyList<FilmwebRole>> GetTopRolesAsync(long id, CancellationToken cancellationToken) =>
        await GetAsync($"film/{Id(id)}/top-roles", FilmwebJson.TopRoles, cancellationToken).ConfigureAwait(false) ?? [];

    public Task<FilmwebPerson?> GetPersonAsync(long id, CancellationToken cancellationToken) =>
        GetAsync($"person/{Id(id)}/preview", json => FilmwebJson.Person(json, id), cancellationToken);

    public async Task<IReadOnlyList<FilmwebPhoto>> GetPhotosAsync(long id, CancellationToken cancellationToken) =>
        await GetAsync($"film/{Id(id)}/photos", FilmwebJson.Photos, cancellationToken).ConfigureAwait(false) ?? [];

    public void Dispose()
    {
        _cache.Dispose();
        _gate.Dispose();
    }

    private static string Id(long id) => id.ToString(CultureInfo.InvariantCulture);

    /// <summary>Null when Filmweb has nothing at that path, which it says with a 404 or a 204.</summary>
    private async Task<T?> GetAsync<T>(string path, Func<string, T?> parse, CancellationToken cancellationToken)
        where T : class
    {
        if (!_cache.TryGetValue(path, out string? body))
        {
            body = await FetchAsync(path, cancellationToken).ConfigureAwait(false);
            _cache.Set(path, body, new MemoryCacheEntryOptions { AbsoluteExpirationRelativeToNow = RememberFor, Size = 1 });
        }

        if (body is null)
        {
            return null;
        }

        try
        {
            return parse(body);
        }
        catch (JsonException e)
        {
            // A block page or a maintenance notice with a 200 on it. Forget it, so the next refresh
            // asks again instead of failing on the same page for an hour.
            _cache.Remove(path);
            throw new HttpRequestException($"Filmweb answered {path} with something that is not JSON", e);
        }
    }

    private async Task<string?> FetchAsync(string path, CancellationToken cancellationToken)
    {
        for (var attempt = 1; ; attempt++)
        {
            HttpRequestException failure;
            TimeSpan? retryAfter = null;

            await _gate.WaitAsync(cancellationToken).ConfigureAwait(false);
            try
            {
                using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
                timeout.CancelAfter(AttemptTimeout);
                using var request = new HttpRequestMessage(HttpMethod.Get, BaseUrl + path);
                request.Headers.TryAddWithoutValidation("Accept", "application/json");
                request.Headers.TryAddWithoutValidation("User-Agent", UserAgent);
                request.Headers.TryAddWithoutValidation("x-locale", "pl_PL");

                using var response = await _httpClient().SendAsync(request, timeout.Token).ConfigureAwait(false);
                if (response.StatusCode is HttpStatusCode.NotFound or HttpStatusCode.NoContent)
                {
                    return null;
                }

                if (response.IsSuccessStatusCode)
                {
                    return await response.Content.ReadAsStringAsync(timeout.Token).ConfigureAwait(false);
                }

                failure = new HttpRequestException(
                    $"Filmweb answered {(int)response.StatusCode} for {path}",
                    null,
                    response.StatusCode);
                if (response.StatusCode != HttpStatusCode.TooManyRequests && (int)response.StatusCode < 500)
                {
                    throw failure;
                }

                retryAfter = RetryAfter(response);
            }
            catch (HttpRequestException e) when (e.StatusCode is null)
            {
                failure = e;
            }
            catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
            {
                failure = new HttpRequestException($"Filmweb did not answer {path} within {AttemptTimeout.TotalSeconds:0} s");
            }
            finally
            {
                // Released before the wait below: a request that is backing off must not hold a slot.
                _gate.Release();
            }

            if (attempt == MaxAttempts)
            {
                throw failure;
            }

            var wait = retryAfter ?? TimeSpan.FromSeconds(Math.Pow(2, attempt - 1));
            _logger.LogDebug("Filmweb: {Path} failed ({Reason}), attempt {Attempt}; retrying in {Wait}", path, failure.Message, attempt, wait);
            await _delay(wait, cancellationToken).ConfigureAwait(false);
        }
    }

    private static TimeSpan? RetryAfter(HttpResponseMessage response)
    {
        var header = response.Headers.RetryAfter;
        var wait = header?.Delta ?? (header?.Date is { } date ? date - DateTimeOffset.UtcNow : null);
        return wait is null ? null : TimeSpan.FromTicks(Math.Clamp(wait.Value.Ticks, 0, LongestWait.Ticks));
    }
}
