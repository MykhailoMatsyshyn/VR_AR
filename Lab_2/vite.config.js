import basicSsl from "@vitejs/plugin-basic-ssl";
import { resolve } from "path";

export default {
  plugins: [
    basicSsl({
      name: "test",
      domains: ["*.custom.com"],
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
