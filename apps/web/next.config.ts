import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@geo-command/ui', '@geo-command/types'],
}

export default nextConfig
