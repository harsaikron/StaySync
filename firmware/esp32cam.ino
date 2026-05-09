#include "esp_camera.h"
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// Camera model: AI-Thinker ESP32-CAM
#define PWDN_GPIO_NUM     32
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM      0
#define SIOD_GPIO_NUM     26
#define SIOC_GPIO_NUM     27
#define Y9_GPIO_NUM       35
#define Y8_GPIO_NUM       34
#define Y7_GPIO_NUM       39
#define Y6_GPIO_NUM       36
#define Y5_GPIO_NUM       21
#define Y4_GPIO_NUM       19
#define Y3_GPIO_NUM       18
#define Y2_GPIO_NUM        5
#define VSYNC_GPIO_NUM    25
#define HREF_GPIO_NUM     23
#define PCLK_GPIO_NUM     22

// Config — set via serial JSON before WiFi connect
char ssid[64] = "";
char password[64] = "";
char serverUrl[128] = "http://localhost:3001";
String cameraId = "";

void readSerialConfig() {
  if (Serial.available()) {
    String json = Serial.readStringUntil('\n');
    json.trim();
    DynamicJsonDocument doc(512);
    if (deserializeJson(doc, json) == DeserializationError::Ok) {
      strlcpy(ssid, doc["ssid"] | "", sizeof(ssid));
      strlcpy(password, doc["password"] | "", sizeof(password));
      strlcpy(serverUrl, doc["server_url"] | "http://localhost:3001", sizeof(serverUrl));
      Serial.println("Config received OK");
    }
  }
}

void connectWiFi() {
  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nConnected! IP: " + WiFi.localIP().toString());
    cameraId = "esp32-" + String((uint32_t)ESP.getEfuseMac(), HEX);
    // Register camera with backend
    HTTPClient http;
    String regUrl = String(serverUrl) + "/cameras/register";
    http.begin(regUrl);
    http.addHeader("Content-Type", "application/json");
    String body = "{\"id\":\"" + cameraId + "\",\"name\":\"ESP32-CAM\",\"location\":\"room\"}";
    http.POST(body);
    http.end();
  } else {
    Serial.println("\nWiFi failed — check credentials");
  }
}

void initCamera() {
  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = Y2_GPIO_NUM;
  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;
  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;
  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;
  config.pin_d7 = Y9_GPIO_NUM;
  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href = HREF_GPIO_NUM;
  config.pin_sccb_sda = SIOD_GPIO_NUM;
  config.pin_sccb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;
  config.frame_size = FRAMESIZE_VGA;
  config.jpeg_quality = 12;
  config.fb_count = 1;
  esp_camera_init(&config);
}

void uploadPhoto() {
  camera_fb_t* fb = esp_camera_fb_get();
  if (!fb) { Serial.println("Camera capture failed"); return; }

  HTTPClient http;
  String url = String(serverUrl) + "/upload/" + cameraId;
  http.begin(url);
  http.addHeader("Content-Type", "image/jpeg");
  int code = http.POST(fb->buf, fb->len);
  if (code != 200) Serial.println("Upload failed: " + String(code));
  http.end();
  esp_camera_fb_return(fb);
}

void setup() {
  Serial.begin(115200);
  Serial.println("StaySync ESP32-CAM starting...");

  // Wait up to 10s for serial config
  unsigned long start = millis();
  while (millis() - start < 10000) {
    readSerialConfig();
    if (strlen(ssid) > 0) break;
    delay(100);
  }

  initCamera();
  if (strlen(ssid) > 0) connectWiFi();
}

void loop() {
  if (WiFi.status() == WL_CONNECTED && cameraId.length() > 0) {
    uploadPhoto();
    delay(3000); // Upload every 3 seconds
  } else {
    readSerialConfig();
    if (strlen(ssid) > 0 && WiFi.status() != WL_CONNECTED) connectWiFi();
    delay(500);
  }
}
