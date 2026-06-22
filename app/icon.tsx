import { ImageResponse } from "next/og";

export const size = {
  width: 64,
  height: 64,
};
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: "linear-gradient(135deg, #66f2bd, #75e7ff)",
          borderRadius: "18px",
          color: "#06111c",
          display: "flex",
          fontFamily: "Inter, Arial, sans-serif",
          fontSize: "44px",
          fontWeight: 900,
          height: "64px",
          justifyContent: "center",
          width: "64px",
        }}
      >
        A
      </div>
    ),
    size
  );
}
