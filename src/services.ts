import { hashPassword, verifyPassword } from "./passwords.js";
import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import { Repository, type User, type Article } from "./data.js";
import { fail } from "./errors.js";
export class Services {
  constructor(
    public repo: Repository,
    private secret: string,
  ) {}
  token(u: User) {
    return jwt.sign({ id: u.id }, this.secret, {
      expiresIn: "1d",
      algorithm: "HS256",
    });
  }
  authenticate(token?: string) {
    if (!token) return fail(401, "token", "is missing");
    try {
      const p = jwt.verify(token, this.secret, { algorithms: ["HS256"] }) as {
        id: number;
      };
      const u = this.repo.user(p.id);
      if (!u) throw Error();
      return u;
    } catch {
      return fail(401, "token", "is invalid");
    }
  }
  userView(u: User) {
    return {
      email: u.email,
      username: u.username,
      bio: u.bio,
      image: u.image,
      token: this.token(u),
    };
  }
  profile(u: User, viewer?: User) {
    return {
      username: u.username,
      bio: u.bio,
      image: u.image,
      following: viewer ? this.repo.follows(viewer.id, u.id) : false,
    };
  }
  unique(data: { email?: string; username?: string }, exclude?: number) {
    for (const field of ["email", "username"] as const)
      if (
        data[field] &&
        this.repo
          .users()
          .some((u) => u.id !== exclude && u[field] === data[field])
      )
        fail(409, field, "has already been taken");
  }
  async register(data: { username: string; email: string; password: string }) {
    const hash = await hashPassword(data.password);
    this.unique(data);
    return this.repo.saveUser({
      ...data,
      password: hash,
      bio: null,
      image: null,
    });
  }
  async login(data: { email: string; password: string }) {
    const u = this.repo.users().find((u) => u.email === data.email);
    if (!u || !(await verifyPassword(data.password, u.password)))
      return fail(401, "credentials", "invalid");
    return u;
  }
  async updateUser(u: User, data: Partial<Omit<User, "id">>) {
    this.unique(data, u.id);
    const changed = { ...u, ...data };
    if (data.password) changed.password = await hashPassword(data.password);
    changed.bio = changed.bio || null;
    changed.image = changed.image || null;
    return this.repo.saveUser(changed, u.id);
  }
  getProfile(username: string) {
    return (
      this.repo.users().find((u) => u.username === username) ??
      fail(404, "profile", "not found")
    );
  }
  article(slug: string) {
    return (
      this.repo.articles().find((a) => a.slug === slug) ??
      fail(404, "article", "not found")
    );
  }
  articleView(a: Article, viewer?: User, summary = false) {
    const { id, authorId, ...data } = a;
    const favorites = this.repo.favorites(id);
    const result: Record<string, unknown> = {
      ...data,
      favorited: !!viewer && favorites.includes(viewer.id),
      favoritesCount: favorites.length,
      author: this.profile(this.repo.user(authorId)!, viewer),
    };
    if (summary) delete result.body;
    return result;
  }
  createArticle(
    u: User,
    data: {
      title: string;
      description: string;
      body: string;
      tagList: string[];
    },
  ) {
    const now = new Date().toISOString();
    return this.repo.saveArticle({
      ...data,
      slug: this.slug(data.title),
      authorId: u.id,
      createdAt: now,
      updatedAt: now,
    });
  }
  slug(title: string) {
    return `${title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")}-${randomUUID()}`;
  }
  own(a: Article, u: User) {
    if (a.authorId !== u.id) fail(403, "article", "forbidden");
  }
  updateArticle(
    a: Article,
    u: User,
    data: Partial<Pick<Article, "title" | "description" | "body" | "tagList">>,
  ) {
    this.own(a, u);
    return this.repo.saveArticle(
      {
        ...a,
        ...data,
        slug:
          data.title && data.title !== a.title ? this.slug(data.title) : a.slug,
        updatedAt: new Date(
          Math.max(Date.now(), Date.parse(a.updatedAt) + 1),
        ).toISOString(),
      },
      a.id,
    );
  }
  list(
    q: {
      limit: number;
      offset: number;
      tag?: string;
      author?: string;
      favorited?: string;
    },
    viewer?: User,
    feed = false,
  ) {
    let rows = this.repo
      .articles()
      .filter(
        (a) =>
          (!q.tag || a.tagList.includes(q.tag)) &&
          (!q.author || this.repo.user(a.authorId)?.username === q.author) &&
          (!q.favorited ||
            this.repo
              .favorites(a.id)
              .some((id) => this.repo.user(id)?.username === q.favorited)) &&
          (!feed || (!!viewer && this.repo.follows(viewer.id, a.authorId))),
      );
    rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id);
    return {
      articles: rows
        .slice(q.offset, q.offset + q.limit)
        .map((a) => this.articleView(a, viewer, true)),
      articlesCount: rows.length,
    };
  }
  commentView(c: Record<string, unknown>, viewer?: User) {
    return {
      id: Number(c.id),
      body: c.body,
      createdAt: c.createdAt,
      updatedAt: c.createdAt,
      author: this.profile(this.repo.user(Number(c.authorId))!, viewer),
    };
  }
}
