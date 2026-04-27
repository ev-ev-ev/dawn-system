import { nodeResolve } from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";

/** @type {import("rollup").RollupOptions} */
export default {
  input: "src/dawn-system.ts",
  output: {
    file: "dist/dawn-system.mjs",
    format: "es",
    sourcemap: true,
  },
  plugins: [
    nodeResolve(),
    typescript({ tsconfig: "./tsconfig.build.json" }),
  ],
};
