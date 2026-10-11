using MediaBrowser.Common.Configuration;
using MediaBrowser.Common.Plugins;
using MediaBrowser.Model.Plugins;
using MediaBrowser.Model.Serialization;

namespace Jellyfin.Plugin.Filmweb;

/// <summary>
/// Filmweb.pl as a metadata source for films and series.
///
/// Unlike the other plugins in this repository this one injects nothing into the web client. It is
/// a plain set of Jellyfin providers:
///   * <see cref="Providers.FilmwebMovieProvider"/> and <see cref="Providers.FilmwebSeriesProvider"/>
///     search Filmweb and fill in the Polish title, synopsis, genres, ratings, dates and cast;
///   * <see cref="Providers.FilmwebImageProvider"/> offers the poster and the stills;
///   * the external id makes "Filmweb" a field in the Identify dialog and a link on the item page.
/// They all talk to the REST API the Filmweb website itself uses, through <see cref="Api.FilmwebClient"/>.
/// </summary>
public class Plugin : BasePlugin<PluginConfiguration>, IHasWebPages
{
    /// <summary>The provider's name in library settings, and the key of the provider id.</summary>
    public const string ProviderName = "Filmweb";

    public Plugin(IApplicationPaths applicationPaths, IXmlSerializer xmlSerializer)
        : base(applicationPaths, xmlSerializer)
    {
        Instance = this;
    }

    /// <summary>The running instance, so the providers can read the config.</summary>
    public static Plugin? Instance { get; private set; }

    public override string Name => "Filmweb";

    public override Guid Id => Guid.Parse("e3a85d17-6b0c-4f29-a1d4-9c7e2f50b846");

    public override string Description =>
        "Filmweb.pl as a metadata source for films and series: Polish titles and synopses, genres, "
        + "user and critic ratings, cast, posters and stills.";

    public IEnumerable<PluginPageInfo> GetPages() =>
    [
        new PluginPageInfo
        {
            Name = Name,
            EmbeddedResourcePath = $"{GetType().Namespace}.Configuration.configPage.html"
        }
    ];
}
