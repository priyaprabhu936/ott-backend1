// server.js
const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();

// ---------- CONFIG ----------
const PORT = process.env.PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET || "super-secret-change-this";
const DB_PATH = path.join(__dirname, "db.json");

// ---------- MIDDLEWARE ----------
app.use(express.json());
app.use(
  cors({
    origin: [
      /https?:\/\/.*vercel\.app$/,
      /https?:\/\/localhost(:\d+)?$/,
      /https?:\/\/.*onrender\.com$/,
    ],
    credentials: true,
  })
);

// ---------- DB HELPERS ----------
function readDB() {
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify({ users: [], movies: [] }, null, 2));
  }
  return JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
}
function writeDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

// ---------- AUTH MIDDLEWARE ----------
function auth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ message: "No token" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { id, email }
    next();
  } catch (e) {
    return res.status(401).json({ message: "Invalid token" });
  }
}

// ---------- ROUTES ----------

// Health
app.get("/", (req, res) => res.json({ ok: true, service: "ott-backend", time: new Date().toISOString() }));

// Register
app.post("/register", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ message: "Email & password required" });

    const db = readDB();
    const exists = db.users.find((u) => u.email.toLowerCase() === String(email).toLowerCase());
    if (exists) return res.status(409).json({ message: "User already exists" });

    const hash = await bcrypt.hash(password, 10);
    const newUser = { id: Date.now().toString(), email, password: hash };
    db.users.push(newUser);
    writeDB(db);

    return res.status(201).json({ message: "Registered successfully" });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Server error" });
  }
});

// Login
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ message: "Email & password required" });

    const db = readDB();
    const user = db.users.find((u) => u.email.toLowerCase() === String(email).toLowerCase());
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ message: "Invalid credentials" });

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: "7d" });
    return res.json({ token, user: { id: user.id, email: user.email } });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Server error" });
  }
});

// Protected example
app.get("/profile", auth, (req, res) => {
  res.json({ message: "Profile ok", user: req.user });
});

// Movies (public sample)
app.get("/movies", (req, res) => {
  const db = readDB();
  res.json(db.movies || []);
});

// Add movie (protected)
app.post("/movies", auth, (req, res) => {
  const { title, poster } = req.body || {};
  if (!title) return res.status(400).json({ message: "title required" });

  const db = readDB();
  const movie = { id: Date.now().toString(), title, poster: poster || "" };
  db.movies.push(movie);
  writeDB(db);
  res.status(201).json(movie);
});

app.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});
