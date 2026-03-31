import { spawn } from 'node:child_process';

export const repoRoot = process.cwd();

export function runCli(args, options = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn('node', ['dist/index.js', ...args], {
      cwd: repoRoot,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    proc.on('error', reject);
    proc.on('close', (code) => {
      resolve({ code: code ?? 1, stdout, stderr });
    });

    if (typeof options.stdin === 'string') {
      proc.stdin.write(options.stdin);
    }
    proc.stdin.end();
  });
}

export function callMcpTool(name, args = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn('node', ['dist/index.js', 'mcp', 'serve'], {
      cwd: repoRoot,
      stdio: ['pipe', 'pipe', 'inherit'],
    });
    let buffer = Buffer.alloc(0);

    function send(msg) {
      const body = JSON.stringify(msg);
      proc.stdin.write(`Content-Length: ${Buffer.byteLength(body, 'utf8')}\r\n\r\n${body}`);
    }

    function read() {
      return new Promise((resolveMessage, rejectMessage) => {
        const onExit = (code, signal) => {
          proc.stdout.off('data', onData);
          rejectMessage(new Error(`mcp exited ${code ?? signal}`));
        };
        const onData = (chunk) => {
          buffer = Buffer.concat([buffer, chunk]);
          while (true) {
            const headerEnd = buffer.indexOf(Buffer.from('\r\n\r\n'));
            if (headerEnd < 0) return;
            const headerText = buffer.slice(0, headerEnd).toString('utf8');
            const match = headerText.match(/Content-Length:\s*(\d+)/i);
            if (!match) {
              proc.off('exit', onExit);
              rejectMessage(new Error('Missing Content-Length'));
              return;
            }
            const length = Number(match[1]);
            const bodyStart = headerEnd + 4;
            if (buffer.length < bodyStart + length) return;
            const body = buffer.slice(bodyStart, bodyStart + length).toString('utf8');
            buffer = buffer.slice(bodyStart + length);
            proc.stdout.off('data', onData);
            proc.off('exit', onExit);
            resolveMessage(JSON.parse(body));
            return;
          }
        };
        proc.stdout.on('data', onData);
        proc.on('exit', onExit);
      });
    }

    (async () => {
      try {
        send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} });
        await read();
        send({
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/call',
          params: {
            name,
            arguments: args,
          },
        });
        const result = await read();
        proc.kill('SIGTERM');
        resolve(result);
      } catch (error) {
        proc.kill('SIGTERM');
        reject(error);
      }
    })();
  });
}
