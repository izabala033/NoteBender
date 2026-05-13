import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { freqToNoteAndCents } from "../utils/utils";
import {
  getGameAccuracy,
  getTargetMidiNumbers,
  hasPlayableNotes,
  initialGameStats,
  isDetectedPitchHit,
} from "./noteHighwayScoring";
import type { GameStats, PlaybackEvent } from "./types";

type DetectedNote = NonNullable<ReturnType<typeof freqToNoteAndCents>>;

type UseNoteHighwayScoringOptions = {
  currentEventIndex: number;
  currentGameEvent: PlaybackEvent | undefined;
  detectedNote: DetectedNote | null;
  playbackEvents: PlaybackEvent[];
  targetEventIndex: number | null;
};

export const useNoteHighwayScoring = ({
  currentEventIndex,
  currentGameEvent,
  detectedNote,
  playbackEvents,
  targetEventIndex,
}: UseNoteHighwayScoringOptions) => {
  const [gameStats, setGameStats] = useState<GameStats>(initialGameStats);
  const [lastHitIndex, setLastHitIndex] = useState<number | null>(null);
  const scoredEventIndexRef = useRef<number | null>(null);
  const previousEventIndexRef = useRef(0);

  const currentTargetMidiNumbers = useMemo(
    () => getTargetMidiNumbers(currentGameEvent),
    [currentGameEvent]
  );
  const isCurrentHit =
    targetEventIndex !== null &&
    isDetectedPitchHit(currentTargetMidiNumbers, detectedNote);
  const accuracy = getGameAccuracy(gameStats);

  const resetScoring = useCallback(() => {
    setGameStats(initialGameStats);
    setLastHitIndex(null);
    scoredEventIndexRef.current = null;
    previousEventIndexRef.current = 0;
  }, []);

  useEffect(() => {
    if (
      targetEventIndex === null ||
      !isCurrentHit ||
      scoredEventIndexRef.current === targetEventIndex
    ) {
      return;
    }

    scoredEventIndexRef.current = targetEventIndex;
    setLastHitIndex(targetEventIndex);
    setGameStats((stats) => ({
      ...stats,
      hits: stats.hits + 1,
      streak: stats.streak + 1,
    }));
  }, [isCurrentHit, targetEventIndex]);

  useEffect(() => {
    const previousIndex = previousEventIndexRef.current;
    if (currentEventIndex <= previousIndex) {
      previousEventIndexRef.current = currentEventIndex;
      return;
    }

    const previousEvent = playbackEvents[previousIndex];
    const shouldScoreMiss =
      hasPlayableNotes(previousEvent) &&
      scoredEventIndexRef.current !== previousIndex;

    if (shouldScoreMiss) {
      setGameStats((stats) => ({
        ...stats,
        misses: stats.misses + 1,
        streak: 0,
      }));
    }

    previousEventIndexRef.current = currentEventIndex;
  }, [currentEventIndex, playbackEvents]);

  return {
    accuracy,
    gameStats,
    lastHitIndex,
    resetScoring,
  };
};
