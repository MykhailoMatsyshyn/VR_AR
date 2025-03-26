// vite.config.js
import basicSsl from "@vitejs/plugin-basic-ssl";

export default {
  plugins: [
    basicSsl({
      /** name of certification */
      name: "test",
      /** custom trust domains */
      domains: ["*.custom.com"],
      /** custom certification directory */
      certDir: "/Users/.../.devServer/cert",
    }),
  ],
  build: {
    outDir: "dist",
    rollupOptions: {
      input: {
        task1: resolve(__dirname, "src/task1.html"),
        task2: resolve(__dirname, "src/task2.html"),
        task3: resolve(__dirname, "src/task3.html"),
        task4: resolve(__dirname, "src/task4.html"),
      },
    },
  },
};
