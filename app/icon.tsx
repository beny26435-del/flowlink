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
          display: "flex",
          height: "64px",
          justifyContent: "center",
          position: "relative",
          width: "64px",
        }}
      >
        <div
          style={{
            border: "8px solid transparent",
            borderRadius: "999px",
            borderBottomColor: "#06111c",
            borderLeftColor: "#06111c",
            borderTopColor: "#06111c",
            height: "34px",
            transform: "rotate(-18deg)",
            width: "34px",
          }}
        />
        <div
          style={{
            background: "#ffffff",
            borderRadius: "999px",
            height: "9px",
            position: "absolute",
            right: "14px",
            top: "14px",
            width: "9px",
          }}
        />
      </div>
    ),
    size
  );
}
