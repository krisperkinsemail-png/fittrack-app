import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const cwd = process.cwd();
const csvPath = path.join(cwd, "research", "food-library-merged.csv");
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    "Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Export both env vars before running sync:restaurants."
  );
  process.exit(1);
}

if (!fs.existsSync(csvPath)) {
  console.error(`Missing CSV at ${csvPath}. Run python3 research/build_food_library_datasets.py first.`);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

function parseCsv(text) {
  const rows = [];
  let current = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      current.push(field);
      field = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      current.push(field);
      field = "";
      if (current.some((value) => value !== "")) {
        rows.push(current);
      }
      current = [];
      continue;
    }

    field += char;
  }

  if (field || current.length) {
    current.push(field);
    rows.push(current);
  }

  return rows;
}

function toNullableNumber(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  const parsed = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function toInteger(value, fallback = 0) {
  const parsed = toNullableNumber(value);
  if (parsed === null) {
    return fallback;
  }
  return Math.round(parsed);
}

function toBoolean(value) {
  return String(value).trim() === "1" || String(value).trim().toLowerCase() === "true";
}

function mapRow(header, values) {
  const row = Object.fromEntries(header.map((key, index) => [key, values[index] ?? ""]));

  return {
    id: row.id,
    brand: row.brand,
    item_name: row.item_name,
    category: row.category || null,
    description: row.description || null,
    serving_amount: toNullableNumber(row.serving_amount),
    serving_unit: row.serving_unit || null,
    serving_label: row.serving_label || null,
    calories: toInteger(row.calories, 0),
    fat_g: toNullableNumber(row.fat_g) ?? 0,
    carbs_g: toNullableNumber(row.carbs_g) ?? 0,
    protein_g: toNullableNumber(row.protein_g) ?? 0,
    fiber_g: toNullableNumber(row.fiber_g),
    sugar_g: toNullableNumber(row.sugar_g),
    sodium_mg: toNullableNumber(row.sodium_mg),
    cholesterol_mg: toNullableNumber(row.cholesterol_mg),
    potassium_mg: toNullableNumber(row.potassium_mg),
    source_type: row.source_type,
    source_date: row.source_date || null,
    source_detail: row.source_detail || null,
    source_url: row.source_url || null,
    region: row.region || "US",
    is_manual_override: toBoolean(row.is_manual_override),
  };
}

async function main() {
  const raw = fs.readFileSync(csvPath, "utf8");
  const [header, ...records] = parseCsv(raw);
  const payload = records.map((record) => mapRow(header, record));
  const batchSize = 500;

  console.log(`Preparing to sync ${payload.length} restaurant rows from ${csvPath}`);

  const { error: truncateError } = await supabase.from("restaurant_library").delete().neq("id", "");
  if (truncateError) {
    console.error("Failed to clear restaurant_library before sync.", truncateError.message);
    process.exit(1);
  }

  for (let index = 0; index < payload.length; index += batchSize) {
    const batch = payload.slice(index, index + batchSize);
    const { error } = await supabase.from("restaurant_library").upsert(batch, { onConflict: "id" });
    if (error) {
      console.error(`Failed on batch starting at row ${index + 1}.`, error.message);
      process.exit(1);
    }
    console.log(`Synced ${Math.min(index + batch.length, payload.length)} / ${payload.length}`);
  }

  console.log("Restaurant library sync complete.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
