export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["Space Grotesk", "sans-serif"],
        mono: ["Space Mono", "monospace"],
        hand: ["Caveat", "cursive"],
      },
      colors: {
        yellow: "#FFE135",
        cyan: "#00F5D4",
        pink: "#FF2D78",
        ink: "#0A0A0A",
        paper: "#FAF9F6",
        muted: "#F0EDE8",
      },
      fontSize: {
        "display": ["clamp(3.5rem,9vw,10rem)", { lineHeight: "0.92", letterSpacing: "-0.03em" }],
        "headline": ["clamp(2rem,5vw,6rem)", { lineHeight: "0.95", letterSpacing: "-0.02em" }],
        "title":    ["clamp(1.25rem,2.5vw,2.5rem)", { lineHeight: "1.1" }],
      },
      boxShadow: {
        brutal:    "4px 4px 0px #0A0A0A",
        "brutal-md": "6px 6px 0px #0A0A0A",
        "brutal-lg": "10px 10px 0px #0A0A0A",
        "brutal-y":  "6px 6px 0px #FFE135",
        "brutal-inv":"4px 4px 0px #FAF9F6",
      },
    },
  },
  plugins: [],
};
