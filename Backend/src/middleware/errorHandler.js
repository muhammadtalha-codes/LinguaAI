function globalErrorHandler(err, req, res, _next) {
  console.error('Unhandled error:', err.message);

  const statusCode = err.statusCode || 500;

  res.status(statusCode).json({
    success: false,
    error: statusCode === 500
      ? 'An unexpected error occurred. Please try again later.'
      : err.message,
  });
}

module.exports = { globalErrorHandler };