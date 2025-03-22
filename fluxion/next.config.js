const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
  eslint: {
    ignoreDuringBuilds: true,
},
})
module.exports = withBundleAnalyzer({})