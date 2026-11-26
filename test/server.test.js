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

    const accepted = await fetch(`${baseUrl}/api/admin/orders/${created.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ status: "accepted", estimatedMinutes: 30 })
    });
    const acceptedResult = await accepted.json();
    assert.equal(acceptedResult.status, "accepted");
    assert.equal(acceptedResult.estimatedMinutes, 30);

    const rejected = await fetch(`${baseUrl}/api/admin/orders/${created.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ status: "cancelled" })
    });
    assert.equal((await rejected.json()).status, "cancelled");
});

test("table orders without a valid mesa are rejected", async () => {
    const response = await fetch(`${baseUrl}/api/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ table: "", items: [] })
    });
    assert.equal(response.status, 400);
});

test("dish delivery orders are stored and identified separately", async () => {
    const submitted = await fetch(`${baseUrl}/api/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            orderType: "delivery-dishes",
            customer: "João",
            deliveryPhone: "258841234567",
            deliveryAddress: "Bairro Central, Rua 5",
            deliveryDate: "2026-12-20",
            deliveryTime: "18:30",
            notes: "Entregar após as 18h",
            items: [{ productId: 3, name: "Prato para entrega", quantity: 1, unitPrice: 450, details: "Sem picante" }]
        })
    });
    assert.equal(submitted.status, 201);
    const created = await submitted.json();

    const login = await fetch(`${baseUrl}/api/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: "test-password-123" })
    });
    const cookie = login.headers.get("set-cookie").split(";")[0];
    const listed = await fetch(`${baseUrl}/api/admin/orders`, { headers: { Cookie: cookie } });
    const { orders } = await listed.json();
    const delivery = orders.find(order => order.id === created.id);
    assert.equal(delivery.orderType, "delivery-dishes");
    assert.equal(delivery.table, "Entrega");
    assert.equal(delivery.customer, "João");
    assert.equal(delivery.deliveryPhone, "258841234567");
    assert.equal(delivery.deliveryAddress, "Bairro Central, Rua 5");
    assert.equal(delivery.deliveryDate, "2026-12-20");
    assert.equal(delivery.deliveryTime, "18:30");
});

test("buffet requests are stored without predefined menu items", async () => {
    const submitted = await fetch(`${baseUrl}/api/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            orderType: "delivery-buffet",
            customer: "Maria",
            deliveryPhone: "258849876543",
            deliveryAddress: "Matola, Bairro A",
            deliveryDate: "2026-12-20",
            deliveryTime: "19:00",
            notes: "Buffet de casamento para 80 pessoas no dia 20 de dezembro",
            items: []
        })
    });
    assert.equal(submitted.status, 201);
    const created = await submitted.json();

    const login = await fetch(`${baseUrl}/api/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: "test-password-123" })
    });
    const cookie = login.headers.get("set-cookie").split(";")[0];
    const listed = await fetch(`${baseUrl}/api/admin/orders`, { headers: { Cookie: cookie } });
    const { orders } = await listed.json();
    const buffet = orders.find(order => order.id === created.id);
    assert.equal(buffet.orderType, "delivery-buffet");
    assert.equal(buffet.table, "Entrega");
    assert.equal(buffet.customer, "Maria");
    assert.equal(buffet.items.length, 0);
    assert.match(buffet.notes, /casamento/);

    const filtered = await fetch(
        `${baseUrl}/api/admin/orders?type=delivery-buffet`,
        { headers: { Cookie: cookie } }
    );
    assert.equal(filtered.status, 200);
    const filteredOrders = (await filtered.json()).orders;
    assert.ok(filteredOrders.every(order => order.orderType === "delivery-buffet"));

    const combined = await fetch(
        `${baseUrl}/api/admin/orders?type=delivery-buffet&status=new`,
        { headers: { Cookie: cookie } }
    );
    assert.equal(combined.status, 200);
    const combinedOrders = (await combined.json()).orders;
    assert.ok(combinedOrders.every(order =>
        order.orderType === "delivery-buffet" && order.status === "new"
    ));
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
