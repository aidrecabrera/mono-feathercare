import os
import sys
import threading
import time
import requests
import seeed_mlx9064x
from serial import Serial
from flask import Flask, jsonify
from flask_cors import CORS
from sqlalchemy import create_engine, Column, Integer, Float, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import serial
import RPi.GPIO as GPIO
from supabase import create_client
from datetime import datetime
from requests.exceptions import ConnectionError
import logging

CONFIG = {
    "serial_port": "/dev/ttyUSB0",
    "baud_rate": 9600,
    "buzzer_pin": 23,
    "temperature_threshold": 40.6,
    "check_interval": 30,
    "buzzer_frequency": 2000,
    "buzzer_duration": 2.5,
    "min_hue": 180,
    "max_hue": 360,
    "thermal_camera_mode": "I2C",
    "center_index": 95,
}

SUPABASE_URL = "https://ofwutctiuezihlprbwqs.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9md3V0Y3RpdWV6aWhscHJid3FzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTgwOTIwODUsImV4cCI6MjAzMzY2ODA4NX0.RMO9URsAmSRpVd7RPWFmpdz6wmfHM1i_qQohCNfSyoc"
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

DATABASE_URL = "sqlite:///thermal_data.db"

Base = declarative_base()
engine = create_engine(DATABASE_URL)
Session = sessionmaker(bind=engine)
session = Session()

hetaData = {"frame": [], "maxHet": 0, "minHet": 0}
lock = threading.Lock()
minHue = CONFIG["min_hue"]
maxHue = CONFIG["max_hue"]

flask_app = Flask(__name__)
CORS(flask_app)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class FeverLog(Base):
    __tablename__ = "fever_log"
    id = Column(Integer, primary_key=True, autoincrement=True)
    detected_at = Column(DateTime, default=datetime.utcnow)
    min_temperature = Column(Float)
    max_temperature = Column(Float)
    avg_temperature = Column(Float)

class MonitorLog(Base):
    __tablename__ = "monitor_log"
    id = Column(Integer, primary_key=True, autoincrement=True)
    logged_at = Column(DateTime, default=datetime.utcnow)
    min_temperature = Column(Float)
    max_temperature = Column(Float)
    avg_temperature = Column(Float)

Base.metadata.create_all(engine)

class BinNotificationSystem:
    def __init__(self, port=CONFIG["serial_port"], baud_rate=CONFIG["baud_rate"]):
        self.serial_connection = serial.Serial(port, baud_rate, timeout=1)
        time.sleep(2)
        
    def send_notification(self, action):
        commands = {
            'start': 's',
            'notify': 'n',
        }
        if action in commands:
            self.serial_connection.write(commands[action].encode())
            
    def close(self):
        self.serial_connection.close()

def setup_buzzer(buzzer_pin=CONFIG["buzzer_pin"]):
    GPIO.setwarnings(False)
    GPIO.setmode(GPIO.BCM)
    GPIO.setup(buzzer_pin, GPIO.OUT)
    return buzzer_pin

def cleanup():
    GPIO.cleanup()

def mapValue(value, curMin, curMax, desMin, desMax):
    if curMin == curMax:
        return (desMax + desMin) / 2
    return desMin + (desMax - desMin) * (value - curMin) / (curMax - curMin)

def constrain(value, down, up):
    value = up if value > up else value
    value = down if value < down else value
    return value        

def isDigital(value):
    try:
        if value == "nan":
            return False
        else:
            float(value)
        return True
    except ValueError:
        return False

class DataReader(threading.Thread):
    I2C = 0,
    SERIAL = 1
    MODE = I2C if CONFIG["thermal_camera_mode"] == "I2C" else SERIAL

    def __init__(self, port):
        super(DataReader, self).__init__()
        self.frameCount = 0
        self.frame = [0] * 192
        if port is None:
            self.dataHandle = seeed_mlx9064x.grove_mxl90641()
            self.dataHandle.refresh_rate = seeed_mlx9064x.RefreshRate.REFRESH_8_HZ
            self.readData = self.i2cRead
        else:
            self.MODE = DataReader.SERIAL
            self.port = port
            self.dataHandle = Serial(self.port, 2000000, timeout=5)
            self.readData = self.serialRead

    def i2cRead(self):
        self.dataHandle.getFrame(self.frame)
        return self.frame

    def serialRead(self):
        hetData = self.dataHandle.read_until(terminator=b'\r\n')
        hetData = str(hetData, encoding="utf8").split(",")
        hetData = hetData[:-1]
        return hetData

    def run(self):
        while True:
            maxHet = 0
            minHet = 500
            tempData = []
            hetData = self.readData()

            if len(hetData) < 192:
                continue

            for i in range(0, 192):
                curCol = i % 32
                curData = None

                if i < len(hetData) and isDigital(hetData[i]):
                    curData = float(hetData[i])
                else:
                    interpolationPointCount = 0
                    sumValue = 0

                    abovePointIndex = i - 32
                    if abovePointIndex > 0 and hetData[abovePointIndex] != "nan":
                        interpolationPointCount += 1
                        sumValue += float(hetData[abovePointIndex])

                    belowPointIndex = i + 32
                    if belowPointIndex < 192 and hetData[belowPointIndex] != "nan":
                        interpolationPointCount += 1
                        sumValue += float(hetData[belowPointIndex])

                    leftPointIndex = i - 1
                    if curCol != 31 and hetData[leftPointIndex] != "nan":
                        interpolationPointCount += 1
                        sumValue += float(hetData[leftPointIndex])

                    rightPointIndex = i + 1
                    if belowPointIndex < 192 and curCol != 0 and hetData[rightPointIndex] != "nan":
                        interpolationPointCount += 1
                        sumValue += float(hetData[rightPointIndex])

                    curData = sumValue / interpolationPointCount if interpolationPointCount else 0

                tempData.append(curData)
                maxHet = max(curData, maxHet)
                minHet = min(curData, minHet)

            if maxHet == 0 or minHet == 500:
                continue

            lock.acquire()
            hetaData["frame"] = tempData
            hetaData["maxHet"] = maxHet
            hetaData["minHet"] = minHet
            lock.release()

def log_to_db(table_name):
    if table_name == "fever_log":
        new_log = FeverLog(
            min_temperature=hetaData["minHet"],
            max_temperature=hetaData["maxHet"],
            avg_temperature=sum(hetaData["frame"]) / len(hetaData["frame"])
        )
    else:
        new_log = MonitorLog(
            min_temperature=hetaData["minHet"],
            max_temperature=hetaData["maxHet"],
            avg_temperature=sum(hetaData["frame"]) / len(hetaData["frame"])
        )
    session.add(new_log)
    session.commit()
    threading.Thread(target=sync_to_supabase, args=(table_name,)).start()

def sync_to_supabase(table_name, retry_attempts=3):
    for attempt in range(retry_attempts):
        try:
            response = requests.get("http://www.google.com")
            response.raise_for_status()
            
            if table_name == "fever_log":
                logs = session.query(FeverLog).all()
                data = [{
                    "id": log.id,
                    "detected_at": log.detected_at.isoformat(),
                    "min_temperature": log.min_temperature,
                    "max_temperature": log.max_temperature,
                    "avg_temperature": log.avg_temperature
                } for log in logs]
                supabase.table("fever_log").upsert(data, ignore_duplicates=True).execute()
            else:
                logs = session.query(MonitorLog).all()
                data = [{
                    "id": log.id,
                    "logged_at": log.logged_at.isoformat(),
                    "min_temperature": log.min_temperature,
                    "max_temperature": log.max_temperature,
                    "avg_temperature": log.avg_temperature
                } for log in logs]
                supabase.table("monitor_log").upsert(data, ignore_duplicates=True).execute()
            logger.info(f"Synced {table_name} data successfully.")
            return

        except ConnectionError as e:
            logger.warning(f"ConnectionError on attempt {attempt + 1}: {e}. Retrying...")
            time.sleep(5)

        except Exception as e:
            logger.error(f"Unexpected error on attempt {attempt + 1}: {e}. Aborting sync.")
            break

    logger.error(f"Failed to sync {table_name} data after {retry_attempts} attempts.")

def initial_buzz():
    activate_buzzer(2)

def activate_buzzer(duration):
    GPIO.output(buzzer_pin, GPIO.HIGH)
    time.sleep(duration)
    GPIO.output(buzzer_pin, GPIO.LOW)

@flask_app.route('/thermal_data')
def thermal_data():
    lock.acquire()
    data = hetaData.copy()
    lock.release()
    return jsonify(data)

def periodic_check():
    while True:
        time.sleep(CONFIG["check_interval"])
        frame = hetaData["frame"]
        high_temps = [temp for temp in frame if temp > CONFIG["temperature_threshold"]]
        if high_temps:
            log_to_db("fever_log")
            bin_notification.send_notification('notify')
            activate_buzzer(CONFIG["buzzer_duration"])
        log_to_db("monitor_log")

def run():
    global minHue
    global maxHue
    global bin_notification
    global buzzer_pin

    bin_notification = BinNotificationSystem()
    buzzer_pin = setup_buzzer()

    bin_notification.send_notification('start')

    threading.Thread(target=initial_buzz).start()

    if len(sys.argv) >= 2 and sys.argv[1] == "-h":
        print("Usage: %s [PortName] [minHue] [maxHue]" % sys.argv[0])
        exit(0)
    if len(sys.argv) >= 4:
        CONFIG["min_hue"] = int(sys.argv[2])
        CONFIG["max_hue"] = int(sys.argv[3])
    if len(sys.argv) >= 2:
        port = sys.argv[1]
    else:
        port = None

    data_thread = DataReader(port)
    data_thread.start()

    flask_thread = threading.Thread(target=lambda: flask_app.run(host="0.0.0.0", port=5000))
    flask_thread.daemon = True
    flask_thread.start()

    periodic_check_thread = threading.Thread(target=periodic_check)
    periodic_check_thread.start()

    data_thread.join()
    flask_thread.join()
    periodic_check_thread.join()

    bin_notification.close()
    cleanup()

run()
