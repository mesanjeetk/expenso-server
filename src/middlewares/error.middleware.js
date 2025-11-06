// global error handler
export const errorHandler = (err, req, res, next) => {
  console.error("🔥 Error:", err);

  let statusCode = err.statusCode || 500;

  // for mongoose validation errors
  if (err.name === 'ValidationError') {
    statusCode = 400;
  }

  const message = err.message || "Something went wrong";

  return res.status(statusCode).json({
    success: false,
    statusCode,
    message,
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
  });
};
