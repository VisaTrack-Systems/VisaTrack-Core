import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const servers = [];

// Preserve the localhost URLs used by the compiled frontend and backend's
// trusted Origin checks while forwarding to the Mac's running services.
async function startProxy(port) {
  const server = http.createServer((request, response) => {
    const upstream = http.request({
      hostname: 'host.docker.internal',
      port,
      path: request.url,
      method: request.method,
      headers: request.headers,
    }, (incoming) => {
      response.writeHead(incoming.statusCode, incoming.headers);
      incoming.pipe(response);
    });
    upstream.on('error', (error) => {
      if (!response.headersSent) response.writeHead(502, { 'Content-Type': 'text/plain' });
      response.end(`Local service on port ${port} is unavailable: ${error.message}`);
    });
    request.on('aborted', () => upstream.destroy());
    request.pipe(upstream);
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  servers.push(server);
}

async function main() {
  if (process.env.REGRESSION_ALLOW_MUTATIONS !== 'local') {
    throw new Error('Set REGRESSION_ALLOW_MUTATIONS=local to allow disposable local test data.');
  }
  if (!process.env.REGRESSION_BOOTSTRAP_PASSWORD) {
    throw new Error('Supply REGRESSION_BOOTSTRAP_PASSWORD at runtime.');
  }

  await startProxy(3000);
  await startProxy(8000);
  const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const args = [
    path.join(projectRoot, 'node_modules', '@playwright', 'test', 'cli.js'),
    'test', '--config', 'playwright.regression.config.ts',
    ...process.argv.slice(2),
  ];
  const child = spawn(process.execPath, args, {
    cwd: projectRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      REGRESSION_BASE_URL: 'http://localhost:3000',
      REGRESSION_API_URL: 'http://localhost:8000',
    },
  });
  const interrupt = () => child.kill('SIGINT');
  const terminate = () => child.kill('SIGTERM');
  process.once('SIGINT', interrupt);
  process.once('SIGTERM', terminate);
  try {
    process.exitCode = await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('exit', (code) => resolve(code ?? 1));
    });
  } finally {
    process.removeListener('SIGINT', interrupt);
    process.removeListener('SIGTERM', terminate);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
}).finally(() => {
  for (const server of servers) {
    server.closeAllConnections();
    server.close();
  }
});
