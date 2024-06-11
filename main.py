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
from PyQt5.QtWidgets import (
    QApplication,
    QGraphicsView,
    QGraphicsScene,
    QGraphicsPixmapItem,
    QGraphicsTextItem,
    QGraphicsEllipseItem,
    QGraphicsLineItem,
    QGraphicsBlurEffect,
    QMainWindow
)
from PyQt5.QtGui import QPainter, QBrush, QColor, QFont, QPixmap, QPen
from PyQt5.QtCore import QThread, pyqtSignal, Qt, QTimer, QObject, pyqtSlot
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
    "pixel_size": 30,
    "window_width": 480,
    "window_height": 360,
    "font_size": 30,
    "blur_radius": 50,
    "narrow_ratio": 1,
    "use_blur": True,
    "thermal_camera_mode": "I2C",
    "center_index": 95,
    "font_family": "Microsoft YaHei",
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

class DataReader(QThread):
    drawRequire = pyqtSignal()

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
            self.drawRequire.emit()

class painter(QGraphicsView):
    narrowRatio = CONFIG["narrow_ratio"]
    useBlur = CONFIG["use_blur"]
    pixelSize = int(CONFIG["pixel_size"] / narrowRatio)
    width = int(CONFIG["window_width"] / narrowRatio)
    height = int(CONFIG["window_height"] / narrowRatio)
    fontSize = int(CONFIG["font_size"] / narrowRatio)
    anchorLineSize = int(100 / narrowRatio)
    ellipseRadius = int(8 / narrowRatio)
    textInterval = int(90 / narrowRatio)
    col = 16
    line = 12
    centerIndex = CONFIG["center_index"]
    frameCount = 0
    baseZValue = 0
    textLineHeight = fontSize + 10
    blurRadius = CONFIG["blur_radius"]

    def __init__(self):
        super(painter, self).__init__()
        self.setFixedSize(self.width, self.height + self.textLineHeight + 40)
        self.setHorizontalScrollBarPolicy(Qt.ScrollBarAlwaysOff)
        self.setVerticalScrollBarPolicy(Qt.ScrollBarAlwaysOff)
        self.scene = QGraphicsScene()
        self.setScene(self.scene)

        self.centerTextItem = QGraphicsTextItem()
        self.centerTextItem.setPos(self.width / 2 - self.fontSize, 0)
        self.centerTextItem.setZValue(self.baseZValue + 1)
        self.scene.addItem(self.centerTextItem)

        self.countdownTextItem = QGraphicsTextItem()
        self.countdownTextItem.setPos(10, self.height + self.textLineHeight)
        self.countdownTextItem.setZValue(self.baseZValue + 1)
        self.countdownTextItem.setFont(QFont(CONFIG["font_family"], 12))
        self.scene.addItem(self.countdownTextItem)

        centerX = self.width / 2
        centerY = self.height / 2
        self.ellipseItem = QGraphicsEllipseItem(
            0, 0, 
            self.ellipseRadius * 2, 
            self.ellipseRadius * 2
        )
        self.horLineItem = QGraphicsLineItem(0, 0, self.anchorLineSize, 0)
        self.verLineItem = QGraphicsLineItem(0, 0, 0, self.anchorLineSize)
        self.ellipseItem.setPos(
            centerX - self.ellipseRadius, 
            centerY - self.ellipseRadius
        )
        self.horLineItem.setPos(centerX - self.anchorLineSize / 2, centerY)
        self.verLineItem.setPos(centerX, centerY - self.anchorLineSize / 2)
        self.ellipseItem.setPen(QColor(Qt.white))
        self.horLineItem.setPen(QColor(Qt.white))
        self.verLineItem.setPen(QColor(Qt.white))
        self.ellipseItem.setZValue(self.baseZValue + 1)
        self.horLineItem.setZValue(self.baseZValue + 1)
        self.verLineItem.setZValue(self.baseZValue + 1)
        self.scene.addItem(self.ellipseItem)
        self.scene.addItem(self.horLineItem)
        self.scene.addItem(self.verLineItem)

        self.cameraBuffer = QPixmap(self.width, self.height + self.textLineHeight)
        self.cameraItem = QGraphicsPixmapItem()
        if self.useBlur:
            self.gusBlurEffect = QGraphicsBlurEffect()
            self.gusBlurEffect.setBlurRadius(self.blurRadius)
            self.cameraItem.setGraphicsEffect(self.gusBlurEffect)
        self.cameraItem.setPos(0, 0)
        self.cameraItem.setZValue(self.baseZValue)
        self.scene.addItem(self.cameraItem)

        self.hetTextBuffer = QPixmap(self.width, self.textLineHeight)
        self.hetTextItem = QGraphicsPixmapItem()
        self.hetTextItem.setPos(0, self.height)
        self.hetTextItem.setZValue(self.baseZValue)
        self.scene.addItem(self.hetTextItem)

        self.timer = QTimer()
        self.timer.timeout.connect(self.periodicCheck)
        self.timer.start(CONFIG["check_interval"] * 1000)

        self.countdownTimer = QTimer()
        self.countdownTimer.timeout.connect(self.updateCountdown)
        self.countdownTimeLeft = CONFIG["check_interval"]
        self.countdownTimer.start(1000)
        self.in_checking = False

    def updateCountdown(self):
        if self.in_checking:
            self.countdownTextItem.setPlainText("Checking Temperature...")
        else:
            self.countdownTimeLeft -= 1
            if self.countdownTimeLeft <= 0:
                self.countdownTimeLeft = CONFIG["check_interval"]
            self.countdownTextItem.setPlainText(f"Checking in {self.countdownTimeLeft} seconds")

    def periodicCheck(self):
        self.in_checking = True
        self.performCheck()

    def performCheck(self):
        frame = hetaData["frame"]
        high_temps = [temp for temp in frame if temp > CONFIG["temperature_threshold"]]
        if high_temps:
            bin_notification.send_notification('notify')
            log_to_db("fever_log")
            activate_buzzer(CONFIG["buzzer_duration"])
        log_to_db("monitor_log")
        self.in_checking = False

    def draw(self):
        if not hetaData["frame"]:
            return
        font = QFont()
        color = QColor()
        font.setPointSize(self.fontSize)
        font.setFamily(CONFIG["font_family"])
        font.setBold(True)
        font.setLetterSpacing(QFont.AbsoluteSpacing, 0)
        index = 0
        lock.acquire()
        frame = hetaData["frame"]
        maxHet = hetaData["maxHet"]
        minHet = hetaData["minHet"]
        lock.release()
        avgTemp = sum(frame) / len(frame)
        p = QPainter(self.cameraBuffer)
        p.fillRect(
            0, 0, self.width, 
            self.height + self.textLineHeight, 
            QBrush(QColor(Qt.black))
        )

        color = QColor()
        highTempIndices = [i for i, temp in enumerate(frame) if temp > CONFIG["temperature_threshold"]]
        highTempChicks = []

        for yIndex in range(int(self.height / self.pixelSize)):
            for xIndex in range(int(self.width / self.pixelSize)):
                if index >= len(frame):
                    break
                tempData = constrain(mapValue(frame[index], minHet, maxHet, minHue, maxHue), minHue, maxHue)
                color.setHsvF(tempData / 360, 1.0, 1.0)
                p.fillRect(
                    xIndex * self.pixelSize,
                    yIndex * self.pixelSize,
                    self.pixelSize, self.pixelSize,
                    QBrush(color)
                )
                if index in highTempIndices:
                    highTempChicks.append((xIndex, yIndex, frame[index]))
                index = index + 1
            if index >= len(frame):
                break
        self.cameraItem.setPixmap(self.cameraBuffer)

        pen = QPen(QColor(Qt.red))
        pen.setWidth(3)
        p.setPen(pen)
        for xIndex, yIndex, temp in highTempChicks:
            p.drawRect(
                xIndex * self.pixelSize,
                yIndex * self.pixelSize,
                self.pixelSize, self.pixelSize
            )
            p.drawText(
                xIndex * self.pixelSize,
                yIndex * self.pixelSize - self.fontSize,
                f"{temp:.1f}°C"
            )

        p = QPainter(self.hetTextBuffer)
        p.fillRect(
            0, 0, self.width, 
            self.height + self.textLineHeight, 
            QBrush(QColor(Qt.black))
        )
        hetDiff = maxHet - minHet
        bastNum = round(minHet)
        interval = round(hetDiff / 5)
        for i in range(5):
            hue = constrain(mapValue((bastNum + (i * interval)), minHet, maxHet, minHue, maxHue), minHue, maxHue)
            color.setHsvF(hue / 360, 1.0, 1.0)
            p.setPen(color)
            p.setFont(font)
            p.drawText(i * self.textInterval, self.fontSize + 3, str(bastNum + (i * interval)) + "°")
        self.hetTextItem.setPixmap(self.hetTextBuffer)

        centerTemp = round(frame[self.centerIndex], 1)
        centerText = "<font color=white>%s</font><br/><font color=yellow>Avg: %s</font>"
        self.centerTextItem.setFont(font)
        self.centerTextItem.setHtml(centerText % (str(centerTemp) + "°", str(round(avgTemp, 1)) + "°"))
        self.frameCount = self.frameCount + 1

@flask_app.route('/thermal_data')
def thermal_data():
    lock.acquire()
    data = hetaData.copy()
    lock.release()
    return jsonify(data)

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

def run():
    global minHue
    global maxHue
    global bin_notification
    global buzzer_pin

    bin_notification = BinNotificationSystem()
    buzzer_pin = setup_buzzer()

    bin_notification.send_notification('start')

    threading.Timer(0, initial_buzz).start()

    if len(sys.argv) >= 2 and sys.argv[1] == "-h":
        print("Usage: %s [PortName] [minHue] [maxHue] [NarrowRatio] [UseBlur]" % sys.argv[0])
        exit(0)
    if len(sys.argv) >= 4:
        CONFIG["min_hue"] = int(sys.argv[2])
        CONFIG["max_hue"] = int(sys.argv[3])
    if len(sys.argv) >= 2:
        port = sys.argv[1]
    else:
        port = None
    qt_app = QApplication(sys.argv)
    # window = painter()
    # dataThread = DataReader(port)
    # dataThread.drawRequire.connect(window.draw)
    # dataThread.start()
    # window.show()

    flask_thread = threading.Thread(target=lambda: flask_app.run(host="0.0.0.0", port=5000))
    flask_thread.daemon = True
    flask_thread.start()

    # qt_app.exec_()

    bin_notification.close()
    cleanup()

run()