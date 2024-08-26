const express = require('express');
const bodyParser = require('body-parser');
const redis = require('redis');

// Configura Redis
const redisClient = redis.createClient({
    host: '127.0.0.1',
    port: 6379,
});

redisClient.on('connect', () => {
    console.log('Conectado a Redis');
    redisClient.ping((err, result) => {
        if (err) {
            console.log('Error al hacer ping a Redis:', err);
        } else {
            console.log('Respuesta de ping a Redis:', result); // Debería ser 'PONG'
        }
    });
});

redisClient.on('ready', () => {
    console.log('Redis listo para recibir comandos');
});

redisClient.on('error', (err) => {
    console.log('Error de conexión a Redis: ' + err);
});

redisClient.on('end', () => {
    console.log('Cliente Redis desconectado');
});

const app = express();
app.use(bodyParser.json());

app.post('/guardar', (req, res) => {
    console.log('Solicitud POST recibida');
    console.log('Datos recibidos:', req.body);

    const { nombre, edad } = req.body;
    
    if (!nombre || !edad) {
        console.log('Datos faltantes:', { nombre, edad });
        return res.status(400).send('Faltan datos');
    }

    // Guardar en Redis si el cliente está listo
    if (redisClient.connected) {
        redisClient.set(nombre, edad, (err, reply) => {
            if (err) {
                console.log('Error al guardar en Redis:', err);
                return res.status(500).send('Error al guardar en Redis');
            }
            console.log('Datos guardados en Redis:', reply);
            res.send('Datos guardados en Redis');
        });
    } else {
        console.log('Cliente Redis no está conectado');
        return res.status(500).send('Cliente Redis no está conectado');
    }
});

// Inicia el servidor
app.listen(3000, () => {
    console.log('Servidor escuchando en el puerto 3000');
});