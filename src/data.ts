import { DatabaseSync } from "node:sqlite";
export interface User {
  id: number;
  username: string;
  email: string;
  password: string;
  bio: string | null;
  image: string | null;
}
export interface Article {
  id: number;
  slug: string;
  title: string;
  description: string;
  body: string;
  tagList: string[];
  authorId: number;
  createdAt: string;
  updatedAt: string;
}
// All SQL is confined to this repository. JSON payloads keep the take-home schema small.
export class Repository {
  db: DatabaseSync;
  constructor(path = "conduit.sqlite") {
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA foreign_keys=ON;
      CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, username TEXT NOT NULL UNIQUE, email TEXT NOT NULL UNIQUE, password TEXT NOT NULL, bio TEXT, image TEXT);
      CREATE TABLE IF NOT EXISTS articles(id INTEGER PRIMARY KEY, slug TEXT NOT NULL UNIQUE, payload TEXT NOT NULL, authorId INTEGER NOT NULL REFERENCES users(id));
      CREATE TABLE IF NOT EXISTS follows(userId INTEGER REFERENCES users(id), targetId INTEGER REFERENCES users(id), PRIMARY KEY(userId,targetId));
      CREATE TABLE IF NOT EXISTS favorites(userId INTEGER REFERENCES users(id), articleId INTEGER REFERENCES articles(id) ON DELETE CASCADE, PRIMARY KEY(userId,articleId));
      CREATE TABLE IF NOT EXISTS comments(id INTEGER PRIMARY KEY, articleId INTEGER REFERENCES articles(id) ON DELETE CASCADE, authorId INTEGER REFERENCES users(id), body TEXT, createdAt TEXT);`);
  }
  users(): User[] {
    return this.db.prepare("SELECT * FROM users").all() as unknown as User[];
  }
  user(id: number) {
    return this.users().find((u) => u.id === id);
  }
  saveUser(u: Omit<User, "id">, id?: number): User {
    if (id)
      this.db
        .prepare(
          "UPDATE users SET username=?,email=?,password=?,bio=?,image=? WHERE id=?",
        )
        .run(u.username, u.email, u.password, u.bio, u.image, id);
    else
      id = Number(
        this.db
          .prepare(
            "INSERT INTO users(username,email,password,bio,image) VALUES(?,?,?,?,?)",
          )
          .run(u.username, u.email, u.password, u.bio, u.image).lastInsertRowid,
      );
    return this.user(id)!;
  }
  articles(): Article[] {
    return this.db
      .prepare("SELECT id,payload FROM articles")
      .all()
      .map((r) => ({ ...JSON.parse(String(r.payload)), id: Number(r.id) }));
  }
  saveArticle(a: Omit<Article, "id">, id?: number): Article {
    if (id)
      this.db
        .prepare("UPDATE articles SET slug=?,payload=? WHERE id=?")
        .run(a.slug, JSON.stringify(a), id);
    else
      id = Number(
        this.db
          .prepare("INSERT INTO articles(slug,payload,authorId) VALUES(?,?,?)")
          .run(a.slug, JSON.stringify(a), a.authorId).lastInsertRowid,
      );
    return { ...a, id };
  }
  deleteArticle(id: number) {
    this.db.prepare("DELETE FROM articles WHERE id=?").run(id);
  }
  follows(userId: number, targetId: number) {
    return !!this.db
      .prepare("SELECT 1 FROM follows WHERE userId=? AND targetId=?")
      .get(userId, targetId);
  }
  follow(userId: number, targetId: number, enabled: boolean) {
    this.db
      .prepare(
        enabled
          ? "INSERT OR IGNORE INTO follows VALUES(?,?)"
          : "DELETE FROM follows WHERE userId=? AND targetId=?",
      )
      .run(userId, targetId);
  }
  favorite(userId: number, articleId: number, enabled: boolean) {
    this.db
      .prepare(
        enabled
          ? "INSERT OR IGNORE INTO favorites VALUES(?,?)"
          : "DELETE FROM favorites WHERE userId=? AND articleId=?",
      )
      .run(userId, articleId);
  }
  favorites(articleId: number): number[] {
    return this.db
      .prepare("SELECT userId FROM favorites WHERE articleId=?")
      .all(articleId)
      .map((r) => Number(r.userId));
  }
  comments(articleId: number) {
    return this.db
      .prepare("SELECT * FROM comments WHERE articleId=? ORDER BY id DESC")
      .all(articleId);
  }
  addComment(articleId: number, authorId: number, body: string) {
    const createdAt = new Date().toISOString();
    const id = Number(
      this.db
        .prepare(
          "INSERT INTO comments(articleId,authorId,body,createdAt) VALUES(?,?,?,?)",
        )
        .run(articleId, authorId, body, createdAt).lastInsertRowid,
    );
    return this.comments(articleId).find((c) => Number(c.id) === id)!;
  }
  deleteComment(id: number) {
    this.db.prepare("DELETE FROM comments WHERE id=?").run(id);
  }
}
