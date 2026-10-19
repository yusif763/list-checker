/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ["unpdf"],
  },
  webpack: (config, { isServer }) => {
    config.resolve.alias.canvas = false;
    if (isServer) {
      // unpdf-i serverdə node_modules-dən yüklə (bundle etmə) ki, daxili
      // pdfjs serverless build-i worker axtarmasın.
      const externals = config.externals || [];
      config.externals = Array.isArray(externals)
        ? [...externals, "unpdf"]
        : [externals, "unpdf"];
    }
    return config;
  },
};

export default nextConfig;
