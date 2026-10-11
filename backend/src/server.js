const path = require('path');
const express = require('express');
const cors = require('cors');

require('./db'); // inicializa y siembra la base de datos

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

app.use('/api/folios', require('./routes/folios'));
app.use('/api/asociados', require('./routes/asociados'));
app.use('/api/aliados', require('./routes/aliados'));
app.use('/api/pos', require('./routes/pos'));
app.use('/api/metas', require('./routes/metas'));
app.use('/api/catalogos', require('./routes/catalogos'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/datos', require('./routes/datos'));
app.use('/api/backup', require('./routes/backup'));

app.get('/api/health', (req, res) => res.json({ ok: true }));

// Frontend estático
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
app.use(express.static(PUBLIC_DIR));
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'No encontrado' });
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// manejador de errores genérico
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Error interno' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Dashboard de Ventas y Asociados escuchando en http://localhost:${PORT}`);
});
