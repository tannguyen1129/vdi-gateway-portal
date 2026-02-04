import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false, // Giữ nguyên false
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://umt_backend:3000/:path*',
      },
      {
        source: '/guaclite', 
        destination: 'http://umt_backend:3000/guaclite', 
      },
    ];
  },
};

export default nextConfig;