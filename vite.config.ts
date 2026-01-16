import { defineConfig, type Plugin, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { SignJWT, importPKCS8 } from "jose";
import fs from "fs";

// Load HTTPS certs if they exist (for custom domain development)
const certKeyPath = "./cdata.embedded.demo-key.pem";
const certPath = "./cdata.embedded.demo.pem";
const httpsConfig =
  fs.existsSync(certKeyPath) && fs.existsSync(certPath)
    ? {
        key: fs.readFileSync(certKeyPath),
        cert: fs.readFileSync(certPath),
      }
    : undefined;

// Server-side JWT generation plugin for non-HTTPS environments
function jwtServerPlugin(): Plugin {
  // Load env vars at plugin creation time
  const env = loadEnv("development", process.cwd(), "VITE_");

  return {
    name: "jwt-server",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url === "/api/jwt" && req.method === "GET") {
          try {
            const accountId = env.VITE_CDATA_ACCOUNT_ID || "";
            const subscriberId = env.VITE_CDATA_SUBSCRIBER_ID || "";
            const privateKey = env.VITE_CDATA_PRIVATE_KEY || "";

            if (!accountId || !subscriberId || !privateKey) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: "Missing CData credentials" }));
              return;
            }

            const now = Math.floor(Date.now() / 1000);
            const payload = {
              tokenType: "powered-by",
              iat: now,
              exp: now + 7200,
              iss: accountId,
              sub: subscriberId,
            };

            const key = await importPKCS8(privateKey, "RS256");
            const token = await new SignJWT(payload)
              .setProtectedHeader({ alg: "RS256" })
              .sign(key);

            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ token }));
          } catch (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: String(err) }));
          }
          return;
        }
        next();
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    proxy: {
      // Proxy CData API requests to avoid CORS issues
      "/cdata-api": {
        target: "https://cloud.cdata.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/cdata-api/, "/api"),
        secure: true,
      },
    },
    https: httpsConfig,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    jwtServerPlugin(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
