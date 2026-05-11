import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Chord, Note } from "tonal";
import { usePitchDetector } from "../hooks/usePitchDetector";
import {
  freqToNoteAndCents,
  generateLayout,
  getLayoutMidiNumbers,
  harmonicaKeys,
  harmonicaLayoutDisplayRows,
} from "../utils/utils";
import {
  bluesBars,
  getPitchClassSet,
  getPracticeTargets,
  positionOptions,
  scaleOptions,
} from "./practiceTargets";
import type { HarmonicaLayoutDisplayRowKey, TonalNote } from "../utils/utils";
import type { PracticeScaleValue } from "./practiceTargets";

const trainerModes = [
  { label: "Explore", value: "explore" },
  { label: "Practice", value: "practice" },
  { label: "Bends", value: "bends" },
  { label: "12-bar", value: "blues" },
];

const rowColorClasses = {
  wholeStepBlowBend: "bg-purple-800",
  HalfStepBlowBend: "bg-indigo-800",
  blow: "bg-blue-700",
  draw: "bg-red-700",
  halfStepDrawBendOverdraw: "bg-pink-800",
  wholeStepDrawBend: "bg-rose-800",
  oneAndHalfStepDrawBend: "bg-amber-800",
} satisfies Record<HarmonicaLayoutDisplayRowKey, string>;

type TrainerMode = (typeof trainerModes)[number]["value"];

function Practice() {
  const { t } = useTranslation();
  const [key, setKey] = useState("C4");
  const [positionIndex, setPositionIndex] = useState(1);
  const [scaleValue, setScaleValue] = useState<PracticeScaleValue>("blues");
  const [trainerMode, setTrainerMode] = useState<TrainerMode>("explore");
  const [targetIndex, setTargetIndex] = useState(0);
  const [barIndex, setBarIndex] = useState(0);
  const [isListening, setIsListening] = useState(false);

  const layout = useMemo(() => generateLayout(key), [key]);
  const {
    position,
    tonic,
    scaleLabel,
    activePitchClasses,
    practiceTargets,
    bendTargets,
  } = useMemo(
    () =>
      getPracticeTargets({
        layout,
        harmonicaKey: key,
        positionIndex,
        scaleValue,
      }),
    [key, layout, positionIndex, scaleValue]
  );

  const bluesRoots = useMemo(
    () => ({
      I: tonic,
      IV: Note.transpose(tonic, "4P"),
      V: Note.transpose(tonic, "5P"),
    }),
    [tonic]
  );
  const currentBluesRoot = bluesRoots[bluesBars[barIndex] as keyof typeof bluesRoots];
  const currentChordNotes = Chord.get(`${currentBluesRoot}7`).notes;

  const chordPitchClasses = useMemo(
    () => getPitchClassSet(currentChordNotes),
    [currentChordNotes]
  );
  const targets = trainerMode === "bends" ? bendTargets : practiceTargets;
  const target = targets[targetIndex % Math.max(targets.length, 1)];
  const activeTarget =
    trainerMode === "practice" || trainerMode === "bends" ? target : undefined;

  const allowedMidiNumbers = useMemo(() => {
    return new Set(getLayoutMidiNumbers(layout));
  }, [layout]);

  const { pitch, clarity, error } = usePitchDetector(0.82, isListening, {
    allowedMidiNumbers,
    minRms: 0.015,
    stableFrames: 4,
  });
  const detectedNote = useMemo(() => {
    if (!pitch) return null;
    return freqToNoteAndCents(Number(pitch));
  }, [pitch]);
  const detectedMidi = detectedNote ? Note.midi(detectedNote.note) : null;
  const isTargetHit =
    Boolean(activeTarget && detectedMidi === activeTarget.midi && Math.abs(detectedNote?.cents ?? 99) <= 25);

  const nextTarget = () => {
    if (!targets.length) return;
    setTargetIndex((index) => {
      if (targets.length === 1) return 0;

      const nextIndex = Math.floor(Math.random() * targets.length);
      return nextIndex === index ? (index + 1) % targets.length : nextIndex;
    });
  };

  const renderLine = (offsetY: number) => {
    const clampedOffset = Math.max(-8, Math.min(8, offsetY));
    return (
      <div
        className="absolute left-0 right-0 h-[2px] bg-green-300"
        style={{ top: `calc(50% + ${clampedOffset}px)`, pointerEvents: "none" }}
      />
    );
  };

  const renderCell = (note: TonalNote | null, rowLabel: string, index: number, color: string) => {
    if (!note) return <div key={`${rowLabel}-${index}`} />;

    const midi = Note.midi(note.name);
    const chroma = Note.chroma(note.name);
    const isActive = activePitchClasses.has(chroma);
    const isChordTone = trainerMode === "blues" && chordPitchClasses.has(chroma);
    const isTarget = activeTarget?.midi === midi;
    const isDetected = detectedMidi === midi;
    const pitchClass = Note.simplify(Note.pitchClass(note.name));

    return (
      <div
        key={`${rowLabel}-${index}`}
        className={`relative min-h-8 rounded border px-1 py-1 text-center text-sm font-semibold ${
          isTarget
            ? "border-cyan-200 bg-cyan-400 text-black"
            : isChordTone
              ? "border-yellow-200 bg-yellow-400 text-black"
              : isActive
              ? "border-emerald-300 bg-emerald-500 text-black"
              : `border-gray-700 ${color} text-white opacity-45`
        }`}
      >
        {t(pitchClass)}
        {isDetected && renderLine(-((detectedNote?.cents ?? 0) / 50) * 8)}
      </div>
    );
  };

  return (
    <div className="app-page">
      <div className="app-route app-route-workspace">
        <header className="app-header">
          <h1 className="app-title">Practice Trainer</h1>
          <p className="app-subtitle">
            {t(Note.pitchClass(key))} harmonica · {position.label} position · {t(tonic)}{" "}
            {scaleLabel}
          </p>
        </header>

        <div className="app-panel grid gap-3 lg:grid-cols-4">
          <label className="app-control-label">
            Harmonica key
            <select
              value={key}
              onChange={(event) => {
                setKey(event.target.value);
                setTargetIndex(0);
              }}
              className="app-field"
            >
              {harmonicaKeys.map((harmonicaKey) => (
                <option key={harmonicaKey.value} value={harmonicaKey.value}>
                  {t(harmonicaKey.label)}
                </option>
              ))}
            </select>
          </label>

          <label className="app-control-label">
            Position
            <select
              value={positionIndex}
              onChange={(event) => {
                setPositionIndex(Number(event.target.value));
                setTargetIndex(0);
              }}
              className="app-field"
            >
              {positionOptions.map((option, index) => (
                <option key={option.label} value={index}>
                  {option.label} · {option.name}
                </option>
              ))}
            </select>
          </label>

          <label className="app-control-label">
            Scale
            <select
              value={scaleValue}
              onChange={(event) => {
                setScaleValue(event.target.value as PracticeScaleValue);
                setTargetIndex(0);
              }}
              className="app-field"
            >
              {scaleOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-end">
            <div className="app-segmented flex-wrap">
            {trainerModes.map((mode) => (
              <button
                key={mode.value}
                type="button"
                aria-pressed={trainerMode === mode.value}
                onClick={() => {
                  setTrainerMode(mode.value);
                  setTargetIndex(0);
                }}
                className={`app-segment ${
                  trainerMode === mode.value
                    ? "app-segment-active"
                    : ""
                }`}
              >
                {mode.label}
              </button>
            ))}
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="app-panel app-scroll-x">
            <div className="min-w-[720px]">
              {harmonicaLayoutDisplayRows.slice(0, 3).map(({ key, practiceLabel }) => (
                <div
                  key={key}
                  className="mb-1 grid grid-cols-[96px_repeat(10,minmax(48px,1fr))] gap-2"
                >
                  <div className="flex min-h-8 items-center text-xs font-semibold text-gray-400">
                    {practiceLabel}
                  </div>
                  {layout[key].map((note, index) =>
                    renderCell(note, practiceLabel, index, rowColorClasses[key])
                  )}
                </div>
              ))}
              <div className="mb-2 grid grid-cols-[96px_repeat(10,minmax(48px,1fr))] gap-2 text-center text-sm font-bold text-gray-400">
                <div className="text-left text-xs uppercase tracking-normal text-gray-500">
                  Hole
                </div>
                {Array.from({ length: 10 }, (_, index) => (
                  <div key={index + 1}>{index + 1}</div>
                ))}
              </div>
              {harmonicaLayoutDisplayRows.slice(3).map(({ key, practiceLabel }) => (
                <div
                  key={key}
                  className="mb-1 grid grid-cols-[96px_repeat(10,minmax(48px,1fr))] gap-2"
                >
                  <div className="flex min-h-8 items-center text-xs font-semibold text-gray-400">
                    {practiceLabel}
                  </div>
                  {layout[key].map((note, index) =>
                    renderCell(note, practiceLabel, index, rowColorClasses[key])
                  )}
                </div>
              ))}
            </div>
          </div>

          <aside className="app-panel">
            {trainerMode === "blues" ? (
              <>
                <h2 className="app-section-title">12-bar blues</h2>
                <div className="mt-3 grid grid-cols-4 gap-2">
                  {bluesBars.map((degree, index) => (
                    <button
                      key={`${degree}-${index}`}
                      type="button"
                      onClick={() => setBarIndex(index)}
                      aria-pressed={barIndex === index}
                      className={`app-button min-h-9 px-2 py-2 ${
                        barIndex === index
                          ? "app-button-primary"
                          : "app-button-secondary"
                      }`}
                    >
                      {index + 1}. {degree}
                    </button>
                  ))}
                </div>
                <p className="mt-4 text-sm text-gray-300">
                  Bar {barIndex + 1}: {t(currentBluesRoot)}7 ·{" "}
                  {currentChordNotes.map((note) => t(Note.pitchClass(note))).join(" - ")}
                </p>
              </>
            ) : (
              <>
                <h2 className="app-section-title">
                  {trainerMode === "bends" ? "Bend trainer" : "Note practice"}
                </h2>
                {activeTarget ? (
                  <div className="mt-4 rounded-lg border border-cyan-600/70 bg-cyan-950/30 p-5 text-center shadow-[0_0_24px_rgba(8,145,178,0.14)]">
                    <div className="text-sm text-gray-400">{activeTarget.label}</div>
                    <div className="mt-1 text-5xl font-bold text-cyan-100">{t(Note.pitchClass(activeTarget.noteName))}</div>
                    <div className="mt-1 text-sm text-gray-400">{activeTarget.noteName}</div>
                    <div
                      className={`app-status mt-4 text-base font-semibold ${
                        isTargetHit ? "app-status-success" : "border-gray-700 bg-gray-800 text-gray-300"
                      }`}
                    >
                      {isTargetHit ? "Hit" : "Waiting"}
                    </div>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-gray-400">
                    No playable targets for this selection.
                  </p>
                )}

                <button
                  type="button"
                  onClick={nextTarget}
                  disabled={!targets.length}
                  className="app-button app-button-primary mt-3 w-full"
                >
                  Next target
                </button>
              </>
            )}

            <div className="mt-5 border-t border-gray-800 pt-4">
              {!isListening ? (
                <div className="space-y-3">
                  <div className="app-status app-status-info" role="status">
                    Microphone idle
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsListening(true)}
                    className="app-button app-button-success w-full"
                  >
                    Start listening
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div
                    className={`app-status ${
                      detectedNote ? "app-status-success" : "app-status-info"
                    }`}
                    role="status"
                  >
                    {detectedNote
                      ? `Detected ${detectedNote.note} · ${detectedNote.cents.toFixed(1)} cents · clarity ${clarity}`
                      : "Listening for pitch"}
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsListening(false)}
                    className="app-button app-button-secondary w-full"
                  >
                    Stop listening
                  </button>
                </div>
              )}

              {error && (
                <p className="app-status app-status-error mt-3" role="alert">
                  {error}
                </p>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

export default Practice;
