const express = require('express');
const redis = require('redis');
const bcrypt = require('bcrypt');
const cors = require('cors');

const app = express();
const port = 3000;

const redisClient = redis.createClient({
    url: 'redis://localhost:6379'
});

redisClient.on('error', (err) => {
    console.error('Error conectando a Redis:', err);
});

redisClient.connect().catch(err => {
    console.error('Error conectando a Redis:', err);
});

app.use(cors());
app.use(express.json());

const saltRounds = 10;

// Ruta para el registro de usuarios
app.post('/register', async (req, res) => {
    const { username, password } = req.body;

    try {
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        await redisClient.set(`user:${username}`, hashedPassword);
        res.json({ success: true, message: `Usuario ${username} registrado con éxito` });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Ruta para el inicio de sesión
app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const storedPassword = await redisClient.get(`user:${username}`);
        if (storedPassword === null) {
            return res.status(404).json({ success: false, error: `Usuario ${username} no encontrado` });
        }

        const match = await bcrypt.compare(password, storedPassword);
        if (match) {
            res.json({ success: true, message: `Inicio de sesión exitoso`, username: username });
        } else {
            res.status(401).json({ success: false, error: 'Contraseña incorrecta' });
        }
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.listen(port, () => {
    console.log(`API escuchando en http://localhost:${port}`);
});

process.on('SIGINT', () => {
    redisClient.quit();
    process.exit();
});
