#ifndef FIRMWARE_CONFIG_H
#define FIRMWARE_CONFIG_H

// ============================================================================
// TAPORAA TRANSIT GATE — ESP32 + AS608 HARDWARE CONFIGURATION
// Updated: 03-November-2026
// ============================================================================

// ----------------------------------------------------------------------------
// 1. Wi-Fi Station Credentials
// Enter your Wi-Fi router / mobile hotspot name and password:
// ----------------------------------------------------------------------------
#define WIFI_SSID "Reddy "
#define WIFI_PASS "123456789"

// ----------------------------------------------------------------------------
// 2. Taporaa Backend API Base URL
// Choose ONE depending on whether you are running locally or on Render:
// ----------------------------------------------------------------------------
// OPTION A (Local Wi-Fi Testing): Use your computer's local IP address
#define API_BASE_URL "http://10.150.1.14:3000"

// OPTION B (Render Single-Place Cloud Deployment):
// When deployed on Render, uncomment the line below and enter your Render URL:
// #define API_BASE_URL "https://your-taporaa-app.onrender.com"

// ----------------------------------------------------------------------------
// 3. Hardware Authentication Token
// Must match ESP32_DEVICE_TOKEN in .env / server configuration
// ----------------------------------------------------------------------------
#define DEVICE_TOKEN "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaqqqqqqqqqqqqqqqqqqqqqqqwwwwwwwwwwwwwwwwwwwwwww"

// ----------------------------------------------------------------------------
// 4. Gate Terminal ID & Location
// ----------------------------------------------------------------------------
#define DEVICE_ID "ESP32-GATE-MAJ-01"
#define STATION_ID 1                     // 1 = Majestic (Kempegowda), 2 = Indiranagar, 3 = MG Road
#define GATE_TYPE "auto"                 // "auto" (detects check-in/out), "entry", or "exit"

// ----------------------------------------------------------------------------
// 5. AS608 Hardware UART Configuration (ESP32 Serial2)
// ----------------------------------------------------------------------------
#define AS608_RX_PIN 16                  // ESP32 GPIO16 (RX2) -> AS608 TX (Yellow wire)
#define AS608_TX_PIN 17                  // ESP32 GPIO17 (TX2) -> AS608 RX (White wire)
#define AS608_BAUD_RATE 57600            // Default factory AS608 baud rate
#define AS608_MAX_CAPACITY 120           // Maximum template capacity in flash memory

// ----------------------------------------------------------------------------
// 6. Gate Actuator Relay & Safety Interlock
// ----------------------------------------------------------------------------
#define RELAY_PIN 26                     // GPIO connected to Relay IN terminal
#define RELAY_ACTIVE_LOW true            // Active LOW relay module: LOW = ON, HIGH = OFF
#define GATE_OPEN_TIME_MS 3000           // Gate unlocked duration (milliseconds)

// CRITICAL SAFETY INTERLOCK:
// Keep SAFE_TEST_MODE set to true during initial testing so the physical relay does
// not click or cycle if not connected. Change to false when physical turnstile/servo is wired.
#define SAFE_TEST_MODE true

// ----------------------------------------------------------------------------
// 7. Status Indicators & Sound Feedback
// ----------------------------------------------------------------------------
#define BUZZER_PIN 25                    // Piezo buzzer GPIO: (+) to GPIO25, (-) to GND
#define BUZZER_ENABLED true              // Sounds alarm on unknown finger and chime on gate open
#define LED_STATUS_PIN 2                 // Onboard blue LED (GPIO 2)

#endif // FIRMWARE_CONFIG_H
