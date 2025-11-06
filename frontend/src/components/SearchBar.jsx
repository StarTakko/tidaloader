import { h } from "preact";
import { useState } from "preact/hooks";
import { api } from "../api/client";
import { useDownloadStore } from "../stores/downloadStore";
import { ArtistPage } from "./ArtistPage";
import { AlbumPage } from "./AlbumPage";

export function SearchBar() {
  const [query, setQuery] = useState("");
  const [searchType, setSearchType] = useState("track");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [error, setError] = useState(null);

  const addToQueue = useDownloadStore((state) => state.addToQueue);

  const handleSearchTypeChange = async (newType) => {
    const previousType = searchType;
    setSearchType(newType);

    // Clear results when switching search type
    setResults([]);
    setSelected(new Set());
    setError(null);

    // Auto-trigger search if there's a query
    if (query.trim() && previousType !== newType) {
      // Small delay to ensure UI updates
      await new Promise((resolve) => setTimeout(resolve, 50));
      handleSearch(newType);
    }
  };

  const handleSearch = async (overrideType) => {
    const activeType = overrideType || searchType;

    if (!query.trim()) {
      setError("Please enter a search query");
      return;
    }

    setLoading(true);
    setError(null);
    setResults([]);
    setSelected(new Set());

    try {
      let result;
      if (activeType === "track") {
        result = await api.searchTracks(query.trim());
      } else if (activeType === "album") {
        result = await api.searchAlbums(query.trim());
      } else {
        result = await api.searchArtists(query.trim());
      }

      setResults(result.items || []);

      if (result.items.length === 0) {
        setError("No results found");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const toggleTrack = (trackId) => {
    const newSelected = new Set(selected);
    if (newSelected.has(trackId)) {
      newSelected.delete(trackId);
    } else {
      newSelected.add(trackId);
    }
    setSelected(newSelected);
  };

  const handleAddToQueue = () => {
    const selectedTracks = results
      .filter((r) => selected.has(r.id))
      .map((r) => ({
        tidal_id: r.id,
        title: r.title,
        artist: r.artist,
        album: r.album,
        tidal_exists: true,
      }));

    addToQueue(selectedTracks);
    alert(`Added ${selectedTracks.length} tracks to download queue!`);
    setSelected(new Set());
  };

  return (
    <div class="search-bar">
      <div class="search-input-group">
        <input
          type="text"
          value={query}
          onInput={(e) => setQuery(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Search for tracks, albums, or artists..."
          disabled={loading}
        />
        <button
          onClick={() => handleSearch()}
          disabled={loading || !query.trim()}
        >
          {loading ? "⏳" : "🔍"} Search
        </button>
      </div>

      <div class="search-type">
        <label>
          <input
            type="radio"
            name="type"
            value="track"
            checked={searchType === "track"}
            onChange={() => handleSearchTypeChange("track")}
          />
          Track
        </label>
        <label>
          <input
            type="radio"
            name="type"
            value="album"
            checked={searchType === "album"}
            onChange={() => handleSearchTypeChange("album")}
          />
          Album
        </label>
        <label>
          <input
            type="radio"
            name="type"
            value="artist"
            checked={searchType === "artist"}
            onChange={() => handleSearchTypeChange("artist")}
          />
          Artist
        </label>
      </div>

      {error && <div class="error-message">{error}</div>}

      {loading && <div class="loading-message">Searching Tidal...</div>}

      {searchType === "track" && results.length > 0 && (
        <TrackResults
          results={results}
          selected={selected}
          onToggle={toggleTrack}
          onAddToQueue={handleAddToQueue}
        />
      )}

      {searchType === "album" && results.length > 0 && (
        <AlbumResults results={results} />
      )}

      {searchType === "artist" && results.length > 0 && (
        <ArtistResults results={results} />
      )}
    </div>
  );
}

function TrackResults({ results, selected, onToggle, onAddToQueue }) {
  return (
    <div class="search-results">
      <div class="results-header">
        <h3>Found {results.length} tracks</h3>
        {selected.size > 0 && (
          <button class="add-selected-btn" onClick={onAddToQueue}>
            Add {selected.size} to Queue
          </button>
        )}
      </div>

      <div class="track-list">
        {results.map((track) => (
          <div key={track.id} class="track-item search-result">
            <label>
              <input
                type="checkbox"
                checked={selected.has(track.id)}
                onChange={() => onToggle(track.id)}
              />
              {track.cover && (
                <img
                  src={api.getCoverUrl(track.cover, "80")}
                  alt={track.title}
                  class="track-cover"
                />
              )}
              <div class="track-info">
                <div class="track-title">{track.title}</div>
                <div class="track-meta">
                  {track.artist}
                  {track.album && ` • ${track.album}`}
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
  );
}

function AlbumResults({ results }) {
  const [selectedAlbumId, setSelectedAlbumId] = useState(null);

  if (selectedAlbumId) {
    return (
      <AlbumPage
        albumId={selectedAlbumId}
        onBack={() => setSelectedAlbumId(null)}
      />
    );
  }

  return (
    <div class="search-results">
      <h3>Found {results.length} albums</h3>
      <div class="album-grid">
        {results.map((album) => (
          <div
            key={album.id}
            class="album-card"
            onClick={() => setSelectedAlbumId(album.id)}
          >
            {album.cover && (
              <img
                src={api.getCoverUrl(album.cover, "320")}
                alt={album.title}
                class="album-cover"
              />
            )}
            <div class="album-info">
              <div class="album-title">{album.title}</div>
              <div class="album-artist">
                {album.artist?.name || "Unknown Artist"}
              </div>
              {album.numberOfTracks && (
                <div class="album-tracks">{album.numberOfTracks} tracks</div>
              )}
              {album.releaseDate && (
                <div class="album-year">
                  {new Date(album.releaseDate).getFullYear()}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ArtistResults({ results }) {
  const [selectedArtistId, setSelectedArtistId] = useState(null);

  if (selectedArtistId) {
    return (
      <ArtistPage
        artistId={selectedArtistId}
        onBack={() => setSelectedArtistId(null)}
      />
    );
  }

  return (
    <div class="search-results">
      <h3>Found {results.length} artists</h3>
      <div class="artist-list">
        {results.map((artist) => (
          <div
            key={artist.id}
            class="artist-item"
            onClick={() => setSelectedArtistId(artist.id)}
          >
            {artist.picture ? (
              <img
                src={api.getCoverUrl(artist.picture, "160")}
                alt={artist.name}
                class="artist-picture"
                onError={(e) => {
                  e.target.style.display = "none";
                }}
              />
            ) : (
              <div class="artist-placeholder">
                {artist.name?.charAt(0) || "?"}
              </div>
            )}
            <div class="artist-info">
              <div class="artist-name">{artist.name || "Unknown Artist"}</div>
              {artist.popularity && (
                <div class="artist-popularity">
                  Popularity: {artist.popularity}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatDuration(seconds) {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}
