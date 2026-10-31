/** @type {import('next').NextConfig} */
const nextConfig = {
  // NEXT_DIST_DIR: compilar en otra carpeta sin pisar la del servidor de desarrollo
  distDir: process.env.NEXT_DIST_DIR || '.next',
}

module.exports = nextConfig
