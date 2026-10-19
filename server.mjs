import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { runRedTeam, supportBot } from "./src/engine.mjs";

const projectDirectory = dirname(fileURLToPath(import.meta.url));
const publicDirectory = resolve(projectDirectory, "public");
const port = Number.parseInt(process.env.PORT || "3000", 10);
const host = process.env.HOST || "0.0.0.0";
const maximumBodyBytes = 8 * 1024;

const contentTypes = Object.freeze({
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".woff2": "font/woff2",
});

function securityHeaders(contentType) {
  return {
    "Cache-Control": "no-store",
    "Content-Type": contentType,
    "Content-Security-Policy":
      "default-src 'self'; connect-src 'self'; font-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; base-uri 'none'; frame-ancestors 'none'",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
  };
}

function sendJson(response, statusCode, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(statusCode, securityHeaders("application/json; charset=utf-8"));
  response.end(body);
}

function sendError(response, statusCode, message) {
  sendJson(response, statusCode, { error: message });
}

async function readJsonBody(request) {
  const chunks = [];
  let byteCount = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    byteCount += buffer.byteLength;
    if (byteCount > maximumBodyBytes) {
      const error = new Error("Request body is too large.");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(buffer);
  }

  if (chunks.length === 0) {
    return {};
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    const error = new Error("Request body must be valid JSON.");
    error.statusCode = 400;
    throw error;
  }
}

function isInsidePublicDirectory(filePath) {
  return filePath === publicDirectory || filePath.startsWith(`${publicDirectory}${sep}`);
}

async function serveStatic(request, response, pathname) {
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    sendError(response, 400, "The requested path is invalid.");
    return;
  }

  const relativePath = decodedPath === "/" ? "/index.html" : decodedPath;
  const filePath = resolve(publicDirectory, `.${relativePath}`);
  if (!isInsidePublicDirectory(filePath)) {
    sendError(response, 403, "That path is outside the demo app.");
    return;
  }

  try {
    const body = await readFile(filePath);
    const contentType = contentTypes[extname(filePath).toLowerCase()] || "application/octet-stream";
    response.writeHead(200, securityHeaders(contentType));
    response.end(body);
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "EISDIR") {
      sendError(response, 404, "The requested demo asset was not found.");
      return;
    }
    sendError(response, 500, "The demo asset could not be loaded.");
  }
}

async function handleRequest(request, response) {
  const requestUrl = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
  const { pathname } = requestUrl;

  if (pathname === "/api/health") {
    if (request.method !== "GET") {
      sendError(response, 405, "Use GET for the health check.");
      return;
    }
    sendJson(response, 200, { status: "ok", offline: true, target: "supportBot" });
    return;
  }

  if (pathname === "/api/chat") {
    if (request.method !== "POST") {
      sendError(response, 405, "Use POST to message the included weak bot.");
      return;
    }

    try {
      const body = await readJsonBody(request);
      if (typeof body.message !== "string" || body.message.trim().length === 0) {
        sendError(response, 400, "A non-empty message is required.");
        return;
      }
      sendJson(response, 200, { reply: supportBot(body.message) });
    } catch (error) {
      sendError(response, error.statusCode || 500, error.message || "The support request failed.");
    }
    return;
  }

  if (pathname === "/api/red-team") {
    if (request.method !== "POST") {
      sendError(response, 405, "Use POST to run the local red-team demo.");
      return;
    }

    try {
      const run = runRedTeam();
      sendJson(response, 200, {
        ...run,
        report: { findings: run.findings, summary: run.summary },
      });
    } catch {
      sendError(response, 500, "The local red-team run failed.");
    }
    return;
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    sendError(response, 405, "Only GET and HEAD are supported for demo assets.");
    return;
  }

  if (request.method === "HEAD") {
    const contentType = pathname === "/" ? contentTypes[".html"] : contentTypes[extname(pathname).toLowerCase()];
    response.writeHead(200, securityHeaders(contentType || "application/octet-stream"));
    response.end();
    return;
  }

  await serveStatic(request, response, pathname);
}

const server = createServer((request, response) => {
  handleRequest(request, response).catch(() => {
    if (!response.headersSent) {
      sendError(response, 500, "The offline demo encountered an unexpected error.");
      return;
    }
    response.destroy();
  });
});

server.listen(port, host, () => {
  console.log(`RedTeam Demo listening on http://${host}:${port}`);
  console.log("Scope locked: included weak supportBot only; no external calls.");
});

function closeServer(signal) {
  console.log(`Received ${signal}; stopping RedTeam Demo.`);
  server.close(() => process.exit(0));
}

process.once("SIGINT", () => closeServer("SIGINT"));
process.once("SIGTERM", () => closeServer("SIGTERM"));
