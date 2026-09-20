using MediaBrowser.Model.Plugins;

namespace Jellyfin.Plugin.PauseInfoCard;

/// <summary>
/// Everything here is handed to the browser as window.JELLYFLIX_ADDON_CONFIG, which the bundle reads
/// before it starts. Defaults match the module defaults in addons/mods/*.js, so a fresh install
/// behaves exactly like the plain userscript.
/// </summary>
public class PluginConfiguration : BasePluginConfiguration
{
    /// <summary>Master switch. Off means the script tag is not injected at all.</summary>
    public bool Enabled { get; set; } = true;

    // --- pauseInfo: the visible feature -------------------------------------------------------

    public bool PauseInfoEnabled { get; set; } = true;

    /// <summary>How long playback must stay paused before the card appears. Shorter pauses are seeks.</summary>
    public int PauseInfoDelayMs { get; set; } = 350;

    /// <summary>Darken the whole frame, not just the left ramp.</summary>
    public bool PauseInfoDim { get; set; } = true;

    public bool PauseInfoShowLogo { get; set; } = true;

    public bool PauseInfoShowOverview { get; set; } = true;

    /// <summary>"21 min left", from the media element, only above one minute.</summary>
    public bool PauseInfoShowRemaining { get; set; } = true;

    // --- CSS hooks: inert unless you also write the CSS ----------------------------------------

    /// <summary>data-jfx-row="&lt;slug of the row title&gt;" on every home row.</summary>
    public bool RowTagsEnabled { get; set; } = true;

    /// <summary>--jflix-scroll: 0..1 on &lt;html&gt;.</summary>
    public bool ScrollVarEnabled { get; set; } = true;

    /// <summary>data-jfx-overview / -genres / -runtime on home cards. One extra API call per batch.</summary>
    public bool CardMetaEnabled { get; set; }

    /// <summary>Writes [JellyFlix] tracing to the browser console.</summary>
    public bool Debug { get; set; }
}
