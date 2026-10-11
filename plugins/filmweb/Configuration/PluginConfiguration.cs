using MediaBrowser.Model.Plugins;

namespace Jellyfin.Plugin.Filmweb;

/// <summary>
/// What the Dashboard page edits. Whether Filmweb is used at all, and in which order against the
/// other providers, is not here: that is Jellyfin's own per-library setting.
/// </summary>
public class PluginConfiguration : BasePluginConfiguration
{
    /// <summary>Use the original title as the item's name instead of the Polish one.</summary>
    public bool PreferOriginalTitle { get; set; }

    /// <summary>
    /// Bring in directors and cast. Off leaves an item's people to another provider — one that
    /// knows the characters played, which Filmweb does not publish.
    /// </summary>
    public bool FetchPeople { get; set; } = true;

    /// <summary>How many actors to bring in; each one costs a request. 0 means directors only.</summary>
    public int CastLimit { get; set; } = 10;

    /// <summary>Fill the critic rating from Filmweb's critics' average.</summary>
    public bool FetchCriticRating { get; set; } = true;

    /// <summary>Offer the title's stills as backdrops. They are at most 900 px wide.</summary>
    public bool FetchBackdrops { get; set; } = true;
}
