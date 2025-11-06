import { create } from "zustand";

/**
 * Download queue store using Zustand
 */
export const useDownloadStore = create((set, get) => ({
  // Queue state
  queue: [],
  downloading: [],
  completed: [],
  failed: [],

  // Settings
  quality: "LOSSLESS",
  maxConcurrent: 3,

  // Actions
  addToQueue: (tracks) =>
    set((state) => {
      // Prevent duplicates - check all queues
      const existingIds = new Set([
        ...state.queue.map((t) => t.tidal_id),
        ...state.downloading.map((t) => t.tidal_id),
        ...state.completed.map((t) => t.tidal_id),
      ]);

      const newTracks = tracks
        .filter((track) => !existingIds.has(track.tidal_id))
        .map((track) => ({
          ...track,
          id: `${track.tidal_id}-${Date.now()}`,
          status: "queued",
          progress: 0,
          addedAt: Date.now(),
        }));

      if (newTracks.length === 0) {
        console.log("All tracks already in queue");
        return state;
      }

      console.log(
        `Adding ${newTracks.length} new tracks to queue (${
          tracks.length - newTracks.length
        } duplicates skipped)`
      );

      return {
        queue: [...state.queue, ...newTracks],
      };
    }),

  removeFromQueue: (trackId) =>
    set((state) => ({
      queue: state.queue.filter((t) => t.id !== trackId),
    })),

  startDownload: (trackId) =>
    set((state) => {
      const track = state.queue.find((t) => t.id === trackId);
      if (!track) return state;

      return {
        queue: state.queue.filter((t) => t.id !== trackId),
        downloading: [
          ...state.downloading,
          { ...track, status: "downloading", startedAt: Date.now() },
        ],
      };
    }),

  updateProgress: (trackId, progress) =>
    set((state) => ({
      downloading: state.downloading.map((t) =>
        t.id === trackId ? { ...t, progress } : t
      ),
    })),

  completeDownload: (trackId, filename) =>
    set((state) => {
      const track = state.downloading.find((t) => t.id === trackId);
      if (!track) return state;

      return {
        downloading: state.downloading.filter((t) => t.id !== trackId),
        completed: [
          ...state.completed,
          {
            ...track,
            status: "completed",
            progress: 100,
            completedAt: Date.now(),
            filename,
          },
        ],
      };
    }),

  failDownload: (trackId, error) =>
    set((state) => {
      const track = state.downloading.find((t) => t.id === trackId);
      if (!track) return state;

      return {
        downloading: state.downloading.filter((t) => t.id !== trackId),
        failed: [
          ...state.failed,
          {
            ...track,
            status: "failed",
            error,
            failedAt: Date.now(),
          },
        ],
      };
    }),

  retryFailed: (trackId) =>
    set((state) => {
      const track = state.failed.find((t) => t.id === trackId);
      if (!track) return state;

      return {
        failed: state.failed.filter((t) => t.id !== trackId),
        queue: [
          ...state.queue,
          { ...track, status: "queued", error: undefined, progress: 0 },
        ],
      };
    }),

  clearCompleted: () => set({ completed: [] }),

  clearFailed: () => set({ failed: [] }),

  setQuality: (quality) => set({ quality }),

  // Get statistics
  getStats: () => {
    const state = get();
    return {
      queued: state.queue.length,
      downloading: state.downloading.length,
      completed: state.completed.length,
      failed: state.failed.length,
      total:
        state.queue.length +
        state.downloading.length +
        state.completed.length +
        state.failed.length,
    };
  },
}));
