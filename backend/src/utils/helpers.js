const crypto = require('crypto');

/**
 * Generate a secure random token
 */
function generateToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Paginate query results
 */
function paginate(query, page = 1, limit = 20) {
  const skip = (page - 1) * limit;
  return query.skip(skip).limit(limit);
}

/**
 * Build pagination meta for API responses
 */
function paginationMeta(total, page, limit) {
  return {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    hasNext: page * limit < total,
    hasPrev: page > 1,
  };
}

/**
 * Get user language from request headers
 */
function getLang(req) {
  return req.headers['accept-language']?.startsWith('en') ? 'en' : 'ar';
}

/**
 * Async handler — wraps async route handlers to catch errors
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = {
  generateToken,
  paginate,
  paginationMeta,
  getLang,
  asyncHandler,
};
