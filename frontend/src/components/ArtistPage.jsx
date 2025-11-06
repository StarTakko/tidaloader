import { h } from "preact";
import { useState, useEffect } from "preact/hooks";
import { api } from "../api/client";
import { useDownloadStore } from "../stores/downloadStore";

export function ArtistPage({ artistId, onBack }) {
  const [loading, setLoading] = useState(true);
  const [artist, setArtist] = useState(null);
  const [topTracks, setTopTracks] = useState([]);
  const [albums, setAlbums] = useState([]);
  const [selectedTracks, setSelectedTracks] = useState(new Set());
  const [selectedAlbums, setSelectedAlbums] = useState(new Set());
  const [error, setError] = useState(null);

  const addToQueue = useDownloadStore((state) => state.addToQueue);

  useEffect(() => {
    loadArtistData();
  }, [artistId]);

  const loadArtistData = async () => {
    setLoading(true);
    setError(null);

    try {
      console.log(`Loading artist data for ID: ${artistId}`);
      const result = await api.get(`/artist/${artistId}`);

      setArtist(result.artist || {});
      setTopTracks(result.tracks || []);
      setAlbums(result.albums || []);

      // Auto-select all top tracks
      if (result.tracks) {
        setSelectedTracks(new Set(result.tracks.map((t) => t.id)));
      }

      console.log(
        `Loaded: ${result.tracks?.length || 0} tracks, ${
          result.albums?.length || 0
        } albums`
      );
    } catch (err) {
      console.error("Failed to load artist:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleTrack = (trackId) => {
    const newSelected = new Set(selectedTracks);
    if (newSelected.has(trackId)) {
      newSelected.delete(trackId);
    } else {
      newSelected.add(trackId);
    }
    setSelectedTracks(newSelected);
  };

  const toggleAlbum = (albumId) => {
    const newSelected = new Set(selectedAlbums);
    if (newSelected.has(albumId)) {
      newSelected.delete(albumId);
    } else {
      newSelected.add(albumId);
    }
    setSelectedAlbums(newSelected);
  };

  const selectAllTracks = () => {
    setSelectedTracks(new Set(topTracks.map((t) => t.id)));
  };

  const deselectAllTracks = () => {
    setSelectedTracks(new Set());
  };

  const selectAllAlbums = () => {
    setSelectedAlbums(new Set(albums.map((a) => a.id)));
  };

  const deselectAllAlbums = () => {
    setSelectedAlbums(new Set());
  };

  const handleDownloadTracks = () => {
    const tracks = topTracks
      .filter((t) => selectedTracks.has(t.id))
      .map((t) => ({
        tidal_id: t.id,
        title: t.title,
        artist: t.artist?.name || artist.name,
        album: t.album?.title,
        tidal_exists: true,
      }));

    addToQueue(tracks);
    alert(`Added ${tracks.length} tracks to download queue!`);
  };

  const handleDownloadAlbums = async () => {
    const albumsToDownload = albums.filter((a) => selectedAlbums.has(a.id));

    if (albumsToDownload.length === 0) {
      alert("No albums selected");
      return;
    }

    setLoading(true);
    let totalTracks = 0;

    try {
      for (const album of albumsToDownload) {
        console.log(`Fetching tracks for album: ${album.title}`);
        const result = await api.get(`/album/${album.id}/tracks`);

        const tracks = (result.items || []).map((t) => ({
          tidal_id: t.id,
          title: t.title,
          artist: t.artist || album.artist?.name || artist.name,
          album: album.title,
          tidal_exists: true,
        }));

        addToQueue(tracks);
        totalTracks += tracks.length;
      }

      alert(
        `Added ${totalTracks} tracks from ${albumsToDownload.length} albums to queue!`
      );
      setSelectedAlbums(new Set());
    } catch (err) {
      alert(`Failed to fetch album tracks: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadDiscography = async () => {
    if (albums.length === 0) {
      alert("No albums found for this artist");
      return;
    }

    const confirmDownload = confirm(
      `Download entire discography? (${albums.length} albums)`
    );

    if (!confirmDownload) return;

    setLoading(true);
    let totalTracks = 0;

    try {
      for (const album of albums) {
        console.log(`Fetching tracks for album: ${album.title}`);
        const result = await api.get(`/album/${album.id}/tracks`);

        const tracks = (result.items || []).map((t) => ({
          tidal_id: t.id,
          title: t.title,
          artist: t.artist || album.artist?.name || artist.name,
          album: album.title,
          tidal_exists: true,
        }));

        addToQueue(tracks);
        totalTracks += tracks.length;

        // Rate limit protection
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      alert(
        `Added entire discography: ${totalTracks} tracks from ${albums.length} albums!`
      );
    } catch (err) {
      alert(`Failed to fetch discography: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !artist) {
    return (
      <div class="artist-page">
        <button class="back-btn" onClick={onBack}>
          ← Back to Search
        </button>
        <div class="loading-message">Loading artist...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div class="artist-page">
        <button class="back-btn" onClick={onBack}>
          ← Back to Search
        </button>
        <div class="error-message">{error}</div>
      </div>
    );
  }

  if (!artist) {
    return (
      <div class="artist-page">
        <button class="back-btn" onClick={onBack}>
          ← Back to Search
        </button>
        <div class="error-message">Artist not found</div>
      </div>
    );
  }

  return (
    <div class="artist-page">
      {/* Header */}
      <div class="artist-header">
        <button class="back-btn" onClick={onBack}>
          ← Back to Search
        </button>

        <div class="artist-info-header">
          {artist.picture ? (
            <img
              src={api.getCoverUrl(artist.picture, "320")}
              alt={artist.name}
              class="artist-header-picture"
            />
          ) : (
            <div class="artist-header-placeholder">
              {artist.name?.charAt(0) || "?"}
            </div>
          )}

          <div class="artist-header-text">
            <h2>{artist.name}</h2>
            {artist.popularity && (
              <div class="artist-stats">Popularity: {artist.popularity}</div>
            )}
          </div>
        </div>

        {albums.length > 0 && (
          <button
            class="download-discography-btn"
            onClick={handleDownloadDiscography}
            disabled={loading}
          >
            📥 Download Entire Discography ({albums.length} albums)
          </button>
        )}
      </div>

      {/* Top Tracks */}
      {topTracks.length > 0 && (
        <div class="artist-section">
          <div class="section-header">
            <h3>Top Tracks ({topTracks.length})</h3>
            <div class="section-controls">
              <button class="select-all-btn" onClick={selectAllTracks}>
                Select All
              </button>
              <button class="deselect-all-btn" onClick={deselectAllTracks}>
                Deselect All
              </button>
              {selectedTracks.size > 0 && (
                <button
                  class="download-selected-btn"
                  onClick={handleDownloadTracks}
                >
                  Add {selectedTracks.size} to Queue
                </button>
              )}
            </div>
          </div>

          <div class="track-list">
            {topTracks.map((track) => (
              <div key={track.id} class="track-item search-result">
                <label>
                  <input
                    type="checkbox"
                    checked={selectedTracks.has(track.id)}
                    onChange={() => toggleTrack(track.id)}
                  />
                  {track.album?.cover && (
                    <img
                      src={api.getCoverUrl(track.album.cover, "80")}
                      alt={track.title}
                      class="track-cover"
                    />
                  )}
                  <div class="track-info">
                    <div class="track-title">{track.title}</div>
                    <div class="track-meta">
                      {track.album?.title || "Unknown Album"}
                      {track.duration && (
                        <span class="track-duration">
                          {" "}
                          • {formatDuration(track.duration)}
                        </span>
                      )}
                    </div>
                  </div>
                  {track.audioQuality && (
                    <span class="quality-badge">{track.audioQuality}</span>
                  )}
                </label>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Albums */}
      {albums.length > 0 && (
        <div class="artist-section">
          <div class="section-header">
            <h3>Albums ({albums.length})</h3>
            <div class="section-controls">
              <button class="select-all-btn" onClick={selectAllAlbums}>
                Select All
              </button>
              <button class="deselect-all-btn" onClick={deselectAllAlbums}>
                Deselect All
              </button>
              {selectedAlbums.size > 0 && (
                <button
                  class="download-selected-btn"
                  onClick={handleDownloadAlbums}
                  disabled={loading}
                >
                  Add {selectedAlbums.size} Albums to Queue
                </button>
              )}
            </div>
          </div>

          <div class="album-grid">
            {albums.map((album) => (
              <div key={album.id} class="album-card-selectable">
                <label class="album-card-label">
                  <input
                    type="checkbox"
                    checked={selectedAlbums.has(album.id)}
                    onChange={() => toggleAlbum(album.id)}
                    class="album-checkbox"
                  />
                  {album.cover && (
                    <img
                      src={api.getCoverUrl(album.cover, "320")}
                      alt={album.title}
                      class="album-cover"
                    />
                  )}
                  <div class="album-info">
                    <div class="album-title">{album.title}</div>
                    {album.numberOfTracks && (
                      <div class="album-tracks">
                        {album.numberOfTracks} tracks
                      </div>
                    )}
                    {album.releaseDate && (
                      <div class="album-year">
                        {new Date(album.releaseDate).getFullYear()}
                      </div>
                    )}
                  </div>
                </label>
              </div>
            ))}
          </div>
        </div>
      )}

      {topTracks.length === 0 && albums.length === 0 && (
        <div class="empty-state">
          <p>No tracks or albums found for this artist</p>
        </div>
      )}
    </div>
  );
}

function formatDuration(seconds) {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}
