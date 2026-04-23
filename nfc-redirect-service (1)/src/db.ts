import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize DB in root folder for simplicity, or use env path for Docker
const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), 'nfc-redirect.db');
export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// Initial Schema Setup
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    card_id TEXT UNIQUE NOT NULL,
    owner_id TEXT NOT NULL,
    destination_url TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS taps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    card_id TEXT NOT NULL,
    tapped_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    user_agent TEXT,
    country TEXT
  );
`);

// Migration: Add saved_urls to cards if missing
try {
  db.exec(`ALTER TABLE cards ADD COLUMN saved_urls TEXT DEFAULT '[]'`);
} catch (e) {
  // column already exists
}

