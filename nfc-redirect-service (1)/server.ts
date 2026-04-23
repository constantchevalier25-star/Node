import { fileURLToPath } from 'url';
import path from 'path';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { db } from './src/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // === NFC REDIRECT ENDPOINT (Fast Path) ===
  app.get('/r/:cardId', (req, res) => {
    const { cardId } = req.params;
    
    // Quick lookup in DB
    const stmt = db.prepare('SELECT destination_url FROM cards WHERE card_id = ? AND is_active = 1');
    const card = stmt.get(cardId) as { destination_url: string } | undefined;

    // Log the tap asynchronously (fire & forget)
    setTimeout(() => {
      try {
        const stmt = db.prepare('INSERT INTO taps (card_id, user_agent) VALUES (?, ?)');
        stmt.run(cardId, req.headers['user-agent'] || 'unknown');
      } catch (err) {
        console.error('Failed to log tap:', err);
      }
    }, 0);

    if (card && card.destination_url) {
      // 302 Found redirect - temporary so they can change URLs
      res.redirect(302, card.destination_url);
    } else {
      // Send to dashboard to claim or show 404
      res.status(404).send('Card not found or inactive');
    }
  });

  // === DASHBOARD API ENDPOINTS ===
  // Authentication via Device Token logic
  const getOwnerId = (req: express.Request, res: express.Response): string | null => {
    const token = req.headers['x-device-token'];
    if (!token || typeof token !== 'string') {
      res.status(401).json({ error: 'Unauthorized: Missing device token' });
      return null;
    }
    return token;
  };

  app.get('/api/cards', (req, res) => {
    const ownerId = getOwnerId(req, res);
    if (!ownerId) return;

    const stmt = db.prepare('SELECT * FROM cards WHERE owner_id = ? ORDER BY created_at DESC');
    const cards = stmt.all(ownerId);
    res.json(cards);
  });

  app.post('/api/cards', (req, res) => {
    const ownerId = getOwnerId(req, res);
    if (!ownerId) return;

    const { card_id, destination_url } = req.body;
    
    // Basic validation
    if (!card_id || !destination_url) {
      return res.status(400).json({ error: 'card_id and destination_url are required' });
    }

    try {
      const stmt = db.prepare("INSERT INTO cards (card_id, destination_url, owner_id, saved_urls) VALUES (?, ?, ?, '[]')");
      const info = stmt.run(card_id, destination_url, ownerId);
      res.json({ id: info.lastInsertRowid, card_id, destination_url, is_active: 1, saved_urls: '[]' });
    } catch (err: any) {
      // SQLite constraint error
      if (err.message.includes('UNIQUE constraint failed')) {
        return res.status(409).json({ error: 'Card ID already exists' });
      }
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/cards/:id', (req, res) => {
    const ownerId = getOwnerId(req, res);
    if (!ownerId) return;

    const { id } = req.params;
    const { destination_url, is_active, saved_urls } = req.body;

    const stmt = db.prepare('UPDATE cards SET destination_url = ?, is_active = ?, saved_urls = ? WHERE id = ? AND owner_id = ?');
    const info = stmt.run(
      destination_url, 
      is_active === false ? 0 : 1, 
      saved_urls ? JSON.stringify(saved_urls) : '[]', 
      id, 
      ownerId
    );

    if (info.changes === 0) {
      return res.status(404).json({ error: 'Card not found or unauthorized' });
    }
    
    res.json({ success: true });
  });

  app.delete('/api/cards/:id', (req, res) => {
    const ownerId = getOwnerId(req, res);
    if (!ownerId) return;

    const { id } = req.params;

    const stmt = db.prepare('DELETE FROM cards WHERE id = ? AND owner_id = ?');
    const info = stmt.run(id, ownerId);

    if (info.changes === 0) {
      return res.status(404).json({ error: 'Card not found or unauthorized' });
    }

    res.json({ success: true });
  });

  app.get('/api/stats', (req, res) => {
    const ownerId = getOwnerId(req, res);
    if (!ownerId) return;

    // Get total taps for all cards owned by the active user
    const stmt = db.prepare(`
      SELECT c.card_id, COUNT(t.id) as tap_count 
      FROM cards c 
      LEFT JOIN taps t ON c.card_id = t.card_id 
      WHERE c.owner_id = ? 
      GROUP BY c.card_id
    `);
    const stats = stmt.all(ownerId);
    res.json(stats);
  });

  // === VITE MIDDLEWARE FOR DEVELOPMENT ===
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production static files
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
