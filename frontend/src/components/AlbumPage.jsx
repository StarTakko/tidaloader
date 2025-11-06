import { h } from "preact";
import { useState, useEffect } from "preact/hooks";
import { api } from "../api/client";
import { useDownloadStore } from "../stores/downloadStore";

export function AlbumPage({ albumId, onBack }) {
  const [loading, setLoading] = useState(true);
  const [album, setAlbum] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [selectedTracks, setSelectedTracks] = useState(new Set());
  const [error, setError] = useState(null);

  const addToQueue = useDownloadStore((state) => state.addToQueue);

  useEffect(() => {
    loadAlbumData();
  }, [albumId]);

  const loadAlbumData = async () => {
    setLoading(true);
    setError(null);

    try {
      console.log(`Loading album data for ID: ${albumId}`);
      const result = await api.get(`/album/${albumId}/tracks`);

      // Extract album info from the API response
      // The backend returns the full album metadata in the response
      let albumInfo = null;

      // First, try to get album from the response metadata (if backend provides it)
      if (result.album) {
        albumInfo = result.album;
      }
      // Otherwise, extract from first track
      else if (result.items && result.items.length > 0) {
        const firstTrack = result.items[0];

        // Handle track.album which should be an object
        if (firstTrack.album && typeof firstTrack.album === "object") {
          albumInfo = firstTrack.album;
        }
        // Fallback: construct from track data
        else {
          albumInfo = {
            id: albumId,
            title: firstTrack.album || "Unknown Album",
            cover: firstTrack.cover,
            artist: firstTrack.artist ? { name: firstTrack.artist } : null,
          };
        }
      }

      // Set album with fallback
      setAlbum(
        albumInfo || {
          id: albumId,
          title: "Unknown Album",
          artist: { name: "Unknown Artist" },
        }
      );

      setTracks(result.items || []);

      // Auto-select all tracks
      if (result.items) {
        setSelectedTracks(new Set(result.items.map((t) => t.id)));
      }

      console.log(`Loaded album:`, albumInfo);
      console.log(`Loaded: ${result.items?.length || 0} tracks`);
    } catch (err) {
      console.error("Failed to load album:", err);
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

  const selectAllTracks = () => {
    setSelectedTracks(new Set(tracks.map((t) => t.id)));
  };

  const deselectAllTracks = () => {
    setSelectedTracks(new Set());
  };

  const handleDownloadTracks = () => {
    const selectedTrackList = tracks
      .filter((t) => selectedTracks.has(t.id))
      .map((t) => ({
        tidal_id: t.id,
        title: t.title,
        artist: t.artist || album?.artist?.name || "Unknown Artist",
        album: album?.title || t.album,
        tidal_exists: true,
      }));

    addToQueue(selectedTrackList);
    alert(`Added ${selectedTrackList.length} tracks to download queue!`);
  };

  if (loading && !album) {
    return (
      <div class="album-page">
        <button class="back-btn" onClick={onBack}>
          ← Back to Search
        </button>
        <div class="loading-message">Loading album...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div class="album-page">
        <button class="back-btn" onClick={onBack}>
          ← Back to Search
        </button>
        <div class="error-message">{error}</div>
      </div>
    );
  }

  if (!album && tracks.length === 0) {
    return (
      <div class="album-page">
        <button class="back-btn" onClick={onBack}>
          ← Back to Search
        </button>
        <div class="error-message">Album not found</div>
      </div>
    );
  }

  // Calculate total duration
  const totalDuration = tracks.reduce((sum, t) => sum + (t.duration || 0), 0);

  return (
    <div class="album-page">
      {/* Header */}
      <div class="album-header">
        <button class="back-btn" onClick={onBack}>
          ← Back to Search
        </button>

        <div class="album-info-header">
          {album?.cover ? (
            <img
              src={api.getCoverUrl(album.cover, "320")}
              alt={album.title}
              class="album-header-cover"
            />
          ) : (
            <div class="album-header-placeholder">
              {album?.title?.charAt(0) || "?"}
            </div>
          )}

          <div class="album-header-text">
            <h2>{album?.title || "Unknown Album"}</h2>
            <div class="album-artist-name">
              {album?.artist?.name || "Unknown Artist"}
            </div>
            <div class="album-metadata">
              {album?.releaseDate && (
                <span>{new Date(album.releaseDate).getFullYear()}</span>
              )}
              {album?.releaseDate && tracks.length > 0 && <span> • </span>}
              {tracks.length > 0 && <span>{tracks.length} tracks</span>}
              {totalDuration > 0 && (
                <span> • {formatTotalDuration(totalDuration)}</span>
              )}
            </div>
          </div>
        </div>

        {tracks.length > 0 && (
          <button
            class="download-all-btn"
            onClick={handleDownloadTracks}
            disabled={selectedTracks.size === 0}
          >
            📥 Add {selectedTracks.size} Track
            {selectedTracks.size !== 1 ? "s" : ""} to Queue
          </button>
        )}
      </div>

      {/* Tracks */}
      {tracks.length > 0 && (
        <div class="album-section">
          <div class="section-header">
            <h3>Tracks</h3>
            <div class="section-controls">
              <button class="select-all-btn" onClick={selectAllTracks}>
                Select All
              </button>
              <button class="deselect-all-btn" onClick={deselectAllTracks}>
                Deselect All
              </button>
            </div>
          </div>

          <div class="track-list">
            {tracks.map((track, index) => (
              <div key={track.id} class="track-item album-track-item">
                <label>
                  <input
                    type="checkbox"
                    checked={selectedTracks.has(track.id)}
                    onChange={() => toggleTrack(track.id)}
                  />
                  <span class="track-number">{index + 1}</span>
                  <div class="track-info">
                    <div class="track-title">{track.title}</div>
                    <div class="track-meta">
                      {track.artist}
                      {track.duration && (
                        <span class="track-duration">
                          {" "}
                          • {formatDuration(track.duration)}
                        </span>
                      )}
                    </div>
                  </div>
                  {track.quality && (
                    <span class="quality-badge">{track.quality}</span>
                  )}
                </label>
              </div>
            ))}
          </div>
        </div>
      )}

      {tracks.length === 0 && (
        <div class="empty-state">
          <p>No tracks found for this album</p>
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

function formatTotalDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours} hr ${minutes} min`;
  }
  return `${minutes} min`;
}
