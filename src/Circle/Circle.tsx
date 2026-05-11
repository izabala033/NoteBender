import React, { useState, useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Chord, Note } from "tonal";
import {
  chordQualityColors,
  getCircleTheory,
  modes,
  modeNames,
  scaleOptions,
  type CircleScaleValue,
} from "./circleTheory";

const getResponsiveSize = () => {
  const width = window.innerWidth;
  if (width < 400) return { radius: 100, center: 120 };
  if (width < 640) return { radius: 120, center: 140 };
  if (width < 768) return { radius: 140, center: 160 };
  return { radius: 160, center: 180 };
};

function Circle() {
  const [selectedRoot, setSelectedRoot] = useState("C");
  const [selectedMode, setSelectedMode] = useState(0);
  const [selectedScale, setSelectedScale] =
    useState<CircleScaleValue>("mode");
  const [dimensions, setDimensions] = useState(getResponsiveSize());
  const { t } = useTranslation();

  useEffect(() => {
    const handleResize = () => setDimensions(getResponsiveSize());
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const { radius, center } = dimensions;
  const circleSize = center * 2;
  const { circleOfFifths, modeTonic, scale, scaleLabel, triads, noteColors } =
    useMemo(
      () =>
        getCircleTheory({
          selectedRoot,
          selectedMode,
          selectedScale,
        }),
      [selectedRoot, selectedMode, selectedScale]
    );
  const selectedModeName = modeNames[selectedMode] ?? "Mode";

  const angleStep = (2 * Math.PI) / circleOfFifths.length;

  return (
    <div className="app-page">
      <div className="app-route app-route-workspace">
        <header className="app-header">
          <h1 className="app-title">Circle of Fifths</h1>
          <p className="app-subtitle">
            {t(selectedRoot)} root · {selectedModeName} · {t(modeTonic)} {scaleLabel}
          </p>
        </header>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-center">
          <div className="flex justify-center py-3">
            <div
              className="relative"
              style={{ width: circleSize, height: circleSize }}
            >
        {circleOfFifths.map((note, i) => {
          const angle = i * angleStep - Math.PI / 2;
          const x = center + radius * Math.cos(angle);
          const y = center + radius * Math.sin(angle);

          const chroma = Note.chroma(note);
          const noteColor = noteColors[chroma] || "none";
          const colorClass =
            chordQualityColors[noteColor] ||
            chordQualityColors[Chord.get(noteColor).type || "none"] ||
            chordQualityColors.none;

          const isTonicNote =
            Note.chroma(note) === Note.chroma(modeTonic);
          const borderClass = isTonicNote ? "border-4 border-cyan-300" : "";

          return (
            <React.Fragment key={note}>
              <button
                type="button"
                onClick={() => {
                  setSelectedRoot(note);
                  setSelectedMode(0);
                }}
                aria-label={`Select root: ${t(note)}`}
                aria-pressed={
                  Note.chroma(note) === Note.chroma(selectedRoot)
                }
                className={`absolute flex h-10 w-10 cursor-pointer items-center justify-center overflow-hidden rounded-full px-1 text-[11px] font-semibold transition-colors duration-300 sm:h-14 sm:w-14 sm:text-sm ${colorClass} ${borderClass}`}
                style={{
                  left: x,
                  top: y,
                  transform: "translate(-50%, -50%)",
                }}
                title={`Select root: ${t(note)}`}
              >
                {t(note)}
              </button>

              {(() => {
                const degreeIndex = scale.findIndex(
                  (n) => Note.chroma(n) === Note.chroma(note)
                );
                if (degreeIndex === -1) return null;

                const innerRadius = radius * 0.6;
                const xInner =
                  center + innerRadius * Math.cos(i * angleStep - Math.PI / 2);
                const yInner =
                  center + innerRadius * Math.sin(i * angleStep - Math.PI / 2);

                return (
                  <div
                    className={`absolute flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold sm:h-8 sm:w-8 ${colorClass}`}
                    style={{
                      left: xInner,
                      top: yInner,
                      transform: "translate(-50%, -50%)",
                    }}
                  >
                    {degreeIndex + 1}
                  </div>
                );
              })()}
            </React.Fragment>
          );
        })}
            </div>
          </div>

          <aside className="app-panel">
            <h2 className="app-section-title">Selected sound</h2>
            <div className="mt-3 space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-gray-400">Root</span>
                <span className="text-lg font-bold text-cyan-200">
                  {t(selectedRoot)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-gray-400">Mode</span>
                <span className="font-semibold text-gray-100">
                  {selectedModeName}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-gray-400">Tonic</span>
                <span className="font-semibold text-emerald-200">
                  {t(modeTonic)}
                </span>
              </div>
            </div>
          </aside>
        </section>

        <div className="app-scroll-x flex gap-2 pb-2 sm:gap-3">
        {[...modes]
          .sort((a, b) => a.harmonicaOrder - b.harmonicaOrder)
          .map(({ name, harmonicaPosition }) => {
            const modeIndex = modeNames.indexOf(name);
            const isSelected = modeIndex === selectedMode;

            return (
              <button
                type="button"
                key={name}
                onClick={() => setSelectedMode(modeIndex)}
                aria-pressed={isSelected}
                className={`app-button shrink-0 px-3 py-1.5 sm:px-4 ${
                  isSelected
                    ? "app-button-primary"
                    : "app-button-secondary"
                }`}
              >
                {name} ({harmonicaPosition})
              </button>
            );
          })}
      </div>

        <div className="app-scroll-x flex gap-2 pb-2 sm:gap-3">
        {scaleOptions.map(({ label, value }) => {
          const isSelected = selectedScale === value;

          return (
            <button
              key={value}
              type="button"
              onClick={() => setSelectedScale(value)}
              aria-pressed={isSelected}
              className={`app-button shrink-0 px-3 py-1.5 sm:px-4 ${
                isSelected
                  ? "app-button-success"
                  : "app-button-secondary"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(260px,0.6fr)]">
        <div className="app-panel w-full space-y-2 text-sm">
          <h2 className="app-section-title mb-2">
            {t(modeTonic)} {scaleLabel}
          </h2>
          <div className="flex flex-wrap gap-2">
            {scale.map((note, idx) => (
              <span
                key={`${note}-${idx}`}
                className="rounded bg-gray-800 px-2 py-1 text-xs sm:text-sm font-medium"
              >
                {idx + 1}. {t(note)}
              </span>
            ))}
          </div>
          {triads.length > 0 && (
            <h3 className="text-base font-bold pt-3">Triads</h3>
          )}
          <ul className="space-y-1">
            {triads.map(({ root, notes, quality }, idx) => (
              <li
                key={idx}
                className="grid gap-2 rounded border border-gray-700 bg-gray-800 px-2 py-1.5 text-xs sm:grid-cols-[2rem_minmax(0,1fr)_auto] sm:items-center sm:text-sm"
              >
                <span className="font-medium">
                  {idx + 1}. {t(root)}
                </span>
                <span className="text-gray-300 sm:text-center">
                  {notes.map((note) => t(note)).join(" - ")}
                </span>
                <span
                  className={`justify-self-start rounded px-2 py-1 text-xs font-semibold capitalize sm:justify-self-end ${
                    chordQualityColors[Chord.get(quality).type || "none"]
                  }`}
                >
                  {(() => {
                    const chordData = Chord.get(quality); // e.g., C#m -> { tonic: "C#", type: "m", name: "C#m" }

                    if (!chordData.tonic) return quality; // fallback

                    const translatedRoot = t(chordData.tonic);
                    const suffix = chordData.type; // e.g., "m", "maj7", "dim"

                    return `${translatedRoot} ${suffix}`;
                  })()}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="app-panel w-full space-y-2 text-sm">
          <h2 className="app-section-title mb-2">Legend</h2>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
            <li className="text-xs text-gray-300 sm:text-sm">
              <span className="inline-block w-4 h-4 bg-emerald-500 rounded-sm align-middle mr-2 border border-black"></span>
              Scale note
            </li>
            <li className="text-xs text-gray-300 sm:text-sm">
              <span className="inline-block w-4 h-4 bg-yellow-400 rounded-sm align-middle mr-2 border border-black"></span>
              Major triad
            </li>
            <li className="text-xs text-gray-300 sm:text-sm">
              <span className="inline-block w-4 h-4 bg-blue-600 rounded-sm align-middle mr-2"></span>
              Minor triad
            </li>
            <li className="text-xs text-gray-300 sm:text-sm">
              <span className="inline-block w-4 h-4 bg-red-500 rounded-sm align-middle mr-2"></span>
              Diminished triad
            </li>
            <li className="text-xs text-gray-300 sm:text-sm">
              <span className="inline-block w-4 h-4 bg-gray-800 rounded-sm align-middle mr-2 border border-white"></span>
              No triad / unclassified
            </li>
            <li className="text-xs text-gray-300 sm:text-sm">
              <span className="inline-block w-4 h-4 border-4 border-cyan-300 rounded-full align-middle mr-2"></span>
              Tonic of selected mode (starting note)
            </li>
            <li className="text-xs text-gray-300 sm:text-sm">
              <span className="inline-block w-4 h-4 bg-gray-600 rounded-sm align-middle mr-2"></span>
              Numbers inside circle = scale degrees
            </li>
          </ul>
        </div>
      </div>
      </div>
    </div>
  );
}

export default Circle;
