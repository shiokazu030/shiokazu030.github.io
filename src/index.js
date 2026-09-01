const UPSTREAM = "https://my-short-link.kazuto03.chatgpt.site";
const PUBLIC_URL = "https://card.shindanlabo.workers.dev";

const COPY_FIX = `
<script>
(() => {
  const originalClipboard = navigator.clipboard;
  const nativeWrite = originalClipboard && originalClipboard.writeText
    ? originalClipboard.writeText.bind(originalClipboard)
    : null;

  function fallbackCopy(value) {
    const area = document.createElement("textarea");
    area.value = String(value);
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.top = "0";
    area.style.left = "-9999px";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.focus();
    area.select();
    area.setSelectionRange(0, area.value.length);

    let copied = false;
    try {
      copied = document.execCommand("copy");
    } catch (_) {}

    area.remove();
    return copied;
  }

  const clipboard = {
    writeText(value) {
      const text = String(value);
      if (fallbackCopy(text)) return Promise.resolve();
      if (nativeWrite) return nativeWrite(text);
      return Promise.reject(new Error("コピーできませんでした"));
    }
  };

  try {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      get: () => clipboard
    });
  } catch (_) {}
})();
</script>
`;

export default {
  async fetch(request) {
    const incomingUrl = new URL(request.url);
    const targetUrl = new URL(incomingUrl.pathname + incomingUrl.search, UPSTREAM);
    const headers = new Headers(request.headers);

    const origin = headers.get("origin");
    if (origin) {
      headers.set("origin", origin.replace(PUBLIC_URL, UPSTREAM));
    }

    const referer = headers.get("referer");
    if (referer) {
      headers.set("referer", referer.replace(PUBLIC_URL, UPSTREAM));
    }

    headers.delete("content-length");
    headers.delete("x-forwarded-host");
    headers.delete("x-forwarded-proto");

    const options = {
      method: request.method,
      headers,
      redirect: "manual",
    };

    if (request.method !== "GET" && request.method !== "HEAD") {
      options.body = request.body;
    }

    const response = await fetch(targetUrl, options);
    const responseHeaders = new Headers(response.headers);
    const location = responseHeaders.get("location");

    if (location) {
      responseHeaders.set("location", location.replaceAll(UPSTREAM, PUBLIC_URL));
    }

    const contentType = responseHeaders.get("content-type") || "";
    const isText =
      contentType.startsWith("text/") ||
      contentType.includes("json") ||
      contentType.includes("javascript") ||
      contentType.includes("xml");

    if (isText) {
      let body = (await response.text()).replaceAll(UPSTREAM, PUBLIC_URL);

      if (contentType.includes("text/html")) {
        body = body.includes("</head>")
          ? body.replace("</head>", COPY_FIX + "</head>")
          : COPY_FIX + body;
      }

      responseHeaders.delete("content-length");
      responseHeaders.delete("content-encoding");
      responseHeaders.delete("etag");

      return new Response(body, {
        status: response.status,
        headers: responseHeaders,
      });
    }

    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders,
    });
  },
};
