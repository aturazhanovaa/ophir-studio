import assert from "node:assert/strict";
import { computeTimeRange } from "../src/utils/timeRanges.js";

function isoDate(dt) {
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  const hh = String(dt.getHours()).padStart(2, "0");
  const mm = String(dt.getMinutes()).padStart(2, "0");
  const ss = String(dt.getSeconds()).padStart(2, "0");
  return `${y}-${m}-${d}T${hh}:${mm}:${ss}`;
}

// Run with TZ=UTC so these are deterministic.
{
  const now = new Date("2024-02-10T12:00:00Z"); // Q1
  const lastQuarter = computeTimeRange("last_quarter", now);
  assert.equal(isoDate(lastQuarter.start), "2023-10-01T00:00:00");
  assert.equal(isoDate(lastQuarter.end), "2023-12-31T23:59:59");
}

{
  const now = new Date("2024-08-10T12:00:00Z"); // Q3
  const lastQuarter = computeTimeRange("last_quarter", now);
  assert.equal(isoDate(lastQuarter.start), "2024-04-01T00:00:00");
  assert.equal(isoDate(lastQuarter.end), "2024-06-30T23:59:59");
}

console.log("OK: timeRanges last_quarter");

