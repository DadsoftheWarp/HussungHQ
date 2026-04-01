import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow images from Google user photos
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
};

export default nextConfig;
