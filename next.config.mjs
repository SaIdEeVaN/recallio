export default {
  outputFileTracingIncludes: {
    "/api/study": [
      "./lib/pdf-worker.mjs",
      "./node_modules/pdfjs-dist/legacy/build/pdf*.mjs",
      "./node_modules/pdfjs-dist/package.json",
      "./node_modules/pdfjs-dist/standard_fonts/**",
      "./node_modules/pdfjs-dist/cmaps/**",
      "./node_modules/@napi-rs/canvas*/**",
    ],
  },
  allowedDevOrigins: ["127.0.0.1"],
  reactStrictMode: true,
  poweredByHeader: false,
  serverExternalPackages: ["pdfjs-dist", "@napi-rs/canvas"],
  experimental: { cpus: 2 },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};
