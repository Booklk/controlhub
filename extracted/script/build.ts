import * as esbuild from "esbuild";
import * as path from "path";
import { execSync } from "child_process";

const ignoreVitePlugin: esbuild.Plugin = {
  name: 'ignore-vite',
  setup(build) {
    build.onResolve({ filter: /\.\/vite$/ }, () => ({
      path: 'vite-stub',
      namespace: 'vite-stub',
    }));
    build.onLoad({ filter: /.*/, namespace: 'vite-stub' }, () => ({
      contents: 'module.exports = {};',
      loader: 'js',
    }));

    build.onResolve({ filter: /^\.\.\/vite\.config/ }, () => ({
      path: 'vite-config-stub',
      namespace: 'vite-config-stub',
    }));
    build.onLoad({ filter: /.*/, namespace: 'vite-config-stub' }, () => ({
      contents: 'module.exports = {};',
      loader: 'js',
    }));
  },
};

async function build() {
  console.log("Building client...");
  execSync("npx vite build", { stdio: "inherit", cwd: path.resolve(import.meta.dirname, "..") });

  console.log("Building server...");
  await esbuild.build({
    entryPoints: [path.resolve(import.meta.dirname, "../server/index.ts")],
    outfile: path.resolve(import.meta.dirname, "../dist/index.cjs"),
    bundle: true,
    platform: "node",
    target: "node20",
    format: "cjs",
    sourcemap: false,
    packages: "external",
    plugins: [ignoreVitePlugin],
    alias: {
      "@shared": path.resolve(import.meta.dirname, "../shared"),
    },
    define: {
      "import.meta.dirname": "__dirname",
    },
  });

  console.log("Build complete!");
}

build().catch(console.error);
