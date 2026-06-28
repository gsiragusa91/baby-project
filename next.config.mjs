/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Las fotos se comprimen en el browser antes de subir (~200-400KB), pero
    // subimos el límite del body de los Server Actions como red de seguridad.
    serverActions: {
      bodySizeLimit: "4mb"
    }
  }
};

export default nextConfig;
