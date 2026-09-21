/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/huong-dan',
        destination: '/guide',
      },
    ];
  },
};

export default nextConfig;
