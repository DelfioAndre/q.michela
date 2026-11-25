const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { after, before, test } = require("node:test");
const { createApp } = require("../server/app");

let server;
let baseUrl;
let temporaryDirectory;

before(async () => {
    temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "qmichela-orders-"));
    server = createApp({
        adminPassword: "test-password-123",
        databasePath: path.join(temporaryDirectory, "orders.sqlite")
    });
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
});

test("mesa orders are stored and can be managed after login", async () => {
    const submitted = await fetch(`${baseUrl}/api/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            table: "4",
            customer: "Ana",
            notes: "Sem picante",
            items: [{ productId: 1, name: "Prato do dia", quantity: 2, unitPrice: 300, details: "" }]
        })
    });
    assert.equal(submitted.status, 201);
    const created = await submitted.json();
    assert.equal(created.status, "new");

    const denied = await fetch(`${baseUrl}/api/admin/orders`);
    assert.equal(denied.status, 401);

    const login = await fetch(`${baseUrl}/api/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: "test-password-123" })
    });
    assert.equal(login.status, 200);
    const cookie = login.headers.get("set-cookie").split(";")[0];

    const listed = await fetch(`${baseUrl}/api/admin/orders`, { headers: { Cookie: cookie } });
    assert.equal(listed.status, 200);
    const { orders } = await listed.json();
    assert.equal(orders.length, 1);
    assert.equal(orders[0].table, "4");
    assert.equal(orders[0].items[0].quantity, 2);
    assert.equal(orders[0].total, 600);

    const updated = await fetch(`${baseUrl}/api/admin/orders/${created.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ status: "preparing" })
    });
    assert.equal(updated.status, 200);
    assert.equal((await updated.json()).status, "preparing");
});

test("table orders without a valid mesa are rejected", async () => {
    const response = await fetch(`${baseUrl}/api/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ table: "", items: [] })
    });
    assert.equal(response.status, 400);
});

test("malformed order products are rejected without creating an order", async () => {
    const response = await fetch(`${baseUrl}/api/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ table: "2", items: [null] })
    });
    assert.equal(response.status, 400);
});

test("manager page is served by the order system", async () => {
    const response = await fetch(`${baseUrl}/manager`);
    assert.equal(response.status, 200);
    assert.match(await response.text(), /Sistema do Gerente/);
});
