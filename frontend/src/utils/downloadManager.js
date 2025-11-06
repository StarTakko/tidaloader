import { api } from "../api/client";
import { useDownloadStore } from "../stores/downloadStore";

// Add configuration option
const DOWNLOAD_MODE = "client"; // or "server"

class DownloadManager {
  constructor() {
    this.isProcessing = false;
    this.activeDownloads = new Map();
  }

  /**
   * Start processing the queue
   */
  async start() {
    if (this.isProcessing) {
      console.log("Download manager already running");
      return;
    }

    this.isProcessing = true;
    console.log("🎵 Download manager started");

    while (this.isProcessing) {
      const state = useDownloadStore.getState();
      const { queue, downloading, maxConcurrent } = state;

      // Check if we can start more downloads
      if (downloading.length < maxConcurrent && queue.length > 0) {
        const track = queue[0];
        await this.downloadTrack(track);
      } else if (downloading.length === 0 && queue.length === 0) {
        // Nothing to do
        await this.sleep(1000);
      } else {
        // Wait for active downloads
        await this.sleep(500);
      }
    }

    console.log("🛑 Download manager stopped");
  }

  /**
   * Stop processing the queue
   */
  stop() {
    this.isProcessing = false;

    // Cancel active downloads
    this.activeDownloads.forEach((controller) => {
      controller.abort();
    });
    this.activeDownloads.clear();
  }

  /**
   * Download a single track
   */
  async downloadTrack(track) {
    if (DOWNLOAD_MODE === "server") {
      return this.downloadTrackServerSide(track);
    } else {
      return this.downloadTrackClientSide(track);
    }
  }

  /**
   * Download track server-side (saves to backend/downloads/)
   */
  async downloadTrackServerSide(track) {
    const { startDownload, completeDownload, failDownload, quality } =
      useDownloadStore.getState();

    startDownload(track.id);

    try {
      console.log(`⬇️ Downloading (server): ${track.artist} - ${track.title}`);

      const response = await fetch(`${API_BASE}/download/track`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          track_id: track.tidal_id,
          artist: track.artist,
          title: track.title,
          quality,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      completeDownload(track.id, result.filename);
      console.log(`✓ Downloaded: ${result.filename}`);
    } catch (error) {
      console.error(`✗ Download failed: ${track.title}`, error);
      failDownload(track.id, error.message);
    }

    await this.sleep(1000);
  }

  /**
   * Download track client-side (browser Downloads folder)
   */
  async downloadTrackClientSide(track) {
    const {
      startDownload,
      completeDownload,
      failDownload,
      updateProgress,
      quality,
    } = useDownloadStore.getState();

    // Move to downloading state
    startDownload(track.id);

    const controller = new AbortController();
    this.activeDownloads.set(track.id, controller);

    try {
      console.log(`⬇️ Downloading: ${track.artist} - ${track.title}`);

      // Get stream URL
      const streamData = await api.get(`/download/stream/${track.tidal_id}`, {
        quality,
      });

      if (!streamData.stream_url) {
        throw new Error("No stream URL returned");
      }

      // Download the file
      const response = await fetch(streamData.stream_url, {
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Track progress
      const totalBytes = parseInt(
        response.headers.get("content-length") || "0"
      );
      let receivedBytes = 0;

      const reader = response.body.getReader();
      const chunks = [];

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        chunks.push(value);
        receivedBytes += value.length;

        if (totalBytes > 0) {
          const progress = Math.round((receivedBytes / totalBytes) * 100);
          updateProgress(track.id, progress);
        }
      }

      // Create blob and trigger download
      const blob = new Blob(chunks, {
        type: response.headers.get("content-type") || "audio/flac",
      });

      const filename = this.sanitizeFilename(
        `${track.artist} - ${track.title}.flac`
      );

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Mark as complete
      completeDownload(track.id, filename);
      console.log(
        `✓ Downloaded: ${filename} (${(receivedBytes / 1024 / 1024).toFixed(
          2
        )} MB)`
      );
    } catch (error) {
      if (error.name === "AbortError") {
        console.log(`⏹️ Download cancelled: ${track.title}`);
        failDownload(track.id, "Download cancelled");
      } else {
        console.error(`✗ Download failed: ${track.title}`, error);
        failDownload(track.id, error.message);
      }
    } finally {
      this.activeDownloads.delete(track.id);
    }

    // Rate limit protection
    await this.sleep(1000);
  }

  /**
   * Sanitize filename
   */
  sanitizeFilename(filename) {
    const invalid = /[<>:"/\\|?*]/g;
    return filename.replace(invalid, "_").trim();
  }

  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Singleton instance
export const downloadManager = new DownloadManager();
