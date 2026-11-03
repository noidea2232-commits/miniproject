/*
 * TAPORAA BIOMETRIC TRANSIT PLATFORM
 * ESP32 + AS608 Optical Fingerprint Gate Controller Firmware
 * Version: 2.1 — Updated: 03-November-2026 (Live Release)
 *
 * Features:
 * 1. AS608 Optical Fingerprint reading and hardware search.
 * 2. Authenticated HTTP POST to /api/device/check-in and /api/device/check-out.
 * 3. DISTINCT Hardware Buzzer Sounds using tone() (PWM frequency control):
 *    - AUTHORIZED:   Rising 2-tone chime (880Hz → 1760Hz) — pleasant, clearly different
 *    - UNAUTHORIZED: 5 fast sharp alarm beeps (2000Hz) — loud & alarming
 *    - ERROR:        Low descending tone (400Hz) — indicates problem
 *    - CONFIRM:      Double short beep (1200Hz) — indicates name confirmed, proceeding
 * 4. CHECK-IN CONFIRMATION WORKFLOW:
 *    - Scan finger → lookup passenger name from backend
 *    - Display name on Serial Monitor, wait 3 seconds
 *    - Then commit check-in/check-out
 *    - Prevents accidental check-in; shows real name before committing
 * 5. Multi-Person Biometric Enrollment directly on AS608 hardware:
 *    - Type 'ENROLL 6', 'ENROLL 7' etc. in Serial Monitor (115200 baud).
 *    - Dual-placement enrollment with template generation stored in AS608 flash.
 *    - Notifies Taporaa Backend so dashboard updates live.
 * 6. Unknown Fingerprint detection — distinct alarm and backend report.
 * 7. Periodic heartbeat reporting to /api/hardware/heartbeat.
 * 8. SAFE_TEST_MODE relay protection interlock.
 *
 * BUZZER WIRING: BUZZER_PIN (GPIO 25) must be connected to a PWM-capable pin.
 * Use a passive buzzer (not active) for tone() frequency control.
 * If you only have an active buzzer, tone() will still work but at fixed frequency.
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Adafruit_Fingerprint.h>
#include "firmware_config.h"

// Hardware Serial 2 for AS608
HardwareSerial mySerial(2);
Adafruit_Fingerprint finger = Adafruit_Fingerprint(&mySerial);

unsigned long lastHeartbeatTime = 0;
const unsigned long HEARTBEAT_INTERVAL_MS = 25000;

// Deduplication: prevent multiple requests for a single finger placement
int lastScannedFingerId = -1;
unsigned long lastScanTime = 0;
const unsigned long DEBOUNCE_MS = 4000; // 4s debounce to cover confirmation window

// Forward declarations
void soundBeep(int durationMs);
void soundTone(int frequency, int durationMs);
void soundUnknownAlarm();
void soundSuccessChime();
void soundErrorChime();
void soundConfirmBeep();
bool enrollFingerprint(uint8_t id);
void checkSerialCommands();
void processTransitScan(int fingerId, int confidence);
void reportUnknownFingerprint();
void sendHeartbeat();
void notifyBackendEnrollment(int slot);
void openGateActuator();
void connectToWiFi();

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println(F("\n========================================================"));
  Serial.println(F("   TAPORAA TRANSIT GATE — ESP32 HARDWARE CONTROLLER    "));
  Serial.println(F("   Firmware v2.1 — Confirmation + Distinct Buzzer Tones "));
  Serial.println(F("========================================================"));

  // Initialize GPIOs
  pinMode(RELAY_PIN, OUTPUT);
  pinMode(LED_STATUS_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);

  if (RELAY_ACTIVE_LOW) {
    digitalWrite(RELAY_PIN, HIGH); // De-energize relay (gate locked)
  } else {
    digitalWrite(RELAY_PIN, LOW);
  }
  digitalWrite(LED_STATUS_PIN, LOW);

  // Initialize AS608 Sensor
  mySerial.begin(AS608_BAUD_RATE, SERIAL_8N1, AS608_RX_PIN, AS608_TX_PIN);
  finger.begin(AS608_BAUD_RATE);

  if (finger.verifyPassword()) {
    Serial.println(F("[AS608] Optical Fingerprint Sensor detected successfully."));
    finger.getParameters();
    Serial.print(F("[AS608] Sensor Capacity: "));
    Serial.println(finger.capacity);
    Serial.print(F("[AS608] Security Level: "));
    Serial.println(finger.security_level);
    finger.getTemplateCount();
    Serial.print(F("[AS608] Currently Enrolled Fingerprints: "));
    Serial.println(finger.templateCount);

    // Startup chime
    soundSuccessChime();
  } else {
    Serial.println(F("[AS608] ERROR: Could not communicate with AS608 sensor!"));
    Serial.println(F("[AS608] Check wiring: AS608 TX->GPIO16, RX->GPIO17, 3.3V/5V & GND."));
    soundErrorChime();
  }

  Serial.println(F(""));
  Serial.println(F("[INFO] ENROLLMENT: Type 'ENROLL <slot>' (e.g. ENROLL 6) in Serial Monitor."));
  Serial.println(F("[INFO] BUZZER TONES: Authorized=Rising chime, Unauthorized=5-beep alarm, Error=Low tone"));
  Serial.println(F("[INFO] WORKFLOW: Scan -> Lookup Name -> 3s Confirmation Window -> Check-In/Out"));
  Serial.println(F("========================================================\n"));

  // Connect to Wi-Fi
  connectToWiFi();
}

void loop() {
  // 1. Maintain Wi-Fi Connection
  if (WiFi.status() != WL_CONNECTED) {
    connectToWiFi();
    return;
  }

  // 2. Check for Serial Enrollment Commands (e.g. typing 'ENROLL 6' or '6')
  checkSerialCommands();

  // 3. Periodic Heartbeat
  if (millis() - lastHeartbeatTime > HEARTBEAT_INTERVAL_MS) {
    sendHeartbeat();
    lastHeartbeatTime = millis();
  }

  // 4. Scan for Fingerprint
  readFingerprint();

  delay(50);
}

// ----------------------------------------------------------------------------
// Sound & Buzzer Routines — DISTINCT TONES for each event type
// ----------------------------------------------------------------------------

// Play a tone at specific frequency using PWM (passive buzzer required for true pitch)
void soundTone(int frequency, int durationMs) {
  if (!BUZZER_ENABLED) return;
  tone(BUZZER_PIN, frequency, durationMs);
  delay(durationMs + 10);
  noTone(BUZZER_PIN);
}

// Simple digital beep (works with both active and passive buzzers)
void soundBeep(int durationMs) {
  if (!BUZZER_ENABLED) return;
  digitalWrite(BUZZER_PIN, HIGH);
  delay(durationMs);
  digitalWrite(BUZZER_PIN, LOW);
}

// AUTHORIZED ACCESS — Pleasant rising 2-tone chime
// Low note then high note: clearly pleasant and welcoming
void soundSuccessChime() {
  Serial.println(F("[BUZZER] SUCCESS CHIME (authorized — rising 2-tone)"));
  if (!BUZZER_ENABLED) return;
  // Low note: 880 Hz (A5) for 200ms
  tone(BUZZER_PIN, 880, 200);
  delay(250);
  // High note: 1760 Hz (A6) for 300ms
  tone(BUZZER_PIN, 1760, 300);
  delay(350);
  noTone(BUZZER_PIN);
}

// UNAUTHORIZED / UNKNOWN FINGERPRINT — Loud 5-beep rapid alarm
// Very clearly different from success chime — alarming and urgent
void soundUnknownAlarm() {
  Serial.println(F("[BUZZER] ALARM! UNAUTHORIZED FINGERPRINT — 5 rapid beeps"));
  if (!BUZZER_ENABLED) return;
  digitalWrite(LED_STATUS_PIN, HIGH);
  for (int i = 0; i < 5; i++) {
    tone(BUZZER_PIN, 2000, 100); // 2000Hz = sharp, piercing alarm tone
    delay(150);
  }
  noTone(BUZZER_PIN);
  digitalWrite(LED_STATUS_PIN, LOW);
}

// ERROR / REJECTION — Single low descending tone
// Low and dull — indicates a problem without being as alarming as unknown
void soundErrorChime() {
  Serial.println(F("[BUZZER] ERROR TONE (rejection/problem)"));
  if (!BUZZER_ENABLED) return;
  tone(BUZZER_PIN, 400, 500); // 400Hz low tone for 500ms
  delay(550);
  noTone(BUZZER_PIN);
}

// CONFIRMATION WINDOW — Double short beep (name shown, proceeding in 3s)
void soundConfirmBeep() {
  if (!BUZZER_ENABLED) return;
  tone(BUZZER_PIN, 1200, 80);
  delay(120);
  tone(BUZZER_PIN, 1200, 80);
  delay(100);
  noTone(BUZZER_PIN);
}

// ----------------------------------------------------------------------------
// Wi-Fi Connection
// ----------------------------------------------------------------------------
void connectToWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;

  Serial.print(F("[WiFi] Connecting to: "));
  Serial.println(WIFI_SSID);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(F("."));
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println(F("\n[WiFi] Connected successfully!"));
    Serial.print(F("[WiFi] Terminal IP Address: "));
    Serial.println(WiFi.localIP());
    soundSuccessChime();
    sendHeartbeat();
  } else {
    Serial.println(F("\n[WiFi] Connection timeout. Retrying in next loop..."));
  }
}

// ----------------------------------------------------------------------------
// Real AS608 Hardware Fingerprint Enrollment
// ----------------------------------------------------------------------------
bool enrollFingerprint(uint8_t id) {
  if (id < 1 || id > AS608_MAX_CAPACITY) {
    Serial.println(F("[ENROLL] Error: ID must be between 1 and 120."));
    soundErrorChime();
    return false;
  }

  Serial.println(F("\n========================================================"));
  Serial.print(F(">>> STARTING AS608 HARDWARE ENROLLMENT FOR SLOT #"));
  Serial.print(id);
  Serial.println(F(" <<<"));
  Serial.println(F("========================================================"));

  int p = -1;
  Serial.println(F("[ENROLL] Step 1: Place passenger finger firmly on the optical sensor..."));
  soundConfirmBeep();

  // Wait for finger placement (timeout 30 seconds)
  unsigned long start = millis();
  while (p != FINGERPRINT_OK) {
    p = finger.getImage();
    if (p == FINGERPRINT_OK) {
      Serial.println(F("[ENROLL] Image 1 captured successfully!"));
      soundBeep(100);
      break;
    }
    if (millis() - start > 30000) {
      Serial.println(F("[ENROLL] Timed out waiting for finger. Enrollment cancelled."));
      soundErrorChime();
      return false;
    }
    delay(100);
  }

  // Convert image 1 to characteristics
  p = finger.image2Tz(1);
  if (p != FINGERPRINT_OK) {
    Serial.println(F("[ENROLL] Image 1 conversion failed. Sensor error or messy scan."));
    soundErrorChime();
    return false;
  }

  Serial.println(F("[ENROLL] Remove finger from the sensor now..."));
  delay(1500);
  p = 0;
  while (p != FINGERPRINT_NOFINGER) {
    p = finger.getImage();
    delay(100);
  }

  Serial.println(F("\n[ENROLL] Step 2: Place the SAME finger on sensor again to verify..."));
  soundConfirmBeep();
  p = -1;
  start = millis();
  while (p != FINGERPRINT_OK) {
    p = finger.getImage();
    if (p == FINGERPRINT_OK) {
      Serial.println(F("[ENROLL] Image 2 captured successfully!"));
      soundBeep(100);
      break;
    }
    if (millis() - start > 30000) {
      Serial.println(F("[ENROLL] Timed out waiting for second placement. Enrollment cancelled."));
      soundErrorChime();
      return false;
    }
    delay(100);
  }

  // Convert image 2 to characteristics
  p = finger.image2Tz(2);
  if (p != FINGERPRINT_OK) {
    Serial.println(F("[ENROLL] Image 2 conversion failed."));
    soundErrorChime();
    return false;
  }

  // Compare both characteristics and create unified model
  Serial.println(F("[ENROLL] Comparing prints and creating template model..."));
  p = finger.createModel();
  if (p != FINGERPRINT_OK) {
    if (p == FINGERPRINT_ENROLLMISMATCH) {
      Serial.println(F("[ENROLL] ERROR: Fingerprints did not match! Please retry with the same finger."));
    } else {
      Serial.println(F("[ENROLL] Error creating biometric model."));
    }
    soundUnknownAlarm();
    return false;
  }

  // Store model into flash memory at designated slot ID
  Serial.print(F("[ENROLL] Storing template into AS608 Flash Slot #"));
  Serial.print(id);
  Serial.println(F("..."));

  p = finger.storeModel(id);
  if (p == FINGERPRINT_OK) {
    Serial.println(F("\n========================================================"));
    Serial.print(F(" [SUCCESS] FINGERPRINT COMMITTED INTO AS608 FLASH SLOT #"));
    Serial.println(id);
    Serial.println(F(" Commuter is now enrolled and will be identified instantly!"));
    Serial.println(F("========================================================\n"));
    soundSuccessChime();

    // Report enrollment success to Taporaa Backend
    notifyBackendEnrollment(id);
    return true;
  } else {
    Serial.print(F("[ENROLL] Error writing template to flash memory: 0x"));
    Serial.println(p, HEX);
    soundErrorChime();
    return false;
  }
}

// ----------------------------------------------------------------------------
// Serial Monitor Command Listener
// ----------------------------------------------------------------------------
void checkSerialCommands() {
  if (Serial.available()) {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();
    if (cmd.length() == 0) return;

    if (cmd.startsWith("ENROLL") || cmd.startsWith("enroll") || cmd.startsWith("E") || cmd.startsWith("e")) {
      int slot = -1;
      int spaceIdx = cmd.indexOf(' ');
      if (spaceIdx > 0) {
        slot = cmd.substring(spaceIdx + 1).toInt();
      } else {
        String numPart = "";
        for (unsigned int i = 0; i < cmd.length(); i++) {
          if (isDigit(cmd.charAt(i))) numPart += cmd.charAt(i);
        }
        slot = numPart.toInt();
      }

      if (slot >= 1 && slot <= AS608_MAX_CAPACITY) {
        enrollFingerprint(slot);
      } else {
        Serial.println(F("[COMMAND] Usage: Type 'ENROLL <slot>' (e.g. ENROLL 6) to store a new finger."));
      }
    } else if (cmd.toInt() >= 1 && cmd.toInt() <= AS608_MAX_CAPACITY) {
      // Direct slot number typed, e.g. "6" or "7"
      enrollFingerprint(cmd.toInt());
    } else if (cmd == "LIST" || cmd == "list") {
      finger.getTemplateCount();
      Serial.print(F("[AS608] Enrolled Templates in Sensor Flash: "));
      Serial.println(finger.templateCount);
    } else if (cmd == "HELP" || cmd == "help") {
      Serial.println(F("\n--- TAPORAA GATE SERIAL COMMANDS ---"));
      Serial.println(F("  ENROLL <slot>  : Enroll new fingerprint into AS608 flash (e.g. ENROLL 6)"));
      Serial.println(F("  <number>       : Shortcut to enroll into slot (e.g. 6, 7)"));
      Serial.println(F("  LIST           : Check enrolled template count in AS608 flash"));
      Serial.println(F("  HELP           : Show this help menu\n"));
    }
  }
}

// ----------------------------------------------------------------------------
// Fingerprint Scan & Recognition
// ----------------------------------------------------------------------------
void readFingerprint() {
  uint8_t p = finger.getImage();
  if (p == FINGERPRINT_NOFINGER) {
    if (millis() - lastScanTime > 1500) {
      lastScannedFingerId = -1;
    }
    return;
  }

  if (p != FINGERPRINT_OK) {
    Serial.println(F("[AS608] Optical sensor error getting image."));
    return;
  }

  // Convert image to template
  p = finger.image2Tz();
  if (p != FINGERPRINT_OK) {
    Serial.println(F("[AS608] Fingerprint image too messy or partial."));
    return;
  }

  // Search database inside AS608 flash memory
  p = finger.fingerFastSearch();

  if (p == FINGERPRINT_OK) {
    // MATCH FOUND
    int fingerId = finger.fingerID;
    int confidence = finger.confidence;

    Serial.println(F("\n--------------------------------------------------------"));
    Serial.print(F("[AS608] RECOGNIZED Fingerprint Slot #"));
    Serial.print(fingerId);
    Serial.print(F(" (Confidence: "));
    Serial.print(confidence);
    Serial.println(F(")"));

    // Debounce check
    if (fingerId == lastScannedFingerId && (millis() - lastScanTime < DEBOUNCE_MS)) {
      Serial.println(F("[AS608] Debounced: Finger still placed on sensor."));
      return;
    }

    lastScannedFingerId = fingerId;
    lastScanTime = millis();

    // Process Check-In or Check-Out with Confirmation Workflow
    processTransitScan(fingerId, confidence);

  } else if (p == FINGERPRINT_NOTFOUND) {
    // UNKNOWN / UNREGISTERED FINGERPRINT
    Serial.println(F("\n[AS608] *** SECURITY ALERT: Unknown fingerprint! No match in AS608 memory. ***"));

    if (millis() - lastScanTime < DEBOUNCE_MS) {
      return;
    }
    lastScanTime = millis();

    // 1. Immediately sound distinct alarm buzzer — 5 rapid sharp beeps
    soundUnknownAlarm();

    // 2. Report unknown fingerprint event to Taporaa Backend
    reportUnknownFingerprint();

  } else {
    Serial.print(F("[AS608] Communication error code: 0x"));
    Serial.println(p, HEX);
  }
}

// ----------------------------------------------------------------------------
// Transit Scan Processing — WITH CONFIRMATION STEP
// Step 1: Lookup passenger name (no state change)
// Step 2: Show name, wait 3 seconds (confirmation window)
// Step 3: Commit check-in or check-out
// ----------------------------------------------------------------------------
void processTransitScan(int fingerId, int confidence) {
  String gateMode = String(GATE_TYPE);
  gateMode.toLowerCase();

  // ---- STEP 1: Passenger Lookup (get name before committing) ----
  Serial.println(F("[TRANSIT] Step 1: Looking up passenger name from Taporaa backend..."));
  
  HTTPClient lookupHttp;
  String lookupUrl = String(API_BASE_URL) + "/api/device/passenger-lookup";
  
  lookupHttp.begin(lookupUrl);
  lookupHttp.addHeader("Content-Type", "application/json");
  lookupHttp.addHeader("x-device-token", DEVICE_TOKEN);
  lookupHttp.setTimeout(8000);

  StaticJsonDocument<128> lookupDoc;
  lookupDoc["fingerprint_id"] = fingerId;
  
  String lookupBody;
  serializeJson(lookupDoc, lookupBody);
  
  int lookupCode = lookupHttp.POST(lookupBody);
  String lookupResponse = lookupHttp.getString();
  lookupHttp.end();

  Serial.print(F("[LOOKUP] HTTP Code: "));
  Serial.println(lookupCode);

  String passengerName = "";
  float walletBalance = 0;
  bool hasActiveJourney = false;
  String action = (gateMode == "exit") ? "CHECK-OUT" : "CHECK-IN";

  if (lookupCode == 200) {
    StaticJsonDocument<512> lookupResult;
    DeserializationError err = deserializeJson(lookupResult, lookupResponse);
    if (!err && lookupResult["success"]) {
      passengerName = lookupResult["passenger"]["name"].as<String>();
      walletBalance = lookupResult["passenger"]["wallet_balance"].as<float>();
      hasActiveJourney = lookupResult["has_active_journey"].as<bool>();

      // Determine correct action based on active journey state
      if (hasActiveJourney) {
        action = "CHECK-OUT";
      } else {
        action = "CHECK-IN";
      }

      Serial.println(F(""));
      Serial.println(F("╔══════════════════════════════════════╗"));
      Serial.print(F("║  PASSENGER: "));
      Serial.println(passengerName);
      Serial.print(F("║  BALANCE  : Rs."));
      Serial.println(walletBalance, 0);
      Serial.print(F("║  ACTION   : "));
      Serial.println(action);
      Serial.println(F("║  Proceeding in 3 seconds...          ║"));
      Serial.println(F("╚══════════════════════════════════════╝"));

      // Confirmation double beep
      soundConfirmBeep();
      
      // 3 second window — passenger sees their name displayed
      delay(3000);
    } else {
      Serial.println(F("[LOOKUP] Could not parse passenger data — aborting."));
      soundErrorChime();
      return;
    }
  } else if (lookupCode == 404) {
    // Passenger not recognized in database — sound alarm, do NOT proceed
    Serial.println(F("[LOOKUP] *** PASSENGER NOT IN DATABASE — UNAUTHORIZED ACCESS DENIED ***"));
    soundUnknownAlarm();
    reportUnknownFingerprint();
    return;
  } else {
    Serial.print(F("[LOOKUP] Backend error: "));
    Serial.println(lookupCode);
    soundErrorChime();
    return;
  }

  // ---- STEP 2: Commit check-in or check-out ----
  Serial.print(F("[TRANSIT] Step 2: Committing "));
  Serial.println(action + "...");

  HTTPClient http;
  String url;
  if (action == "CHECK-OUT") {
    url = String(API_BASE_URL) + "/api/device/check-out";
  } else {
    url = String(API_BASE_URL) + "/api/device/check-in";
  }

  Serial.print(F("[HTTP] POST: "));
  Serial.println(url);

  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-device-token", DEVICE_TOKEN);
  http.setTimeout(10000);

  StaticJsonDocument<256> doc;
  doc["fingerprint_id"] = fingerId;
  doc["station_id"] = STATION_ID;
  doc["gate_type"] = gateMode;
  doc["device_id"] = DEVICE_ID;

  String requestBody;
  serializeJson(doc, requestBody);

  int httpCode = http.POST(requestBody);
  String response = http.getString();
  http.end();

  Serial.print(F("[HTTP] Response Code: "));
  Serial.println(httpCode);
  Serial.print(F("[HTTP] Payload: "));
  Serial.println(response);

  if (httpCode == 200 || httpCode == 201) {
    StaticJsonDocument<512> resDoc;
    DeserializationError error = deserializeJson(resDoc, response);

    if (!error) {
      const char* gateCmd = resDoc["gate_command"];
      const char* displayText = resDoc["display_text"];

      if (displayText) {
        Serial.print(F("[LCD DISPLAY] "));
        Serial.println(displayText);
      }

      if (gateCmd && String(gateCmd) == "OPEN") {
        Serial.print(F("[GATE] "));
        Serial.print(passengerName);
        Serial.println(F(" — ACCESS APPROVED. Opening turnstile."));
        soundSuccessChime();
        openGateActuator();
      } else {
        Serial.println(F("[GATE] Gate command is not OPEN. Turnstile stays locked."));
        soundErrorChime();
      }
    }
  } else if (httpCode == 409) {
    Serial.println(F("[GATE] Duplicate journey detected — already checked in."));
    soundErrorChime();
  } else {
    Serial.print(F("[GATE] Request failed or rejected by server: "));
    Serial.println(httpCode);
    soundErrorChime();
  }
}

// ----------------------------------------------------------------------------
// Security Alert Reporting
// ----------------------------------------------------------------------------
void reportUnknownFingerprint() {
  HTTPClient http;
  String url = String(API_BASE_URL) + "/api/hardware/unknown-fingerprint";

  Serial.print(F("[HTTP] Reporting Unknown Fingerprint to: "));
  Serial.println(url);

  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-device-token", DEVICE_TOKEN);
  http.setTimeout(5000);

  StaticJsonDocument<256> doc;
  doc["device_id"] = DEVICE_ID;
  doc["station_id"] = STATION_ID;

  String requestBody;
  serializeJson(doc, requestBody);

  int httpCode = http.POST(requestBody);
  Serial.print(F("[HTTP] Unknown Alert Response Code: "));
  Serial.println(httpCode);

  http.end();
}

// ----------------------------------------------------------------------------
// Heartbeat & Remote Command Polling
// ----------------------------------------------------------------------------
void sendHeartbeat() {
  HTTPClient http;
  String url = String(API_BASE_URL) + "/api/hardware/heartbeat";

  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-device-token", DEVICE_TOKEN);
  http.setTimeout(8000);

  StaticJsonDocument<256> doc;
  doc["device_id"] = DEVICE_ID;
  doc["station_id"] = STATION_ID;
  doc["role"] = GATE_TYPE;
  doc["ip"] = WiFi.localIP().toString();

  String requestBody;
  serializeJson(doc, requestBody);

  int httpCode = http.POST(requestBody);
  if (httpCode == 200) {
    String payload = http.getString();
    StaticJsonDocument<256> resDoc;
    if (!deserializeJson(resDoc, payload)) {
      // Check if web dashboard requested enrollment
      if (resDoc.containsKey("pending_enroll_slot") && resDoc["pending_enroll_slot"].as<int>() > 0) {
        int targetSlot = resDoc["pending_enroll_slot"].as<int>();
        Serial.print(F("[REMOTE] Web Dashboard requested enrollment for Slot #"));
        Serial.println(targetSlot);
        enrollFingerprint(targetSlot);
      }
    }
  }
  http.end();
}

// ----------------------------------------------------------------------------
// Backend Enrollment Sync
// ----------------------------------------------------------------------------
void notifyBackendEnrollment(int slot) {
  HTTPClient http;
  String url = String(API_BASE_URL) + "/api/hardware/event";

  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-device-token", DEVICE_TOKEN);
  http.setTimeout(8000);

  StaticJsonDocument<256> doc;
  doc["type"] = "ENROLL_SUCCESS";
  doc["fingerprint_id"] = slot;
  doc["device_id"] = DEVICE_ID;
  doc["station_name"] = "AS608 Gate Terminal";

  String requestBody;
  serializeJson(doc, requestBody);
  http.POST(requestBody);
  http.end();
}

// ----------------------------------------------------------------------------
// Gate Actuator Relay Control
// ----------------------------------------------------------------------------
void openGateActuator() {
  if (SAFE_TEST_MODE) {
    Serial.println(F("[SAFETY] SAFE_TEST_MODE is ACTIVE: Physical relay is disabled to protect hardware."));
    digitalWrite(LED_STATUS_PIN, HIGH);
    delay(GATE_OPEN_TIME_MS);
    digitalWrite(LED_STATUS_PIN, LOW);
    return;
  }

  Serial.println(F("[RELAY] Energizing relay module..."));
  if (RELAY_ACTIVE_LOW) {
    digitalWrite(RELAY_PIN, LOW);  // Turn ON active-low relay
  } else {
    digitalWrite(RELAY_PIN, HIGH); // Turn ON active-high relay
  }
  digitalWrite(LED_STATUS_PIN, HIGH);

  delay(GATE_OPEN_TIME_MS);

  if (RELAY_ACTIVE_LOW) {
    digitalWrite(RELAY_PIN, HIGH); // Turn OFF active-low relay
  } else {
    digitalWrite(RELAY_PIN, LOW);  // Turn OFF active-high relay
  }
  digitalWrite(LED_STATUS_PIN, LOW);
  Serial.println(F("[RELAY] Relay de-energized. Turnstile re-locked."));
}
