export function notFoundHandler(request, response) {
  response.status(404).json({ error: 'not_found', message: `Route not found: ${request.method} ${request.path}` });
}

export function errorHandler(error, request, response, next) {
  if (response.headersSent) return next(error);
  console.error(`[${request.method} ${request.originalUrl}]`, error);
  const status = error.statusCode || 500;
  response.status(status).json({
    error: status >= 500 ? 'internal_error' : 'request_error',
    message: status >= 500 && process.env.NODE_ENV === 'production' ? 'An unexpected server error occurred' : error.message
  });
}