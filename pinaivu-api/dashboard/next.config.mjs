// Self-signed enclave cert — skip TLS verification for server-side fetches
// to the coordinator. Set COORDINATOR_SKIP_TLS_VERIFY=false when using a
// real CA-signed cert.
if (process.env.COORDINATOR_SKIP_TLS_VERIFY !== "false") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    GATEWAY_URL: process.env.GATEWAY_URL ?? "http://localhost:4001",
    COORDINATOR_URL: process.env.COORDINATOR_URL ?? "https://localhost:4000",
  },
};

export default nextConfig;
