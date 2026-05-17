export function successResponse(data, meta = {}) {
  return {
    success: true,
    data,
    meta,
  };
}

export function errorResponse(code, message, details = {}, requestId = null) {
  return {
    success: false,
    error: {
      code,
      message,
      details,
      ...(requestId && { requestId }),
    },
  };
}
