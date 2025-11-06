import { h } from "preact";
import { useState } from "preact/hooks";
import { useDownloadStore } from "../stores/downloadStore";
import { downloadManager } from "../utils/downloadManager";

export function DownloadQueue() {
  const queue = useDownloadStore((state) => state.queue);
  const downloading = useDownloadStore((state) => state.downloading);
  const completed = useDownloadStore((state) => state.completed);
  const failed = useDownloadStore((state) => state.failed);
  const removeFromQueue = useDownloadStore((state) => state.removeFromQueue);
  const retryFailed = useDownloadStore((state) => state.retryFailed);
  const clearCompleted = useDownloadStore((state) => state.clearCompleted);
  const clearFailed = useDownloadStore((state) => state.clearFailed);

  const [isRunning, setIsRunning] = useState(false);

  const totalInQueue = queue.length + downloading.length;

  const handleStart = async () => {
    setIsRunning(true);
    downloadManager.start().catch((err) => {
      console.error("Download manager error:", err);
      setIsRunning(false);
    });
  };

  const handleStop = () => {
    downloadManager.stop();
    setIsRunning(false);
  };

  return (
    <div class="download-queue">
      <div class="queue-header">
        <h2>Download Queue</h2>
        <div class="queue-stats">
          <span>📋 Queued: {queue.length}</span>
          <span>⬇️ Downloading: {downloading.length}</span>
          <span>✓ Completed: {completed.length}</span>
          {failed.length > 0 && <span>✗ Failed: {failed.length}</span>}
        </div>
        <div class="queue-controls">
          {!isRunning ? (
            <button
              onClick={handleStart}
              disabled={totalInQueue === 0}
              class="start-btn"
            >
              ▶️ Start Downloads
            </button>
          ) : (
            <button onClick={handleStop} class="stop-btn">
              ⏸️ Stop Downloads
            </button>
          )}
        </div>
      </div>

      {/* Queued Tracks */}
      {queue.length > 0 && (
        <div class="queue-section">
          <h3>Queued ({queue.length})</h3>
          <div class="track-list">
            {queue.map((track) => (
              <div key={track.id} class="queue-item">
                <span class="track-info">
                  {track.artist} - {track.title}
                </span>
                <button
                  class="remove-btn"
                  onClick={() => removeFromQueue(track.id)}
                  title="Remove from queue"
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Downloading Tracks */}
      {downloading.length > 0 && (
        <div class="queue-section">
          <h3>Downloading ({downloading.length})</h3>
          <div class="track-list">
            {downloading.map((track) => (
              <div key={track.id} class="queue-item downloading">
                <span class="track-info">
                  {track.artist} - {track.title}
                </span>
                <div class="progress-bar">
                  <div
                    class="progress"
                    style={{ width: `${track.progress || 0}%` }}
                  />
                  <span class="progress-text">{track.progress || 0}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Failed Tracks */}
      {failed.length > 0 && (
        <div class="queue-section">
          <h3>
            Failed ({failed.length})
            <button class="clear-btn" onClick={clearFailed}>
              Clear All
            </button>
          </h3>
          <div class="track-list">
            {failed.map((track) => (
              <div key={track.id} class="queue-item failed">
                <span class="track-info">
                  {track.artist} - {track.title}
                  <span class="error-text">{track.error}</span>
                </span>
                <button
                  class="retry-btn"
                  onClick={() => retryFailed(track.id)}
                  title="Retry download"
                >
                  🔄 Retry
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Completed Downloads Summary */}
      {completed.length > 0 && (
        <div class="completed-summary">
          <h3>
            ✓ Completed: {completed.length} tracks
            <button class="clear-btn" onClick={clearCompleted}>
              Clear
            </button>
          </h3>
        </div>
      )}

      {totalInQueue === 0 && completed.length === 0 && failed.length === 0 && (
        <div class="empty-state">
          <p>No tracks in queue. Add some tracks to get started!</p>
        </div>
      )}
    </div>
  );
}
