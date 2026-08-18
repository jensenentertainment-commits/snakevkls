import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/require-role";
import { validateChatInput } from "@/lib/intelligence/shared/chat-input";
import {
  chatInputError,
  chatServerError,
  logChatServerError,
} from "@/lib/intelligence/shared/chat-server";
import { runReadOnlyEmployeeRequest } from "@/lib/intelligence/workforce/runtime";

export async function POST(req: Request) {
  try {
    const auth = await requireRole(["admin"]);
    if (!auth.ok) return auth.response;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return chatInputError("Forespørselen må inneholde gyldig JSON.");
    }

    const input = validateChatInput(body);
    if (!input.ok) return chatInputError(input.error);

    const result = await runReadOnlyEmployeeRequest({
      userId: auth.user.id,
      userRole: auth.profile.role,
      employeeId: "arne",
      capabilityId: "snake.assess_development",
      request: input.value,
    });

    if (!result.ok) {
      logChatServerError(
        "arne",
        result.outcome === "context_failed"
          ? "context"
          : result.outcome === "model_failed"
            ? "openai"
            : "unexpected",
        new Error(`Workforce run ${result.runId} failed: ${result.outcome}`)
      );
      const response = chatServerError();
      response.headers.set("x-workforce-run-id", result.runId);
      return response;
    }

    return NextResponse.json(
      { answer: result.answer },
      { headers: { "x-workforce-run-id": result.runId } }
    );
  } catch (error) {
    logChatServerError("arne", "unexpected", error);
    return chatServerError();
  }
}
