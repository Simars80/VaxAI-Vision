/** @type {import('next').NextConfig} */
const nextConfig = {
  // onnxruntime-web's default entry (ort.bundle.min.mjs) contains constructs
  // that Next.js 14's Terser/SWC minifier cannot parse — specifically
  // `import.meta.url` + `createRequire` in the Node.js fallback path.
  //
  // Fix: we resolve onnxruntime-web to its browser-specific entry point
  // (dist/ort.min.js) which is plain UMD/CJS and Terser-safe.  The WASM
  // files are loaded at runtime from the CDN path set in inference.ts.
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Point onnxruntime-web to the browser UMD build instead of the
      // ESM bundle that contains Node.js-only constructs
      config.resolve.alias = {
        ...config.resolve.alias,
        "onnxruntime-web": "onnxruntime-web/dist/ort.min.js",
        "onnxruntime-node": false,
      };

      // Ignore .node native addon files
      config.module.rules.push({
        test: /\.node$/,
        type: "asset/resource",
        generator: { emit: false },
      });

      // Fallback for Node-only builtins that onnxruntime may reference
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };
    }

    if (isServer) {
      // On the server side, don't try to bundle onnxruntime at all
      config.externals = config.externals || [];
      if (Array.isArray(config.externals)) {
        config.externals.push("onnxruntime-web", "onnxruntime-node");
      }
    }

    return config;
  },

  serverExternalPackages: ["onnxruntime-node", "onnxruntime-web"],
};

export default nextConfig;
