// Import-free so the suite can run under a transient `npx vitest` as well as a
// normal local install. `defineConfig` is only a typing helper; a plain object
// is equally valid.
export default {
  test: {
    globals: true,
    environment: "node",
    include: ["test/**/*.test.ts"],
    coverage: {
      include: ["app/domain/**", "extensions/**/src/**"],
    },
  },
};
