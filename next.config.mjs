import path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // onnxruntime-web v1.24's default ESM entry (ort.bundle.min.mjs) uses
  // `import.meta` which Next.js 14's Terser cannot parse.  The CJS/UMD
  // build (ort.min.js) works fine — zero import.meta occurrences — but
  // webpack 5's `exports` map resolution takes priority over resolve.alias.
  //
  // Fix: use an absolute-path alias to force webpack to bypass the exports
  // map entirely and load the Terser-safe CJS build.
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Absolute path bypasses package.json "exports" field resolution
      const ortCjsPath = path.resolve(
        __dirname,
        "node_modules/onnxruntime-web/dist/ort.min.js"
      );

      config.resolve.alias = {
        ...config.resolve.alias,
        "onnxruntime-web": ortCjsPath,
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

      // Suppress "Critical dependency" warning from onnxruntime-web's
      // CJS bundle which uses dynamic require() — this is expected
      // behavior for the ONNX runtime and not a real issue.
      config.module.exprContextCritical = false;
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

  // Next.js 14 uses "experimental.serverComponentsExternalPackages"
  // (renamed to serverExternalPackages in v15)
  experimental: {
    serverComponentsExternalPackages: ["onnxruntime-node", "onnxruntime-web"],
  },
};

export default nextConfig;
