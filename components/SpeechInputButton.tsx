"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./SpeechInputButton.module.css";

type RecognitionResult = {
  isFinal: boolean;
  [index: number]: { transcript: string };
};

type Recognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onresult: ((event: { results: ArrayLike<RecognitionResult> }) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type RecognitionConstructor = new () => Recognition;
let activeRecognition: Recognition | null = null;

function getRecognitionConstructor() {
  if (typeof window === "undefined") return null;
  const speechWindow = window as typeof window & {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition || null;
}

export default function SpeechInputButton({
  value,
  onChange,
  label = "Dictate",
}: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
}) {
  const recognitionRef = useRef<Recognition | null>(null);
  const baseValueRef = useRef("");
  const [supported, setSupported] = useState<boolean | null>(null);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setSupported(Boolean(getRecognitionConstructor()));
    return () => {
      recognitionRef.current?.abort();
      if (activeRecognition === recognitionRef.current) activeRecognition = null;
    };
  }, []);

  function start() {
    const RecognitionApi = getRecognitionConstructor();
    if (!RecognitionApi) {
      setSupported(false);
      return;
    }
    activeRecognition?.abort();
    const recognition = new RecognitionApi();
    activeRecognition = recognition;
    recognitionRef.current = recognition;
    baseValueRef.current = value.trimEnd();
    setError("");
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = navigator.language || "en-US";
    recognition.onstart = () => setListening(true);
    recognition.onend = () => {
      setListening(false);
      if (activeRecognition === recognition) activeRecognition = null;
    };
    recognition.onerror = (event) => {
      setError(
        event.error === "not-allowed" || event.error === "service-not-allowed"
          ? "Microphone permission was denied."
          : event.error === "no-speech"
            ? "No speech was detected."
            : "Speech recognition stopped. Please try again.",
      );
      setListening(false);
    };
    recognition.onresult = (event) => {
      let transcript = "";
      for (let index = 0; index < event.results.length; index += 1)
        transcript += event.results[index][0]?.transcript || "";
      const spoken = transcript.trim();
      const base = baseValueRef.current;
      onChange(base && spoken ? `${base}\n${spoken}` : spoken || base);
    };
    try {
      recognition.start();
    } catch {
      setError("The microphone could not start. Please try again.");
    }
  }

  if (supported === false)
    return (
      <span className={styles.wrap}>
        <button className={styles.button} type="button" disabled>
          🎙 Dictation unavailable
        </button>
        <span className={styles.status}>Use Chrome, Edge, or Safari.</span>
      </span>
    );

  return (
    <span className={styles.wrap}>
      <button
        className={`${styles.button} ${listening ? styles.listening : ""}`}
        type="button"
        onClick={listening ? () => recognitionRef.current?.stop() : start}
        disabled={supported === null}
        aria-pressed={listening}
      >
        {listening ? "■ Stop listening" : `🎙 ${label}`}
      </button>
      {listening && <span className={styles.status}>Listening…</span>}
      {error && <span className={styles.error}>{error}</span>}
    </span>
  );
}
