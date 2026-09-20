using MediaBrowser.Model.Plugins;

namespace Jellyfin.Plugin.EpisodePicker;

/// <summary>
/// Handed to the browser as window.JELLYFLIX_ADDON_CONFIG, which the add-on's registry merges over
/// the module defaults. Defaults here match those in addons/mods/60-episode-picker.js.
/// </summary>
public class PluginConfiguration : BasePluginConfiguration
{
    /// <summary>Master switch. Off means the script tag is not injected at all.</summary>
    public bool Enabled { get; set; } = true;

    /// <summary>Show the picker button while an episode is playing.</summary>
    public bool PickerEnabled { get; set; } = true;

    /// <summary>Episode thumbnails in the list. Off makes the rows compact and saves requests.</summary>
    public bool Thumbnails { get; set; } = true;

    /// <summary>Each episode's synopsis under its title.</summary>
    public bool ShowOverview { get; set; } = true;

    /// <summary>Hard cap on the synopsis; the list also line-clamps in CSS.</summary>
    public int OverviewChars { get; set; } = 180;

    /// <summary>Writes [JellyFlix] tracing to the browser console.</summary>
    public bool Debug { get; set; }
}
