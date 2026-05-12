import { useEffect, useRef, useState } from "react";
import { PitchDetector } from "pitchy";

interface WindowWithWebkitAudioContext extends Window {
  webkitAudioContext?: typeof AudioContext;
}

type PitchDetectorOptions = {
  allowedMidiNumbers?: Set<number>;
  minRms?: number;
  stableFrames?: number;
};

const getRms = (buffer: Float32Array<ArrayBuffer>) => {
  const sum = buffer.reduce((total, sample) => total + sample * sample, 0);
  return Math.sqrt(sum / buffer.length);
};

const frequencyToMidi = (frequency: number) =>
  Math.round(69 + 12 * Math.log2(frequency / 440));

export function usePitchDetector(
  minClarity: number = 0.95,
  enabled = true,
  {
    allowedMidiNumbers,
    minRms = 0.015,
    stableFrames = 4,
  }: PitchDetectorOptions = {}
) {
  const [pitch, setPitch] = useState<string | null>(null);
  const [clarity, setClarity] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const pitchDetectorRef = useRef<ReturnType<
    typeof PitchDetector.forFloat32Array
  > | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const candidateMidiRef = useRef<number | null>(null);
  const stableFramesRef = useRef(0);

  useEffect(() => {
    if (!enabled) {
      setPitch(null);
      setClarity(null);
      setError(null);
      return;
    }

    let analyser: AnalyserNode;
    let buffer: Float32Array<ArrayBuffer>;
    let cancelled = false;

    const initAudio = async () => {
      try {
        setError(null);
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        mediaStreamRef.current = stream;

        const AudioContextClass =
          window.AudioContext ||
          (window as WindowWithWebkitAudioContext).webkitAudioContext;
        if (!AudioContextClass) {
          throw new Error("Web Audio API is not supported in this browser.");
        }

        const audioContext = new AudioContextClass();
        audioContextRef.current = audioContext;

        analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;
        const mediaStreamSource = audioContext.createMediaStreamSource(stream);
        mediaStreamSource.connect(analyser);

        buffer = new Float32Array(analyser.fftSize);
        pitchDetectorRef.current = PitchDetector.forFloat32Array(buffer.length);

        const updatePitch = async () => {
          if (cancelled) return;

          if (audioContext.state === "suspended") {
            await audioContext.resume();
          }

          analyser.getFloatTimeDomainData(buffer);
          const [detectedPitch, detectedClarity] =
            pitchDetectorRef.current!.findPitch(
              buffer,
              audioContext.sampleRate
            );
          const detectedMidi = frequencyToMidi(detectedPitch);
          const isAllowedMidi =
            !allowedMidiNumbers || allowedMidiNumbers.has(detectedMidi);
          const isUsablePitch =
            Number.isFinite(detectedPitch) &&
            detectedPitch > 0 &&
            detectedClarity > minClarity &&
            getRms(buffer) >= minRms &&
            isAllowedMidi;

          if (!isUsablePitch) {
            candidateMidiRef.current = null;
            stableFramesRef.current = 0;
            setPitch(null);
            setClarity(null);
          } else {
            if (candidateMidiRef.current === detectedMidi) {
              stableFramesRef.current += 1;
            } else {
              candidateMidiRef.current = detectedMidi;
              stableFramesRef.current = 1;
            }

            if (stableFramesRef.current >= stableFrames) {
              setPitch(detectedPitch.toFixed(1));
              setClarity(detectedClarity.toFixed(2));
            }
          }

          rafIdRef.current = requestAnimationFrame(updatePitch);
        };

        updatePitch();
      } catch (error) {
        console.error("Error accessing microphone:", error);
        setError(
          error instanceof Error
            ? error.message
            : "Unable to access the microphone."
        );
        setPitch(null);
        setClarity(null);
      }
    };

    initAudio();

    return () => {
      cancelled = true;
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      audioContextRef.current?.close();
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      audioContextRef.current = null;
      mediaStreamRef.current = null;
      rafIdRef.current = null;
      candidateMidiRef.current = null;
      stableFramesRef.current = 0;
    };
  }, [allowedMidiNumbers, enabled, minClarity, minRms, stableFrames]);
  return { pitch, clarity, error };
}
