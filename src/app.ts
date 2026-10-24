import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import cors from "cors";
import { Repository, type User } from "./data.js";
import { Services } from "./services.js";
import { ApiError, fail } from "./errors.js";
import * as v from "./validation.js";
export function createApp(repo: Repository, secret: string) {
  const app = express();
  const s = new Services(repo, secret);
  app.use(cors());
  app.use(express.json({ limit: "100kb" }));
  const current = (req: Request, required = false): User | undefined => {
    const h = req.get("authorization");
    if (!h && !required) return undefined;
    return s.authenticate(h?.startsWith("Token ") ? h.slice(6) : undefined);
  };
  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });
  app.post("/api/users", async (req, res) => {
    const u = await s.register(v.validate(v.registration, req.body?.user));
    res.status(201).json({ user: s.userView(u) });
  });
  app.post("/api/users/login", async (req, res) => {
    const u = await s.login(v.validate(v.login, req.body?.user));
    res.json({ user: s.userView(u) });
  });
  app.get("/api/user", (req, res) => {
    res.json({ user: s.userView(current(req, true)!) });
  });
  app.put("/api/user", async (req, res) => {
    const u = current(req, true)!;
    res.json({
      user: s.userView(
        await s.updateUser(u, v.validate(v.userUpdate, req.body?.user)),
      ),
    });
  });
  app.get("/api/profiles/:username", (req, res) => {
    res.json({
      profile: s.profile(
        s.getProfile(String(req.params.username)),
        current(req),
      ),
    });
  });
  app.post("/api/profiles/:username/follow", (req, res) => {
    const u = current(req, true)!;
    const target = s.getProfile(String(req.params.username));
    repo.follow(u.id, target.id, true);
    res.json({ profile: s.profile(target, u) });
  });
  app.delete("/api/profiles/:username/follow", (req, res) => {
    const u = current(req, true)!;
    const target = s.getProfile(String(req.params.username));
    repo.follow(u.id, target.id, false);
    res.json({ profile: s.profile(target, u) });
  });
  app.get("/api/articles/feed", (req, res) => {
    const u = current(req, true)!;
    res.json(s.list(v.validate(v.pagination, req.query), u, true));
  });
  app.get("/api/articles", (req, res) => {
    res.json(s.list(v.validate(v.pagination, req.query), current(req)));
  });
  app.post("/api/articles", (req, res) => {
    const u = current(req, true)!;
    res
      .status(201)
      .json({
        article: s.articleView(
          s.createArticle(u, v.validate(v.articleCreate, req.body?.article)),
          u,
        ),
      });
  });
  app.get("/api/articles/:slug", (req, res) => {
    res.json({
      article: s.articleView(s.article(String(req.params.slug)), current(req)),
    });
  });
  app.put("/api/articles/:slug", (req, res) => {
    const u = current(req, true)!;
    const a = s.article(String(req.params.slug));
    res.json({
      article: s.articleView(
        s.updateArticle(a, u, v.validate(v.articleUpdate, req.body?.article)),
        u,
      ),
    });
  });
  app.delete("/api/articles/:slug", (req, res) => {
    const u = current(req, true)!;
    const a = s.article(String(req.params.slug));
    s.own(a, u);
    repo.deleteArticle(a.id);
    res.sendStatus(204);
  });
  for (const method of ["post", "delete"] as const)
    app[method]("/api/articles/:slug/favorite", (req, res) => {
      const u = current(req, true)!;
      const a = s.article(String(req.params.slug));
      repo.favorite(u.id, a.id, method === "post");
      res.json({ article: s.articleView(a, u) });
    });
  app.get("/api/articles/:slug/comments", (req, res) => {
    const a = s.article(String(req.params.slug));
    res.json({
      comments: repo.comments(a.id).map((c) => s.commentView(c, current(req))),
    });
  });
  app.post("/api/articles/:slug/comments", (req, res) => {
    const u = current(req, true)!;
    const a = s.article(String(req.params.slug));
    const data = v.validate(v.commentCreate, req.body?.comment);
    res
      .status(201)
      .json({
        comment: s.commentView(repo.addComment(a.id, u.id, data.body), u),
      });
  });
  app.delete("/api/articles/:slug/comments/:id", (req, res) => {
    const u = current(req, true)!;
    const a = s.article(String(req.params.slug));
    const c =
      repo.comments(a.id).find((c) => Number(c.id) === Number(req.params.id)) ??
      fail(404, "comment", "not found");
    if (Number(c.authorId) !== u.id) fail(403, "comment", "forbidden");
    repo.deleteComment(Number(c.id));
    res.sendStatus(204);
  });
  app.get("/api/tags", (_req, res) => {
    res.json({ tags: [...new Set(repo.articles().flatMap((a) => a.tagList))] });
  });
  app.use((_req, res) => {
    res.status(404).json({ errors: { route: ["not found"] } });
  });
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ApiError) {
      res.status(err.status).json({ errors: err.errors });
      return;
    }
    if (err instanceof SyntaxError && "body" in err) {
      res.status(400).json({ errors: { body: ["invalid JSON"] } });
      return;
    }
    if (
  err instanceof Error &&
  "type" in err &&
  err.type === "entity.too.large"
) {
  res.status(413).json({
    errors: {
      body: ["request exceeds the 100 KB limit"],
    },
  });
  return;
}
    console.error(err);
    res.status(500).json({ errors: { server: ["internal error"] } });
  });
  return app;
}
