/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      {
        source: '/',
        destination: '/estimate',
        permanent: false,
      },
    ];
  },
}

module.exports = nextConfig
