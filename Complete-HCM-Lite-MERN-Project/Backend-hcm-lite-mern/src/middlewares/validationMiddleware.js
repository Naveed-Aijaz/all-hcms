// Zod ya custom request body validation ke liye reusable middleware
export function validate(schema) {
  return async (req, res, next) => {
    try {
      if (schema) {
        req.body = await schema.parseAsync(req.body);
      }
      next();
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: error.errors || error.message,
      });
    }
  };
}