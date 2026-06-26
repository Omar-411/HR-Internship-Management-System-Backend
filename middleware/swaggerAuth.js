// Simple HTTP Basic Auth middleware for protecting Swagger in production

const swaggerAuth = (req, res, next) => {
  // Only enforce in production; in other environments Swagger stays open
  if (process.env.NODE_ENV !== "production") {
    return next();
  }

  const header = req.headers["authorization"] || "";
  const [scheme, encoded] = header.split(" ");

  if (scheme !== "Basic" || !encoded) {
    res.setHeader("WWW-Authenticate", 'Basic realm="Swagger"');
    return res.status(401).send("Authentication required for Swagger UI");
  }

  const decoded = Buffer.from(encoded, "base64").toString();
  const [user, pass] = decoded.split(":");

  const expectedUser = process.env.SWAGGER_USER || "swagger";
  const expectedPass = process.env.SWAGGER_PASSWORD || "swagger123";

  if (user === expectedUser && pass === expectedPass) {
    return next();
  }

  res.setHeader("WWW-Authenticate", 'Basic realm="Swagger"');
  return res.status(401).send("Invalid Swagger credentials");
};

export default swaggerAuth;
