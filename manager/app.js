const STATUS_OPTIONS = [
    ["new", "Novo"],
    ["accepted", "Aceite"],
    ["preparing", "Em preparação"],
    ["ready", "Pronto"],
    ["completed", "Concluído"],
    ["cancelled", "Cancelado"]
];
const $ = id => document.getElementById(id);
let refreshTimer;

async function request(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        headers: { "Content-Type": "application/json", ...options.headers }
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Não foi possível concluir a operação.");
    return payload;
}

function showMessage(text, isError = false) {
    $("message").textContent = text;
    $("message").classList.toggle("error", isError);
}

function setAuthenticated(authenticated) {
    $("loginPanel").hidden = authenticated;
    $("ordersPanel").hidden = !authenticated;
    $("logout").hidden = !authenticated;
    if (authenticated) {
        refreshOrders();
        clearInterval(refreshTimer);
        refreshTimer = setInterval(refreshOrders, 5000);
    } else {
        clearInterval(refreshTimer);
    }
}

function makeElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
}

function renderOrder(order) {
    const card = makeElement("article", "order-card");
    const heading = makeElement("div", "order-top");
    const title = makeElement("h3", "", `Pedido #${order.id} — Mesa ${order.table}`);
    const status = makeElement("span", `status status-${order.status}`, order.statusLabel);
    heading.append(title, status);
    card.append(heading);

    const meta = makeElement("p", "order-meta", new Date(order.createdAt).toLocaleString("pt-MZ"));
    card.append(meta);
    if (order.customer) card.append(makeElement("p", "order-detail", `Cliente: ${order.customer}`));

    const list = makeElement("ul", "item-list");
    order.items.forEach(item => {
        const details = item.details ? ` — ${item.details}` : "";
        list.append(makeElement("li", "", `${item.quantity} × ${item.name}${details}`));
    });
    card.append(list);
    const total = Number(order.total).toLocaleString("pt-MZ") + " MT";
    card.append(makeElement("p", "order-total", `Total estimado: ${total}`));
    if (order.notes) card.append(makeElement("p", "order-notes", `Observações: ${order.notes}`));

    const controls = makeElement("div", "order-controls");
    const label = makeElement("label", "status-control", "Actualizar estado");
    const select = document.createElement("select");
    select.setAttribute("aria-label", `Estado do pedido ${order.id}`);
    STATUS_OPTIONS.forEach(([value, name]) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = name;
        option.selected = value === order.status;
        select.append(option);
    });
    label.append(select);
    const save = makeElement("button", "button primary", "Guardar");
    save.type = "button";
    save.addEventListener("click", async () => {
        save.disabled = true;
        try {
            await request(`/api/admin/orders/${order.id}/status`, {
                method: "PATCH",
                body: JSON.stringify({ status: select.value })
            });
            showMessage(`Estado do pedido #${order.id} actualizado.`);
            await refreshOrders();
        } catch (error) {
            showMessage(error.message, true);
            save.disabled = false;
        }
    });
    controls.append(label, save);
    card.append(controls);
    return card;
}

async function refreshOrders() {
    try {
        const filter = $("statusFilter").value;
        const query = filter ? `?status=${encodeURIComponent(filter)}` : "";
        const { orders } = await request(`/api/admin/orders${query}`);
        const container = $("orders");
        container.replaceChildren();
        if (!orders.length) {
            container.append(makeElement("p", "empty", "Ainda não há pedidos neste estado."));
        } else {
            orders.forEach(order => container.append(renderOrder(order)));
        }
        $("lastUpdated").textContent = `Actualizado às ${new Date().toLocaleTimeString("pt-MZ")}`;
    } catch (error) {
        showMessage(error.message, true);
        if (error.message.includes("Inicie sessão")) setAuthenticated(false);
    }
}

$("loginForm").addEventListener("submit", async event => {
    event.preventDefault();
    const button = $("loginForm").querySelector("button");
    button.disabled = true;
    try {
        await request("/api/admin/login", {
            method: "POST",
            body: JSON.stringify({ password: $("password").value })
        });
        $("password").value = "";
        showMessage("");
        setAuthenticated(true);
    } catch (error) {
        showMessage(error.message, true);
    } finally {
        button.disabled = false;
    }
});

$("logout").addEventListener("click", async () => {
    try {
        await request("/api/admin/logout", { method: "POST", body: "{}" });
        showMessage("Sessão terminada.");
        setAuthenticated(false);
    } catch (error) {
        showMessage(error.message, true);
    }
});

$("statusFilter").addEventListener("change", refreshOrders);
request("/api/admin/orders")
    .then(() => setAuthenticated(true))
    .catch(() => setAuthenticated(false));
