import express from "express";
import cors from "cors";
import helmet from "helmet";
import type { Pool } from "pg";
import { createApiRouter } from "./routes/api.js";
import type { VerificationEmailService } from "./services/verificationEmail.js";

export function createApp(config: {
  adminPassword: string;
  secret: string;
  postgres: Pool;
  adminEmail?: string;
  origin?: string;
  dummyOtpEnabled?: boolean;
  chapterNotesEnabled?: boolean;
  verificationEmail?: VerificationEmailService;
}) {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet(), cors({ origin: "*" }), express.json({ limit: "150kb" }));
  app.use("/api", createApiRouter(config));
  app.use(
    (
      error: Error & { status?: number },
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      console.error(error.message);
      res
        .status(error.status ?? 500)
        .json({
          error: error.status
            ? error.message
            : "The request could not be completed.",
        });
    },
  );
  return app;
}
