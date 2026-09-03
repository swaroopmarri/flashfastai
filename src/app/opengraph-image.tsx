import { ImageResponse } from "next/og";

export const alt = "Campaign Monster";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #4f46e5 0%, #0ea5e9 100%)",
        }}
      >
        <div style={{ fontSize: 88, fontWeight: 700, color: "white" }}>Campaign Monster</div>
        <div style={{ marginTop: 24, fontSize: 34, color: "rgba(255,255,255,0.9)" }}>
          Upload contacts. Verify every email. Send with confidence.
        </div>
      </div>
    ),
    { ...size },
  );
}
