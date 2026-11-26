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
    const titleText = order.orderType === "delivery-dishes"
        ? `Pedido #${order.id} — Entrega de pratos`
        : order.orderType === "delivery-buffet"
            ? `Pedido #${order.id} — Orçamento de buffet`
            : `Pedido #${order.id} — Mesa ${order.table}`;
    const title = makeElement("h3", "", titleText);
    const status = makeElement("span", `status status-${order.status}`, order.statusLabel);
    heading.append(title, status);
    card.append(heading);

    const meta = makeElement("p", "order-meta", new Date(order.createdAt).toLocaleString("pt-MZ"));
    card.append(meta);
    if (order.customer) card.append(makeElement("p", "order-detail", `Cliente: ${order.customer}`));
    if (order.orderType === "delivery-dishes" || order.orderType === "delivery-buffet") {
        if (order.deliveryPhone) card.append(makeElement("p", "order-detail", `Telefone: ${order.deliveryPhone}`));
        if (order.deliveryAddress) card.append(makeElement("p", "order-detail", `Morada: ${order.deliveryAddress}`));
        if (order.deliveryDate) card.append(makeElement("p", "order-detail", `Data pretendida: ${order.deliveryDate}`));
        if (order.deliveryTime) card.append(makeElement("p", "order-detail", `Hora pretendida: ${order.deliveryTime}`));
    }
    if (order.estimatedMinutes) {
        card.append(makeElement("p", "order-detail", `Tempo estimado: ${order.estimatedMinutes} minutos`));
    }

    const list = makeElement("ul", "item-list");
    order.items.forEach(item => {
        const details = item.details ? ` — ${item.details}` : "";
        list.append(makeElement("li", "", `${item.quantity} × ${item.name}${details}`));
    });
    if (order.orderType !== "delivery-buffet") {
        card.append(list);
        const total = Number(order.total).toLocaleString("pt-MZ") + " MT";
        card.append(makeElement("p", "order-total", `Total estimado: ${total}`));
    } else {
        card.append(makeElement("p", "order-notes", "Solicitação sem produtos predefinidos."));
    }
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
    const timeLabel = makeElement("label", "status-control", "Tempo estimado (minutos)");
    const timeInput = document.createElement("input");
    timeInput.type = "number";
    timeInput.min = "1";
    timeInput.max = "240";
    timeInput.step = "1";
    timeInput.value = order.estimatedMinutes || "";
    timeInput.placeholder = "Ex.: 30";
    timeInput.setAttribute("aria-label", `Tempo estimado do pedido ${order.id}`);
    timeLabel.append(timeInput);
    if (order.status === "new") {
        const accept = makeElement("button", "button primary", "Aceitar");
        accept.type = "button";
        accept.addEventListener("click", async () => {
            accept.disabled = true;
            reject.disabled = true;
            try {
                await request(`/api/admin/orders/${order.id}/status`, {
                    method: "PATCH",
                    body: JSON.stringify({ status: "accepted", estimatedMinutes: timeInput.value })
                });
                showMessage(`Pedido #${order.id} aceite.`);
                await refreshOrders();
            } catch (error) {
                showMessage(error.message, true);
                accept.disabled = false;
                reject.disabled = false;
            }
        });
        const reject = makeElement("button", "button reject", "Rejeitar");
        reject.type = "button";
        reject.addEventListener("click", async () => {
            accept.disabled = true;
            reject.disabled = true;
            try {
                await request(`/api/admin/orders/${order.id}/status`, {
                    method: "PATCH",
                    body: JSON.stringify({ status: "cancelled", estimatedMinutes: timeInput.value })
                });
                showMessage(`Pedido #${order.id} rejeitado.`);
                await refreshOrders();
            } catch (error) {
                showMessage(error.message, true);
                accept.disabled = false;
                reject.disabled = false;
            }
        });
        controls.append(accept, reject);
    }
    const save = makeElement("button", "button primary", "Guardar");
    save.type = "button";
    save.addEventListener("click", async () => {
        save.disabled = true;
        try {
            await request(`/api/admin/orders/${order.id}/status`, {
                method: "PATCH",
                body: JSON.stringify({ status: select.value, estimatedMinutes: timeInput.value })
            });
            showMessage(`Estado do pedido #${order.id} actualizado.`);
            await refreshOrders();
        } catch (error) {
            showMessage(error.message, true);
            save.disabled = false;
        }
    });
    controls.append(label, timeLabel, save);
    card.append(controls);
    return card;
}

async function refreshOrders() {
    try {
        const statusFilter = $("statusFilter").value;
        const typeFilter = $("typeFilter").value;
        const params = new URLSearchParams();
        if (statusFilter) params.set("status", statusFilter);
        if (typeFilter) params.set("type", typeFilter);
        const query = params.size ? `?${params.toString()}` : "";
        const [{ orders }, allResult] = await Promise.all([
            request(`/api/admin/orders${query}`),
            request("/api/admin/orders")
        ]);
        const container = $("orders");
        container.replaceChildren();
        if (!orders.length) {
            container.append(makeElement("p", "empty", "Ainda não há pedidos neste estado."));
        } else {
            orders.forEach(order => container.append(renderOrder(order)));
        }
        const newOrders = allResult.orders.filter(order => order.status === "new").length;
        const badge = $("newOrdersBadge");
        badge.hidden = newOrders === 0;
        badge.textContent = `${newOrders} novo${newOrders === 1 ? "" : "s"}`;
        document.title = newOrders
            ? `(${newOrders}) Sistema do Gerente | Quinta Michela`
            : "Sistema do Gerente | Quinta Michela";
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
$("typeFilter").addEventListener("change", refreshOrders);
request("/api/admin/orders")
    .then(() => setAuthenticated(true))
    .catch(() => setAuthenticated(false));
