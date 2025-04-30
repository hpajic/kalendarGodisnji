import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { date, member, action } = req.body;
    if (action === 'delete') {
      await pool.query('DELETE FROM godisnji WHERE datum = $1 AND osoba = $2', [date, member]);
      res.status(200).json({ status: 'DELETED' });
      return;
    }
    try {
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
  if (req.method === 'GET') {
    const result = await pool.query('SELECT datum, osoba FROM godisnji');
    // Formatiraj podatke kao što frontend očekuje (array of arrays, prvi red su zaglavlja)
    const rows = result.rows.map(r => [r.datum.toISOString().slice(0, 10), r.osoba]);
    res.status(200).json([["Datum", "Osoba"], ...rows]);
    return;
  }
  res.status(405).end();
}