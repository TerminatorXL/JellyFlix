using MediaBrowser.Common.Configuration;
using MediaBrowser.Common.Plugins;
using MediaBrowser.Model.Plugins;
using MediaBrowser.Model.Serialization;

namespace Jellyfin.Plugin.PauseInfoCard;

/// <summary>
/// The pause info card, packaged as a Jellyfin plugin.
///
/// jellyfin-web 12.1 has no hook for custom JavaScript — Custom CSS is the only thing the Dashboard
/// will take. So this plugin does the two things a userscript manager or a reverse proxy would
/// otherwise have to do:
///   * <see cref="Services.ScriptInjectionStartupFilter"/> appends one &lt;script&gt; tag to
///     index.html on its way out, and
///   * <see cref="PauseInfoCardController"/> serves the bundle (embedded in this assembly) from
///     /PauseInfoCard/addon.js, together with the settings below as a config object.
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

    public override string Name => "Pause Info Card";

    public override Guid Id => Guid.Parse("b1f0a6e2-9c3d-4a7f-8e15-2d6c4b9a7f03");

    public override string Description =>
        "Pause playback and the film or series logo, the episode title and the synopsis fade in over "
        + "the frame. Plus optional CSS hooks: row names, scroll position and card metadata.";

    public IEnumerable<PluginPageInfo> GetPages() =>
    [
        new PluginPageInfo
        {
            Name = Name,
            EmbeddedResourcePath = $"{GetType().Namespace}.Configuration.configPage.html"
        }
    ];
}
