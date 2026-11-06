const API_ORIGIN = "https://api.schoology.com/v1";
const encoder = new TextEncoder();

function json(body, status = 200, origin = "*") {
	return new Response(JSON.stringify(body), {
		status,
		headers: {
			"content-type": "application/json; charset=utf-8",
			"access-control-allow-origin": origin,
			"access-control-allow-methods": "GET, OPTIONS",
			"access-control-allow-headers": "Authorization, Content-Type",
			"vary": "Origin",
			"cache-control": "no-store"
		}
	});
}

function encode(value) {
	return encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

function constantTimeEqual(left, right) {
	if (!left || !right || left.length !== right.length) return false;
	let mismatch = 0;
	for (let index = 0; index < left.length; index++) mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
	return mismatch === 0;
}

async function signRequest(url, consumerKey, consumerSecret) {
	const oauth = {
		oauth_consumer_key: consumerKey,
		oauth_nonce: crypto.randomUUID().replaceAll("-", ""),
		oauth_signature_method: "HMAC-SHA1",
		oauth_timestamp: String(Math.floor(Date.now() / 1000)),
		oauth_version: "1.0"
	};
	const params = [...url.searchParams.entries(), ...Object.entries(oauth)]
		.map(([key, value]) => [encode(key), encode(value)])
		.sort(([keyA, valueA], [keyB, valueB]) => keyA < keyB ? -1 : keyA > keyB ? 1 : valueA < valueB ? -1 : valueA > valueB ? 1 : 0)
		.map(([key, value]) => `${key}=${value}`)
		.join("&");
	const baseUrl = `${url.origin}${url.pathname}`;
	const baseString = ["GET", encode(baseUrl), encode(params)].join("&");
	const signingKey = `${encode(consumerSecret)}&`;
	const key = await crypto.subtle.importKey("raw", encoder.encode(signingKey), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
	const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(baseString));
	oauth.oauth_signature = btoa(String.fromCharCode(...new Uint8Array(signature)));
	const header = Object.entries(oauth).map(([name, value]) => `${encode(name)}="${encode(value)}"`).join(", ");
	return `OAuth ${header}`;
}

function allowedApiPath(pathname) {
	if (pathname === "/api/me") return "/users/me";
	if (pathname === "/api/sections") return "/users/me/sections";
	if (pathname === "/api/events") return "/users/me/events";
	const sectionMatch = pathname.match(/^\/api\/sections\/([A-Za-z0-9_-]+)\/(assignments|updates|grades)$/);
	if (sectionMatch) return `/sections/${sectionMatch[1]}/${sectionMatch[2]}`;
	return null;
}

function allowedOrigin(request, env) {
	const origin = request.headers.get("Origin") || "";
	const configured = (env.ALLOWED_ORIGINS || "").split(",").map((item) => item.trim()).filter(Boolean);
	if (!origin) return "null";
	if (configured.length && !configured.includes(origin)) return null;
	if (!configured.length && !/^https?:\/\/localhost(?::\d+)?$/.test(origin)) return null;
	return origin;
}

export default {
	async fetch(request, env) {
		const origin = allowedOrigin(request, env);
		if (!origin) return json({ error: "This origin is not allowed. Configure ALLOWED_ORIGINS for your frontend." }, 403, "null");
		if (request.method === "OPTIONS") return new Response(null, {
			status: 204,
			headers: {
				"access-control-allow-origin": origin,
				"access-control-allow-methods": "GET, OPTIONS",
				"access-control-allow-headers": "Authorization, Content-Type",
				"vary": "Origin"
			}
		});
		if (request.method !== "GET") return json({ error: "Only GET requests are supported." }, 405, origin);
		const expectedToken = env.CLIENT_ACCESS_TOKEN || "";
		const authorization = request.headers.get("Authorization") || "";
		if (!expectedToken || !constantTimeEqual(authorization, `Bearer ${expectedToken}`)) {
			return json({ error: "Unauthorized. Check the private access token configured for this Worker." }, 401, origin);
		}
		if (!env.SCHOOLOGY_CONSUMER_KEY || !env.SCHOOLOGY_CONSUMER_SECRET) {
			return json({ error: "Schoology API credentials are not configured on the Worker." }, 503, origin);
		}
		const incoming = new URL(request.url);
		const apiPath = allowedApiPath(incoming.pathname);
		if (!apiPath) return json({ error: "This Schoology endpoint is not available through this client." }, 404, origin);
		const upstream = new URL(`${API_ORIGIN}${apiPath}`);
		for (const [key, value] of incoming.searchParams) upstream.searchParams.append(key, value);
		upstream.searchParams.set("format", "json");

		try {
			const response = await fetch(upstream, {
				headers: { Authorization: await signRequest(upstream, env.SCHOOLOGY_CONSUMER_KEY, env.SCHOOLOGY_CONSUMER_SECRET), Accept: "application/json" }
			});
			const body = await response.text();
			let payload;
			try { payload = JSON.parse(body); } catch { payload = { error: body || "Schoology returned an unreadable response." }; }
			if (!response.ok) return json({ error: payload.error_description || payload.error || `Schoology returned HTTP ${response.status}.`, upstreamStatus: response.status }, response.status, origin);
			return json(payload, 200, origin);
		} catch {
			return json({ error: "Could not reach Schoology. Check Worker logs and Schoology API availability." }, 502, origin);
		}
	}
};
