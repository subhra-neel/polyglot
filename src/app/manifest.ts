import type { MetadataRoute } from "next";

/** Lets Android offer "Add to Home screen" and open the app without browser chrome. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Polyglot",
    short_name: "Polyglot",
    description: "Learn to speak Kannada through real conversations.",
    start_url: "/today",
    display: "standalone",
    background_color: "#faf8f3",
    theme_color: "#0e5f55",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon-maskable.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
