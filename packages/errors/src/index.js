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
export const errorHandler = (err, _req, res, _next) => {
  const status = err.statusCode ?? 500;
  res.status(status).json({
    error: { code: err.code ?? 'INTERNAL', message: err.message },
  });
};
