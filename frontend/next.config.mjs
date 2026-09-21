/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  turbopack: {},
  // Next 16 writes its own AGENTS.md / CLAUDE.md into the app directory on
  // dev start. This repo already has an AGENTS.md at the root and does not
  // want a generated one shadowing it.
  agentRules: false,
};

// Next.js collects anonymous build telemetry by default. A product whose whole
// claim is zero egress cannot ship a build step that phones home, so this is
// switched off in the repo rather than left to whoever runs the build.
process.env.NEXT_TELEMETRY_DISABLED = "1";

export default nextConfig;
