export function successResponse(data, meta = {}) {
  return {
    success: true,
    data,
    meta,
  };
}

export function errorResponse(code, message, details = {}, requestId = null) {
  let normalizedDetails = details ?? {};
  let normalizedRequestId = requestId;

  if (normalizedRequestId == null && typeof details === 'string') {
    normalizedDetails = {};
    normalizedRequestId = details;
  }

  return {
    success: false,
    error: {
      code,
      message,
      details: normalizedDetails,
      ...(normalizedRequestId && { requestId: normalizedRequestId }),
    },
  };
}
