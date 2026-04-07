import { Pool } from 'pg';
import bcrypt from 'bcryptjs';

// NeonDB connection string
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export default async function handler(req, res) {
  // Rješavanje CORS preflight upita za Vercel (kako bi frontend mogao slati Auth headere)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // AUTENTIFIKACIJA SVIH RUTA
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Basic ')) {
    return res.status(401).json({ error: 'Niste prijavljeni' });
  }
  const decoded = Buffer.from(auth.split(' ')[1], 'base64').toString();
  const [user, pass] = decoded.split(':');

  try {
    const userCheck = await pool.query('SELECT * FROM users WHERE username = $1', [user]);
    if (userCheck.rowCount === 0) {
      return res.status(401).json({ error: 'Pogrešna lozinka ili korisnik' });   
    }

    const isValid = await bcrypt.compare(pass, userCheck.rows[0].password);
    if (!isValid) {
      return res.status(401).json({ error: 'Pogrešna lozinka ili korisnik' });
    }
  } catch (dbErr) {
    return res.status(500).json({ error: 'Baza korisnika nije konfigurirana. Kreirajte tablicu users!' });
  }

  if (req.method === 'POST') {
    const { date, member, action } = req.body;
    if (action === 'delete') {
      await pool.query('DELETE FROM godisnji WHERE datum = $1 AND osoba = $2', [date, member]);
      res.status(200).json({ status: 'DELETED' });
      return;
    }
    // Provjera 2 osobe pravila
    try {
      const dbUsersCount = await pool.query('SELECT COUNT(*) FROM users');
      const totalUsers = parseInt(dbUsersCount.rows[0].count);
      const maxOnVacation = Math.max(0, totalUsers - 2);

      const existingForDate = await pool.query('SELECT COUNT(*) FROM godisnji WHERE datum = $1', [date]);
      const currentOnVacation = parseInt(existingForDate.rows[0].count);

      // Check if user is already on vacation
      const userOnDate = await pool.query('SELECT * FROM godisnji WHERE datum = $1 AND osoba = $2', [date, member]);

      if (userOnDate.rowCount === 0 && currentOnVacation >= maxOnVacation) {
        return res.status(403).json({ error: 'Za taj dan mora ostati barem 2 osobe raditi!' });
      }

      await pool.query(
        'INSERT INTO godisnji (datum, osoba) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [date, member]
      );
      res.status(200).json({ status: 'OK' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
    return;
  }
  if (req.method === 'DELETE') {
    await pool.query("DELETE FROM godisnji"); 
    res.status(200).json({ status: 'ALL_DELETED' });
    return;
  }
  if (req.method === 'GET') {
    if (req.query && req.query.action === 'users') {
      const usersResult = await pool.query('SELECT username, name FROM users ORDER BY name ASC');
      return res.status(200).json(usersResult.rows);
    }
    const result = await pool.query('SELECT datum, osoba FROM godisnji');
    const rows = result.rows.map(r => [r.datum.toISOString().slice(0, 10), r.osoba]);
    res.status(200).json([["Datum", "Osoba"], ...rows]);
    return;
  }
  res.status(405).end();
}