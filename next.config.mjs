/** @type {import('next').NextConfig} */
// The same build serves two homes, and the only difference is the prefix.
//
// GitHub Pages hosts it under /GAILEYS/, so the Pages workflow sets
// NEXT_PUBLIC_BASE_PATH=/GAILEYS. The Android app loads the same files from
// inside the apk with nothing in front of them, so it leaves the variable
// unset. Development is unset too, which is why the dev server is now plain
// http://localhost:3000 rather than /GAILEYS.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

const nextConfig = {
  output: 'export',
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
