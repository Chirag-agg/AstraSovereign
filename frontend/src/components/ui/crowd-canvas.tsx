"use client";

import { gsap } from "gsap";
import React, { useEffect, useRef } from "react";

/**
 * Crowd canvas.
 *
 * Skiper 39 / Canvas_Landing_004 by @gurvinder-singh02 (gxuri.me), itself an
 * inspired rebuild of https://codepen.io/zadvorsky/pen/xxwbBQV, illustrations
 * from openpeeps.com. Kept essentially as authored; the sprite sheet is
 * vendored into /public so an air-gapped build has no CDN dependency, and the
 * ticker is torn down on unmount and paused when the section is off-screen.
 *
 * It closes the page for a reason: the people walking along the bottom are who
 * this is actually for — the approvals clerk, the inspector, the desk officer.
 */

interface CrowdCanvasProps {
  src: string;
  rows?: number;
  cols?: number;
  className?: string;
}

const CrowdCanvas = ({ src, rows = 15, cols = 7, className }: CrowdCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const config = { src, rows, cols };

    const randomRange = (min: number, max: number) => min + Math.random() * (max - min);
    const randomIndex = (array: unknown[]) => randomRange(0, array.length) | 0;
    const removeFromArray = <T,>(array: T[], i: number) => array.splice(i, 1)[0];
    const removeItemFromArray = <T,>(array: T[], item: T) => removeFromArray(array, array.indexOf(item));
    const removeRandomFromArray = <T,>(array: T[]) => removeFromArray(array, randomIndex(array));
    const getRandomFromArray = <T,>(array: T[]) => array[randomIndex(array) | 0];

    type Peep = {
      image: HTMLImageElement;
      rect: number[];
      width: number;
      height: number;
      x: number;
      y: number;
      anchorY: number;
      scaleX: number;
      walk: gsap.core.Timeline | null;
      setRect: (rect: number[]) => void;
      render: (ctx: CanvasRenderingContext2D) => void;
    };

    const resetPeep = ({ stage, peep }: { stage: { width: number; height: number }; peep: Peep }) => {
      const direction = Math.random() > 0.5 ? 1 : -1;
      const offsetY = 100 - 250 * gsap.parseEase("power2.in")(Math.random());
      const startY = stage.height - peep.height + offsetY;
      let startX: number;
      let endX: number;

      if (direction === 1) {
        startX = -peep.width;
        endX = stage.width;
        peep.scaleX = 1;
      } else {
        startX = stage.width + peep.width;
        endX = 0;
        peep.scaleX = -1;
      }

      peep.x = startX;
      peep.y = startY;
      peep.anchorY = startY;

      return { startX, startY, endX };
    };

    const normalWalk = ({ peep, props }: { peep: Peep; props: { startX: number; startY: number; endX: number } }) => {
      const { startY, endX } = props;
      const xDuration = 10;
      const yDuration = 0.25;

      const tl = gsap.timeline();
      tl.timeScale(randomRange(0.5, 1.5));
      tl.to(peep, { duration: xDuration, x: endX, ease: "none" }, 0);
      tl.to(peep, { duration: yDuration, repeat: xDuration / yDuration, yoyo: true, y: startY - 10 }, 0);
      return tl;
    };

    const walks = [normalWalk];

    const createPeep = ({ image, rect }: { image: HTMLImageElement; rect: number[] }): Peep => {
      const peep: Peep = {
        image,
        rect: [],
        width: 0,
        height: 0,
        x: 0,
        y: 0,
        anchorY: 0,
        scaleX: 1,
        walk: null,
        setRect: (next: number[]) => {
          peep.rect = next;
          peep.width = next[2];
          peep.height = next[3];
        },
        render: (context: CanvasRenderingContext2D) => {
          context.save();
          context.translate(peep.x, peep.y);
          context.scale(peep.scaleX, 1);
          context.drawImage(
            peep.image,
            peep.rect[0],
            peep.rect[1],
            peep.rect[2],
            peep.rect[3],
            0,
            0,
            peep.width,
            peep.height,
          );
          context.restore();
        },
      };
      peep.setRect(rect);
      return peep;
    };

    const img = document.createElement("img");
    const stage = { width: 0, height: 0 };

    const allPeeps: Peep[] = [];
    const availablePeeps: Peep[] = [];
    const crowd: Peep[] = [];

    const createPeeps = () => {
      const { rows: r, cols: c } = config;
      const { naturalWidth: width, naturalHeight: height } = img;
      const total = r * c;
      const rectWidth = width / r;
      const rectHeight = height / c;

      for (let i = 0; i < total; i++) {
        allPeeps.push(
          createPeep({
            image: img,
            rect: [(i % r) * rectWidth, ((i / r) | 0) * rectHeight, rectWidth, rectHeight],
          }),
        );
      }
    };

    const addPeepToCrowd = () => {
      const peep = removeRandomFromArray(availablePeeps);
      const walk = getRandomFromArray(walks)({
        peep,
        props: resetPeep({ peep, stage }),
      }).eventCallback("onComplete", () => {
        removePeepFromCrowd(peep);
        addPeepToCrowd();
      });

      peep.walk = walk;
      crowd.push(peep);
      crowd.sort((a, b) => a.anchorY - b.anchorY);
      return peep;
    };

    const initCrowd = () => {
      while (availablePeeps.length) {
        addPeepToCrowd().walk?.progress(Math.random());
      }
    };

    const removePeepFromCrowd = (peep: Peep) => {
      removeItemFromArray(crowd, peep);
      availablePeeps.push(peep);
    };

    const render = () => {
      if (!canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.scale(devicePixelRatio, devicePixelRatio);
      crowd.forEach((peep) => peep.render(ctx));
      ctx.restore();
    };

    const resize = () => {
      if (!canvas) return;
      stage.width = canvas.clientWidth;
      stage.height = canvas.clientHeight;
      canvas.width = stage.width * devicePixelRatio;
      canvas.height = stage.height * devicePixelRatio;

      crowd.forEach((peep) => peep.walk?.kill());
      crowd.length = 0;
      availablePeeps.length = 0;
      availablePeeps.push(...allPeeps);
      initCrowd();
    };

    let ticking = false;
    const startTicker = () => {
      if (ticking) return;
      gsap.ticker.add(render);
      ticking = true;
    };
    const stopTicker = () => {
      if (!ticking) return;
      gsap.ticker.remove(render);
      ticking = false;
    };

    const init = () => {
      createPeeps();
      resize();
      startTicker();
    };

    img.onload = init;
    img.src = config.src;

    const handleResize = () => resize();
    window.addEventListener("resize", handleResize);

    // Stop burning frames when the section is scrolled away, and honour a
    // reduced-motion preference by rendering one static frame.
    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (reduced) {
          // Freeze this crowd only. This used to pause gsap.globalTimeline,
          // which stopped every GSAP animation on the site for anyone with
          // reduced motion on — including the preloader, which then could
          // never be dismissed.
          stopTicker();
          crowd.forEach((peep) => peep.walk?.pause());
          render();
          return;
        }
        if (entry.isIntersecting) startTicker();
        else stopTicker();
      },
      { threshold: 0 },
    );
    observer.observe(canvas);

    return () => {
      window.removeEventListener("resize", handleResize);
      observer.disconnect();
      stopTicker();
      crowd.forEach((peep) => peep.walk?.kill());
    };
  }, [src, rows, cols]);

  return <canvas ref={canvasRef} className={className ?? "absolute bottom-0 h-full w-full"} aria-hidden="true" />;
};

export { CrowdCanvas };
export default CrowdCanvas;
