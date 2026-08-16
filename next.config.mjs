/** @type {import('next').NextConfig} */
// Static export served from GitHub Pages at /GAILEYS/ - the app is fully
// client-side (device storage), so no server is needed anywhere.
const nextConfig = {
  output: 'export',
  basePath: '/GAILEYS',
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
