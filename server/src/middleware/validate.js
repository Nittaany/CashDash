/**
 * Generic Zod validator middleware
 * Validates body, query, and/or params against provided schemas
 * Results are stored in req.validated to avoid mutating Express internals
 */
export function validate({ body, query, params }) {
  return (req, _res, next) => {
    try {
      req.validated = {};

      if (body) {
        req.validated.body = body.parse(req.body);
      }
      if (query) {
        req.validated.query = query.parse(req.query);
      }
      if (params) {
        req.validated.params = params.parse(req.params);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
