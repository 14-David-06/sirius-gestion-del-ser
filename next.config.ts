import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * `@sirius/solicitudes` se distribuye en TypeScript, sin paso de build, así que
   * lo transpila la app que lo consume. Cualquier app que lo instale necesita
   * esta línea.
   */
  transpilePackages: ["@sirius/solicitudes"],
};

export default nextConfig;
