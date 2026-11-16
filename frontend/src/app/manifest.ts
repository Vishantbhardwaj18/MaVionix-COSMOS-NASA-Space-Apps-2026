import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "COSMOS: SPHEREx sky, over time",
    short_name: "COSMOS",
    description: "See how NASA SPHEREx's infrared sky changes between visits.",
    start_url: "/",
    display: "standalone",
    background_color: "#0c1426",
    theme_color: "#101a30",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
