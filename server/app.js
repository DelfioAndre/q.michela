const http = require("node:http");
const { createHash, randomBytes, timingSafeEqual } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const ROOT = path.resolve(__dirname, "..");
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const ORDER_STATUSES = new Set(["new", "accepted", "preparing", "ready", "completed", "cancelled"]);
const STATUS_LABELS = {
    new: "Novo",
    accepted: "Aceite",
    preparing: "Em preparação",
    ready: "Pronto",
    completed: "Concluído",
    cancelled: "Cancelado"
};
const STATIC_FILES = new Map([
    ["/", ["index.html", "text/html; charset=utf-8"]],
    ["/index.html", ["index.html", "text/html; charset=utf-8"]],
    ["/script/app.js", ["script/app.js", "text/javascript; charset=utf-8"]],
    ["/css/style.css", ["css/style.css", "text/css; charset=utf-8"]],
    ["/manager", ["manager/index.html", "text/html; charset=utf-8"]],
    ["/manager/", ["manager/index.html", "text/html; charset=utf-8"]],
    ["/manager/app.js", ["manager/app.js", "text/javascript; charset=utf-8"]],
    ["/manager/style.css", ["manager/style.css", "text/css; charset=utf-8"]]
]);

class HttpError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

function sendJson(response, status, value, headers = {}) {
    response.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        ...headers
    });
    response.end(JSON.stringify(value));
}

function readJson(request, maxBytes = 64 * 1024) {
    return new Promise((resolve, reject) => {
        let body = "";
        let size = 0;
        request.setEncoding("utf8");
        request.on("data", chunk => {
            size += Buffer.byteLength(chunk);
            if (size > maxBytes) {
                reject(new HttpError(413, "O pedido é demasiado grande."));
                request.destroy();
                return;
            }
            body += chunk;
        });
        request.on("end", () => {
            try {
                resolve(JSON.parse(body || "{}"));
            } catch {
                reject(new HttpError(400, "O conteúdo enviado não é válido."));
            }
        });
        request.on("error", reject);
    });
}

function requiredText(value, label, maxLength, allowEmpty = false) {
    if (typeof value !== "string") {
        throw new HttpError(400, `${label} inválido.`);
    }
    const text = value.trim();
    if ((!allowEmpty && !text) || text.length > maxLength) {
        throw new HttpError(400, `${label} inválido.`);
    }
    return text;
}

function requiredObject(value, label) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new HttpError(400, `${label} inválido.`);
    }
    return value;
}

function getSessionToken(request) {
    const cookies = (request.headers.cookie || "").split(";");
    const sessionCookie = cookies.map(cookie => cookie.trim()).find(cookie => cookie.startsWith("qm_session="));
    return sessionCookie ? sessionCookie.slice("qm_session=".length) : "";
}

function createApp(options = {}) {
    const adminPassword = options.adminPassword || process.env.ADMIN_PASSWORD || "";
    if (adminPassword.length < 12) {
        throw new Error("Defina ADMIN_PASSWORD com pelo menos 12 caracteres.");
    }

    const dataDirectory = options.dataDirectory || process.env.DATA_DIR || path.join(ROOT, "data");
    const databasePath = options.databasePath || path.join(dataDirectory, "orders.sqlite");
    fs.mkdirSync(path.dirname(databasePath), { recursive: true });

    const database = new DatabaseSync(databasePath);
    database.exec(`
        PRAGMA foreign_keys = ON;
        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            table_number TEXT NOT NULL,
            customer_name TEXT NOT NULL DEFAULT '',
            notes TEXT NOT NULL DEFAULT '',
            status TEXT NOT NULL DEFAULT 'new',
            created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
            updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        );
        CREATE TABLE IF NOT EXISTS order_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
            product_id INTEGER NOT NULL,
            product_name TEXT NOT NULL,
            quantity INTEGER NOT NULL,
            unit_price REAL NOT NULL,
            details TEXT NOT NULL DEFAULT ''
        );
    `);

    const allowedOrigins = new Set(options.allowedOrigins || (process.env.FRONTEND_ORIGIN || "")
        .split(",").map(origin => origin.trim()).filter(Boolean));
    const sessions = new Map();
    const passwordDigest = createHash("sha256").update(adminPassword).digest();

    function setCors(request, response) {
        const origin = request.headers.origin;
        if (origin && !allowedOrigins.has(origin)) {
            sendJson(response, 403, { error: "Origem não autorizada." });
            return false;
        }
        if (origin) {
            response.setHeader("Access-Control-Allow-Origin", origin);
            response.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS");
            response.setHeader("Access-Control-Allow-Headers", "Content-Type");
            response.setHeader("Vary", "Origin");
        }
        return true;
    }

    function requireManager(request, response) {
        const token = getSessionToken(request);
        const expiresAt = sessions.get(token);
        if (!expiresAt || expiresAt <= Date.now()) {
            sessions.delete(token);
            sendJson(response, 401, { error: "Inicie sessão para continuar." });
            return false;
        }
        return true;
    }

    function serveStatic(request, response, pathname) {
        let entry = STATIC_FILES.get(pathname);
        if (!entry && /^\/imagens\/[A-Za-z0-9._-]+$/.test(pathname)) {
            const extension = path.extname(pathname).toLowerCase();
            const contentType = {
                ".png": "image/png",
                ".jpg": "image/jpeg",
                ".jpeg": "image/jpeg"
            }[extension];
            if (contentType) entry = [pathname.slice(1), contentType];
        }
        if (!entry) {
            sendJson(response, 404, { error: "Página não encontrada." });
            return;
        }
        const filePath = path.resolve(ROOT, entry[0]);
        if (!filePath.startsWith(ROOT + path.sep) || !fs.existsSync(filePath)) {
            sendJson(response, 404, { error: "Página não encontrada." });
            return;
        }
        response.writeHead(200, {
            "Content-Type": entry[1],
            "Cache-Control": "no-cache",
            "X-Content-Type-Options": "nosniff"
        });
        fs.createReadStream(filePath).pipe(response);
    }

    const server = http.createServer(async (request, response) => {
        try {
            const url = new URL(request.url, "http://localhost");
            const { pathname } = url;

            if (request.method === "OPTIONS") {
                if (!setCors(request, response)) return;
                response.writeHead(204);
                response.end();
                return;
            }

            if (pathname.startsWith("/api/") && !setCors(request, response)) return;

            if (request.method === "GET" && pathname === "/api/health") {
                sendJson(response, 200, { status: "ok" });
                return;
            }

            if (request.method === "POST" && pathname === "/api/admin/login") {
                const body = requiredObject(await readJson(request, 4096), "Dados");
                const submitted = typeof body.password === "string" ? body.password : "";
                const submittedDigest = createHash("sha256").update(submitted).digest();
                if (!timingSafeEqual(passwordDigest, submittedDigest)) {
                    sendJson(response, 401, { error: "Palavra-passe incorrecta." });
                    return;
                }
                const token = randomBytes(32).toString("base64url");
                sessions.set(token, Date.now() + SESSION_TTL_MS);
                const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
                sendJson(response, 200, { authenticated: true }, {
                    "Set-Cookie": `qm_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL_MS / 1000}${secure}`
                });
                return;
            }

            if (request.method === "POST" && pathname === "/api/admin/logout") {
                const token = getSessionToken(request);
                sessions.delete(token);
                sendJson(response, 200, { authenticated: false }, {
                    "Set-Cookie": "qm_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0"
                });
                return;
            }

            if (request.method === "POST" && pathname === "/api/orders") {
                const body = requiredObject(await readJson(request), "Pedido");
                const tableNumber = requiredText(body.table, "Mesa", 20);
                if (!/^[A-Za-z0-9À-ÿ][A-Za-z0-9À-ÿ._-]{0,19}$/.test(tableNumber)) {
                    throw new HttpError(400, "Mesa inválida.");
                }
                const customerName = requiredText(body.customer || "", "Nome", 80, true);
                const notes = requiredText(body.notes || "", "Observações", 500, true);
                if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 30) {
                    throw new HttpError(400, "O pedido deve conter entre 1 e 30 produtos.");
                }
                const items = body.items.map(item => {
                    item = requiredObject(item, "Produto");
                    const { productId, quantity, unitPrice } = item;
                    if (!Number.isInteger(productId) || productId < 1 ||
                        !Number.isInteger(quantity) || quantity < 1 || quantity > 99 ||
                        !Number.isFinite(unitPrice) || unitPrice < 0 || unitPrice > 10000000) {
                        throw new HttpError(400, "Um produto do pedido contém dados inválidos.");
                    }
                    return {
                        productId,
                        name: requiredText(item.name, "Produto", 100),
                        quantity,
                        unitPrice,
                        details: requiredText(item.details || "", "Detalhes", 300, true)
                    };
                });

                database.exec("BEGIN IMMEDIATE");
                try {
                    const orderResult = database.prepare(
                        "INSERT INTO orders (table_number, customer_name, notes) VALUES (?, ?, ?)"
                    ).run(tableNumber, customerName, notes);
                    const orderId = Number(orderResult.lastInsertRowid);
                    const insertItem = database.prepare(
                        "INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, details) VALUES (?, ?, ?, ?, ?, ?)"
                    );
                    items.forEach(item => insertItem.run(
                        orderId, item.productId, item.name, item.quantity, item.unitPrice, item.details
                    ));
                    database.exec("COMMIT");
                    sendJson(response, 201, { id: orderId, status: "new" });
                } catch (error) {
                    database.exec("ROLLBACK");
                    throw error;
                }
                return;
            }

            if (request.method === "GET" && pathname === "/api/admin/orders") {
                if (!requireManager(request, response)) return;
                const filter = url.searchParams.get("status");
                if (filter && !ORDER_STATUSES.has(filter)) {
                    throw new HttpError(400, "Estado inválido.");
                }
                const orders = filter
                    ? database.prepare("SELECT * FROM orders WHERE status = ? ORDER BY created_at DESC").all(filter)
                    : database.prepare("SELECT * FROM orders ORDER BY created_at DESC").all();
                const getItems = database.prepare(
                    "SELECT product_id AS productId, product_name AS name, quantity, unit_price AS unitPrice, details FROM order_items WHERE order_id = ? ORDER BY id"
                );
                sendJson(response, 200, {
                    orders: orders.map(order => {
                        const items = getItems.all(order.id);
                        return {
                            id: order.id,
                            table: order.table_number,
                            customer: order.customer_name,
                            notes: order.notes,
                            status: order.status,
                            statusLabel: STATUS_LABELS[order.status],
                            createdAt: order.created_at,
                            updatedAt: order.updated_at,
                            total: items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
                            items
                        };
                    })
                });
                return;
            }

            const statusRoute = request.method === "PATCH" && pathname.match(/^\/api\/admin\/orders\/(\d+)\/status$/);
            if (statusRoute) {
                if (!requireManager(request, response)) return;
                const orderId = Number(statusRoute[1]);
                const body = requiredObject(await readJson(request, 4096), "Dados");
                if (!ORDER_STATUSES.has(body.status)) {
                    throw new HttpError(400, "Estado inválido.");
                }
                const result = database.prepare(
                    "UPDATE orders SET status = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?"
                ).run(body.status, orderId);
                if (result.changes === 0) {
                    throw new HttpError(404, "Pedido não encontrado.");
                }
                sendJson(response, 200, { id: orderId, status: body.status, statusLabel: STATUS_LABELS[body.status] });
                return;
            }

            if (request.method === "GET") {
                serveStatic(request, response, pathname);
                return;
            }

            sendJson(response, 404, { error: "Rota não encontrada." });
        } catch (error) {
            if (response.headersSent || response.destroyed) return;
            if (error instanceof HttpError) {
                sendJson(response, error.status, { error: error.message });
                return;
            }
            console.error(error);
            sendJson(response, 500, { error: "Ocorreu um erro interno. Tente novamente." });
        }
    });

    server.on("close", () => database.close());
    return server;
}

module.exports = { createApp };
