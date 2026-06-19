// When the coordinator serves a self-signed cert (default in dev and
// inside the Nitro Enclave), Node.js TLS verification must be relaxed
// for server-side fetch calls. Set COORDINATOR_SKIP_TLS_VERIFY=false
// in production once you attach a real CA-signed certificate.
if (process.env.COORDINATOR_SKIP_TLS_VERIFY !== "false") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    COORDINATOR_URL: process.env.COORDINATOR_URL ?? "https://localhost:4000",
  },
};

export default nextConfig;
