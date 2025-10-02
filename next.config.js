/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      {
        source: '/credit-cards',
        destination: '/budgets',
        permanent: true, // 308
      },
    ];
  },
};

module.exports = nextConfig;
