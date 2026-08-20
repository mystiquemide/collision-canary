import { ImageResponse } from "next/og";

export const alt =
  "Collision Canary: catch the bug only two users can make";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          backgroundColor: "#F3EFE8",
          padding: "72px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginBottom: "28px",
          }}
        >
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "10px",
              backgroundColor: "#F5B93B",
              display: "flex",
              marginRight: "16px",
            }}
          />
          <div style={{ fontSize: "30px", fontWeight: 700, color: "#272C34", display: "flex" }}>
            Collision Canary
          </div>
        </div>
        <div
          style={{
            fontSize: "72px",
            fontWeight: 800,
            color: "#272C34",
            lineHeight: 1.05,
            maxWidth: "1040px",
            display: "flex",
          }}
        >
          Catch the bug only two users can make.
        </div>
        <div
          style={{
            fontSize: "30px",
            color: "#5C6470",
            marginTop: "28px",
            display: "flex",
          }}
        >
          Two real browsers. One last seat. One honest proof.
        </div>
      </div>
    ),
    { ...size },
  );
}
