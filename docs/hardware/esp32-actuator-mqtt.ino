/**
 * ESP32 — subscribe perintah aktuator & publish telemetry balik
 *
 * Library: PubSubClient, ArduinoJson
 * Broker:  MQTT_BROKER (port 1883) — sesuaikan IP broker di jaringan lokal
 *
 * node_code & screenhouse_id HARUS sama dengan tabel sensor_nodes di DB.
 * Contoh seed: screenhouse_id=1, node_code=SH01-N01
 */

#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

// ─── Konfigurasi jaringan & identitas node ───
const char* WIFI_SSID     = "YOUR_WIFI";
const char* WIFI_PASSWORD = "YOUR_PASSWORD";
const char* MQTT_BROKER   = "192.168.1.100";  // IP Mosquitto / server dev

const char* SCREENHOUSE_ID = "1";
const char* NODE_CODE      = "SH01-N01";

// ─── Pin relay (LOW/HIGH sesuaikan wiring relay module) ───
const int PIN_FAN        = 26;
const int PIN_IRRIGATION = 27;
const int PIN_LAMP       = 14;

WiFiClient wifiClient;
PubSubClient mqtt(wifiClient);

char topicCmd[96];
char topicSensor[96];

bool fanOn = false;
bool irrigationOn = false;
bool lampOn = false;

unsigned long lastTelemetryMs = 0;
const unsigned long TELEMETRY_INTERVAL_MS = 60000;

void applyRelays() {
  digitalWrite(PIN_FAN, fanOn ? HIGH : LOW);
  digitalWrite(PIN_IRRIGATION, irrigationOn ? HIGH : LOW);
  digitalWrite(PIN_LAMP, lampOn ? HIGH : LOW);
}

void buildTopics() {
  snprintf(topicCmd, sizeof(topicCmd),
           "screenhouse/%s/node/%s/command", SCREENHOUSE_ID, NODE_CODE);
  snprintf(topicSensor, sizeof(topicSensor),
           "screenhouse/%s/node/%s/sensor", SCREENHOUSE_ID, NODE_CODE);
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  StaticJsonDocument<256> doc;
  DeserializationError err = deserializeJson(doc, payload, length);
  if (err) {
    Serial.println("[mqtt] JSON command invalid");
    return;
  }

  if (!doc["fan_status"].isNull())        fanOn = doc["fan_status"];
  if (!doc["irrigation_status"].isNull()) irrigationOn = doc["irrigation_status"];
  if (!doc["lamp_status"].isNull())       lampOn = doc["lamp_status"];

  applyRelays();
  publishTelemetry();  // konfirmasi status ke server segera

  Serial.printf("[mqtt] command applied fan=%d irr=%d lamp=%d source=%s\n",
                fanOn, irrigationOn, lampOn,
                doc["source"] | "unknown");
}

void connectMqtt() {
  while (!mqtt.connected()) {
    Serial.print("[mqtt] connecting...");
    String clientId = String("esp32-") + NODE_CODE;
    if (mqtt.connect(clientId.c_str())) {
      Serial.println(" OK");
      mqtt.subscribe(topicCmd);
      Serial.print("[mqtt] subscribed: ");
      Serial.println(topicCmd);
    } else {
      Serial.printf(" fail rc=%d\n", mqtt.state());
      delay(3000);
    }
  }
}

void publishTelemetry() {
  StaticJsonDocument<512> doc;
  doc["node_code"] = NODE_CODE;

  // TODO: baca sensor RS485/NPK & lingkungan di sini
  doc["nitrogen"] = 24;
  doc["phosphorus"] = 15;
  doc["potassium"] = 18;
  doc["soil_moisture"] = 68;
  doc["soil_temperature"] = 26.5;
  doc["soil_ph"] = 6.2;
  doc["air_temperature"] = 28;
  doc["air_humidity"] = 65;
  doc["light_intensity"] = 12000;

  doc["fan_status"] = fanOn;
  doc["irrigation_status"] = irrigationOn;
  doc["lamp_status"] = lampOn;

  char buffer[512];
  size_t len = serializeJson(doc, buffer, sizeof(buffer));
  mqtt.publish(topicSensor, buffer, len);
  Serial.println("[mqtt] telemetry published");
}

void setup() {
  Serial.begin(115200);
  pinMode(PIN_FAN, OUTPUT);
  pinMode(PIN_IRRIGATION, OUTPUT);
  pinMode(PIN_LAMP, OUTPUT);
  applyRelays();

  buildTopics();

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\n[wifi] connected");

  mqtt.setServer(MQTT_BROKER, 1883);
  mqtt.setCallback(mqttCallback);
  connectMqtt();
  publishTelemetry();
}

void loop() {
  if (!mqtt.connected()) connectMqtt();
  mqtt.loop();

  if (millis() - lastTelemetryMs >= TELEMETRY_INTERVAL_MS) {
    lastTelemetryMs = millis();
    publishTelemetry();
  }
}
