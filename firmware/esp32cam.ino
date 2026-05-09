/*
  StaySync ESP32-CAM Firmware
  Board: AI Thinker ESP32-CAM
  Libraries required (install via Library Manager):
    - ArduinoJson by Benoit Blanchon (v6 or v7)

  QUICK START — edit the three lines below, flash, done.
  The portal can also send these via serial (JSON on one line) at runtime.
*/

// ─── EDIT THESE ───────────────────────────────────────────────────────────────
#define WIFI_SSID       "StarHub_4594"
#define WIFI_PASSWORD   "HAWerJNQ5h"
#define SERVER_URL      "https://lloyd-ethical-michael-locale.trycloudflare.com"
#define CAMERA_ID       "esp32-livingroom"   // fixed ID — must match portal
// ──────────────────────────────────────────────────────────────────────────────

#include "esp_camera.h"
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// AI-Thinker ESP32-CAM pin map
#define PWDN_GPIO_NUM   32
#define RESET_GPIO_NUM  -1
#define XCLK_GPIO_NUM    0
#define SIOD_GPIO_NUM   26
#define SIOC_GPIO_NUM   27
#define Y9_GPIO_NUM     35
#define Y8_GPIO_NUM     34
#define Y7_GPIO_NUM     39
#define Y6_GPIO_NUM     36
#define Y5_GPIO_NUM     21
#define Y4_GPIO_NUM     19
#define Y3_GPIO_NUM     18
#define Y2_GPIO_NUM      5
#define VSYNC_GPIO_NUM  25
#define HREF_GPIO_NUM   23
#define PCLK_GPIO_NUM   22

char ssid[64]       = WIFI_SSID;
char password[64]   = WIFI_PASSWORD;
char serverUrl[192] = SERVER_URL;
String cameraId     = CAMERA_ID;
bool wifiReady      = false;

// ─── Serial config ────────────────────────────────────────────────────────────
// Portal sends: {"ssid":"...","password":"...","server_url":"..."}\n
void readSerialConfig() {
  if (!Serial.available()) return;
  String json = Serial.readStringUntil('\n');
  json.trim();
  if (json.length() < 5) return;

  JsonDocument doc;
  if (deserializeJson(doc, json)) {
    Serial.println("Bad JSON — ignored");
    return;
  }
  if (doc["ssid"].as<String>().length())       strlcpy(ssid,      doc["ssid"]       | ssid,      sizeof(ssid));
  if (doc["password"].as<String>().length())   strlcpy(password,  doc["password"]   | password,  sizeof(password));
  if (doc["server_url"].as<String>().length()) strlcpy(serverUrl, doc["server_url"] | serverUrl, sizeof(serverUrl));
  Serial.println("Config updated — reconnecting WiFi...");
  wifiReady = false;
  WiFi.disconnect(true);
}

// ─── WiFi ─────────────────────────────────────────────────────────────────────
bool connectWiFi() {
  Serial.printf("Connecting to WiFi: %s\n", ssid);
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);
  for (int i = 0; i < 20; i++) {
    if (WiFi.status() == WL_CONNECTED) {
      Serial.println("WiFi connected. IP: " + WiFi.localIP().toString());
      return true;
    }
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi failed — check SSID/password");
  return false;
}

void registerCamera() {
  HTTPClient http;
  String url = String(serverUrl) + "/cameras/register";
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  String body = "{\"id\":\"" + cameraId + "\",\"name\":\"ESP32-CAM\",\"location\":\"room\"}";
  int code = http.POST(body);
  Serial.printf("Register camera: HTTP %d\n", code);
  http.end();
}

// ─── Camera init ──────────────────────────────────────────────────────────────
bool initCamera() {
  camera_config_t cfg;
  cfg.ledc_channel = LEDC_CHANNEL_0;
  cfg.ledc_timer   = LEDC_TIMER_0;
  cfg.pin_d0       = Y2_GPIO_NUM;
  cfg.pin_d1       = Y3_GPIO_NUM;
  cfg.pin_d2       = Y4_GPIO_NUM;
  cfg.pin_d3       = Y5_GPIO_NUM;
  cfg.pin_d4       = Y6_GPIO_NUM;
  cfg.pin_d5       = Y7_GPIO_NUM;
  cfg.pin_d6       = Y8_GPIO_NUM;
  cfg.pin_d7       = Y9_GPIO_NUM;
  cfg.pin_xclk     = XCLK_GPIO_NUM;
  cfg.pin_pclk     = PCLK_GPIO_NUM;
  cfg.pin_vsync    = VSYNC_GPIO_NUM;
  cfg.pin_href     = HREF_GPIO_NUM;
  cfg.pin_sccb_sda = SIOD_GPIO_NUM;
  cfg.pin_sccb_scl = SIOC_GPIO_NUM;
  cfg.pin_pwdn     = PWDN_GPIO_NUM;
  cfg.pin_reset    = RESET_GPIO_NUM;
  cfg.xclk_freq_hz = 20000000;
  cfg.pixel_format = PIXFORMAT_JPEG;

  if (psramFound()) {
    cfg.frame_size   = FRAMESIZE_VGA;  // 640x480
    cfg.jpeg_quality = 12;
    cfg.fb_count     = 2;
    Serial.println("PSRAM found — VGA mode");
  } else {
    cfg.frame_size   = FRAMESIZE_QVGA; // 320x240
    cfg.jpeg_quality = 15;
    cfg.fb_count     = 1;
    Serial.println("No PSRAM — QVGA mode");
  }

  esp_err_t err = esp_camera_init(&cfg);
  if (err != ESP_OK) {
    Serial.printf("Camera init failed: 0x%x\n", err);
    return false;
  }
  Serial.println("Camera ready");
  return true;
}

// ─── Upload ───────────────────────────────────────────────────────────────────
void uploadPhoto() {
  camera_fb_t* fb = esp_camera_fb_get();
  if (!fb) { Serial.println("Capture failed"); return; }

  HTTPClient http;
  String url = String(serverUrl) + "/upload/" + cameraId;
  http.begin(url);
  http.addHeader("Content-Type", "image/jpeg");
  http.setTimeout(10000);

  int code = http.POST(fb->buf, fb->len);
  if (code == 200) {
    Serial.printf("Upload OK (%d bytes)\n", fb->len);
  } else {
    Serial.printf("Upload failed: HTTP %d\n", code);
  }
  http.end();
  esp_camera_fb_return(fb);
}

// ─── Setup / Loop ─────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  Serial.println("\nStaySync ESP32-CAM starting...");

  // Wait up to 8s for serial config from the portal (optional)
  Serial.println("Waiting 8s for serial config... (or will use hardcoded defaults)");
  unsigned long deadline = millis() + 8000;
  while (millis() < deadline) {
    readSerialConfig();
    delay(100);
  }

  if (!initCamera()) {
    Serial.println("Camera init failed — halting");
    while (true) delay(1000);
  }

  if (connectWiFi()) {
    wifiReady = true;
    registerCamera();
  }
}

void loop() {
  readSerialConfig(); // accept live reconfiguration at any time

  if (!wifiReady || WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi lost — reconnecting...");
    wifiReady = connectWiFi();
    if (wifiReady) registerCamera();
    delay(5000);
    return;
  }

  uploadPhoto();
  delay(3000); // capture every 3 seconds
}
