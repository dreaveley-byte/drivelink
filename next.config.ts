import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "drivelink-rouge.vercel.app" }],
        destination: "https://drivflo.ca/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
