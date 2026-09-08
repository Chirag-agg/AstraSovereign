/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    // The client-side document exporter helpers guard these behind node detection;
    // stub the node: scheme so webpack does not try to bundle them for the browser.
    config.resolve.fallback = {
      ...(config.resolve.fallback ?? {}),
      fs: false,
      https: false,
      os: false,
      path: false,
      "node:fs": false,
      "node:https": false,
      "node:os": false,
      "node:path": false,
      "image-size": false,
      bufferutil: false,
      "utf-8-validate": false,
    };
    return config;
  },
};

export default nextConfig;
