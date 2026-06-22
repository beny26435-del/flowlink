import { ImageResponse } from "next/og";

export const alt = "Arclet stablecoin checkout on Arc";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background:
            "radial-gradient(circle at 12% 12%, rgba(117,231,255,0.22), transparent 30%), radial-gradient(circle at 92% 88%, rgba(102,242,189,0.18), transparent 34%), linear-gradient(135deg, #050913 0%, #07111d 46%, #04070d 100%)",
          color: "#f4fbff",
          display: "flex",
          fontFamily: "Inter, Arial, sans-serif",
          height: "100%",
          justifyContent: "space-between",
          padding: "70px",
          position: "relative",
          width: "100%",
        }}
      >
        <div
          style={{
            border: "1px solid rgba(177,222,255,0.12)",
            borderRadius: "38px",
            inset: "30px",
            position: "absolute",
          }}
        />
        <div
          style={{
            background: "linear-gradient(90deg, transparent, rgba(117,231,255,0.42), rgba(102,242,189,0.32), transparent)",
            borderRadius: "999px",
            filter: "blur(14px)",
            height: "42px",
            left: "70px",
            position: "absolute",
            top: "92px",
            transform: "rotate(-6deg)",
            width: "690px",
          }}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: "34px", maxWidth: "650px" }}>
          <div style={{ alignItems: "center", display: "flex", gap: "18px" }}>
            <div
              style={{
                alignItems: "center",
                background: "linear-gradient(135deg, #66f2bd, #75e7ff)",
                borderRadius: "24px",
                boxShadow: "0 18px 44px rgba(102,242,189,0.22)",
                color: "#06111c",
                display: "flex",
                fontSize: "48px",
                fontWeight: 900,
                height: "72px",
                justifyContent: "center",
                lineHeight: 1,
                width: "72px",
              }}
            >
              A
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: "44px", fontWeight: 850, letterSpacing: "-1px" }}>Arclet</div>
              <div style={{ color: "#97aaba", fontSize: "22px", fontWeight: 650 }}>Stablecoin checkout on Arc</div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
            <div style={{ display: "flex", flexDirection: "column", fontSize: "76px", fontWeight: 900, letterSpacing: "-2px", lineHeight: 0.98 }}>
              <span>Stablecoin checkout</span>
              <span>for Arc.</span>
            </div>
            <div style={{ color: "#c5d5df", fontSize: "28px", lineHeight: 1.35, maxWidth: "610px" }}>
              Accept native Arc USDC with shareable payment pages and onchain receipts.
            </div>
          </div>

          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            {["Arc Testnet", "Native USDC", "Invoices", "Tip Jar"].map((item) => (
              <div
                key={item}
                style={{
                  background: "rgba(255,255,255,0.07)",
                  border: "1px solid rgba(177,222,255,0.16)",
                  borderRadius: "999px",
                  color: "#dcebf3",
                  fontSize: "20px",
                  fontWeight: 750,
                  padding: "12px 18px",
                }}
              >
                {item}
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            background: "linear-gradient(180deg, rgba(17,27,40,0.92), rgba(8,14,22,0.78))",
            border: "1px solid rgba(177,222,255,0.18)",
            borderRadius: "34px",
            boxShadow: "0 26px 80px rgba(0,0,0,0.36)",
            display: "flex",
            flexDirection: "column",
            gap: "22px",
            padding: "30px",
            width: "380px",
          }}
        >
          <div style={{ alignItems: "center", display: "flex", justifyContent: "space-between" }}>
            <div style={{ color: "#97aaba", fontSize: "19px", fontWeight: 800, textTransform: "uppercase" }}>Checkout</div>
            <div
              style={{
                background: "rgba(102,242,189,0.12)",
                border: "1px solid rgba(102,242,189,0.34)",
                borderRadius: "999px",
                color: "#a6ffd9",
                fontSize: "18px",
                fontWeight: 800,
                padding: "8px 12px",
              }}
            >
              Payable
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div style={{ color: "#97aaba", fontSize: "18px" }}>Amount due</div>
            <div style={{ fontSize: "54px", fontWeight: 900, letterSpacing: "-1px" }}>125.00</div>
            <div style={{ color: "#75e7ff", fontSize: "22px", fontWeight: 800 }}>native Arc USDC</div>
          </div>
          <div
            style={{
              background: "rgba(255,255,255,0.055)",
              border: "1px solid rgba(177,222,255,0.12)",
              borderRadius: "22px",
              display: "flex",
              flexDirection: "column",
              gap: "14px",
              padding: "20px",
            }}
          >
            {[
              ["Recipient", "0x531f...C938"],
              ["Network", "Arc Testnet"],
              ["Receipt", "onchain"],
            ].map(([label, value]) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: "22px" }}>
                <div style={{ color: "#97aaba", fontSize: "18px" }}>{label}</div>
                <div style={{ color: "#f4fbff", fontSize: "18px", fontWeight: 800 }}>{value}</div>
              </div>
            ))}
          </div>
          <div
            style={{
              background: "linear-gradient(135deg, #66f2bd, #75e7ff)",
              borderRadius: "999px",
              color: "#06111c",
              fontSize: "22px",
              fontWeight: 900,
              padding: "18px 24px",
              textAlign: "center",
            }}
          >
            Create an Arclet
          </div>
        </div>
      </div>
    ),
    size
  );
}
