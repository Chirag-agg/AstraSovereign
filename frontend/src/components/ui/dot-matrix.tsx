"use client";

import * as React from "react";

/**
 * Dot-matrix field.
 *
 * The reference implementation pulled three.js off a CDN at runtime to draw
 * one full-screen quad. This product cannot reach a CDN and should not ship
 * 600 KB of scene graph for a single shader, so the same effect is written
 * directly against WebGL2: one quad, one program, no dependency.
 *
 * The shader is the reference's, retimed and recoloured onto the system
 * palette — the grid resolves outward from the centre on load, then keeps
 * flickering like a panel of indicator lamps.
 *
 * Nothing here is load-bearing: if the context cannot be created the canvas
 * stays empty and the page is unchanged.
 */

const VERT = `#version 300 es
precision mediump float;
in vec2 a_position;
uniform vec2 u_resolution;
out vec2 v_frag;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  v_frag = (a_position + 1.0) * 0.5 * u_resolution;
  v_frag.y = u_resolution.y - v_frag.y;
}`;

const FRAG = `#version 300 es
precision mediump float;
in vec2 v_frag;

uniform float u_time;
uniform vec2 u_resolution;
uniform float u_total_size;
uniform float u_dot_size;
uniform vec3 u_base;
uniform vec3 u_accent;

out vec4 fragColor;

float PHI = 1.61803398874989484820459;

float random(vec2 xy) {
  return fract(tan(distance(xy * PHI, xy) * 0.5) * xy.x);
}

void main() {
  vec2 st = v_frag;
  st.x -= abs(floor((mod(u_resolution.x, u_total_size) - u_dot_size) * 0.5));
  st.y -= abs(floor((mod(u_resolution.y, u_total_size) - u_dot_size) * 0.5));

  float opacity = step(0.0, st.x) * step(0.0, st.y);

  vec2 cell = vec2(floor(st.x / u_total_size), floor(st.y / u_total_size));

  float frequency = 5.0;
  float show_offset = random(cell);
  float rand = random(cell * floor((u_time / frequency) + show_offset + frequency));

  // Most lamps sit dim; a few carry full weight. Same distribution as the
  // reference, tightened so the field reads as texture rather than noise.
  float opacities[10];
  opacities[0] = 0.06; opacities[1] = 0.08; opacities[2] = 0.10;
  opacities[3] = 0.14; opacities[4] = 0.18; opacities[5] = 0.24;
  opacities[6] = 0.32; opacities[7] = 0.44; opacities[8] = 0.62; opacities[9] = 0.92;
  opacity *= opacities[int(rand * 10.0)];

  opacity *= 1.0 - step(u_dot_size / u_total_size, fract(st.x / u_total_size));
  opacity *= 1.0 - step(u_dot_size / u_total_size, fract(st.y / u_total_size));

  // One lamp in nine burns accent; the rest are bone. Two colours, as the
  // rest of the system.
  vec3 color = show_offset > 0.89 ? u_accent : u_base;

  float animation_speed_factor = 2.2;
  vec2 center_grid = u_resolution / 2.0 / u_total_size;
  float dist_from_center = distance(center_grid, cell);
  float timing = dist_from_center * 0.012 + (random(cell) * 0.16);

  opacity *= step(timing, u_time * animation_speed_factor);
  opacity *= clamp((1.0 - step(timing + 0.1, u_time * animation_speed_factor)) * 1.4, 1.0, 1.4);

  fragColor = vec4(color, opacity);
  fragColor.rgb *= fragColor.a;
}`;

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export interface DotMatrixProps {
  className?: string;
  style?: React.CSSProperties;
  /** Grid pitch in device pixels. */
  pitch?: number;
  /** Lamp size in device pixels. */
  dot?: number;
}

export function DotMatrix({ className, style, pitch = 22, dot = 6 }: DotMatrixProps) {
  const ref = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl2", { alpha: true, antialias: false, premultipliedAlpha: true });
    if (!gl) return;

    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const uTime = gl.getUniformLocation(program, "u_time");
    const uRes = gl.getUniformLocation(program, "u_resolution");
    gl.uniform1f(gl.getUniformLocation(program, "u_total_size"), pitch);
    gl.uniform1f(gl.getUniformLocation(program, "u_dot_size"), dot);
    gl.uniform3f(gl.getUniformLocation(program, "u_base"), 0.93, 0.93, 0.93);
    gl.uniform3f(gl.getUniformLocation(program, "u_accent"), 0.93, 0.38, 0.09);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    // Returns false while the canvas has no box to draw into.
    //
    // This guard is the whole fix for "the field only appears once I open
    // DevTools". Every workbench section is mounted at once behind
    // display:none, and a hidden element reports clientWidth/Height of 0, so
    // the first run here used to allocate a 0x0 drawing buffer and call
    // glViewport(0,0,0,0). On a real GPU that leaves the context in a state it
    // does not recover from on its own — it needs a genuine resize, which is
    // exactly what opening DevTools provides. Software rendering shrugs it
    // off, which is why it never showed up in a headless check.
    //
    // So: never allocate an empty buffer, and never draw into one.
    const resize = (): boolean => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.floor(canvas.clientWidth * dpr);
      const h = Math.floor(canvas.clientHeight * dpr);
      if (w === 0 || h === 0) return false;
      if (canvas.width === w && canvas.height === h) return true;
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
      gl.uniform2f(uRes, w, h);
      return true;
    };

    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const start = performance.now();
    let raf = 0;
    let visible = true;

    const draw = () => {
      if (!resize()) return;
      gl.uniform1f(uTime, (performance.now() - start) / 1000);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    if (reduced) {
      // One settled frame, no loop — but only once there is something to draw
      // into. A hidden section would otherwise get its single frame while it
      // has no box and then never draw again.
      const settle = () => {
        gl.uniform1f(uTime, 999);
        if (!resize()) {
          raf = requestAnimationFrame(settle);
          return;
        }
        draw();
      };
      raf = requestAnimationFrame(settle);
    } else {
      const loop = () => {
        if (!visible) return;
        draw();
        raf = requestAnimationFrame(loop);
      };
      // Start on the next frame rather than synchronously inside the effect,
      // so the first draw lands after the browser has laid the canvas out.
      raf = requestAnimationFrame(loop);
    }

    // A section that unhides, a sidebar that collapses, a panel that resizes:
    // none of these fire a window resize, so the canvas would keep its old
    // buffer. ResizeObserver catches the ones window.onresize misses.
    const ro =
      typeof ResizeObserver === "function"
        ? new ResizeObserver(() => {
            if (!visible || reduced) {
              // Reduced motion still wants one correct frame at the new size.
              if (reduced && resize()) draw();
              return;
            }
            resize();
          })
        : null;
    ro?.observe(canvas);

    const onVisibility = () => {
      visible = !document.hidden;
      if (visible && !reduced) {
        raf = requestAnimationFrame(function frame() {
          if (!visible) return;
          draw();
          raf = requestAnimationFrame(frame);
        });
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      visible = false;
      cancelAnimationFrame(raf);
      ro?.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.deleteBuffer(buffer);
    };
  }, [pitch, dot]);

  return <canvas ref={ref} className={className} style={{ display: "block", width: "100%", height: "100%", ...style }} aria-hidden="true" />;
}

export default DotMatrix;
