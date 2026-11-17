/**
 * Makes `mongodb+srv://` connection strings work on networks where Node's
 * DNS resolver is misconfigured.
 *
 * Why this exists
 * ---------------
 * Node has *two* independent DNS paths:
 *
 *   - `dns.lookup()`  -> the operating system resolver (getaddrinfo). This is
 *     what `net.connect()` and therefore every ordinary outbound socket uses.
 *   - `dns.resolve*()` -> c-ares, a resolver bundled inside Node that talks to
 *     DNS servers itself and reads its own copy of the system configuration.
 *
 * A `mongodb+srv://` URI is not a hostname: before it can connect, the driver
 * must look up an SRV record (and a TXT record) through `dns.resolveSrv()`,
 * which is the c-ares path. On some Windows setups - VPNs, captive portals,
 * NAT64/DNS64 campus networks, or an adapter whose DNS servers c-ares fails to
 * read - c-ares finds no usable servers and silently falls back to 127.0.0.1.
 * Nothing is listening there, so every SRV lookup dies instantly with:
 *
 *     querySrv ECONNREFUSED _mongodb._tcp.<cluster>.mongodb.net
 *
 * The confusing part is that the machine's networking is completely fine:
 * `nslookup` works, the browser works, and even Node's own `dns.lookup()`
 * works, because all of those use the OS resolver rather than c-ares.
 *
 * What this does
 * --------------
 * Probes the real SRV record. If it resolves, nothing is changed. If it fails
 * for a resolver-level reason, we point c-ares at a public resolver and probe
 * again, restoring the original list if that does not help either.
 *
 * `dns.setServers()` only affects `dns.resolve*()`. `dns.lookup()` - and so
 * the actual TCP connections to the database, and every other outbound request
 * the app makes - still goes through the OS resolver. That matters on NAT64 /
 * DNS64 networks, where the OS resolver synthesises the IPv6 addresses that
 * are the only way out; overriding it would break them. We deliberately do not.
 */
import dns from "node:dns";
import { createLogger } from "../utils/logger.js";

const log = createLogger("dns");

// Resolver-level failures: the question was never answered, so it is worth
// asking a different server. A genuine NXDOMAIN (ENOTFOUND/NOTFOUND) means the
// cluster name itself is wrong and a second opinion will not change that.
const RESOLVER_FAILURES = new Set([
  "ECONNREFUSED",
  "ESERVFAIL",
  "ETIMEOUT",
  "ETIMEDOUT",
  "EREFUSED",
  "ECANCELLED",
  "EBADRESP",
  "ENOTIMP",
]);

/** Public resolvers used only as a fallback; override with DNS_SERVERS. */
const DEFAULT_FALLBACK = ["1.1.1.1", "8.8.8.8", "9.9.9.9"];

function fallbackServers() {
  const configured = (process.env.DNS_SERVERS || "")
    .split(",")
    .map((server) => server.trim())
    .filter(Boolean);
  return configured.length > 0 ? configured : DEFAULT_FALLBACK;
}

/** `mongodb+srv://user:pass@cluster.x.mongodb.net/db` -> `cluster.x.mongodb.net` */
function srvHost(uri) {
  if (typeof uri !== "string" || !uri.startsWith("mongodb+srv://")) return null;
  const afterCredentials = uri.slice("mongodb+srv://".length).split("@").pop();
  const host = afterCredentials.split(/[/?]/)[0];
  return host || null;
}

async function probe(host) {
  try {
    await dns.promises.resolveSrv(`_mongodb._tcp.${host}`);
    return null;
  } catch (error) {
    return error.code || "UNKNOWN";
  }
}

/**
 * Called from connectDB() before the driver runs its own SRV lookup, so the
 * server and every script in scripts/ get the same treatment.
 *
 * Never throws: if it cannot help, it leaves DNS exactly as it found it and
 * lets the driver report the real error.
 */
export async function ensureSrvResolution(uri) {
  const host = srvHost(uri);
  // A plain mongodb:// URI (local mongod, or an Atlas seed list) resolves
  // through dns.lookup() and never touches c-ares, so there is nothing to fix.
  if (!host) return true;

  const firstFailure = await probe(host);
  if (!firstFailure) return true;

  if (!RESOLVER_FAILURES.has(firstFailure)) {
    // NXDOMAIN and friends: the name is wrong, not the resolver.
    log.warn(`SRV lookup for ${host} failed with ${firstFailure} - check the cluster name in MONGO_URI`);
    return false;
  }

  const original = dns.getServers();
  const fallback = fallbackServers();
  log.warn(
    `SRV lookup failed (${firstFailure}) using DNS server(s) ${original.join(", ")}. ` +
      `Retrying via ${fallback.join(", ")} - set DNS_SERVERS to choose different ones.`
  );

  try {
    dns.setServers(fallback);
  } catch (error) {
    log.error(`DNS_SERVERS is not a valid list of IP addresses: ${error.message}`);
    return false;
  }

  const secondFailure = await probe(host);
  if (!secondFailure) {
    log.info(`SRV lookup now resolving via ${fallback.join(", ")} (record lookups only; sockets still use the OS resolver)`);
    return true;
  }

  // The fallback is no better - put the original configuration back so the
  // driver's own error message describes the machine's real state.
  log.error(`SRV lookup still failing (${secondFailure}) via ${fallback.join(", ")} - restoring original DNS servers`);
  dns.setServers(original);
  return false;
}
