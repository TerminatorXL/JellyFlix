using Jellyfin.Plugin.Filmweb.Api;
using Jellyfin.Plugin.Filmweb.Lookup;
using MediaBrowser.Common.Net;
using MediaBrowser.Controller;
using MediaBrowser.Controller.Plugins;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.Filmweb.Services;

/// <summary>
/// Jellyfin builds the providers itself and hands them whatever their constructors ask for, so the
/// client they share has to be in its service collection. One client for all of them is the point:
/// its cache and its limit on concurrent requests only work if there is exactly one.
/// </summary>
public class PluginServiceRegistrator : IPluginServiceRegistrator
{
    public void RegisterServices(IServiceCollection serviceCollection, IServerApplicationHost applicationHost)
    {
        serviceCollection.AddSingleton(services => new FilmwebClient(
            () => services.GetRequiredService<IHttpClientFactory>().CreateClient(NamedClient.Default),
            services.GetRequiredService<ILogger<FilmwebClient>>()));
        serviceCollection.AddSingleton<FilmwebTitleService>();
    }
}
