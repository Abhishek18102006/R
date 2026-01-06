import express from "express";
import cors from "cors";
import { spawn } from "child_process";
import pool from "./db.js";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
app.use(cors());
app.use(express.json());

/* ===============================
   PATH FIX (ES MODULE SAFE)
   =============================== */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ===============================
   LOGIN API
   =============================== */
app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const result = await pool.query(
      "SELECT username, section_code FROM users WHERE username=$1 AND password=$2",
      [username, password]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: "Invalid username or password" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Database error" });
  }
});

/* ===============================
   AI CONFLICT RESOLUTION API
   (STDIN → PYTHON)
   =============================== */
app.post("/resolve-conflict", (req, res) => {
  const pythonScript = path.join(
    __dirname,
    "../ai_model/predict_train.py"
  );

  const python = spawn("python", [pythonScript]);

  let output = "";
  let error = "";

  // Send JSON safely via stdin
  python.stdin.write(JSON.stringify(req.body));
  python.stdin.end();

  python.stdout.on("data", data => {
    output += data.toString();
  });

  python.stderr.on("data", data => {
    error += data.toString();
  });

  python.on("close", () => {
    if (error) {
      console.error("PYTHON ERROR:", error);
      return res.status(500).json({ error });
    }

    if (!output) {
      return res.status(500).json({
        error: "No output received from AI model"
      });
    }

    try {
      res.json(JSON.parse(output));
    } catch (e) {
      console.error("JSON PARSE ERROR:", output);
      res.status(500).json({ error: "Invalid AI response" });
    }
  });
});

/* ===============================
   START SERVER
   =============================== */
app.listen(5000, () => {
  console.log("🚀 Backend running at http://localhost:5000");
});
