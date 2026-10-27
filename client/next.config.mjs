/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  // API requests are intentionally resolved in the browser from
  // window.location.hostname (see src/lib/api-client.ts). A build-time rewrite
  // would hide the real client IP and break LAN guest fingerprinting.
};

export default nextConfig;
