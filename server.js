// server.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
const PORT = process.env.PORT || 10000;
const JWT_SECRET = process.env.JWT_SECRET || "devsecret-change-it";

// ---- CORS ----
const FRONTEND_ORIGIN =
  process.env.FRONTEND_ORIGIN ||
  "http://localhost:3000,https://*.vercel.app";
const allowList = FRONTEND_ORIGIN.split(",").map((s) => s.trim());

app.use(
  cors({
    origin: function (origin, cb) {
      if (!origin) return cb(null, true); // Postman/health etc.
      const ok =
        allowList.includes("*") ||
        allowList.includes(origin) ||
        allowList.some((o) => o.endsWith("*.vercel.app") && origin.endsWith(".vercel.app"));
      cb(ok ? null : new Error("CORS blocked"), ok);
    }
  })
);
app.use(express.json());

// ---- DB helpers ----
const dbPath = path.join(__dirname, "db.json");
function readDB() {
  try {
    return JSON.parse(fs.readFileSync(dbPath, "utf8"));
  } catch (_) {
    return { users: [], movies: [] };
  }
}
function writeDB(db) {
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
}

// ---- Auth middleware ----
function auth(req, res, next) {
  const hdr = req.headers.authorization || "";
  const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : null;
  if (!token) return res.status(401).json({ message: "No token" });
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ message: "Invalid token" });
    req.user = decoded;
    next();
  });
}

// ---- Routes ----
app.get("/", (_, res) => res.json({ ok: true, service: "ott-backend1" }));
app.get("/healthz", (_, res) => res.send("ok"));

app.post("/register", async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password)
    return res.status(400).json({ message: "username & password required" });

  const db = readDB();
  const exists = db.users.find((u) => u.username === username);
  if (exists) return res.status(409).json({ message: "User already exists" });

  const hash = await bcrypt.hash(password, 10);
  const user = { id: Date.now(), username, password: hash };
  db.users.push(user);
  writeDB(db);

  return res.json({ message: "Registered" });
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body || {};
  const db = readDB();
  const user = db.users.find((u) => u.username === username);
  if (!user) return res.status(401).json({ message: "Invalid credentials" });

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(401).json({ message: "Invalid credentials" });

  const token = jwt.sign(
    { id: user.id, username: user.username },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
  res.json({ token });
});

app.get("/profile", auth, (req, res) => {
  res.json({ user: { id: req.user.id, username: req.user.username } });
});

app.get("/movies", auth, (req, res) => {
  const db = readDB();
  res.json({ movies: db.movies });
});

// ---- Start ----
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
