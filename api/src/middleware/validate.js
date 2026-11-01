// Parses req.body / req.query / req.params with zod and puts the clean values on req.data.
// (Express 5 makes req.query read-only, so we never overwrite it.)
export const validate =
  (schemas) =>
  (req, _res, next) => {
    req.data = req.data || {};
    for (const part of ['params', 'query', 'body']) {
      if (schemas[part]) req.data[part] = schemas[part].parse(req[part] ?? {});
    }
    next();
  };
