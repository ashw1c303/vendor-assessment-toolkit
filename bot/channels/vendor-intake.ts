import { defineChannel, POST } from "@cursor/bdk/channels";
import { intakeBody, type IntakeBody } from "../lib/schemas.js";

function structured(body: IntakeBody): boolean {
  return (
    body.requesterName !== undefined ||
    body.vendorName !== undefined ||
    body.serviceCategory !== undefined ||
    body.urgency !== undefined ||
    body.securityCompliance !== undefined ||
    body.integrationSpecs !== undefined ||
    body.followUpNote !== undefined
  );
}

function json(payload: unknown, status = 202): Response {
  return Response.json(payload, { status });
}

export default defineChannel({
  routes: [
    POST("/intake", {
      description: "Accept a vendor request as structured fields, free text, or both.",
      bodySchema: intakeBody,
      handler: async (_request, { body, callTool, send, waitUntil }) => {
        const parsed = intakeBody.safeParse(body);
        if (!parsed.success) return json({ ok: false, error: "invalid_body" });
        const input = parsed.data;
        if (!structured(input)) {
          const message = input.message?.trim();
          if (message === undefined || message === "") {
            return json({ ok: false, error: "empty_intake" });
          }
          waitUntil(send(message, { title: "Vendor request" }));
          return json({ ok: true, accepted: true, mode: "model" });
        }
        try {
          const outcome = await callTool("record_vendor_request", {
            requesterName: input.requesterName,
            vendorName: input.vendorName,
            serviceCategory: input.serviceCategory,
            urgency: input.urgency,
            securityCompliance: input.securityCompliance,
            integrationSpecs: input.integrationSpecs,
          });
          const result = outcome.result;
          const requestId =
            typeof result === "object" && result !== null && "request" in result
              ? (result as { request?: { id?: string } }).request?.id
              : undefined;
          const message = input.message?.trim();
          if (requestId !== undefined && message !== undefined && message !== "") {
            waitUntil(
              send(
                `Request ${requestId} is persisted. Additional note from the sender:\n${message}\nUpdate ${requestId} if this adds fields. Do not research while missingFields is non-empty.`,
                { continuationToken: `vendor:${requestId}`, title: `Vendor ${requestId}` },
              ),
            );
          }
          return json({ ok: !outcome.isError, mode: "record", result: outcome.result });
        } catch (error) {
          const message = error instanceof Error ? error.message : "intake_failed";
          return json({ ok: false, error: message });
        }
      },
    }),
    POST("/reply", {
      description: "Add fields or a note to an existing vendor request.",
      bodySchema: intakeBody,
      handler: async (_request, { body, callTool, send, waitUntil }) => {
        const parsed = intakeBody.safeParse(body);
        if (!parsed.success) return json({ ok: false, error: "invalid_body" });
        const input = parsed.data;
        const requestId = input.requestId?.trim();
        if (requestId === undefined || requestId === "") {
          return json({ ok: false, error: "request_id_required" });
        }
        if (structured(input)) {
          try {
            const outcome = await callTool("update_vendor_request", {
              requestId,
              requesterName: input.requesterName,
              vendorName: input.vendorName,
              serviceCategory: input.serviceCategory,
              urgency: input.urgency,
              securityCompliance: input.securityCompliance,
              integrationSpecs: input.integrationSpecs,
              followUpNote: input.followUpNote,
            });
            const followUp = await callTool("draft_collection_followup", { requestId });
            const message = input.message?.trim();
            if (message !== undefined && message !== "") {
              waitUntil(
                send(
                  `The sender replied on request ${requestId}:\n${message}\nUpdate that same record. Do not research while missingFields is non-empty.`,
                  { continuationToken: `vendor:${requestId}`, title: `Vendor ${requestId}` },
                ),
              );
            }
            return json({
              ok: !outcome.isError,
              mode: "update",
              result: outcome.result,
              followUp: followUp.result,
            });
          } catch (error) {
            const message = error instanceof Error ? error.message : "reply_failed";
            return json({ ok: false, error: message });
          }
        }
        const message = input.message?.trim();
        if (message === undefined || message === "") return json({ ok: false, error: "empty_reply" });
        waitUntil(
          send(
            `Continue request ${requestId}. Sender said:\n${message}\nCall update_vendor_request on this id. Do not research while required fields are missing.`,
            { continuationToken: `vendor:${requestId}`, title: `Vendor ${requestId}` },
          ),
        );
        return json({ ok: true, accepted: true, mode: "model", requestId });
      },
    }),
  ],
});
