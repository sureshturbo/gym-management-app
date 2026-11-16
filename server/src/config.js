function env(key, fallback) {
  const value = process.env[key] ?? fallback;
  if (value === undefined || value === '') throw new Error(`Missing required environment variable ${key}`);
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 4100),
  db: {
    host: env('DB_HOST', '127.0.0.1'),
    port: Number(env('DB_PORT', '3306')),
    user: env('DB_USER'),
    password: process.env.DB_PASSWORD ?? '',
    database: env('DB_NAME', 'gym_app'),
  },
  jwtSecret: env('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  corsOrigins: (process.env.CORS_ORIGIN ?? 'http://localhost:5180').split(',').map((s) => s.trim()).filter(Boolean),

  // Business rules
  overdueGraceDays: 7, // unpaid balance becomes "overdue" this many days after the membership starts
  expiringSoonDays: 7, // memberships expiring within this window show up on dashboards
  absentAlertDays: 5, // active members not seen for this many days are flagged
  gpsAccuracyAllowanceM: 50, // max GPS accuracy (metres) credited towards the gym radius
};
