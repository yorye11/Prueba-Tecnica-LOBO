// index.js
const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

// Importamos la conexión a la base de datos que acabamos de crear
const pool = require('./config/db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());

// Regex para validar UUID v4 (formato de Supabase Auth)
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isValidUUID = (id) => UUID_REGEX.test(id);

// Endpoint de prueba simple
app.get('/', (req, res) => {
  res.send('API funcionando y conectada a la base de datos.');
});

// GET /api/movies - Buscar películas en OMDb API
app.get('/api/movies', async (req, res) => {
  try {
    const { s } = req.query;

    if (!s) {
      return res.status(400).json({ error: 'El parámetro de búsqueda "s" es requerido' });
    }

    const response = await axios.get(
      `http://www.omdbapi.com/?apikey=${process.env.OMDB_API_KEY}&s=${encodeURIComponent(s)}`
    );

    if (response.data.Response === 'False') {
      return res.status(404).json({ error: response.data.Error || 'No se encontraron películas' });
    }

    res.json(response.data);
  } catch (error) {
    console.error('Error al buscar películas:', error.message);
    res.status(500).json({ error: 'Error al consultar la API de películas' });
  }
});

// POST /api/favorites - Agregar película a favoritos
app.post('/api/favorites', async (req, res) => {
  try {
    const { imdb_id, title, year, poster, user_id } = req.body;

    if (!imdb_id || !title || !user_id) {
      return res.status(400).json({ error: 'imdb_id, title y user_id son requeridos' });
    }

    // Validar que user_id sea un UUID válido
    if (!isValidUUID(user_id)) {
      return res.status(400).json({ error: 'user_id debe ser un UUID válido' });
    }

    const query = `
      INSERT INTO favorites (imdb_id, title, year, poster, user_id)
      VALUES ($1, $2, $3, $4, $5::uuid)
      RETURNING *
    `;

    const values = [imdb_id, title, year, poster, user_id];
    const result = await pool.query(query, values);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    // Manejo de error de duplicados (código 23505 en PostgreSQL)
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Esta película ya está en tus favoritos' });
    }
    console.error('Error al agregar favorito:', error.message);
    res.status(500).json({ error: 'Error al agregar película a favoritos' });
  }
});

// GET /api/favorites/:user_id - Obtener favoritos de un usuario
app.get('/api/favorites/:user_id', async (req, res) => {
  try {
    const { user_id } = req.params;

    // Validar que user_id sea un UUID válido
    if (!isValidUUID(user_id)) {
      return res.status(400).json({ error: 'user_id debe ser un UUID válido' });
    }

    const query = `
      SELECT * FROM favorites
      WHERE user_id = $1::uuid
      ORDER BY created_at DESC
    `;

    const result = await pool.query(query, [user_id]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener favoritos:', error.message);
    res.status(500).json({ error: 'Error al obtener favoritos' });
  }
});

// DELETE /api/favorites/:id - Eliminar favorito por ID
app.delete('/api/favorites/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const query = 'DELETE FROM favorites WHERE id = $1 RETURNING *';
    const result = await pool.query(query, [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Favorito no encontrado' });
    }

    res.json({ message: 'Favorito eliminado correctamente', deleted: result.rows[0] });
  } catch (error) {
    console.error('Error al eliminar favorito:', error.message);
    res.status(500).json({ error: 'Error al eliminar favorito' });
  }
});

// Levantamos el servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});
