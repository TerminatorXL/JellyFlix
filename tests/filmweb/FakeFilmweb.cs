using System.Net;
using System.Text;
using Jellyfin.Plugin.Filmweb.Api;
using Jellyfin.Plugin.Filmweb.Lookup;
using Microsoft.Extensions.Logging.Abstractions;

namespace Jellyfin.Plugin.Filmweb.Tests;

/// <summary>
/// Stands in for www.filmweb.pl at the HTTP layer, so the real client, parser and service run
/// against scripted answers. Anything not scripted is a 404, which is what Filmweb does too.
/// </summary>
internal sealed class FakeFilmweb : HttpMessageHandler, IHttpClientFactory
{
    private const string Root = "/api/v1/";
    private readonly Dictionary<string, Queue<Func<HttpResponseMessage>>> _answers = new(StringComparer.Ordinal);
    private readonly Lock _lock = new();

    /// <summary>Every request made, as the path and query below /api/v1/.</summary>
    public List<string> Requests { get; } = [];

    public List<HttpRequestMessage> Messages { get; } = [];

    /// <summary>The waits the client asked for between retries; nothing actually sleeps.</summary>
    public List<TimeSpan> Delays { get; } = [];

    public FakeFilmweb Json(string path, string body) =>
        Answer(path, () => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(body, Encoding.UTF8, "application/json")
        });

    public FakeFilmweb Fixture(string path, string fixture) => Json(path, Tests.Fixture.Read(fixture));

    public FakeFilmweb Status(string path, HttpStatusCode status, int times = 1)
    {
        for (var i = 0; i < times; i++)
        {
            Answer(path, () => new HttpResponseMessage(status));
        }

        return this;
    }

    public FakeFilmweb Answer(string path, Func<HttpResponseMessage> answer)
    {
        if (!_answers.TryGetValue(path, out var queue))
        {
            _answers[path] = queue = new Queue<Func<HttpResponseMessage>>();
        }

        queue.Enqueue(answer);
        return this;
    }

    /// <summary>Inception, as the fixtures captured it: film 500891 with every endpoint present.</summary>
    public FakeFilmweb WithInception() => this
        .Fixture("title/500891/info", "title-info")
        .Fixture("film/500891/preview", "preview")
        .Fixture("film/500891/description", "description")
        .Fixture("film/500891/rating", "rating")
        .Fixture("film/500891/critics/rating", "critics-rating")
        .Fixture("film/500891/dates", "dates")
        .Fixture("film/500891/top-roles", "top-roles")
        .Fixture("film/500891/photos", "photos")
        .Fixture("person/30/preview", "person")
        .Json("person/3168/preview", """{"id":3168,"name":"Joseph Gordon-Levitt","poster":{"path":"/31/68/3168/1.$.jpg"}}""")
        .Json("person/57104/preview", """{"id":57104,"name":"Tom Hardy","poster":{"path":"/71/04/57104/2.$.jpg"}}""")
        .Json("person/84517/preview", """{"id":84517,"name":"Elliot Page"}""")
        .Json("person/40896/preview", """{"id":40896,"name":"Christopher Nolan","poster":{"path":"/08/96/40896/3.$.jpg"}}""")
        .Json(
            "live/search?query=Inception&pageSize=20",
            """{"total":1,"searchHits":[{"id":500891,"type":"film","matchedTitle":"Inception"}]}""");

    public FilmwebClient Client() =>
        new(CreateHttpClient, NullLogger<FilmwebClient>.Instance, (delay, _) =>
        {
            Delays.Add(delay);
            return Task.CompletedTask;
        });

    public FilmwebTitleService Service() => new(Client(), NullLogger<FilmwebTitleService>.Instance);

    public HttpClient CreateClient(string name) => CreateHttpClient();

    public int Count(string path) => Requests.Count(r => r == path);

    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        var pathAndQuery = request.RequestUri!.PathAndQuery;
        var path = pathAndQuery.StartsWith(Root, StringComparison.Ordinal) ? pathAndQuery[Root.Length..] : pathAndQuery;
        Func<HttpResponseMessage>? answer = null;
        lock (_lock)
        {
            Requests.Add(path);
            Messages.Add(request);
            if (_answers.TryGetValue(path, out var queue))
            {
                // The last scripted answer repeats, so a 200 keeps answering and a sequence ends on its tail.
                answer = queue.Count > 1 ? queue.Dequeue() : queue.Peek();
            }
        }

        return Task.FromResult(answer?.Invoke() ?? new HttpResponseMessage(HttpStatusCode.NotFound));
    }

    private HttpClient CreateHttpClient() => new(this, disposeHandler: false);
}
