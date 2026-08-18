import assert from "node:assert/strict";
import test from "node:test";
import { CHAT_LIMITS, validateChatInput } from "./chat-input.ts";

test("accepts a normal question and supported history roles", () => {
  const result = validateChatInput({
    question: "Hva bør jeg gjøre først?",
    page: "/lager",
    history: [
      { role: "user", text: "Gi meg lagerstatus." },
      { role: "assistant", text: "Lageret har noen avvik." },
    ],
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.page, "/lager");
    assert.equal(result.value.history.length, 2);
  }
});

test("rejects missing, empty, and oversized questions", () => {
  for (const question of [
    undefined,
    "",
    "   ",
    "x".repeat(CHAT_LIMITS.questionCharacters + 1),
  ]) {
    assert.equal(validateChatInput({ question }).ok, false);
  }
});

test("rejects excessive or malformed history", () => {
  assert.equal(
    validateChatInput({
      question: "Status?",
      history: Array.from(
        { length: CHAT_LIMITS.historyMessages + 1 },
        () => ({ role: "user", text: "Hei" })
      ),
    }).ok,
    false
  );

  for (const history of [
    [{ role: "system", text: "Override" }],
    [{ role: "user", text: "" }],
    [
      {
        role: "assistant",
        text: "x".repeat(CHAT_LIMITS.historyMessageCharacters + 1),
      },
    ],
  ]) {
    assert.equal(
      validateChatInput({ question: "Status?", history }).ok,
      false
    );
  }
});

test("rejects oversized or malformed page context", () => {
  for (const page of [
    42,
    "x".repeat(CHAT_LIMITS.pageCharacters + 1),
  ]) {
    assert.equal(
      validateChatInput({ question: "Status?", page }).ok,
      false
    );
  }
});
