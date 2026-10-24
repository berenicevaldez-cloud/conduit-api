import { test } from "node:test";
import assert from "node:assert/strict";
import {
  articleCreate,
  articleUpdate,
  commentCreate,
} from "../src/validation.js";

test("article creation and updates preserve body formatting", () => {
  const body = "  Primera linea\n\nSegunda linea\n";

  const created = articleCreate.parse({
    title: "Articulo",
    description: "Descripcion",
    body,
  });

  const updated = articleUpdate.parse({ body });

  assert.equal(created.body, body);
  assert.equal(updated.body, body);
});

test("comments preserve body formatting", () => {
  const body = "  Mi comentario\n";

  assert.equal(commentCreate.parse({ body }).body, body);
});

test("blank article and comment bodies are rejected", () => {
  for (const body of ["", "   ", "\n\t "]) {
    assert.equal(
      articleCreate.safeParse({
        title: "Articulo",
        description: "Descripcion",
        body,
      }).success,
      false,
    );

    assert.equal(articleUpdate.safeParse({ body }).success, false);
    assert.equal(commentCreate.safeParse({ body }).success, false);
  }
});