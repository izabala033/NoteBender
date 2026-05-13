import { Note } from "tonal";
import { NOTE_PITCH_TOLERANCE_CENTS } from "./constants";
import type { GameStats, PlaybackEvent } from "./types";

export type DetectedPitch = {
  cents: number;
  note: string;
};

export const initialGameStats: GameStats = {
  hits: 0,
  misses: 0,
  streak: 0,
};

export const hasPlayableNotes = (event: PlaybackEvent | undefined) =>
  Boolean(event?.notes.some((note) => note.shouldPlay));

export const getTargetMidiNumbers = (event: PlaybackEvent | undefined) =>
  new Set(
    (event?.notes ?? [])
      .filter((note) => note.shouldPlay)
      .map((note) => Note.midi(note.name))
      .filter((midi): midi is number => typeof midi === "number")
  );

export const isDetectedPitchHit = (
  targetMidiNumbers: Set<number>,
  detectedPitch: DetectedPitch | null
) => {
  if (!detectedPitch) return false;

  const detectedMidi = Note.midi(detectedPitch.note);
  return (
    typeof detectedMidi === "number" &&
    targetMidiNumbers.has(detectedMidi) &&
    Math.abs(detectedPitch.cents) <= NOTE_PITCH_TOLERANCE_CENTS
  );
};

export const getGameAccuracy = ({ hits, misses }: GameStats) => {
  const scoredNotes = hits + misses;
  return scoredNotes > 0 ? Math.round((hits / scoredNotes) * 100) : 0;
};
