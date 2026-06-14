import { captureException } from '@dc/observability';

export class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Not found') { super(message, 404, 'NOT_FOUND'); }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') { super(message, 401, 'UNAUTHORIZED'); }
}

// Express error handler — last middleware in every service.
//
// 5xx errors are reported to Sentry (a no-op unless the service called
// initSentry() with a DSN configured) and the message is masked so internal
// details never reach the client. 4xx errors keep their original message.
export const errorHandler = (err, _req, res, _next) => {
  const status = err.statusCode ?? 500;
  if (status >= 500) captureException(err);
  res.status(status).json({
    error: {
      code: err.code ?? 'INTERNAL',
      message: status >= 500 ? 'Internal server error' : err.message,
    },
  });
};
