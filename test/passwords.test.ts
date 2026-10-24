import { test } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import bcrypt from "bcryptjs";
import { createApp } from "../src/app.js";
import { Repository } from "../src/data.js";
import { hashPassword, verifyPassword } from "../src/passwords.js";

test("different passwords sharing 72 bytes cannot authenticate as each other", async () => {
  const repo = new Repository(":memory:");
  const api = request(
    createApp(repo, "test-secret-at-least-thirty-two-characters"),
  );
  try {
    const prefix = "a".repeat(72);
    const user = {
      username: "long",
      email: "long@test.com",
      password: prefix + "X",
    };
    const registered = await api.post("/api/users").send({ user }).expect(201);
    assert.ok(repo.users()[0].password.startsWith("scrypt-v1$"));
    await api
      .post("/api/users/login")
      .send({ user: { email: user.email, password: prefix + "Y" } })
      .expect(401);
    await api
      .post("/api/users/login")
      .send({ user: { email: user.email, password: user.password } })
      .expect(200);

    // Password updates must use the same safe algorithm as registration.
    const next = prefix + "Z";
    await api
      .put("/api/user")
      .set("Authorization", `Token ${registered.body.user.token}`)
      .send({ user: { password: next } })
      .expect(200);
    await api
      .post("/api/users/login")
      .send({ user: { email: user.email, password: user.password } })
      .expect(401);
    await api
      .post("/api/users/login")
      .send({ user: { email: user.email, password: next } })
      .expect(200);
  } finally {
    repo.db.close();
  }
});

test("Unicode passwords distinguish suffixes beyond bcrypt's byte limit", async () => {
  const prefix = "ñ".repeat(40); // 80 UTF-8 bytes, only 40 characters.
  const hash = await hashPassword(prefix + "X");
  assert.equal(await verifyPassword(prefix + "X", hash), true);
  assert.equal(await verifyPassword(prefix + "Y", hash), false);
});

test("hashes use random salts and malformed stored hashes are rejected", async () => {
  const a = await hashPassword("same-password");
  const b = await hashPassword("same-password");
  assert.notEqual(a, b);
  assert.equal(
    await verifyPassword("same-password", "scrypt-v1$invalid$hash"),
    false,
  );
});

test("legacy bcrypt users still log in without silently truncating long input", async () => {
  const repo = new Repository(":memory:");
  const api = request(
    createApp(repo, "test-secret-at-least-thirty-two-characters"),
  );
  try {
    const password = "a".repeat(72);
    repo.saveUser({
      username: "legacy",
      email: "legacy@test.com",
      password: await bcrypt.hash(password, 12),
      bio: null,
      image: null,
    });
    await api
      .post("/api/users/login")
      .send({ user: { email: "legacy@test.com", password } })
      .expect(200);
    await api
      .post("/api/users/login")
      .send({
        user: { email: "legacy@test.com", password: password + "extra" },
      })
      .expect(401);
  } finally {
    repo.db.close();
  }
});
