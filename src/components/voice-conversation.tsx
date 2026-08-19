"use client";

import type { UIMessage } from "ai";
import { AudioLinesIcon, SquareIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type FC } from "react";

import { Button } from "@/components/ui/button";

type VoicePhase = "idle" | "listening" | "thinking" | "speaking" | "error";

type BrowserSpeechRecognitionResult = {
  isFinal: boolean;
  [index: number]: { transcript: string };
};

type BrowserSpeechRecognitionEvent = Event & {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: BrowserSpeechRecognitionResult;
  };
};

type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  start: () => void;
  abort: () => void;
};

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

type VoiceConversationProps = {
  messages: UIMessage[];
  status: string;
  onSend: (text: string) => Promise<void>;
};

const getSpeechRecognition = (): BrowserSpeechRecognitionConstructor | undefined => {
  if (typeof window === "undefined") return undefined;
  const browser = window as Window & typeof globalThis & {
    SpeechRecognition?: BrowserSpeechRecognitionConstructor;
    webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
  };
  return browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
};

const messageText = (message: UIMessage | undefined) => {
  if (!message || message.role !== "assistant") return "";
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join(" ")
    .trim();
};

const speechText = (text: string) => text
  .replace(/```[\s\S]*?```/g, " มีโค้ดประกอบอยู่ในข้อความ ")
  .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
  .replace(/[`*_>#]/g, " ")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, 3_000);

export const VoiceConversation: FC<VoiceConversationProps> = ({ messages, status, onSend }) => {
  const [phase, setPhase] = useState<VoicePhase>("idle");
  const [caption, setCaption] = useState("");
  const [hasResponseError, setHasResponseError] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const restartTimerRef = useRef<number | null>(null);
  const beginListeningRef = useRef<() => void>(() => undefined);
  const shouldContinueRef = useRef(false);
  const awaitingResponseRef = useRef(false);
  const sawResponseRunRef = useRef(false);
  const messagesRef = useRef(messages);
  const onSendRef = useRef(onSend);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    onSendRef.current = onSend;
  }, [onSend]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setIsSupported(
        typeof getSpeechRecognition() === "function" &&
        typeof window.speechSynthesis !== "undefined",
      );
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const clearRestart = useCallback(() => {
    if (restartTimerRef.current != null) {
      window.clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
  }, []);

  const beginListening = useCallback(() => {
    const SpeechRecognition = getSpeechRecognition();
    if (!shouldContinueRef.current || awaitingResponseRef.current || !SpeechRecognition) return;

    clearRestart();
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = "th-TH";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.onstart = () => {
      if (!shouldContinueRef.current) return;
      setCaption("");
      setPhase("listening");
    };
    recognition.onresult = (event) => {
      let finalText = "";
      let interimText = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const text = result[0]?.transcript?.trim() ?? "";
        if (result.isFinal) finalText += `${text} `;
        else interimText += `${text} `;
      }
      const transcript = finalText.trim();
      setCaption((transcript || interimText).trim());
      if (!transcript || awaitingResponseRef.current) return;

      awaitingResponseRef.current = true;
      setPhase("thinking");
      recognition.abort();
      void onSendRef.current(transcript).catch(() => {
        awaitingResponseRef.current = false;
        shouldContinueRef.current = false;
        setHasResponseError(true);
        setPhase("error");
        setCaption("ส่งข้อความด้วยเสียงไม่สำเร็จ");
      });
    };
    recognition.onerror = (event) => {
      if (!shouldContinueRef.current || event.error === "aborted") return;
      if (event.error === "no-speech") return;
      shouldContinueRef.current = false;
      setPhase("error");
      setCaption(event.error === "not-allowed" || event.error === "service-not-allowed"
        ? "กรุณาอนุญาตการใช้ไมโครโฟน"
        : "ไม่สามารถรับเสียงได้ ลองใหม่อีกครั้ง");
    };
    recognition.onend = () => {
      if (!shouldContinueRef.current || awaitingResponseRef.current) return;
      restartTimerRef.current = window.setTimeout(() => beginListeningRef.current(), 350);
    };
    try {
      recognition.start();
    } catch {
      restartTimerRef.current = window.setTimeout(() => beginListeningRef.current(), 350);
    }
  }, [clearRestart]);

  useEffect(() => {
    beginListeningRef.current = beginListening;
  }, [beginListening]);

  const speakAnswer = useCallback((text: string) => {
    const spoken = speechText(text);
    if (!spoken || !shouldContinueRef.current || typeof window.speechSynthesis === "undefined") {
      beginListening();
      return;
    }

    window.speechSynthesis.cancel();
    setCaption("");
    setPhase("speaking");
    const utterance = new SpeechSynthesisUtterance(spoken);
    utterance.lang = /[\u0E00-\u0E7F]/.test(spoken) ? "th-TH" : "en-US";
    utterance.rate = 0.96;
    utterance.onend = () => {
      if (shouldContinueRef.current) beginListening();
    };
    utterance.onerror = () => {
      if (shouldContinueRef.current) beginListening();
    };
    window.speechSynthesis.speak(utterance);
  }, [beginListening]);

  useEffect(() => {
    if (!shouldContinueRef.current || !awaitingResponseRef.current) return;
    if (status === "submitted" || status === "streaming") {
      sawResponseRunRef.current = true;
      return;
    }
    if (status === "error") {
      awaitingResponseRef.current = false;
      shouldContinueRef.current = false;
      window.setTimeout(() => setHasResponseError(true), 0);
      return;
    }
    if (status !== "ready" || !sawResponseRunRef.current) return;

    awaitingResponseRef.current = false;
    sawResponseRunRef.current = false;
    const latestAssistantMessage = [...messagesRef.current].reverse().find((message) => message.role === "assistant");
    const answer = messageText(latestAssistantMessage);
    window.setTimeout(() => {
      if (!shouldContinueRef.current) return;
      if (answer) speakAnswer(answer);
      else beginListening();
    }, 0);
  }, [beginListening, speakAnswer, status]);

  const stopVoice = useCallback(() => {
    shouldContinueRef.current = false;
    awaitingResponseRef.current = false;
    sawResponseRunRef.current = false;
    setHasResponseError(false);
    clearRestart();
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    window.speechSynthesis?.cancel();
    setCaption("");
    setPhase("idle");
  }, [clearRestart]);

  const startVoice = useCallback(() => {
    if (!isSupported || !getSpeechRecognition() || typeof window.speechSynthesis === "undefined") {
      setPhase("error");
      setCaption("เบราว์เซอร์นี้ยังไม่รองรับโหมดเสียง");
      return;
    }
    shouldContinueRef.current = true;
    awaitingResponseRef.current = false;
    sawResponseRunRef.current = false;
    setHasResponseError(false);
    window.speechSynthesis.cancel();
    beginListening();
  }, [beginListening, isSupported]);

  useEffect(() => stopVoice, [stopVoice]);

  const visiblePhase = hasResponseError ? "error" : phase;
  const isActive = !hasResponseError && (phase === "listening" || phase === "thinking" || phase === "speaking");
  const statusLabel = visiblePhase === "listening"
    ? caption ? `ได้ยิน: ${caption}` : "กำลังฟัง พูดได้เลย"
    : visiblePhase === "thinking"
      ? "กำลังคิดคำตอบ"
      : visiblePhase === "speaking"
        ? "กำลังอ่านคำตอบ"
        : visiblePhase === "error" ? "ยังตอบคำถามไม่สำเร็จ" : caption;

  return (
    <div className="relative flex shrink-0 items-center">
      {phase !== "idle" ? (
        <div role="status" aria-live="polite" className="absolute bottom-full right-0 z-20 mb-2 w-max max-w-64 rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
          <span className="flex items-center gap-2">
            <span className="size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
            <span className="truncate">{statusLabel}</span>
          </span>
        </div>
      ) : null}
      <Button
        type="button"
        variant={isActive ? "secondary" : "ghost"}
        size="icon"
        className="size-9 rounded-full text-muted-foreground hover:bg-muted"
        onClick={isActive ? stopVoice : startVoice}
        disabled={!isSupported}
        aria-label={isActive ? "หยุดโหมดสนทนาด้วยเสียง" : "เริ่มคุยด้วยเสียง"}
        aria-pressed={isActive}
        title={isSupported ? (isActive ? "หยุดโหมดสนทนาด้วยเสียง" : "คุยด้วยเสียง") : "เบราว์เซอร์นี้ยังไม่รองรับโหมดเสียง"}
      >
        {isActive ? <SquareIcon className="size-3.5 fill-current" /> : <AudioLinesIcon className="size-4" />}
      </Button>
    </div>
  );
};
