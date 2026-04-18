/** @type {import('next').NextConfig} */
const nextConfig = {
  // onnxruntime-web ships a Node.js binding file (ort.node.min.mjs) that uses
  // `import.meta.url` + `createRequire` — constructs Terser cannot parse in
  // the browser bundle.  We only need the WASM backend, so we tell webpack to
  // completely ignore the Node-specific files.
  webpack: (config, { isServer, webpack }) => {
    // Ignore the Node.js-specific ONNX Runtime binding that breaks Terser
    config.plugins.push(
      new webpack.IgnorePlugin({
        resourceRegExp: /ort\.node\.min\.mjs$/,
      })
    );

    if (!isServer) {
      // Alias onnxruntime-node to empty module (not installed, but may be
      // referenced as optional peer dependency)
      config.resolve.alias = {
        ...config.resolve.alias,
        "onnxruntime-node": false,
      };

      // Ignore .node native addon files
      config.module.rules.push({
        test: /\.node$/,
        type: "asset/resource",
        generator: { emit: false },
      });

      // Fallback for Node-only builtins referenced by onnxruntime
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };
    }

    return config;
  },

  // Tell Next.js the ONNX Node binding is server-only
  serverExternalPackages: ["onnxruntime-node"],
};

export default nextConfig;
