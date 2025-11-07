import { h } from "preact";
import { useState } from "preact/hooks";
import { SearchBar } from "./components/SearchBar";
import { TroiGenerator } from "./components/TroiGenerator";
import { DownloadQueue } from "./components/DownloadQueue";
import { QualitySelector } from "./components/QualitySelector";

export function App() {
  const [activeTab, setActiveTab] = useState("troi");
  const [showSettings, setShowSettings] = useState(false);

  return (
    <div class="app">
      <header class="header">
        <h1>🎵 Troi Tidal Downloader</h1>
        <button
          class="settings-btn"
          onClick={() => setShowSettings(!showSettings)}
        >
          ⚙️ Settings
        </button>
      </header>

      {showSettings && (
        <div class="settings-panel">
          <QualitySelector />
        </div>
      )}

      <nav class="tabs">
        <button
          class={`tab ${activeTab === "troi" ? "active" : ""}`}
          onClick={() => setActiveTab("troi")}
        >
          Troi Playlist
        </button>
        <button
          class={`tab ${activeTab === "search" ? "active" : ""}`}
          onClick={() => setActiveTab("search")}
        >
          Custom Search
        </button>
      </nav>

      <main class="content">
        {activeTab === "troi" && <TroiGenerator />}
        {activeTab === "search" && <SearchBar />}
      </main>

      <footer class="queue-section">
        <DownloadQueue />
      </footer>
    </div>
  );
}
