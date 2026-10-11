using System.Net;
using Jellyfin.Plugin.Filmweb.Api;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace Jellyfin.Plugin.Filmweb.Tests;

public class FilmwebClientTests
{
    private static readonly CancellationToken None = CancellationToken.None;

    [Fact]
    public async Task SearchAsksLiveSearchWithTheQueryEncoded()
    {
        var filmweb = new FakeFilmweb().Fixture("live/search?query=gra%20o%20tron&pageSize=20", "search");

        var hits = await filmweb.Client().SearchAsync(" gra o tron ", None);

        Assert.Equal(["live/search?query=gra%20o%20tron&pageSize=20"], filmweb.Requests);
        Assert.Equal(20, hits.Count);
    }

    [Fact]
    public async Task AnEmptyQueryFindsNothingWithoutAsking()
    {
        var filmweb = new FakeFilmweb();

        Assert.Empty(await filmweb.Client().SearchAsync("   ", None));
        Assert.Empty(filmweb.Requests);
    }

    [Fact]
    public async Task RequestsGoToTheRestApiWithThePolishLocale()
    {
        var filmweb = new FakeFilmweb().WithInception();

        await filmweb.Client().GetPreviewAsync(500891, None);

        var request = Assert.Single(filmweb.Messages);
        Assert.Equal("https://www.filmweb.pl/api/v1/film/500891/preview", request.RequestUri!.AbsoluteUri);
        Assert.Equal("pl_PL", Assert.Single(request.Headers.GetValues("x-locale")));
        Assert.Contains(request.Headers.Accept, a => a.MediaType == "application/json");
        Assert.Contains("JellyFlix", request.Headers.UserAgent.ToString());
    }

    [Fact]
    public async Task EveryEndpointIsReadFromItsOwnPath()
    {
        var filmweb = new FakeFilmweb().WithInception();
        var client = filmweb.Client();

        Assert.Equal("Incepcja", (await client.GetTitleInfoAsync(500891, None))!.Title);
        Assert.Equal("Incepcja", (await client.GetPreviewAsync(500891, None))!.Title);
        Assert.StartsWith("Cobb (Leonardo DiCaprio)", await client.GetDescriptionAsync(500891, None));
        Assert.Equal(665787, (await client.GetRatingAsync(500891, None))!.Count);
        Assert.Equal(91, (await client.GetCriticsRatingAsync(500891, None))!.Count);
        Assert.Equal(2010, (await client.GetDatesAsync(500891, None))!.WorldPremiere!.Value.Year);
        Assert.Equal(20, (await client.GetTopRolesAsync(500891, None)).Count);
        Assert.Equal("Leonardo DiCaprio", (await client.GetPersonAsync(30, None))!.Name);
        Assert.Equal(6, (await client.GetPhotosAsync(500891, None)).Count);
    }

    [Fact]
    public async Task ATitleFilmwebDoesNotKnowIsNothingRatherThanAnError()
    {
        var client = new FakeFilmweb().Client();

        Assert.Null(await client.GetPreviewAsync(1, None));
        Assert.Null(await client.GetRatingAsync(1, None));
        Assert.Empty(await client.GetTopRolesAsync(1, None));
    }

    [Fact]
    public async Task NoContentIsNothing()
    {
        // What /film/{id}/description answers for a title nobody has described.
        var filmweb = new FakeFilmweb().Status("film/700832/description", HttpStatusCode.NoContent);

        Assert.Null(await filmweb.Client().GetDescriptionAsync(700832, None));
    }

    [Fact]
    public async Task WaitsAndAsksAgainWhenFilmwebSaysSlowDown()
    {
        var filmweb = new FakeFilmweb()
            .Status("film/500891/rating", HttpStatusCode.TooManyRequests)
            .Fixture("film/500891/rating", "rating");

        var rating = await filmweb.Client().GetRatingAsync(500891, None);

        Assert.Equal(665787, rating!.Count);
        Assert.Equal(2, filmweb.Requests.Count);
        Assert.Single(filmweb.Delays);
    }

    [Fact]
    public async Task WaitsLongerBeforeEachRetry()
    {
        var filmweb = new FakeFilmweb()
            .Status("film/500891/rating", HttpStatusCode.ServiceUnavailable, times: 2)
            .Fixture("film/500891/rating", "rating");

        await filmweb.Client().GetRatingAsync(500891, None);

        Assert.Equal(3, filmweb.Requests.Count);
        Assert.Equal(2, filmweb.Delays.Count);
        Assert.True(filmweb.Delays[1] > filmweb.Delays[0]);
    }

    [Fact]
    public async Task WaitsAsLongAsRetryAfterAsksFor()
    {
        var filmweb = new FakeFilmweb()
            .Answer("film/500891/rating", () =>
            {
                var response = new HttpResponseMessage(HttpStatusCode.TooManyRequests);
                response.Headers.RetryAfter = new System.Net.Http.Headers.RetryConditionHeaderValue(TimeSpan.FromSeconds(7));
                return response;
            })
            .Fixture("film/500891/rating", "rating");

        await filmweb.Client().GetRatingAsync(500891, None);

        Assert.Equal([TimeSpan.FromSeconds(7)], filmweb.Delays);
    }

    [Fact]
    public async Task GivesUpAfterThreeAttempts()
    {
        var filmweb = new FakeFilmweb().Status("film/500891/rating", HttpStatusCode.InternalServerError);

        await Assert.ThrowsAsync<HttpRequestException>(() => filmweb.Client().GetRatingAsync(500891, None));

        Assert.Equal(3, filmweb.Requests.Count);
    }

    [Fact]
    public async Task ARefusalIsNotRetried()
    {
        var filmweb = new FakeFilmweb().Status("film/500891/rating", HttpStatusCode.Forbidden);

        await Assert.ThrowsAsync<HttpRequestException>(() => filmweb.Client().GetRatingAsync(500891, None));

        Assert.Single(filmweb.Requests);
    }

    [Fact]
    public async Task ADroppedConnectionIsRetried()
    {
        var filmweb = new FakeFilmweb()
            .Answer("film/500891/rating", () => throw new HttpRequestException("connection reset"))
            .Fixture("film/500891/rating", "rating");

        var rating = await filmweb.Client().GetRatingAsync(500891, None);

        Assert.NotNull(rating);
        Assert.Equal(2, filmweb.Requests.Count);
    }

    [Fact]
    public async Task AnAnswerThatIsNotJsonIsAnErrorAndIsNotRemembered()
    {
        // A block page or a maintenance notice arrives as 200 text/html.
        var filmweb = new FakeFilmweb()
            .Json("film/500891/rating", "<html>Przerwa techniczna</html>")
            .Fixture("film/500891/rating", "rating");
        var client = filmweb.Client();

        await Assert.ThrowsAsync<HttpRequestException>(() => client.GetRatingAsync(500891, None));

        Assert.NotNull(await client.GetRatingAsync(500891, None));
    }

    [Fact]
    public async Task TheSameQuestionIsAnsweredFromMemoryTheSecondTime()
    {
        var filmweb = new FakeFilmweb().WithInception();
        var client = filmweb.Client();

        var first = await client.GetPreviewAsync(500891, None);
        var second = await client.GetPreviewAsync(500891, None);

        Assert.Equal("Incepcja", first!.Title);
        Assert.Equal("Incepcja", second!.Title);
        Assert.Single(filmweb.Requests);
    }

    [Fact]
    public async Task RemembersThatATitleDoesNotExist()
    {
        var filmweb = new FakeFilmweb();
        var client = filmweb.Client();

        await client.GetPreviewAsync(1, None);
        await client.GetPreviewAsync(1, None);

        Assert.Single(filmweb.Requests);
    }

    [Fact]
    public async Task AFailureIsNotRemembered()
    {
        var filmweb = new FakeFilmweb()
            .Status("film/500891/rating", HttpStatusCode.InternalServerError, times: 3)
            .Fixture("film/500891/rating", "rating");
        var client = filmweb.Client();

        await Assert.ThrowsAsync<HttpRequestException>(() => client.GetRatingAsync(500891, None));
        var rating = await client.GetRatingAsync(500891, None);

        Assert.NotNull(rating);
    }

    [Fact]
    public async Task NeverHasMoreThanFourRequestsInFlight()
    {
        var gate = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var handler = new CountingHandler(gate.Task);
        var client = new FilmwebClient(
            () => new HttpClient(handler, disposeHandler: false),
            NullLogger<FilmwebClient>.Instance);

        var calls = Enumerable.Range(1, 12).Select(id => client.GetRatingAsync(id, None)).ToArray();
        await handler.Reached(4);
        await Task.Delay(50);
        var whileBlocked = handler.MaxInFlight;
        gate.SetResult();
        await Task.WhenAll(calls);

        Assert.Equal(4, whileBlocked);
        Assert.Equal(4, handler.MaxInFlight);
        Assert.Equal(12, handler.Total);
    }

    private sealed class CountingHandler(Task gate) : HttpMessageHandler
    {
        private readonly TaskCompletionSource _four = new(TaskCreationOptions.RunContinuationsAsynchronously);
        private int _inFlight;
        private int _max;
        private int _total;

        public int MaxInFlight => _max;

        public int Total => _total;

        public Task Reached(int count) => _four.Task.WaitAsync(TimeSpan.FromSeconds(10));

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            var now = Interlocked.Increment(ref _inFlight);
            Interlocked.Increment(ref _total);
            int seen;
            while (now > (seen = _max) && Interlocked.CompareExchange(ref _max, now, seen) != seen)
            {
            }

            if (now >= 4)
            {
                _four.TrySetResult();
            }

            await gate;
            Interlocked.Decrement(ref _inFlight);
            return new HttpResponseMessage(HttpStatusCode.NotFound);
        }
    }
}
