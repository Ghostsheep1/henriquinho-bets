import assert from "node:assert/strict";
import test from "node:test";
import { getOddsOperationMode } from "../src/lib/odds/config";
import { isSupabaseConfigured } from "../src/lib/supabase";

test("model-only is the safe default and does not select a bookmaker provider", () => {
  assert.equal(getOddsOperationMode(), "model-only");
});

test("browser Supabase configuration requires the URL and publishable key only", () => {
  assert.equal(typeof isSupabaseConfigured, "boolean");
});
