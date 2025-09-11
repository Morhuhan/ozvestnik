import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  // ⚠️ разрешить сборку даже при ошибках типов
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
