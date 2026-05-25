import DOMPurify from "dompurify";

/**
 * Sanitize an HTML string before rendering with dangerouslySetInnerHTML.
 * Strips <script>, event handlers, javascript: URLs, etc.
 */
export function sanitizeHtml(input: unknown): string {
  if (input == null) return "";
  const str = typeof input === "string" ? input : String(input);
  return DOMPurify.sanitize(str, { USE_PROFILES: { html: true } });
}
