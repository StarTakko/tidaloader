import { h } from "preact";
import { useDownloadStore } from "../stores/downloadStore";

const QUALITY_OPTIONS = [
  {
    value: "HI_RES_LOSSLESS",
    label: "Hi-Res FLAC",
    description: "Up to 24-bit/192kHz",
  },
  { value: "LOSSLESS", label: "FLAC", description: "16-bit/44.1kHz" },
  { value: "HIGH", label: "320kbps AAC", description: "High quality AAC" },
  { value: "LOW", label: "96kbps AAC", description: "Low quality AAC" },
];

export function QualitySelector() {
  const quality = useDownloadStore((state) => state.quality);
  const setQuality = useDownloadStore((state) => state.setQuality);

  return (
    <div class="quality-selector">
      <label for="quality-select">Audio Quality:</label>
      <select
        id="quality-select"
        value={quality}
        onChange={(e) => setQuality(e.target.value)}
      >
        {QUALITY_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label} - {option.description}
          </option>
        ))}
      </select>
    </div>
  );
}
