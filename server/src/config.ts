export function loadConfig() {
  const port = Number(process.env.PORT ?? 3001);
  const clientUrl = process.env.CLIENT_URL ?? "http://localhost:5173";
  const additional = (process.env.ADDITIONAL_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    port: Number.isFinite(port) ? port : 3001,
    corsOrigins: [clientUrl, ...additional],
    fixedSeed:
      process.env.FIXED_SEED != null && process.env.FIXED_SEED !== ""
        ? Number(process.env.FIXED_SEED)
        : null,
  };
}

export type ServerConfig = ReturnType<typeof loadConfig>;
