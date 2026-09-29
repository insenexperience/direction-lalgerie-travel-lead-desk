import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@react-pdf/renderer",
    "@react-pdf/font",
    "@react-pdf/pdfkit",
    "@react-pdf/png-js",
  ],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.squarespace-cdn.com",
        pathname: "/content/**",
      },
    ],
  },
  // Outil de relecture du site www (projet Vercel séparé, basePath /relecture).
  async rewrites() {
    return [
      { source: "/relecture", destination: "https://da-relecture.vercel.app/relecture" },
      { source: "/relecture/:chemin*", destination: "https://da-relecture.vercel.app/relecture/:chemin*" },
    ];
  },
};

export default nextConfig;
