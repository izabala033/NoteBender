import { useState, useMemo } from "react";
import { usePitchDetector } from "../hooks/usePitchDetector";
import { Note } from "tonal";
import { useTranslation } from "react-i18next";
import {
  harmonicaKeys,
  generateLayout,
  freqToNoteAndCents,
  getLayoutMidiNumbers,
  harmonicaLayoutDisplayRows,
} from "../utils/utils";
import type {
  HarmonicaLayoutDisplayRowKey,
  TonalNote,
} from "../utils/utils";

const baseKey = "C4";

const rowColorClasses = {
  wholeStepBlowBend: "bg-purple-700 text-white",
  HalfStepBlowBend: "bg-indigo-700 text-white",
  blow: "bg-blue-600 text-white",
  draw: "bg-red-600 text-white",
  halfStepDrawBendOverdraw: "bg-pink-700 text-white",
  wholeStepDrawBend: "bg-rose-700 text-white",
  oneAndHalfStepDrawBend: "bg-amber-700 text-white",
} satisfies Record<HarmonicaLayoutDisplayRowKey, string>;

function Harmonica() {
  const { t } = useTranslation();
  const [isListening, setIsListening] = useState(false);
  const [key, setKey] = useState(baseKey);
  const layout = useMemo(() => generateLayout(key), [key]);
  const allowedMidiNumbers = useMemo(
    () => new Set(getLayoutMidiNumbers(layout)),
    [layout]
  );
  const { pitch, clarity, error } = usePitchDetector(0.82, isListening, {
    allowedMidiNumbers,
    minRms: 0.015,
    stableFrames: 4,
  });
  // Get detected note and cents offset from pitch.
  const detectedNote = useMemo(() => {
    if (!pitch) return null;
    return freqToNoteAndCents(Number(pitch));
  }, [pitch]);
  const detectedMidi = detectedNote ? Note.midi(detectedNote.note) : null;
  const bendControlLabel = detectedNote
    ? Math.abs(detectedNote.cents) <= 5
      ? "Centered"
      : detectedNote.cents > 0
        ? "Higher"
        : "Lower"
    : "Find a steady note";

  const renderBendControlMeter = () => {
    const cents = detectedNote?.cents ?? 0;
    const clampedCents = Math.max(-50, Math.min(50, cents));
    const markerLeft = ((clampedCents + 50) / 100) * 100;

    return (
      <div className="mt-4 w-full max-w-md">
        <div className="mb-2 flex items-center justify-between text-xs font-medium text-gray-400">
          <span>Lower</span>
          <span className="text-gray-300">{bendControlLabel}</span>
          <span>Higher</span>
        </div>
        <div className="relative h-3 rounded-full border border-gray-700 bg-gray-800">
          <div className="absolute left-1/2 top-0 h-full w-px bg-emerald-300" />
          <div
            className={`absolute top-1/2 h-5 w-2 -translate-x-1/2 -translate-y-1/2 rounded bg-emerald-300 shadow-[0_0_16px_rgba(110,231,183,0.65)] ${
              detectedNote ? "" : "opacity-40"
            }`}
            style={{ left: `${markerLeft}%` }}
          />
        </div>
        <div className="mt-2 text-center text-xs text-gray-400">
          {detectedNote
            ? `${detectedNote.cents.toFixed(1)} cents`
            : "Waiting for a stable bend target"}
        </div>
      </div>
    );
  };

  // Render a horizontal line inside the note box
  // offsetY: vertical offset in px from center, positive moves line down
  const renderLine = (offsetY: number) => {
    // Clamp offset to ±8 px max to stay inside the box (box ~ 32px height)
    const clampedOffset = Math.max(-8, Math.min(8, offsetY));
    return (
      <div
        className="absolute left-0 right-0 h-[2px] bg-green-400"
        style={{
          top: `calc(50% + ${clampedOffset}px)`,
          pointerEvents: "none",
        }}
      />
    );
  };

  const renderRow = (
    notes: (TonalNote | null)[],
    label?: string,
    colorClass = "text-white"
  ) => (
    <div
      key={label}
      className="mb-1 grid grid-cols-[88px_repeat(10,minmax(44px,1fr))] gap-2 text-center"
    >
      <div className="flex min-h-8 items-center text-left text-xs font-semibold text-gray-400">
        {label}
      </div>
      {notes.map((note, idx) => {
        if (!note) return <div key={`${label}-${idx}`} />;

        // Check if note matches detected note
        let showLine = false;
        let offsetY = 0;

        const isDetectedCell = detectedMidi === Note.midi(note.name);

        if (isDetectedCell) {
          showLine = true;
          // Map cents offset (±50 cents) to ±8px vertical offset
          // 0 cents = center (0px), 50 cents = 8px
          offsetY = -((detectedNote?.cents ?? 0) / 50) * 8;
        }

        // Use t() to translate note pitch classes, fallback to original
        const simplifiedPitchClass = Note.simplify(Note.pitchClass(note.name));
        const translatedNoteName = t(simplifiedPitchClass);

        return (
          <div
            key={`${label}-${idx}`}
            className={`relative flex min-h-8 items-center justify-center rounded border px-2 py-1 text-sm font-semibold ${
              isDetectedCell
                ? "border-emerald-200 ring-2 ring-emerald-200/80 shadow-[0_0_18px_rgba(52,211,153,0.35)]"
                : "border-gray-700"
            } ${colorClass}`}
          >
            {translatedNoteName}
            {showLine && renderLine(offsetY)}
          </div>
        );
      })}
    </div>
  );

  const renderHoleNumbers = () => (
    <div className="mb-2 grid grid-cols-[88px_repeat(10,minmax(44px,1fr))] gap-2 text-center font-semibold text-gray-400 select-none">
      <div className="text-left text-xs uppercase tracking-normal text-gray-500">
        Hole
      </div>
      {Array.from({ length: 10 }, (_, i) => (
        <div key={`hole-${i + 1}`}>{i + 1}</div>
      ))}
    </div>
  );

  return (
    <div className="app-page">
      <div className="app-route app-route-narrow">
        <header className="app-header">
          <h1 className="app-title">Harmonica Bend Practice</h1>
          <p className="app-subtitle">
            {t(Note.pitchClass(key))} harmonica layout with live bend-control feedback.
          </p>
        </header>

        <section className="app-panel flex min-h-[17rem] items-center justify-center">
          {!isListening && (
            <div className="flex flex-col items-center justify-center gap-3 text-center">
              <div className="app-status app-status-info" role="status">
                Microphone idle
              </div>
              <button
                type="button"
                onClick={() => setIsListening(true)}
                className="app-button app-button-success"
              >
                Start listening
              </button>
              {error && (
                <div className="app-status app-status-error" role="alert">
                  {error}
                </div>
              )}
            </div>
          )}

          {isListening && !error && (
            <div
              className="flex w-full flex-col items-center text-center"
              role="status"
              aria-live="polite"
            >
              <div className="min-h-[3.5rem] text-4xl font-bold text-emerald-300 sm:text-5xl">
                {detectedNote ? detectedNote.note : "--"}
              </div>
              <div className="mt-2 min-h-5 text-sm text-gray-300">
                {detectedNote
                  ? `${pitch} Hz · clarity ${clarity} · ${detectedNote.cents.toFixed(
                      1
                    )} cents`
                  : "Listening for a steady bend target"}
              </div>
              {renderBendControlMeter()}
              <button
                type="button"
                onClick={() => setIsListening(false)}
                className="app-button app-button-secondary mt-4"
              >
                Stop listening
              </button>
            </div>
          )}

          {isListening && error && (
            <div className="flex flex-col items-center justify-center gap-3 text-center">
              <div className="app-status app-status-error" role="alert">
                {error}
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsListening(false);
                  window.setTimeout(() => setIsListening(true), 0);
                }}
                className="app-button app-button-secondary"
              >
                Try again
              </button>
            </div>
          )}
        </section>

        <section className="app-panel">
          <div className="mb-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px] sm:items-end">
            <div>
              <h2 className="app-section-title">
                Harmonica Layout ({t(Note.pitchClass(key))} Major)
              </h2>
            </div>
            <label
              htmlFor="key-select"
              className="app-control-label"
            >
              Harmonica key
              <select
                id="key-select"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                className="app-field"
              >
                {harmonicaKeys.map((k) => (
                  <option key={k.value} value={k.value}>
                    {t(k.label)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="app-scroll-x rounded-lg border border-gray-800 bg-gray-950/70 p-4 shadow-inner shadow-black/20">
            <div className="min-w-[620px]">
              {harmonicaLayoutDisplayRows.slice(0, 3).map(({ key, label }) =>
                renderRow(layout[key], label, rowColorClasses[key])
              )}
              {renderHoleNumbers()}
              {harmonicaLayoutDisplayRows.slice(3).map(({ key, label }) =>
                renderRow(layout[key], label, rowColorClasses[key])
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default Harmonica;
