**1.1.0.0**

- Usable with a TV remote. The drawer was unreachable: opening it left focus on the OSD position slider and the arrow keys walked the player's control shelf, because in the TV layout jellyfin-web owns those keys while the player is up. Focus now lands on the episode you are watching, Up/Down walks the list, Left/Right changes season on the selector instead of seeking the video underneath, Enter starts the highlighted episode, and Back/Escape closes.

**1.0.4.0**

- Input no longer leaks through the drawer into the player (play/pause on `pointerdown`, volume on the wheel).
- A plugin icon, shown in the Jellyfin plugin list.

**1.0.0.0** — first release.

- A button in the player OSD, shown while an episode is playing.
- A drawer listing the season's episodes with thumbnails, watched state and progress.
- Season selector; picking an episode starts it.
