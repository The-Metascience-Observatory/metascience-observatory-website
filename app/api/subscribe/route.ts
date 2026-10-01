export const runtime = 'nodejs';

import { createHash } from "crypto";
import { clientKey, createRateLimiter, readLimitedBody, RequestError } from "@/lib/request-guards";

const rateLimit = createRateLimiter();

export async function POST(request: Request) {
  try {
    const limited = rateLimit(clientKey(request));
    if (limited) return limited;
    const bounded = await readLimitedBody(request, 4096);
    const body: unknown = await bounded.json().catch(() => null);
    const email = body && typeof body === "object" && "email" in body ? body.email : undefined;
    const isValidEmail = typeof email === "string" && email.length <= 254 && /^\S+@\S+\.\S+$/.test(email);
    if (!isValidEmail) {
      return Response.json({ error: "Invalid email" }, { status: 400 });
    }

    const apiKey = process.env.MAILCHIMP_API_KEY;
    const listId = process.env.MAILCHIMP_LIST_ID;
    let serverPrefix = process.env.MAILCHIMP_SERVER_PREFIX;

    if (!apiKey) {
      return Response.json({ error: "Newsletter subscription is temporarily unavailable" }, { status: 500 });
    }
    if (!listId) {
      return Response.json({ error: "Newsletter subscription is temporarily unavailable" }, { status: 500 });
    }

    if (!serverPrefix) {
      const suffix = apiKey.split("-").pop();
      if (suffix && /^[a-z]{2,}\d+$/i.test(suffix)) {
        serverPrefix = suffix;
      } else {
        return Response.json({ error: "Newsletter subscription is temporarily unavailable" }, { status: 500 });
      }
    }

    const subscriberHash = createHash("md5").update(email.toLowerCase()).digest("hex");
    const url = `https://${serverPrefix}.api.mailchimp.com/3.0/lists/${listId}/members/${subscriberHash}`;
    const basicAuth = Buffer.from(`anystring:${apiKey}`).toString("base64");

    const upstream = await fetch(url, {
      method: "PUT",
      signal: AbortSignal.timeout(10_000),
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Basic ${basicAuth}`,
      },
      body: JSON.stringify({
        email_address: email,
        status_if_new: "pending",
      }),
    });

    if (!upstream.ok) {
      // Provider details can reveal subscription or compliance status.
      const json = await upstream.json().catch(() => null);
      const title: unknown = json?.title;

      const benignTitles = new Set([
        "Member Exists",
        "Forgotten Email Not Subscribed",
        "Member In Compliance State",
      ]);
      if (typeof title === "string" && benignTitles.has(title)) {
        return Response.json({ ok: true });
      }

      return Response.json({ error: "Unable to subscribe. Please try again later." }, { status: 400 });
    }

    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof RequestError) return Response.json({ error: error.message }, { status: error.status });
    return Response.json({ error: "Unexpected error" }, { status: 500 });
  }
}


