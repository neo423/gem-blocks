import { createServer } from "vite";

const hostArg = process.argv.includes("--mobile") ? "0.0.0.0" : "127.0.0.1";

const server = await createServer({
  server: {
    host: hostArg,
    port: 5173,
    strictPort: false
  }
});

await server.listen();
server.printUrls();

setInterval(() => {
  // Keep the process alive when launched without an attached terminal.
}, 60_000);
