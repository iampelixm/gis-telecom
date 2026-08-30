import express from "express";
import jwt from "jsonwebtoken";
import { users } from "./users.js";

const app = express();
const port = process.env.PORT || 3100;
const secret = process.env.JWT_SECRET || "dev-secret";
const expiresIn = process.env.JWT_EXPIRES_IN || "12h";

app.use(express.json());

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.get("/users", (_req, res) => {
  res.json(users.map(({ username, name, role }) => ({ username, name, role })));
});

app.post("/login", (req, res) => {
  const { username } = req.body || {};
  const user = users.find((u) => u.username === username);
  if (!user) {
    return res.status(401).json({ error: "unknown user" });
  }

  const token = jwt.sign(
    {
      sub: user.username,
      name: user.name,
      role: user.role,
      permissions: user.permissions,
    },
    secret,
    { expiresIn }
  );

  res.json({ token, user: { username: user.username, name: user.name, role: user.role } });
});

app.listen(port, () => console.log(`mock-auth listening on :${port}`));
