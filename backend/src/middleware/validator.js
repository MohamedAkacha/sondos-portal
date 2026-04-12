const { validationResult } = require('express-validator');

/**
 * Middleware factory — wraps express-validator checks
 * Usage: router.post('/endpoint', validate(checks), controller.method)
 */
const validate = (validations) => {
  return async (req, res, next) => {
    // Run all validations
    await Promise.all(validations.map(validation => validation.run(req)));

    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }

    const lang = req.headers['accept-language']?.startsWith('en') ? 'en' : 'ar';

    return res.status(400).json({
      success: false,
      message: lang === 'en' ? 'Validation failed' : 'بيانات غير صالحة',
      errors: errors.array().map(err => ({
        field: err.path,
        message: err.msg,
      })),
    });
  };
};

module.exports = { validate };
