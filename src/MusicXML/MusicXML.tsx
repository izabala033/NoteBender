import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, FileText, SlidersHorizontal, Upload } from "lucide-react";
import { CursorType, OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { freqToNoteAndCents, harmonicaKeys } from "../utils/utils";
import { useTranslation } from "react-i18next";
import { usePitchDetector } from "../hooks/usePitchDetector";
import {
  ensureAudioContext,
  getAudioOutputLatencyMs,
  playPlaybackNotes,
  stopAudioNodes,
} from "./audioPlayback";
import { getMusicXmlFileErrorMessage, readMusicXmlFile } from "./musicXmlFile";
import {
  createFirstStaffDisplayXml,
  exportHarpTabsText,
  findAutoTransposeInterval,
  injectHarmonicaTabs,
} from "./musicXmlTransform";
import { getMusicXmlParseErrorMessage } from "./musicXmlParser";
import { NoteHighway } from "./NoteHighway";
import { parsePlaybackEvents } from "./playbackParser";
import {
  createPlaybackTimeline,
  getLaneKeys,
  getPlayableMidiNumbers,
  getTargetEventIndex,
  getVisibleGameEvents,
} from "./playbackTimeline";
import { styleSheetCursor } from "./sheetCursor";
import type { PlaybackNote } from "./types";
import { useNoteHighwayScoring } from "./useNoteHighwayScoring";

type RouteStatusTone = "info" | "success" | "error";

type RouteStatus = {
  tone: RouteStatusTone;
  message: string;
};

const routeStatusClassNames: Record<RouteStatusTone, string> = {
  info: "app-status-info",
  success: "app-status-success",
  error: "app-status-error",
};

const MusicXMLWorkspace: React.FC = () => {
  const { t } = useTranslation();
  const [rawFileContent, setRawFileContent] = useState<string | null>(null);
  const [transpose, setTranspose] = useState<number>(0);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [routeStatus, setRouteStatus] = useState<RouteStatus | null>({
    tone: "info",
    message: "Loading the default MusicXML score.",
  });
  const [selectedKey, setSelectedKey] = useState<string>("C4");
  const [noOverblowOrDraw, setNoOverblowOrDraw] = useState(true);
  const [noBend, setNoBend] = useState(false);
  const [tempo, setTempo] = useState(90);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentEventIndex, setCurrentEventIndex] = useState(0);
  const [currentTab, setCurrentTab] = useState("");
  const [currentGameTimeMs, setCurrentGameTimeMs] = useState(0);
  const [isSheetReady, setIsSheetReady] = useState(false);
  const [hasSheetRenderError, setHasSheetRenderError] = useState(false);

  const osmdRef = useRef<HTMLDivElement>(null);
  const sheetScrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const osmdInstance = useRef<OpenSheetMusicDisplay | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const playbackTimerRef = useRef<number | null>(null);
  const playbackRunRef = useRef(0);
  const activeAudioNodesRef = useRef(new Set<AudioScheduledSourceNode>());
  const cursorEventIndexRef = useRef<number | null>(null);
  const gameClockFrameRef = useRef<number | null>(null);
  const gameClockStartMsRef = useRef(0);
  const gameClockOffsetMsRef = useRef(0);
  const sheetRenderRunRef = useRef(0);
  const isPlayingRef = useRef(false);
  const displayFileContent = useMemo(
    () => (fileContent ? createFirstStaffDisplayXml(fileContent) : null),
    [fileContent]
  );

  const playback = useMemo(
    () => (displayFileContent ? parsePlaybackEvents(displayFileContent) : null),
    [displayFileContent]
  );
  const playbackEvents = useMemo(() => playback?.events ?? [], [playback]);
  const playableMidiNumbers = useMemo(
    () => getPlayableMidiNumbers(playbackEvents),
    [playbackEvents]
  );
  const tempoScale = tempo / (playback?.detectedTempo || tempo || 90);
  const playbackTimeline = useMemo(
    () => createPlaybackTimeline(playbackEvents, tempoScale),
    [playbackEvents, tempoScale]
  );
  const playbackEndMs =
    playbackTimeline[playbackTimeline.length - 1]?.endMs ?? 0;
  const laneKeys = useMemo(() => getLaneKeys(playbackEvents), [playbackEvents]);
  const visualPlayheadMs =
    isPlaying
      ? currentGameTimeMs
      : currentEventIndex >= playbackEvents.length
        ? playbackEndMs
        : playbackTimeline[currentEventIndex]?.startMs ?? 0;
  const progress =
    playbackEvents.length > 0
      ? Math.min(
          100,
          Math.round((currentEventIndex / playbackEvents.length) * 100)
        )
      : 0;
  const visibleGameEvents = useMemo(
    () =>
      getVisibleGameEvents(playbackEvents, playbackTimeline, visualPlayheadMs),
    [playbackEvents, playbackTimeline, visualPlayheadMs]
  );
  const targetEventIndex = useMemo(
    () => getTargetEventIndex(visibleGameEvents, visualPlayheadMs),
    [visibleGameEvents, visualPlayheadMs]
  );
  const currentGameEvent = playbackEvents[targetEventIndex ?? currentEventIndex];
  const { pitch, clarity, error: pitchError } = usePitchDetector(
    0.82,
    isPlaying && playbackEvents.length > 0,
    {
      allowedMidiNumbers: playableMidiNumbers,
      minRms: 0.012,
      stableFrames: 2,
    }
  );
  const detectedNote = useMemo(() => {
    if (!pitch) return null;
    return freqToNoteAndCents(Number(pitch));
  }, [pitch]);
  const { accuracy, gameStats, lastHitIndex, resetScoring } =
    useNoteHighwayScoring({
      currentEventIndex,
      currentGameEvent,
      detectedNote,
      playbackEvents,
      targetEventIndex,
    });
  const canUseProcessedScore =
    Boolean(fileContent) && isSheetReady && !hasSheetRenderError;
  const canPlayback = canUseProcessedScore && playbackEvents.length > 0;

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  const clearPlaybackResources = useCallback(() => {
    if (playbackTimerRef.current !== null) {
      window.clearTimeout(playbackTimerRef.current);
      playbackTimerRef.current = null;
    }
    if (gameClockFrameRef.current !== null) {
      window.cancelAnimationFrame(gameClockFrameRef.current);
      gameClockFrameRef.current = null;
    }

    stopAudioNodes(activeAudioNodesRef.current);
  }, []);

  const stopPlayback = useCallback((reset = false) => {
    playbackRunRef.current += 1;
    clearPlaybackResources();
    setIsPlaying(false);

    if (reset) {
      setCurrentEventIndex(0);
      setCurrentTab("");
      setCurrentGameTimeMs(0);
      resetScoring();
      cursorEventIndexRef.current = null;
      osmdInstance.current?.cursor?.reset();
      osmdInstance.current?.cursor?.hide();
      if (sheetScrollRef.current) {
        sheetScrollRef.current.scrollTop = 0;
      }
    }
  }, [clearPlaybackResources, resetScoring]);

  const clearRenderedSheet = useCallback(() => {
    sheetRenderRunRef.current += 1;
    setIsSheetReady(false);
    setHasSheetRenderError(false);
    cursorEventIndexRef.current = null;
    osmdInstance.current?.cursor?.hide();
    osmdRef.current?.replaceChildren();
    osmdInstance.current = null;
    if (sheetScrollRef.current) {
      sheetScrollRef.current.scrollTop = 0;
    }
  }, []);

  const clearCurrentScore = useCallback(() => {
    stopPlayback(true);
    setRawFileContent(null);
    setFileContent(null);
    clearRenderedSheet();
  }, [clearRenderedSheet, stopPlayback]);

  const finishPlayback = useCallback(() => {
    playbackRunRef.current += 1;
    clearPlaybackResources();
    setIsPlaying(false);
    setCurrentEventIndex(playbackEvents.length);
    setCurrentGameTimeMs(playbackEndMs);
  }, [clearPlaybackResources, playbackEndMs, playbackEvents.length]);

  const playNotes = useCallback((notes: PlaybackNote[], tempoBpm: number) => {
    const audioContext = ensureAudioContext(audioContextRef.current);
    audioContextRef.current = audioContext;
    playPlaybackNotes(
      audioContext,
      activeAudioNodesRef.current,
      notes,
      tempoBpm
    );
  }, []);

  const scrollSheetToCursor = useCallback(() => {
    const sheet = sheetScrollRef.current;
    const cursorElement = osmdInstance.current?.cursor?.cursorElement;
    if (!sheet || !cursorElement) return;

    window.requestAnimationFrame(() => {
      const sheetRect = sheet.getBoundingClientRect();
      const cursorRect = cursorElement.getBoundingClientRect();
      const targetTop = sheet.clientHeight * 0.32;
      const offset = cursorRect.top - sheetRect.top - targetTop;

      sheet.scrollTo({
        top: Math.max(0, sheet.scrollTop + offset),
        behavior: "smooth",
      });
    });
  }, []);

  const moveCursorInstantlyToEvent = useCallback((eventIndex: number) => {
    const cursor = osmdInstance.current?.cursor;
    if (!cursor) return;

    cursor.cursorElement.style.transition = "none";

    if (
      cursorEventIndexRef.current === null ||
      eventIndex < cursorEventIndexRef.current
    ) {
      cursor.reset();
      cursorEventIndexRef.current = 0;
    }

    cursor.show();
    for (let index = cursorEventIndexRef.current; index < eventIndex; index += 1) {
      cursor.next();
    }
    cursorEventIndexRef.current = eventIndex;
    styleSheetCursor(cursor.cursorElement, 0);
    void cursor.cursorElement.offsetHeight;
    scrollSheetToCursor();
  }, [scrollSheetToCursor]);

  const animateCursorToEvent = useCallback(
    (eventIndex: number, durationMs: number) => {
      const cursor = osmdInstance.current?.cursor;
      if (!cursor || cursorEventIndexRef.current === null) return;
      if (eventIndex <= cursorEventIndexRef.current) return;

      styleSheetCursor(cursor.cursorElement, durationMs);
      void cursor.cursorElement.offsetHeight;

      for (
        let index = cursorEventIndexRef.current;
        index < eventIndex;
        index += 1
      ) {
        cursor.next();
      }
      cursorEventIndexRef.current = eventIndex;

      window.requestAnimationFrame(() => {
        styleSheetCursor(cursor.cursorElement, durationMs);
        scrollSheetToCursor();
      });
    },
    [scrollSheetToCursor]
  );

  const moveCursorThroughEvent = useCallback(
    (eventIndex: number, durationMs: number) => {
      const event = playbackEvents[eventIndex];
      if (!event) return;

      const sourceEventIndex = event.sourceEventIndex;
      moveCursorInstantlyToEvent(sourceEventIndex);

      const nextEventIndex = eventIndex + 1;
      const nextSourceEventIndex = playbackEvents[nextEventIndex]?.sourceEventIndex;
      if (
        nextSourceEventIndex !== undefined &&
        nextSourceEventIndex > sourceEventIndex
      ) {
        animateCursorToEvent(nextSourceEventIndex, durationMs);
      }
    },
    [animateCursorToEvent, moveCursorInstantlyToEvent, playbackEvents]
  );

  const schedulePlayback = useCallback(
    (startIndex: number, runId: number) => {
      const event = playbackEvents[startIndex];
      if (!event) {
        finishPlayback();
        return;
      }

      const effectiveTempo = Math.max(20, event.tempoBpm * tempoScale);
      const durationMs = Math.max(
        80,
        (60000 / effectiveTempo) * event.durationBeats
      );
      const eventStartMs = playbackTimeline[startIndex]?.startMs ?? 0;

      gameClockOffsetMsRef.current =
        eventStartMs - getAudioOutputLatencyMs(audioContextRef.current);
      gameClockStartMsRef.current = performance.now();
      setCurrentGameTimeMs(gameClockOffsetMsRef.current);
      setCurrentEventIndex(startIndex);
      setCurrentTab(event.tabs.join("  "));
      moveCursorThroughEvent(startIndex, durationMs);
      playNotes(event.notes, effectiveTempo);

      playbackTimerRef.current = window.setTimeout(() => {
        if (playbackRunRef.current !== runId) return;
        schedulePlayback(startIndex + 1, runId);
      }, durationMs);
    },
    [
      moveCursorThroughEvent,
      finishPlayback,
      playNotes,
      playbackEvents,
      playbackTimeline,
      tempoScale,
    ]
  );

  const togglePlayback = useCallback(async () => {
    if (isPlaying) {
      stopPlayback();
      return;
    }

    if (!canPlayback) return;

    audioContextRef.current = ensureAudioContext(audioContextRef.current);
    await audioContextRef.current.resume();

    const startIndex =
      currentEventIndex >= playbackEvents.length ? 0 : currentEventIndex;
    if (startIndex === 0) {
      resetScoring();
    }
    gameClockOffsetMsRef.current =
      (playbackTimeline[startIndex]?.startMs ?? 0) -
      getAudioOutputLatencyMs(audioContextRef.current);
    gameClockStartMsRef.current = performance.now();
    setCurrentGameTimeMs(gameClockOffsetMsRef.current);
    const runId = playbackRunRef.current + 1;
    playbackRunRef.current = runId;
    setIsPlaying(true);
    schedulePlayback(startIndex, runId);
  }, [
    currentEventIndex,
    isPlaying,
    canPlayback,
    playbackEvents.length,
    playbackTimeline,
    resetScoring,
    schedulePlayback,
    stopPlayback,
  ]);

  useEffect(() => {
    if (!isPlaying) return;

    const updateClock = () => {
      setCurrentGameTimeMs(
        gameClockOffsetMsRef.current +
          (performance.now() - gameClockStartMsRef.current)
      );
      gameClockFrameRef.current = window.requestAnimationFrame(updateClock);
    };

    gameClockFrameRef.current = window.requestAnimationFrame(updateClock);

    return () => {
      if (gameClockFrameRef.current !== null) {
        window.cancelAnimationFrame(gameClockFrameRef.current);
        gameClockFrameRef.current = null;
      }
    };
  }, [isPlaying]);

  useEffect(() => {
    setRouteStatus({
      tone: "info",
      message: "Loading the default MusicXML score.",
    });

    fetch(`${import.meta.env.BASE_URL}IntroSong.musicxml`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load default musicxml");
        return res.text();
      })
      .then((text) => {
        setFileName("IntroSong.musicxml");
        setRawFileContent(text);
      })
      .catch((err) => {
        console.error("Fetch error:", err);
        setFileName(null);
        clearCurrentScore();
        setRouteStatus({
          tone: "error",
          message: "Couldn't load the default MusicXML file.",
        });
      });
  }, [clearCurrentScore]);

  const autoTransposeWithFilters = () => {
    if (!rawFileContent) {
      setRouteStatus({
        tone: "error",
        message: "Load a MusicXML file before using auto transpose.",
      });
      return;
    }

    let interval: number | null;
    try {
      interval = findAutoTransposeInterval(rawFileContent, {
        selectedKey,
        noOverblowOrDraw,
        noBend,
      });
    } catch (error) {
      setRouteStatus({
        tone: "error",
        message:
          getMusicXmlParseErrorMessage(error) ??
          "Couldn't inspect that MusicXML file for auto transpose.",
      });
      return;
    }

    if (interval !== null) {
      setRouteStatus({
        tone: interval === transpose ? "success" : "info",
        message:
          interval === transpose
            ? "Current transposition already matches these filters."
            : `Applying a ${interval} semitone transposition.`,
      });
      setTranspose(interval);
      return;
    }

    setRouteStatus({
      tone: "error",
      message: "Couldn't find a transposition matching your selected filters.",
    });
  };

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const input = event.currentTarget;
    const file = event.target.files?.[0];
    if (!file) return;

    setRouteStatus({
      tone: "info",
      message: `Loading ${file.name}.`,
    });
    setFileName(file.name);
    clearCurrentScore();

    try {
      const content = await readMusicXmlFile(file);
      setFileName(file.name);
      setRawFileContent(content);
    } catch (error) {
      setFileName(null);
      clearCurrentScore();
      setRouteStatus({
        tone: "error",
        message:
          getMusicXmlFileErrorMessage(error) ??
          getMusicXmlParseErrorMessage(error) ??
          "Couldn't load that MusicXML file. Check that the file is valid.",
      });
    } finally {
      input.value = "";
    }
  };

  const buildHarmonicaTabXml = useCallback(
    (xml: string): string => injectHarmonicaTabs(xml, { selectedKey, transpose }),
    [selectedKey, transpose]
  );

  const downloadProcessedFile = useCallback(() => {
    if (!canUseProcessedScore || !fileContent) return;

    const blob = new Blob([fileContent], {
      type: "application/vnd.recordare.musicxml+xml",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const baseName = fileName?.replace(/\.(mxl|musicxml|xml)$/i, "") || "score";

    link.href = url;
    link.download = `${baseName}-notebender.musicxml`;
    link.click();
    URL.revokeObjectURL(url);
  }, [canUseProcessedScore, fileContent, fileName]);

  const downloadHarpTabsText = useCallback(() => {
    if (!canUseProcessedScore || !fileContent) return;

    let text: string;
    try {
      text = exportHarpTabsText(fileContent);
    } catch (error) {
      setRouteStatus({
        tone: "error",
        message:
          getMusicXmlParseErrorMessage(error) ??
          "Couldn't export HarpTabs text from that MusicXML file.",
      });
      return;
    }

    const blob = new Blob([text], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const baseName = fileName?.replace(/\.(mxl|musicxml|xml)$/i, "") || "score";

    link.href = url;
    link.download = `${baseName}-harptabs.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }, [canUseProcessedScore, fileContent, fileName]);

  useEffect(() => {
    if (!rawFileContent) {
      setFileContent(null);
      clearRenderedSheet();
      return;
    }

    try {
      setIsSheetReady(false);
      setHasSheetRenderError(false);
      setRouteStatus({
        tone: "info",
        message: "Preparing harmonica tabs for the score.",
      });
      const injected = buildHarmonicaTabXml(rawFileContent);
      setFileContent(injected);
    } catch (error) {
      setFileContent(null);
      clearRenderedSheet();
      setRouteStatus({
        tone: "error",
        message:
          getMusicXmlParseErrorMessage(error) ??
          "Couldn't process that MusicXML file.",
      });
    }
  }, [rawFileContent, buildHarmonicaTabXml, clearRenderedSheet]);

  useEffect(() => {
    if (!playback) return;

    stopPlayback(true);
    setTempo(Math.round(playback.detectedTempo));
  }, [playback, stopPlayback]);

  useEffect(() => () => stopPlayback(true), [stopPlayback]);

  useEffect(() => {
    if (!displayFileContent) {
      clearRenderedSheet();
      return;
    }

    if (!osmdRef.current) return;

    const renderRun = sheetRenderRunRef.current + 1;
    sheetRenderRunRef.current = renderRun;
    setIsSheetReady(false);
    setHasSheetRenderError(false);
    setRouteStatus({
      tone: "info",
      message: "Rendering the MusicXML score.",
    });
    cursorEventIndexRef.current = null;

    if (!osmdInstance.current) {
      osmdInstance.current = new OpenSheetMusicDisplay(osmdRef.current, {
        backend: "svg",
        drawTitle: true,
        drawComposer: true,
        drawFingerings: true,
        fingeringPosition: "below",
        autoResize: true,
        followCursor: false,
        cursorsOptions: [
          {
            type: CursorType.ThinLeft,
            color: "#10b981",
            alpha: 0.85,
            follow: false,
          },
        ],
      });
    }

    osmdInstance.current
      .load(displayFileContent)
      .then(() => {
        if (sheetRenderRunRef.current !== renderRun) return;
        osmdInstance.current?.render();
        const cursor = osmdInstance.current?.cursor;
        cursorEventIndexRef.current = null;
        cursor?.reset();
        if (!isPlayingRef.current) {
          cursor?.hide();
        }
        setIsSheetReady(true);
        setHasSheetRenderError(false);
        setRouteStatus({
          tone: "success",
          message: fileName ? `Ready: ${fileName}.` : "Score ready.",
        });
        if (sheetScrollRef.current) {
          sheetScrollRef.current.scrollTop = 0;
        }
      })
      .catch((err) => {
        if (sheetRenderRunRef.current === renderRun) {
          stopPlayback(true);
          clearRenderedSheet();
          setHasSheetRenderError(true);
          setRouteStatus({
            tone: "error",
            message: "Couldn't render that MusicXML score.",
          });
        }
        console.error("OSMD Load Error:", err);
      });
  }, [clearRenderedSheet, displayFileContent, fileName, stopPlayback]);
  return (
    <div className="app-page">
      <div className="app-route app-route-wide">
        <header className="app-header">
          <h1 className="app-title">MusicXML Viewer with Harmonica Tabs</h1>
          <p className="app-subtitle">
            Load, transpose, render, and practice a first-staff harmonica score.
          </p>
        </header>

      <div className="flex flex-col items-start justify-center gap-4 lg:flex-row">
        {/* Configuration Sidebar */}
        <div className="app-panel w-full space-y-5 lg:w-72 xl:w-80">
          <h2 className="app-section-title">Score setup</h2>

          {routeStatus && (
            <div
              role={routeStatus.tone === "error" ? "alert" : "status"}
              aria-live="polite"
              className={`app-status ${routeStatusClassNames[routeStatus.tone]}`}
            >
              {routeStatus.message}
            </div>
          )}

          {/* Key Selector */}
          <div>
            <label
              htmlFor="harmonicaKey"
              className="app-control-label"
            >
              Harmonica key
            </label>
            <select
              id="harmonicaKey"
              value={selectedKey}
              onChange={(e) => setSelectedKey(e.target.value)}
              className="app-field"
            >
              {harmonicaKeys.map((key) => (
                <option key={key.value} value={key.value}>
                  {t(key.label)}
                </option>
              ))}
            </select>
          </div>

          {/* Transpose Input */}
          <div>
            <label className="app-control-label">
              Transpose
            </label>
            <div className="mt-1 grid grid-cols-[40px_minmax(0,1fr)_40px]">
              <button
                type="button"
                onClick={() => setTranspose((value) => value - 1)}
                className="app-icon-button h-10 rounded-r-none"
                aria-label="Decrease transpose semitones"
                title="Decrease transpose semitones"
              >
                -
              </button>
              <input
                type="number"
                step="1"
                value={transpose}
                onChange={(e) => setTranspose(parseInt(e.target.value, 10) || 0)}
                className="min-h-10 w-full border-y border-gray-700 bg-gray-800 px-3 py-2 text-center text-sm text-white transition hover:border-gray-600"
                aria-label="Transpose semitones"
              />
              <button
                type="button"
                onClick={() => setTranspose((value) => value + 1)}
                className="app-icon-button h-10 rounded-l-none"
                aria-label="Increase transpose semitones"
                title="Increase transpose semitones"
              >
                +
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-500">Semitones</p>
          </div>

          {/* File Upload */}
          <div>
            <label className="app-control-label" htmlFor="musicxml-upload">
              Upload MusicXML file
            </label>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="app-button app-button-primary mt-1 w-full"
            >
              <Upload className="h-4 w-4" aria-hidden="true" />
              Browse MusicXML file
            </button>
            <input
              ref={fileInputRef}
              id="musicxml-upload"
              type="file"
              accept=".xml,.musicxml,.mxl"
              onChange={handleFileChange}
              className="hidden"
              tabIndex={-1}
            />

            {fileName && (
              <p className="mt-1 text-sm text-gray-500">Loaded: {fileName}</p>
            )}
          </div>

          <fieldset className="app-panel-muted space-y-3">
            <legend className="text-sm font-medium text-gray-300">
              Auto transpose filters
            </legend>
            <div>
              <p className="text-xs text-gray-500">
                Apply these filters when choosing a transposition.
              </p>
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-gray-300">
                <input
                  type="checkbox"
                  checked={noOverblowOrDraw}
                  onChange={(e) => setNoOverblowOrDraw(e.target.checked)}
                  aria-label="Exclude overblow and overdraw notes"
                />
                No Overblow or Overdraw Notes
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-300">
                <input
                  type="checkbox"
                  checked={noBend}
                  onChange={(e) => setNoBend(e.target.checked)}
                  aria-label="Exclude bends"
                />
                No Bends
              </label>
            </div>

            <button
              type="button"
              onClick={autoTransposeWithFilters}
              className="app-button app-button-secondary w-full"
            >
              <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
              Auto transpose
            </button>
          </fieldset>

          <button
            type="button"
            onClick={downloadProcessedFile}
            disabled={!canUseProcessedScore}
            className="app-button app-button-secondary w-full"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Download Transposed MusicXML
          </button>

          <button
            type="button"
            onClick={downloadHarpTabsText}
            disabled={!canUseProcessedScore}
            className="app-button app-button-secondary w-full"
          >
            <FileText className="h-4 w-4" aria-hidden="true" />
            Download HarpTabs text
          </button>

        </div>

        <div className="grid w-full min-w-0 flex-1 gap-4 min-[1800px]:grid-cols-[minmax(0,1fr)_460px]">
          <div className="order-1 lg:order-2 min-[1800px]:order-2">
            <NoteHighway
              accuracy={accuracy}
              canPlayback={canPlayback}
              clarity={clarity}
              currentEventIndex={currentEventIndex}
              currentTab={currentTab}
              detectedNote={detectedNote}
              gameStats={gameStats}
              isPlaying={isPlaying}
              laneKeys={laneKeys}
              lastHitIndex={lastHitIndex}
              onRestartPlayback={() => stopPlayback(true)}
              onTogglePlayback={togglePlayback}
              playbackEventsCount={playbackEvents.length}
              pitchError={pitchError}
              progress={progress}
              setTempo={setTempo}
              tempo={tempo}
              visibleGameEvents={visibleGameEvents}
              visualPlayheadMs={visualPlayheadMs}
            />
          </div>

          {/* Sheet Music Viewer */}
          <div className="order-2 min-w-0 lg:order-1 min-[1800px]:order-1">
            <h2 className="app-section-title mb-3">Score viewer</h2>
            <div
              ref={sheetScrollRef}
              className="h-[70dvh] min-h-80 max-h-[620px] w-full overflow-auto rounded-lg border border-gray-800 bg-white p-2 text-black shadow-sm shadow-black/30 sm:p-3 lg:sticky lg:top-4 lg:h-[calc(100dvh-7rem)] lg:min-h-[620px] lg:max-h-none min-[1800px]:min-h-[560px]"
            >
              <div ref={osmdRef} />
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
};

export default MusicXMLWorkspace;
