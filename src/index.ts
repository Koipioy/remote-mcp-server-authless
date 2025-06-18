// Simple Worker returning current time in US Eastern timezone

// Cloudflare Workers runtime uses Deno's serve
// declare Deno for TypeScript
declare const Deno: {
    serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

function getEasternTime(): string {
    return new Date().toLocaleString('en-US', {
        timeZone: 'America/New_York',
        hour12: false,
    });
}

Deno.serve(() => new Response(getEasternTime()));
