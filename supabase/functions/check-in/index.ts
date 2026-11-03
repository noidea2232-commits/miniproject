import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-device-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (payload: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const expectedToken = Deno.env.get("BIO_DEVICE_TOKEN");
  const suppliedToken = req.headers.get("x-device-token");

  if (!expectedToken) {
    return json({ error: "Server misconfiguration: BIO_DEVICE_TOKEN is missing" }, 500);
  }

  if (!suppliedToken) {
    return json({ error: "Missing device token in x-device-token header" }, 401);
  }

  if (suppliedToken !== expectedToken) {
    return json({ error: "Invalid device token" }, 401);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const fingerprintId = Number(body?.fingerprint_id);
  const stationId = Number(body?.entry_station_id ?? body?.station_id);

  if (!Number.isFinite(fingerprintId) || fingerprintId <= 0) {
    return json({ error: "fingerprint_id is required and must be a positive integer" }, 400);
  }

  if (!Number.isFinite(stationId) || stationId <= 0) {
    return json({ error: "station_id is required and must be a positive integer" }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseKey) {
    return json({ error: "Server misconfiguration: missing Supabase service credentials" }, 500);
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    // 1. Fetch passenger by biometric fingerprint ID
    const { data: passenger, error: passengerError } = await supabase
      .from("passengers")
      .select("id, fingerprint_id, name, wallet_balance, status")
      .eq("fingerprint_id", fingerprintId)
      .maybeSingle();

    if (passengerError) throw passengerError;
    if (!passenger) {
      return json({
        error: `Passenger not found for fingerprint ID #${fingerprintId}`,
        code: "PASSENGER_NOT_FOUND"
      }, 404);
    }

    // 2. Validate account status
    if (String(passenger.status).toLowerCase() !== "active") {
      return json({
        error: `Passenger account is currently ${passenger.status}. Access denied.`,
        code: "ACCOUNT_INACTIVE"
      }, 403);
    }

    // 3. Validate minimum wallet balance (₹10.00 required)
    const balance = Number(passenger.wallet_balance ?? 0);
    if (balance < 10) {
      return json({
        error: `Insufficient wallet balance (₹${balance.toFixed(2)}). Minimum ₹10.00 required.`,
        code: "INSUFFICIENT_BALANCE",
        current_balance: balance
      }, 400);
    }

    // 4. Validate station exists in transit network
    const { data: station, error: stationError } = await supabase
      .from("stations")
      .select("id, name, code")
      .eq("id", stationId)
      .maybeSingle();

    if (stationError) throw stationError;
    if (!station) {
      return json({
        error: `Station ID ${stationId} is not recognized in transit network`,
        code: "INVALID_STATION_ID"
      }, 400);
    }

    // 5. Prevent duplicate check-in (atomic database query for ACTIVE journey)
    const { data: activeJourney, error: activeJourneyError } = await supabase
      .from("journeys")
      .select("id, journey_code, entry_station_id, entry_time, status")
      .eq("passenger_id", passenger.id)
      .eq("status", "ACTIVE")
      .maybeSingle();

    if (activeJourneyError) throw activeJourneyError;
    if (activeJourney) {
      return json({
        error: "Active journey already in progress for this passenger",
        code: "DUPLICATE_ACTIVE_JOURNEY",
        active_journey: { ...activeJourney, status: "IN_PROGRESS" }
      }, 409);
    }

    // 6. Generate unique journey code and insert into real Supabase journeys table
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
    const rand = Math.floor(1000 + Math.random() * 9000);
    const journeyCode = `TAP-JRN-${dateStr}-${rand}`;

    const { data: journey, error: journeyError } = await supabase
      .from("journeys")
      .insert({
        passenger_id: passenger.id,
        entry_station_id: station.id,
        exit_station_id: null,
        status: "ACTIVE",
        journey_code: journeyCode,
        entry_time: now.toISOString(),
        exit_time: null,
        fare: null,
        previous_balance: balance,
        new_balance: null,
      })
      .select("id, passenger_id, entry_station_id, exit_station_id, status, journey_code, entry_time, exit_time, fare")
      .single();

    if (journeyError) throw journeyError;

    const firstName = String(passenger.name).split(" ")[0].toUpperCase();

    return json({
      success: true,
      action: "check_in",
      gate_command: "OPEN",
      display_text: `WELCOME ${firstName} - BAL ₹${balance}`,
      message: `Check-in successful at ${station.name}. Gate opened.`,
      journey: {
        ...journey,
        passenger_name: passenger.name,
        entry_station_name: station.name,
        exit_station_name: null,
      },
      passenger: {
        id: `TAP-PASS-${passenger.fingerprint_id}`,
        db_id: passenger.id,
        name: passenger.name,
        fingerprint_id: passenger.fingerprint_id,
        wallet_balance: balance,
        status: String(passenger.status).toLowerCase(),
      },
      source: "supabase_db"
    }, 201);
  } catch (error) {
    console.error("check-in failed:", error);
    return json({
      error: "Database error during check-in",
      message: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

