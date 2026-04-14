import { ImageResponse } from "next/og"
import { SITE_DESCRIPTION_EN, SITE_NAME } from "@/lib/site"

export const size = {
  width: 1200,
  height: 630,
}

export const contentType = "image/png"

function LogoMark() {
  return (
    <div
      style={{
        width: 110,
        height: 110,
        borderRadius: 30,
        background: "#F7F1E8",
        border: "2px solid #D9E8E1",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
      }}
    >
      <div
        style={{
          fontSize: 74,
          fontWeight: 800,
          color: "#F88A51",
          lineHeight: 1,
          transform: "translateY(2px)",
        }}
      >
        S
      </div>
      <div
        style={{
          position: "absolute",
          right: 18,
          top: 18,
          width: 18,
          height: 18,
          borderRadius: 999,
          background: "#D6A15B",
        }}
      />
    </div>
  )
}

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 56,
          background: "linear-gradient(135deg, #FCFAF6 0%, #F5EFE7 100%)",
          color: "#171717",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <LogoMark />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 44, fontWeight: 800, color: "#F88A51", letterSpacing: -1.4 }}>{SITE_NAME}</div>
            <div style={{ fontSize: 20, color: "#5B5B5B" }}>{SITE_DESCRIPTION_EN}</div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 980 }}>
          <div style={{ fontSize: 76, fontWeight: 900, lineHeight: 1.03 }}>Fashion marketplace in Georgia</div>
          <div style={{ fontSize: 30, color: "#4B5563", lineHeight: 1.35 }}>
            Discover new, vintage, and one-of-a-kind fashion pieces in one clean marketplace with fast chat and trusted seller profiles.
          </div>
        </div>

        <div style={{ display: "flex", gap: 14 }}>
          {["VIP განცხადებები", "სწრაფი ჩათი", "Seller trust"].map((item) => (
            <div
              key={item}
              style={{
                display: "flex",
                alignItems: "center",
                borderRadius: 999,
                padding: "12px 20px",
                background: "#FFFFFF",
                border: "1px solid #E5E5E5",
                fontSize: 24,
                color: "#F88A51",
              }}
            >
              {item}
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  )
}
