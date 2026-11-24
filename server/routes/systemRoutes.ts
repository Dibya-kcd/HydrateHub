import type { Express } from "express";
import {
  FatalAiError,
  getCandidateModels,
  recognizeInvoiceWithGemini,
} from "../../invoiceAi";
import { reloadDiskCollections } from "../supabaseStore";

export function registerSystemRoutes(
  app: Express,
  resolveAuth: (req: any) => Promise<any>,
) {
  // Health check endpoint
  app.get("/api/health", async (req, res) => {
    // Anonymous callers only learn that the server is up; configuration details need a valid sign-in.
    const who = await resolveAuth(req).catch(() => null);
    if (!who) return res.json({ status: "ok" });
    res.json({
      status: "ok",
      hasGeminiKey: !!process.env.GEMINI_API_KEY,
      aiModels: getCandidateModels(),
      timestamp: new Date().toISOString(),
    });
  });

  app.post("/api/admin/reload-disk", (_req, res) => {
    try {
      const collections = reloadDiskCollections();
      res.json({ ok: true, keys: Object.keys(collections) });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err?.message || String(err) });
    }
  });

  // AI Invoice Recognition Endpoint (Image, PDF, or text/CSV/Excel content).
  app.post("/api/recognize-invoice", async (req, res) => {
    try {
      const { fileBase64, mimeType, fileName, textContent } = req.body || {};

      if (!fileBase64 && !textContent) {
        return res.status(400).json({
          error: "Please provide fileBase64 or textContent of the invoice.",
        });
      }

      const apiKey = (process.env.GEMINI_API_KEY || "").trim();
      if (!apiKey) {
        return res.status(503).json({
          error:
            "GEMINI_API_KEY is not configured on the server. Please add your GEMINI_API_KEY in the environment settings.",
          fallbackAvailable: true,
        });
      }

      const result = await recognizeInvoiceWithGemini({
        apiKey,
        fileBase64,
        mimeType,
        fileName,
        textContent,
      });

      return res.json({
        success: true,
        data: result.data,
        warnings: result.warnings,
        repaired: result.repaired,
        rawModel: result.model,
      });
    } catch (error: any) {
      console.error("Invoice recognition error:", error);
      const status = error instanceof FatalAiError ? error.status : 500;
      const isTemporary =
        status === 503 ||
        status === 429 ||
        /high demand|busy|unavailable|quota|temporar/i.test(
          error?.message || "",
        );
      return res.status(isTemporary ? 503 : status).json({
        error: error?.message || "Failed to process invoice with AI",
        isTemporary,
        fallbackAvailable: true,
      });
    }
  });
}
