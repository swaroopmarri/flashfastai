import sanitizeHtml from "sanitize-html";

// Pasted content (Excel tables via Outlook/Word, screenshots, etc.) arrives
// full of vendor-specific markup and can carry scripts/styles that have no
// place in an email. This keeps only tags/attributes that render safely and
// consistently across email clients, matching what campaignSend.ts sends.
const ALLOWED_TAGS = [
  "p", "br", "b", "strong", "i", "em", "u", "s", "a", "img",
  "ul", "ol", "li", "blockquote", "h1", "h2", "h3", "h4", "h5", "h6",
  "table", "thead", "tbody", "tr", "th", "td", "hr", "span", "div",
];

const ALLOWED_STYLES = {
  "*": {
    color: [/^.*$/],
    "background-color": [/^.*$/],
    "text-align": [/^.*$/],
    "font-weight": [/^.*$/],
    "font-style": [/^.*$/],
    "border": [/^.*$/],
    "border-collapse": [/^.*$/],
    "width": [/^.*$/],
  },
};

export function sanitizeCampaignHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      a: ["href", "target", "rel"],
      img: ["src", "alt", "width", "height"],
      table: ["border", "cellpadding", "cellspacing"],
      td: ["colspan", "rowspan"],
      th: ["colspan", "rowspan"],
      "*": ["style"],
    },
    allowedStyles: ALLOWED_STYLES,
    // Deliberately excludes "data" -- pasted images are uploaded to Storage
    // client-side and swapped to a hosted URL before save is allowed to
    // proceed (see RichTextEditor's uploading guard), so a surviving data:
    // URL here would only mean the upload never finished.
    allowedSchemes: ["http", "https"],
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer", target: "_blank" }),
    },
  });
}
