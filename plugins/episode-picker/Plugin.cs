using MediaBrowser.Common.Configuration;
using MediaBrowser.Common.Plugins;
using MediaBrowser.Model.Plugins;
using MediaBrowser.Model.Serialization;

namespace Jellyfin.Plugin.EpisodePicker;

/// <summary>
/// The in-player episode picker, packaged as a Jellyfin plugin.
///
/// jellyfin-web 12.1 has no hook for custom JavaScript — Custom CSS is the only thing the Dashboard
/// will take. So this plugin does the two things a userscript manager or a reverse proxy would
/// otherwise have to do:
///   * <see cref="Services.ScriptInjectionStartupFilter"/> appends one &lt;script&gt; tag to
///     index.html on its way out, and
///   * <see cref="EpisodePickerController"/> serves the bundle (embedded in this assembly) from
///     /EpisodePicker/addon.js, together with the settings below as a config object.
/// </summary>
public class Plugin : BasePlugin<PluginConfiguration>, IHasWebPages
{
    public Plugin(IApplicationPaths applicationPaths, IXmlSerializer xmlSerializer)
        : base(applicationPaths, xmlSerializer)
    {
        Instance = this;
    }

    /// <summary>The running instance, so the middleware and the controller can read the config.</summary>
    public static Plugin? Instance { get; private set; }

    public override string Name => "Episode Picker";

    public override Guid Id => Guid.Parse("c7d4e9a1-3f62-4b85-9e07-5a1d8c2b6f34");

    public override string Description =>
        "Adds a button to the player while a series is playing: a drawer with the episodes of the "
        + "current season, a season selector, thumbnails and watched state. Picking an episode starts it.";

    public IEnumerable<PluginPageInfo> GetPages() =>
    [
        new PluginPageInfo
        {
            Name = Name,
            EmbeddedResourcePath = $"{GetType().Namespace}.Configuration.configPage.html"
        }
    ];
}
