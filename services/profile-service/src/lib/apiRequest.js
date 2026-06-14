import { request } from 'node:https';

// Ported verbatim from the monolith (backend/src/utils/apiRequest.js).
export function apiGet(hostname, path, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = request({ hostname, path, method: 'GET', headers }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString();

        if (res.statusCode >= 400) {
          const err = new Error(`HTTP ${res.statusCode} from ${hostname}${path}`);
          err.statusCode = res.statusCode;
          err.responseBody = body;
          return reject(err);
        }

        try {
          resolve(JSON.parse(body));
        } catch {
          reject(new Error(`Non-JSON response from ${hostname}${path}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}
