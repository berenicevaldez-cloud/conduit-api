import { test } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createApp } from "../src/app.js";
import { Repository } from "../src/data.js";

test("oversized JSON returns 413 and the API remains available", async () => {
  const repo = new Repository(":memory:");
  const api = request(
    createApp(repo, "test-secret-at-least-thirty-two-characters"),
  );

  try {
    const response = await api
      .post("/api/articles")
      .send({
        article: {
          title: "Articulo grande",
          description: "Prueba de limite",
          body: "x".repeat(110_000),
        },
      })
      .expect(413);

    assert.deepEqual(response.body, {
      errors: {
        body: ["request exceeds the 100 KB limit"],
      },
    });

    await api.get("/health").expect(200, { status: "ok" });
  } finally {
    repo.db.close();
  }
});