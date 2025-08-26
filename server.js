const express = require("express");
const cors = require("cors");
const fs = require("fs").promises;
const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
app.use(cors());               // allow all origins (demo)
app.use(express.json());       // parse JSON

const DATA_FILE = path.join(process.cwd(), "db.json");
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_123";

// ---------- tiny JSON "DB" helpers ----------
async function readDB() {
  try {
    const txt = await fs.readFile(DATA_FILE, "utf-8");
    return JSON.parse(txt);
  } catch {
    // first run: seed some demo movies
    return {
      users: [],
      movies: [
        { id: 1, title: "Vikram",  poster: "https://via.placeholder.com/300x450?text=Vikram" },
        { id: 2, title: "Leo",     poster: "https://via.placeholder.com/300x450?text=Leo" },
        { id: 3, title: "Jailer",  poster: "https://via.placeholder.com/300x450?text=Jailer" }
      ]
    };
  }
}
async function writeDB(db) {
  await fs.writeFile(DATA_FILE, JSON.stringify(db, null, 2));
}

// ---------- auth middleware ----------
function auth(req, res, next) {
  const hdr = req.headers.authorization || "";
  const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : null;
  if (!token) return res.status(401).json({ message: "Missing token" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
}

// ---------- routes ----------
app.get("/", (req, res) => {
  res.json({ ok: true, message: "CineStream API running" });
});

// Auth: REGISTER
app.post("/api/auth/register", async (req, res) => {
  try {
    const { username, password, email } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ message: "username and password required" });
    }
    const db = await readDB();
    const exists = db.users.find(
      u => u.username.toLowerCase() === String(username).toLowerCase()
    );
    if (exists) return res.status(409).json({ message: "User already exists" });

    const hash = await bcrypt.hash(password, 10);
    const user = { id: Date.now(), username, email: email || "", password: hash };
    db.users.push(user);
    await writeDB(db);

    return res.json({
      message: "Registered",
      user: { id: user.id, username: user.username, email: user.email }
    });
  } catch (e) {
    console.error("REGISTER error:", e);
    res.status(500).json({ message: "Server error" });
  }
});

// Auth: LOGIN
app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body || {};
    const db = await readDB();
    const user = db.users.find(u => u.username === username);
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ message: "Invalid credentials" });

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, {
      expiresIn: "7d"
    });
    res.json({ message: "Logged in", token, user: { id: user.id, username: user.username } });
  } catch (e) {
    console.error("LOGIN error:", e);
    res.status(500).json({ message: "Server error" });
  }
});

// Movies: LIST (public)
app.get("/api/movies", async (req, res) => {
  const db = await readDB();
  res.json(db.movies);
});

// Movies: ADD (protected – needs Bearer token from login)
app.post("/api/movies", auth, async (req, res) => {
  try {
    const { title, poster } = req.body || {};
    if (!title) return res.status(400).json({ message: "title required" });

    const db = await readDB();
    const movie = { id: Date.now(), title, poster: poster || "" };
    db.movies.push(movie);
    await writeDB(db);

    res.status(201).json({ message: "Movie added", movie });
  } catch (e) {
    console.error("ADD MOVIE error:", e);
    res.status(500).json({ message: "Server error" });
  }
});

// Movies: DELETE (protected)
app.delete("/api/movies/:id", auth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const db = await readDB();
    const before = db.movies.length;
    db.movies = db.movies.filter(m => m.id !== id);
    await writeDB(db);
    res.json({ deleted: before - db.movies.length });
  } catch (e) {
    console.error("DELETE MOVIE error:", e);
    res.status(500).json({ message: "Server error" });
  }
});

// ---------- start ----------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
