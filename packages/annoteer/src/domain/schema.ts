import { Schema } from "effect";

const text = (max: number) =>
  Schema.String.pipe(
    Schema.minLength(1),
    Schema.maxLength(max),
    Schema.filter((value) => value.trim().length > 0),
  );
export const AnchorSchema = Schema.Struct({
  kind: Schema.Literal("element", "text"),
  selector: text(2048),
  tag: text(40),
  label: Schema.String.pipe(Schema.maxLength(300)),
  quote: Schema.optional(Schema.String.pipe(Schema.maxLength(2000))),
  prefix: Schema.optional(Schema.String.pipe(Schema.maxLength(100))),
  suffix: Schema.optional(Schema.String.pipe(Schema.maxLength(100))),
  offset: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.nonNegative())),
});
export const CreateAnnotationSchema = Schema.Struct({
  path: text(2048).pipe(
    Schema.filter(
      (path) =>
        path.startsWith("/") &&
        !path.startsWith("//") &&
        !path.includes("\\") &&
        Array.from(path).every((character) => character.charCodeAt(0) >= 32),
    ),
  ),
  deployment: text(100),
  anchor: AnchorSchema,
  body: text(5000),
});
export const SessionSchema = Schema.Struct({ token: text(128), name: text(80) });
export const ReplySchema = Schema.Struct({ body: text(5000) });
export const StatusSchema = Schema.Struct({ status: Schema.Literal("open", "resolved") });
export const InviteSchema = Schema.Struct({
  role: Schema.Literal("agency", "client"),
  label: text(100),
  days: Schema.Number.pipe(Schema.int(), Schema.between(1, 90)),
});
export type Anchor = typeof AnchorSchema.Type;
export type CreateAnnotation = typeof CreateAnnotationSchema.Type;
export type Role = "agency" | "client";
export interface Reply {
  id: string;
  author: string;
  role: Role;
  body: string;
  createdAt: number;
}
export interface Annotation extends CreateAnnotation {
  id: string;
  author: string;
  status: "open" | "resolved";
  createdAt: number;
  replies: Reply[];
}
export interface Session {
  token: string;
  name: string;
  role: Role;
  expiresAt: number;
}
