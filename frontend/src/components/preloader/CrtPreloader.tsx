"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import styles from "./crt.module.css";

const BOOT_LINES = [
  "ASTRA SOVEREIGN // AIR-GAPPED BOOT SEQUENCE v0.10.0",
  "[ok] kernel: air-gapped sovereign runtime initialized",
  "[ok] network guard: OUTBOUND BLOCKED (strict sovereignty enforced)",
  "[ok] audit store: tamper-evident cryptographic ledger mounted",
  "[ok] model registry: local weight checkpoints verified",
  "[ok] capability router: on-prem inference engines online",
  "[ok] job store & worker pool: 8 execution threads ready",
  "[ok] task router & pipeline orchestrator: synchronized",
  "[ok] tool registry: deterministic local toolset registered",
  "[ok] sandbox runner: isolated container sandbox active",
  "[ok] vector store & embeddings: local indices verified",
  "[ok] knowledge base: local documents ready for RAG",
  "[ok] document ingestion & OCR pipeline: standby",
  "[ok] vision provider & multimodal gateway: primed",
  "[ok] artifact store: sovereign workspace volume mounted",
  "[ok] resource scheduler & memory governor: nominal",
  "[ok] data cleanup: ephemeral scratch purge verified",
  "[ok] sovereignty check: zero external telemetry verified",
  "SYSTEM STATUS: ALL LOCAL CORES ARMED AND NOMINAL",
];

export function CrtPreloader({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [displayedLines, setDisplayedLines] = useState<string[]>([]);
  const [currentLineText, setCurrentLineText] = useState("");
  const [isTypingComplete, setIsTypingComplete] = useState(false);
  const [isDismissing, setIsDismissing] = useState(false);
  const [isUnmounted, setIsUnmounted] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameIdRef = useRef<number | null>(null);

  // Client mount check to avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Dismiss / Fast-forward handler
  const handleDismiss = useCallback(() => {
    if (isDismissing || isUnmounted) return;
    if (!isTypingComplete) {
      // First click/key during typing fast-forwards to complete immediately
      setDisplayedLines(BOOT_LINES);
      setCurrentLineText("");
      setIsTypingComplete(true);
      return;
    }
    setIsDismissing(true);
    setTimeout(() => {
      setIsUnmounted(true);
    }, 500);
  }, [isTypingComplete, isDismissing, isUnmounted]);

  // Typing animation / prefers-reduced-motion check
  useEffect(() => {
    if (!mounted || isUnmounted) return;

    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion) {
      setDisplayedLines(BOOT_LINES);
      setCurrentLineText("");
      setIsTypingComplete(true);
      return;
    }

    let currentLineIdx = 0;
    let currentCharIdx = 0;
    let timeoutId: NodeJS.Timeout | null = null;
    let isCancelled = false;

    const typeNextChar = () => {
      if (isCancelled) return;

      if (currentLineIdx >= BOOT_LINES.length) {
        setIsTypingComplete(true);
        return;
      }

      const line = BOOT_LINES[currentLineIdx];

      if (currentCharIdx < line.length) {
        currentCharIdx++;
        setCurrentLineText(line.slice(0, currentCharIdx));
        timeoutId = setTimeout(typeNextChar, 10);
      } else {
        setDisplayedLines((prev) => [...prev, line]);
        setCurrentLineText("");
        currentLineIdx++;
        currentCharIdx = 0;
        timeoutId = setTimeout(typeNextChar, 25);
      }
    };

    timeoutId = setTimeout(typeNextChar, 40);

    return () => {
      isCancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [mounted, isUnmounted]);

  // Keyboard dismissal listener
  useEffect(() => {
    if (isDismissing || isUnmounted) return;

    const onKeyDown = () => {
      handleDismiss();
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isDismissing, isUnmounted, handleDismiss]);

  // Canvas scanline, curvature, and subtle noise loop
  useEffect(() => {
    if (!mounted || isUnmounted) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener("resize", handleResize);

    const noiseSize = 128;
    const noiseCanvas = document.createElement("canvas");
    noiseCanvas.width = noiseSize;
    noiseCanvas.height = noiseSize;
    const noiseCtx = noiseCanvas.getContext("2d");

    const renderNoiseTile = () => {
      if (!noiseCtx) return;
      const imgData = noiseCtx.createImageData(noiseSize, noiseSize);
      const buffer = new Uint32Array(imgData.data.buffer);
      for (let i = 0; i < buffer.length; i++) {
        if (Math.random() < 0.08) {
          buffer[i] = 0x0833ff66;
        } else {
          buffer[i] = 0x00000000;
        }
      }
      noiseCtx.putImageData(imgData, 0, 0);
    };

    let frameCount = 0;

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // 1. Draw horizontal scanlines every 3px
      ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
      for (let y = 0; y < height; y += 3) {
        ctx.fillRect(0, y, width, 1.5);
      }

      // 2. Refresh & tile subtle noise every 3 frames
      frameCount++;
      if (frameCount % 3 === 0) {
        renderNoiseTile();
      }
      if (noiseCtx) {
        const pattern = ctx.createPattern(noiseCanvas, "repeat");
        if (pattern) {
          ctx.fillStyle = pattern;
          ctx.fillRect(0, 0, width, height);
        }
      }

      // 3. Radial CRT curvature vignette
      const gradient = ctx.createRadialGradient(
        width / 2,
        height / 2,
        Math.min(width, height) * 0.45,
        width / 2,
        height / 2,
        Math.max(width, height) * 0.75
      );
      gradient.addColorStop(0, "rgba(5, 19, 10, 0)");
      gradient.addColorStop(0.7, "rgba(2, 8, 4, 0.4)");
      gradient.addColorStop(1, "rgba(0, 0, 0, 0.85)");

      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      animFrameIdRef.current = requestAnimationFrame(render);
    };

    animFrameIdRef.current = requestAnimationFrame(render);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
    };
  }, [mounted, isUnmounted]);

  return (
    <>
      {children}
      {mounted && !isUnmounted && (
        <div
          className={`${styles.overlay} ${
            isTypingComplete ? styles.overlayReady : ""
          } ${isDismissing ? styles.overlayDismissed : ""}`}
          onClick={handleDismiss}
          role="dialog"
          aria-modal="true"
          aria-label="System Boot Sequence"
        >
          <canvas ref={canvasRef} className={styles.canvas} />
          <div className={styles.crtVignette} />

          <div className={styles.terminalContent}>
            {displayedLines.map((line, idx) => (
              <div
                key={idx}
                className={idx === 0 ? styles.titleLine : styles.logLine}
              >
                {line}
              </div>
            ))}

            {!isTypingComplete && (
              <div className={displayedLines.length === 0 ? styles.titleLine : styles.logLine}>
                {currentLineText}
                <span className={styles.cursor} />
              </div>
            )}

            {isTypingComplete && (
              <div className={styles.actionPrompt}>
                {"> press any key or click to continue"}
                <span className={styles.cursor} />
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
