import { createServer } from "node:http";
import { connect } from "node:net";

import { WebSocketServer } from "ws";

function requireLoopbackHost(value, label) {
  if (value !== "127.0.0.1" && value !== "localhost") {
    throw new Error(`${label} must be loopback-only.`);
  }
  return value;
}

function requirePort(value, label) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1024 || port > 65535 || port === 54329) {
    throw new Error(`${label} is invalid or protected.`);
  }
  return port;
}

const listenHost = requireLoopbackHost(
  process.env.LOCAL_PG_WS_LISTEN_HOST ?? "127.0.0.1",
  "WebSocket listen host",
);
const listenPort = requirePort(process.env.LOCAL_PG_WS_LISTEN_PORT, "WebSocket listen port");
const targetHost = requireLoopbackHost(
  process.env.LOCAL_PG_TARGET_HOST ?? "127.0.0.1",
  "PostgreSQL target host",
);
const targetPort = requirePort(process.env.LOCAL_PG_TARGET_PORT, "PostgreSQL target port");

const server = createServer();
const webSocketServer = new WebSocketServer({ noServer: true });

server.on("upgrade", (request, socket, head) => {
  webSocketServer.handleUpgrade(request, socket, head, (webSocket) => {
    webSocketServer.emit("connection", webSocket);
  });
});

webSocketServer.on("connection", (webSocket) => {
  const postgresSocket = connect({ host: targetHost, port: targetPort });

  webSocket.on("message", (data) => postgresSocket.write(data));
  webSocket.on("close", () => postgresSocket.destroy());
  webSocket.on("error", () => postgresSocket.destroy());

  postgresSocket.on("data", (data) => {
    if (webSocket.readyState === webSocket.OPEN) {
      webSocket.send(data, { binary: true });
    }
  });
  postgresSocket.on("close", () => webSocket.close());
  postgresSocket.on("error", () => webSocket.close());
});

server.listen(listenPort, listenHost, () => {
  process.stdout.write(`READY ${listenHost}:${listenPort} -> ${targetHost}:${targetPort}\n`);
});
