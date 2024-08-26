import network
import urequests as requests
import time
from mfrc522 import MFRC522
from machine import Pin, SPI
import dht
import utime

# Configura la conexión Wi-Fi
wifi = network.WLAN(network.STA_IF)
wifi.active(True)
wifi.connect('INFINITUM02A0_2.4', 'Freiheit89')

# Espera hasta que se conecte
while not wifi.isconnected():
    time.sleep(1)

print('Conectado a Wi-Fi:', wifi.ifconfig())

# URL de la API de Node.js
url = 'http://192.168.1.99:5000/guardar_dato' #ip de la red a la que se conecto

# Configura el RFID
spi = SPI(2, baudrate=2500000, polarity=0, phase=0)
spi.init()
rdr = MFRC522(spi=spi, gpioRst=4, gpioCs=5)

# Define pines para los LEDs
led_verde = Pin(12, Pin.OUT)
led_rojo = Pin(13, Pin.OUT)

# Define pines para el sensor DHT11
dht_pin = Pin(21)
dht_sensor = dht.DHT11(dht_pin)

# Define pines para el sensor ultrasónico
pin_led = Pin(2, Pin.OUT)
pin_eco = Pin(15, Pin.IN)  # Cambié el pin de eco para no tener conflicto con los LEDs
pin_gatillo = Pin(4, Pin.OUT)  # Cambié el pin de gatillo para no tener conflicto con los LEDs

def read_ultrasonic_distance(trigger_pin, echo_pin):
    # Configuramos el pin de trigger como salida
    trigger_pin.init(Pin.OUT)
    # Aseguramos que el trigger esté en LOW
    trigger_pin.value(0)
    # Pausamos 2 microsegundos
    time.sleep_us(2)
    # Enviamos un pulso de 10 microsegundos en HIGH
    trigger_pin.value(1)
    time.sleep_us(10)
    trigger_pin.value(0)
    
    # Configuramos el pin de echo como entrada
    echo_pin.init(Pin.IN)
    
    # Medimos la duración del pulso en microsegundos
    while echo_pin.value() == 0:
        pass
    inicio = time.ticks_us()
    
    while echo_pin.value() == 1:
        pass
    fin = time.ticks_us()
    
    duracion = time.ticks_diff(fin, inicio)
    
    return duracion

def calcular_distancia():
    # Calculamos la distancia en cm
    duracion = read_ultrasonic_distance(pin_gatillo, pin_eco)
    distancia = (duracion * 0.01723)  # Ajuste basado en la velocidad del sonido
    return distancia

# Variables para almacenar el estado de la tarjeta
tarjeta_actual = None
timestamp_tarjeta_detectada = 0
estado_led = None
primer_chequeo = True  # Flag para determinar si es la primera detección

print("Place card")

while True:
    # Leer datos del sensor DHT11
    try:
        dht_sensor.measure()
        humidity = dht_sensor.humidity()
        temperature = dht_sensor.temperature()
    except OSError as e:
        print("Failed to read DHT sensor:", e)
        humidity = None
        temperature = None
    
    # Leer distancia
    distancia = calcular_distancia()

    # RFID Handling
    (stat, tag_type) = rdr.request(rdr.REQIDL)
    if stat == rdr.OK:
        (stat, raw_uid) = rdr.anticoll()
        if stat == rdr.OK:
            card_id = "uid:0x%02x%02x%02x%02x" % (raw_uid[0], raw_uid[1], raw_uid[2], raw_uid[3])
            current_time = utime.time()
            time_str = "{:02}:{:02}:{:02}".format(utime.localtime()[3], utime.localtime()[4], utime.localtime()[5])
            
            if tarjeta_actual == card_id:
                # Tarjeta ya detectada anteriormente
                estado = 'inactivo'
                tipo_hora = 'hora_salida'
                
                # Enviar datos al servidor Node.js
                data = {
                    'key': card_id,
                    'value': {
                        'estado': estado,
                        tipo_hora: time_str,
                        'distancia': distancia,
                        'temperatura': temperature,
                        'humedad': humidity
                    }
                }
                try:
                    response = requests.post(url, json=data)
                    print('Respuesta del servidor:', response.text)
                except Exception as e:
                    print('Error al enviar datos:', e)

                # Encender el LED rojo y apagar el verde
                print(f"Inactivo - {time_str} - {card_id} - Distancia: {distancia:.2f} cm - Temperatura: {temperature} C - Humedad: {humidity} %")
                led_verde.off()
                led_rojo.on()
                estado_led = "inactivo"

                tarjeta_actual = None  # Resetear tarjeta_actual para permitir detección de nuevas tarjetas
                utime.sleep(1)
                
            else:
                # Nueva tarjeta detectada
                tarjeta_actual = card_id
                timestamp_tarjeta_detectada = current_time

                if primer_chequeo:
                    estado = 'activo'
                    tipo_hora = 'hora_entrada'
                    primer_chequeo = False
                else:
                    estado = 'inactivo'
                    tipo_hora = 'hora_salida'

                # Enviar datos al servidor Node.js
                data = {
                    'key': card_id,
                    'value': {
                        'estado': estado,
                        tipo_hora: time_str,
                        'distancia': distancia,
                        'temperatura': temperature,
                        'humedad': humidity
                    }
                }
                try:
                    response = requests.post(url, json=data)
                    print('Respuesta del servidor:', response.text)
                except Exception as e:
                    print('Error al enviar datos:', e)

                # Encender el LED verde y apagar el rojo
                print(f"Activo - {time_str} - {card_id} - Distancia: {distancia:.2f} cm - Temperatura: {temperature} C - Humedad: {humidity} %")
                led_verde.on()
                led_rojo.off()
                estado_led = "activo"
                
            utime.sleep(1)

    time.sleep(2)  # Pausa de 2 segundos entre lecturas del sensor

