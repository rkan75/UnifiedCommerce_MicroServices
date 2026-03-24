const checkEnvVariables = require("./check-env-variables")

checkEnvVariables()

/**
 * Medusa Cloud-related environment variables
 */
const S3_HOSTNAME = process.env.MEDUSA_CLOUD_S3_HOSTNAME
const S3_PATHNAME = process.env.MEDUSA_CLOUD_S3_PATHNAME

/**
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  // Use this directory as Turbopack root so the storefront lockfile is used (avoids multiple-lockfile warning)
  turbopack: {
    root: __dirname,
  },
  // Cloud Run decodes URL paths (https://cloud.google.com/run/docs/known-issues#url-decode).
  // Next.js 15 encodes @ in parallel route chunks as %40; decoded @ causes 404.
  // Rewrite decoded @ back to %40 so static chunks load correctly.
  async rewrites() {
    const parallelSlots = ["dashboard", "login"]
    return {
      beforeFiles: parallelSlots.map((slot) => ({
        source: `/_next/static/chunks/app/:path*/@${slot}/:rest*`,
        destination: `/_next/static/chunks/app/:path*/%40${slot}/:rest*`,
      })),
      afterFiles: [],
      fallback: [],
    }
  },
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    // Next.js 16 will require every `quality` used by <Image> to be listed here.
    qualities: [50, 75, 100],
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
      },
      {
        protocol: "https",
        hostname: "medusa-public-images.s3.eu-west-1.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "medusa-server-testing.s3.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "medusa-server-testing.s3.us-east-1.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "storage.googleapis.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "target.scene7.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "kroger.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "www.kroger.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "picsum.photos",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "m.media-amazon.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "www.wholefoodsmarket.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "www.gnc.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "gnc.com",
        pathname: "/**",
      },
      ...(S3_HOSTNAME && S3_PATHNAME
        ? [
            {
              protocol: "https",
              hostname: S3_HOSTNAME,
              pathname: S3_PATHNAME,
            },
          ]
        : []),
    ],
  },
}

module.exports = nextConfig
