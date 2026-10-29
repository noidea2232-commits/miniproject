import React, { useState } from 'react';
import {
  Cpu,
  Fingerprint,
  Radio,
  CheckCircle2,
  XCircle,
  Terminal,
  Code2,
  Copy,
  Check,
  RefreshCw,
  Zap,
} from 'lucide-react';
import { api } from '../services/api';
import type { Station, HardwareScanResult } from '../types/index';

interface TerminalSimulatorProps {
  stations: Station[];
  onScanCompleted?: () => void;
}

export const TerminalSimulator: React.FC<TerminalSimulatorProps> = ({ stations, onScanCompleted }) => {
  const [selectedStationId, setSelectedStationId] = useState<string | number>(1);
  const [gateType, setGateType] = useState<'auto' | 'entry' | 'exit'>('auto');
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanResult, setScanResult] = useState<HardwareScanResult | null>(null);

  // Turnstile barrier animation state: 'locked' | 'scanning' | 'open' | 'rejected'
  const [barrierState, setBarrierState] = useState<'locked' | 'scanning' | 'open' | 'rejected'>('locked');

  // 16x2 character display lines
  const [lcdLine1, setLcdLine1] = useState<string>('TAPORAA TERMINAL');
  const [lcdLine2, setLcdLine2] = useState<string>('TOUCH SENSOR >>>');

  // Serial Monitor Log lines
  const [serialLogs, setSerialLogs] = useState<string[]>([
    '[BOOT] ESP32-WROOM-32 initialized (Firmware v1.4.2)',
    '[SENSOR] AS608 optical sensor detected at 57600 baud',
    '[WIFI] Connected to Transit-AP (IP: 192.168.1.108, RSSI: -52dBm)',
    '[AUTH] Hardware device authentication header ready',
    '[GATE] Station set: MAJESTIC · Mode: AUTO-DETECT · Solenoid GPIO 26 ready',
  ]);

  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'simulator' | 'firmware'>('simulator');

  const addSerialLog = (text: string) => {
    const timestamp = new Date().toISOString().slice(11, 19);
    setSerialLogs((prev) => [...prev.slice(-30), `[${timestamp}] ${text}`]);
  };

  const handleFingerprintScan = async (fingerprintId: number, fingerLabel: string) => {
    if (isScanning) return;
    setIsScanning(true);
    setBarrierState('scanning');
    setScanResult(null);

    setLcdLine1('SCANNING FINGER');
    setLcdLine2(`READING ID #${fingerprintId}...`);

    addSerialLog(`[TOUCH] Sensor detected finger: ${fingerLabel} (ID #${fingerprintId})`);
    addSerialLog(`[AS608] Extracting biometric minutiae buffer... Match score: ${fingerprintId === 99 ? '0 (NO MATCH)' : '184 (MATCH)'}`);

    try {
      addSerialLog(`[HTTP] POST /api/hardware/scan payload: { fingerprint_id: ${fingerprintId}, station_id: "${selectedStationId}" }`);

      // 400ms physical sensor delay simulation
      await new Promise((r) => setTimeout(r, 450));

      const result = await api.scanHardware({
        fingerprint_id: fingerprintId,
        station_id: selectedStationId,
        gate_type: gateType,
        device_id: `ESP32-${selectedStationId}-GATE-01`,
      });

      setScanResult(result);

      if (result.success && result.gate_command === 'OPEN') {
        setBarrierState('open');
        setLcdLine1(result.display_text.slice(0, 16));
        setLcdLine2(result.action === 'check_out' ? `FARE: ₹${result.fare_deducted} BAL: ₹${result.updated_balance}` : 'GATE UNLOCKED');

        addSerialLog(`[GATE] Access Granted: ${result.message}`);
        addSerialLog(`[RELAY] GPIO 26 HIGH -> Turnstile solenoid opened for 3.5 seconds`);

        if (onScanCompleted) onScanCompleted();

        // Auto close after 3.5 seconds
        setTimeout(() => {
          setBarrierState('locked');
          setLcdLine1('TAPORAA TERMINAL');
          setLcdLine2('TOUCH SENSOR >>>');
          addSerialLog(`[RELAY] GPIO 26 LOW -> Solenoid locked`);
        }, 3500);
      } else {
        setBarrierState('rejected');
        setLcdLine1(result.display_text ? result.display_text.slice(0, 16) : 'ACCESS DENIED');
        setLcdLine2(result.error_code || 'VISIT DESK');

        addSerialLog(`[GATE] Access Denied: ${result.message}`);
        addSerialLog(`[BUZZER] Beep 3x (Error warning)`);

        setTimeout(() => {
          setBarrierState('locked');
          setLcdLine1('TAPORAA TERMINAL');
          setLcdLine2('TOUCH SENSOR >>>');
        }, 3000);
      }
    } catch (err: any) {
      setBarrierState('rejected');
      setLcdLine1('NETWORK ERR');
      setLcdLine2('TRY AGAIN');
      addSerialLog(`[ERROR] Network or server failure: ${err.message}`);
      setTimeout(() => {
        setBarrierState('locked');
        setLcdLine1('TAPORAA TERMINAL');
        setLcdLine2('TOUCH SENSOR >>>');
      }, 3000);
    } finally {
      setIsScanning(false);
    }
  };

  const sampleArduinoCode = `/*
  Taporaa Biometric Transit Terminal Firmware
  Target: ESP32-WROOM-32 + AS608 Optical Fingerprint Module
*/
#include <WiFi.h>
#include <HTTPClient.h>
#include <Adafruit_Fingerprint.h>
#include <LiquidCrystal_I2C.h>
#include <ArduinoJson.h>

const char* ssid = "NammaMetro-Wifi";
const char* password = "metro_transit_pass";
const char* serverUrl = "https://your-domain.app/api/hardware/scan";
const char* deviceToken = "BIO_DEVICE_TOKEN_SECRET"; // Injected server-side

HardwareSerial mySerial(2); // RX=16, TX=17
Adafruit_Fingerprint finger = Adafruit_Fingerprint(&mySerial);
LiquidCrystal_I2C lcd(0x27, 16, 2);
const int RELAY_PIN = 26;

void setup() {
  Serial.begin(115200);
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, LOW);
  lcd.init(); lcd.backlight();
  lcd.print("TAPORAA TRANSIT");
  
  finger.begin(57600);
  if (finger.verifyPassword()) {
    Serial.println("AS608 sensor connected!");
  }
  WiFi.begin(ssid, password);
}

void loop() {
  uint8_t p = finger.getImage();
  if (p == FINGERPRINT_OK) {
    if (finger.image2Tz() == FINGERPRINT_OK) {
      if (finger.fingerFastSearch() == FINGERPRINT_OK) {
        int fingerId = finger.fingerID;
        sendScanToServer(fingerId);
      }
    }
  }
  delay(100);
}

void sendScanToServer(int fingerId) {
  HTTPClient http;
  http.begin(serverUrl);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-device-token", deviceToken);
  
  StaticJsonDocument<200> doc;
  doc["fingerprint_id"] = fingerId;
  doc["station_id"] = "MAJESTIC";
  doc["gate_type"] = "auto";
  String payload; serializeJson(doc, payload);
  
  int httpCode = http.POST(payload);
  if (httpCode == 200) {
    digitalWrite(RELAY_PIN, HIGH); // Unlock barrier
    delay(3500);
    digitalWrite(RELAY_PIN, LOW);
  }
  http.end();
}`;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-cyan-400 tracking-wider uppercase font-mono">
              STATION OPERATOR &amp; HARDWARE CONSOLE
            </span>
            <span className="text-slate-500 text-xs">·</span>
            <span className="text-xs text-slate-400">ESP32-WROOM-32 + AS608 Sensor</span>
          </div>
          <h1 className="text-2xl font-bold text-white mt-1">Biometric Turnstile Terminal</h1>
        </div>

        {/* Tab switch */}
        <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800 text-xs">
          <button
            onClick={() => setActiveTab('simulator')}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
              activeTab === 'simulator' ? 'bg-slate-800 text-white font-semibold' : 'text-slate-400 hover:text-white'
            }`}
          >
            Terminal Simulator
          </button>
          <button
            onClick={() => setActiveTab('firmware')}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'firmware' ? 'bg-slate-800 text-white font-semibold' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Code2 className="w-3.5 h-3.5 text-cyan-400" />
            ESP32 Arduino Firmware
          </button>
        </div>
      </div>

      {activeTab === 'firmware' ? (
        /* Arduino Firmware Code Tab */
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-white">ESP32 AS608 Arduino Firmware Sketch</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Flash this C++ firmware onto the ESP32-WROOM-32 microcontroller to interface with the physical AS608 optical sensor.
              </p>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(sampleArduinoCode);
                setCopiedCode(true);
                setTimeout(() => setCopiedCode(false), 2000);
              }}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 flex items-center gap-1.5 border border-slate-700 cursor-pointer"
            >
              {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedCode ? 'Copied' : 'Copy Code'}</span>
            </button>
          </div>

          <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-emerald-300 overflow-x-auto max-h-[500px]">
            {sampleArduinoCode}
          </pre>
        </div>
      ) : (
        /* Terminal Simulator Tab */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Physical Hardware Case Simulator */}
          <div className="lg:col-span-7 bg-slate-900 rounded-2xl border border-slate-800 p-6 space-y-6 shadow-xl relative">
            {/* Terminal Configuration Header */}
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div className="space-y-1">
                <span className="text-[11px] font-mono text-slate-400 uppercase">Station Gate Location:</span>
                <select
                  value={selectedStationId}
                  onChange={(e) => setSelectedStationId(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-white font-medium focus:outline-none focus:border-cyan-500"
                >
                  {stations.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] font-mono text-slate-400 uppercase">Gate Mode:</span>
                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-mono">
                  {(['auto', 'entry', 'exit'] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setGateType(m)}
                      className={`px-2 py-0.5 rounded capitalize transition-colors cursor-pointer ${
                        gateType === m ? 'bg-cyan-500/20 text-cyan-300 font-semibold' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 16x2 Character LCD Screen Component */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-[11px] text-slate-400 font-mono">
                <span>16x2 I2C CHARACTER DISPLAY</span>
                <span className="text-emerald-400">0x27 ADDR</span>
              </div>
              <div className="bg-[#122e1a] border-4 border-slate-950 rounded-xl p-4 shadow-inner font-mono text-emerald-300 font-bold tracking-widest text-sm space-y-1 select-none">
                <div className="truncate drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]">
                  {lcdLine1.padEnd(16, ' ')}
                </div>
                <div className="truncate drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]">
                  {lcdLine2.padEnd(16, ' ')}
                </div>
              </div>
            </div>

            {/* Optical Sensor Pad & Turnstile State */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-center pt-2">
              {/* AS608 Optical Sensor */}
              <div className="flex flex-col items-center justify-center p-6 bg-slate-950 rounded-xl border border-slate-800 relative">
                <span className="text-[11px] font-mono text-slate-400 mb-3 uppercase tracking-wider">
                  AS608 Optical Finger Scanner
                </span>

                <div
                  className={`w-28 h-28 rounded-full border-4 flex items-center justify-center transition-all duration-300 relative ${
                    barrierState === 'scanning'
                      ? 'border-amber-400 bg-amber-500/20 text-amber-300 shadow-[0_0_20px_rgba(251,191,36,0.5)] animate-pulse'
                      : barrierState === 'open'
                      ? 'border-emerald-400 bg-emerald-500/20 text-emerald-300 shadow-[0_0_25px_rgba(52,211,153,0.6)]'
                      : barrierState === 'rejected'
                      ? 'border-red-500 bg-red-500/20 text-red-400 shadow-[0_0_20px_rgba(239,68,68,0.5)]'
                      : 'border-cyan-500/40 bg-slate-900 text-cyan-400 hover:border-cyan-400 hover:scale-105'
                  }`}
                >
                  <Fingerprint className="w-14 h-14" />
                </div>

                <div className="text-[11px] font-mono text-slate-400 mt-3 text-center">
                  Status:{' '}
                  <span
                    className={`font-semibold ${
                      barrierState === 'open'
                        ? 'text-emerald-400'
                        : barrierState === 'rejected'
                        ? 'text-red-400'
                        : barrierState === 'scanning'
                        ? 'text-amber-400'
                        : 'text-cyan-400'
                    }`}
                  >
                    {barrierState.toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Physical Gate Barrier Visualization */}
              <div className="flex flex-col items-center justify-center p-6 bg-slate-950 rounded-xl border border-slate-800 space-y-4">
                <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                  Turnstile Barrier Solenoid
                </span>

                <div className="w-full h-24 bg-slate-900 rounded-lg border border-slate-800 p-2 flex items-center justify-center relative overflow-hidden">
                  {/* Flap barriers */}
                  <div
                    className={`w-14 h-18 rounded bg-gradient-to-r from-slate-700 to-slate-600 border border-slate-500 shadow-md transition-all duration-500 flex items-center justify-center text-xs font-bold text-white ${
                      barrierState === 'open' ? '-rotate-70 translate-x-[-12px] opacity-40' : 'rotate-0'
                    }`}
                  >
                    GATE
                  </div>
                  <div
                    className={`w-14 h-18 rounded bg-gradient-to-l from-slate-700 to-slate-600 border border-slate-500 shadow-md transition-all duration-500 flex items-center justify-center text-xs font-bold text-white ${
                      barrierState === 'open' ? 'rotate-70 translate-x-[12px] opacity-40' : 'rotate-0'
                    }`}
                  >
                    GATE
                  </div>

                  <div className="absolute bottom-1 text-[10px] font-mono text-slate-400">
                    {barrierState === 'open' ? 'SOLENOID UNLOCKED' : 'LOCKED'}
                  </div>
                </div>

                <div className="text-center">
                  <div className="text-xs font-medium text-white">12V DC Relay Pin GPIO 26</div>
                  <div className="text-[11px] text-slate-400">
                    {barrierState === 'open' ? 'Relay High (Passing Allowed)' : 'Relay Low (Barrier Engaged)'}
                  </div>
                </div>
              </div>
            </div>

            {/* Test Fingerprints Touch Palette */}
            <div className="space-y-3 pt-3 border-t border-slate-800">
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold text-slate-200">
                  Touch Test Fingerprint on AS608 Sensor:
                </span>
                <span className="text-[11px] text-slate-400 font-mono">Click to simulate biometric touch</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <button
                  disabled={isScanning}
                  onClick={() => handleFingerprintScan(1, 'Manish')}
                  className="p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-emerald-500/50 text-left transition-all cursor-pointer group disabled:opacity-50"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-emerald-400 font-semibold">FP #1</span>
                    <Fingerprint className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 transition-colors" />
                  </div>
                  <div className="text-xs font-medium text-white mt-1">Manish</div>
                  <div className="text-[10px] text-slate-400 font-mono">Active (₹485)</div>
                </button>

                <button
                  disabled={isScanning}
                  onClick={() => handleFingerprintScan(2, 'Vikranth')}
                  className="p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-emerald-500/50 text-left transition-all cursor-pointer group disabled:opacity-50"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-emerald-400 font-semibold">FP #2</span>
                    <Fingerprint className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 transition-colors" />
                  </div>
                  <div className="text-xs font-medium text-white mt-1">Vikranth</div>
                  <div className="text-[10px] text-slate-400 font-mono">Active (₹300)</div>
                </button>

                <button
                  disabled={isScanning}
                  onClick={() => handleFingerprintScan(3, 'Demo Student')}
                  className="p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-cyan-500/50 text-left transition-all cursor-pointer group disabled:opacity-50"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-cyan-400 font-semibold">FP #3</span>
                    <Fingerprint className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 transition-colors" />
                  </div>
                  <div className="text-xs font-medium text-white mt-1">Demo Student</div>
                  <div className="text-[10px] text-cyan-400 font-mono">Active (₹250)</div>
                </button>

                <button
                  disabled={isScanning}
                  onClick={() => handleFingerprintScan(99, 'Unregistered Finger')}
                  className="p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-red-500/50 text-left transition-all cursor-pointer group disabled:opacity-50"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-red-400 font-semibold">FP #99</span>
                    <Fingerprint className="w-4 h-4 text-slate-500 group-hover:text-red-400 transition-colors" />
                  </div>
                  <div className="text-xs font-medium text-white mt-1">Unknown</div>
                  <div className="text-[10px] text-red-400 font-mono">Unregistered</div>
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Serial Monitor & Diagnostics */}
          <div className="lg:col-span-5 space-y-6">
            {/* Real-time Serial Monitor */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-semibold text-white font-mono uppercase">
                    ESP32 Serial Monitor (115200 Baud)
                  </span>
                </div>
                <button
                  onClick={() => setSerialLogs(['[LOG] Cleared serial monitor buffer'])}
                  className="text-[11px] text-slate-400 hover:text-white cursor-pointer"
                >
                  Clear
                </button>
              </div>

              <div className="bg-slate-950 rounded-xl p-3 font-mono text-[11px] text-slate-300 h-64 overflow-y-auto space-y-1 border border-slate-850">
                {serialLogs.map((log, i) => (
                  <div
                    key={i}
                    className={
                      log.includes('[ERROR]') || log.includes('Denied') || log.includes('NO MATCH')
                        ? 'text-red-400'
                        : log.includes('Access Granted') || log.includes('MATCH') || log.includes('UNLOCKED')
                        ? 'text-emerald-400'
                        : log.includes('[WIFI]') || log.includes('[HTTP]')
                        ? 'text-cyan-300'
                        : 'text-slate-400'
                    }
                  >
                    {log}
                  </div>
                ))}
              </div>
            </div>

            {/* Hardware Status Summary */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 space-y-3">
              <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider font-mono">
                Hardware Device Health
              </h4>
              <div className="divide-y divide-slate-800 text-xs">
                <div className="py-2 flex justify-between">
                  <span className="text-slate-400">Microcontroller:</span>
                  <span className="font-mono text-white">ESP32-WROOM-32 (Dual Core 240MHz)</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-slate-400">Biometric Module:</span>
                  <span className="font-mono text-emerald-400">AS608 Optical (UART 57600)</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-slate-400">Auth Token:</span>
                  <span className="font-mono text-cyan-400">x-device-token (Server Handled)</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-slate-400">Gate Solenoid:</span>
                  <span className="font-mono text-white">GPIO 26 (12V Active High)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
