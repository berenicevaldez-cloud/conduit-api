import { test } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createApp } from "../src/app.js";
import { Repository } from "../src/data.js";
function setup() {
  const repo = new Repository(":memory:");
  return {
    repo,
    api: request(createApp(repo, "test-secret-at-least-thirty-two-characters")),
  };
}
async function register(api: ReturnType<typeof request>, name: string) {
  const r = await api
    .post("/api/users")
    .send({
      user: {
        username: name,
        email: `${name}@test.com`,
        password: "password123",
      },
    })
    .expect(201);
  return r.body.user.token as string;
}
test("owner authorization rejects another user and preserves article", async () => {
  const { repo, api } = setup();
  try {
    const a = await register(api, "alice");
    const b = await register(api, "bob");
    const r = await api
      .post("/api/articles")
      .set("Authorization", `Token ${a}`)
      .send({
        article: {
          title: "Private edit",
          description: "desc",
          body: "original",
        },
      })
      .expect(201);
    const url = `/api/articles/${r.body.article.slug}`;
    await api
      .put(url)
      .set("Authorization", `Token ${b}`)
      .send({ article: { body: "hijacked" } })
      .expect(403);
    await api.delete(url).set("Authorization", `Token ${b}`).expect(403);
    const actual = await api.get(url).expect(200);
    assert.equal(actual.body.article.body, "original");
  } finally {
    repo.db.close();
  }
});
test("malformed JWT and malformed JSON do not cause server errors", async () => {
  const { repo, api } = setup();
  try {
    await api.get("/api/user").set("Authorization", "Token forged").expect(401);
    await api
      .post("/api/users")
      .set("Content-Type", "application/json")
      .send("{bad")
      .expect(400);
  } finally {
    repo.db.close();
  }
});
test("passwords are hashed and password changes affect login", async () => {
  const { repo, api } = setup();
  try {
    const token = await register(api, "passwordtest");
    assert.notEqual(repo.users()[0].password, "password123");
    await api
      .put("/api/user")
      .set("Authorization", `Token ${token}`)
      .send({ user: { password: "new-password-123" } })
      .expect(200);
    await api
      .post("/api/users/login")
      .send({
        user: { email: "passwordtest@test.com", password: "password123" },
      })
      .expect(401);
    await api
      .post("/api/users/login")
      .send({
        user: { email: "passwordtest@test.com", password: "new-password-123" },
      })
      .expect(200);
  } finally {
    repo.db.close();
  }
});
test("duplicate titles, pagination counts and list projection", async () => {
  const { repo, api } = setup();
  try {
    const t = await register(api, "writer");
    const slugs = [];
    for (let i = 0; i < 2; i++) {
      const r = await api
        .post("/api/articles")
        .set("Authorization", `Token ${t}`)
        .send({
          article: {
            title: "Same title",
            description: "desc",
            body: "content",
          },
        })
        .expect(201);
      slugs.push(r.body.article.slug);
    }
    assert.notEqual(slugs[0], slugs[1]);
    const list = await api
      .get("/api/articles?author=writer&limit=1&offset=1")
      .expect(200);
    assert.equal(list.body.articlesCount, 2);
    assert.equal(list.body.articles.length, 1);
    assert.equal(list.body.articles[0].slug, slugs[0]);
    assert.equal("body" in list.body.articles[0], false);
  } finally {
    repo.db.close();
  }
});
