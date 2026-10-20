import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets a production build run beside the dev server without sharing .next
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Programme metadata in public/metadata is read by server code (hash check), so ship it with the
  // server functions too; on Vercel, public/ is otherwise served only by the CDN.
  outputFileTracingIncludes: { "/**": ["./public/metadata/**/*"] },
};

export default nextConfig;
