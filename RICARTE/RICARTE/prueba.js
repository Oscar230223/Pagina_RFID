const express = require('express');
const redis = require('@redis/client');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const port = 5000;

// Configura el cliente de Redis
const redisClient = redis.createClient({
  url: 'redis://127.0.0.1:6379'
});

redisClient.on('error', (err) => {
  console.error('Error de Redis:', err);
});

redisClient.connect();
app.use(cors());
app.use(bodyParser.json());

// Endpoint para guardar datos en Redis
app.post('/guardar_dato', async (req, res) => {
  const { key, value } = req.body;

  try {
    const existingData = await redisClient.get(key);
    let updatedValue;

    if (existingData) {
      const parsedData = JSON.parse(existingData);
      updatedValue = { ...parsedData, ...value };
    } else {
      updatedValue = value;
    }

    await redisClient.set(key, JSON.stringify(updatedValue));
    console.log(`Dato guardado en Redis: ${key} = ${JSON.stringify(updatedValue)}`);
    res.send('Dato guardado en Redis');
  } catch (err) {
    console.error('Error al guardar en Redis:', err);
    res.status(500).send('Error al guardar en Redis');
  }
});

// Endpoint para obtener los datos de una tarjeta específica
app.get('/obtener_datos_tarjeta/:uid', async (req, res) => {
    const id = req.params.uid;
    const pet = `uid:${id}`; // Añade el prefijo 'uid:' si es necesario

    try {
        const data = await redisClient.get(pet);
        
        if (data) {
            const parsedData = JSON.parse(data);
            res.json({
                estado: parsedData.estado || 'No disponible',
                hora_entrada: parsedData.hora_entrada || 'No disponible',
                hora_salida: parsedData.hora_salida || 'No disponible',
                distancia: parsedData.distancia || 'No disponible',
                temperatura: parsedData.temperatura || 'No disponible',
                humedad: parsedData.humedad || 'No disponible'
            });
        } else {
            res.json({
                estado: 'No disponible',
                hora_entrada: 'No disponible',
                hora_salida: 'No disponible',
                distancia: 'No disponible',
                temperatura: 'No disponible',
                humedad: 'No disponible'
            });
        }
    } catch (err) {
        console.error('Error al obtener los datos de Redis:', err);
        res.status(500).json({
            estado: 'Error',
            hora_entrada: 'No disponible',
            hora_salida: 'No disponible',
            distancia: 'No disponible',
            temperatura: 'No disponible',
            humedad: 'No disponible'
        });
    }
});

app.listen(port, () => {
  console.log(`Servidor escuchando en http://localhost:${port}`);
});
