export type OddsOperationMode = "model-only" | "pregame-snapshot" | "bookmaker-only";

export function getOddsOperationMode(): OddsOperationMode {
  const value = process.env.ODDS_OPERATION_MODE;
  if (value === "pregame-snapshot" || value === "bookmaker-only" || value === "model-only") return value;
  return "model-only";
}

export function isModelOnlyMode() {
  return getOddsOperationMode() === "model-only";
}
