const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bodyParser = require("body-parser");

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// ✅ MongoDB Connection
mongoose
  .connect("mongodb+srv://admin:db_admin123@cluster0.1ss7sxa.mongodb.net/ottDB", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// ✅ User Schema
const userSchema = new mongoose.Schema({
  username: String,
  email: String,
  password: String,
});

const User = mongoose.model("User", userSchema);

// ✅ Register Route
app.post("/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const user = new User({ username, email, password });
    await user.save();
    res.status(201).json({ message: "User registered successfully ✅" });
  } catch (err) {
    res.status(500).json({ error: "Failed to register user ❌" });
  }
});

// ✅ Login Route
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email, password });
    if (user) {
      res.json({ message: "Login successful ✅" });
    } else {
      res.status(401).json({ error: "Invalid email or password ❌" });
    }
  } catch (err) {
    res.status(500).json({ error: "Login failed ❌" });
  }
});

// ✅ Root Route
app.get("/", (req, res) => {
  res.send("🚀 Backend is running!");
});

// ✅ Start Server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
