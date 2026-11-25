
/* CONFIGURAR: inserir o WhatsApp oficial no formato 258XXXXXXXXX.
   Substituir os produtos e preços de demonstração pelos dados aprovados. */
const CONFIG = { whatsapp: "258XXXXXXXXX", currency: "MT", ordersApiBaseUrl: "" };
const randomPrice = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const CATEGORIES = ["Todos", "Prato do dia", "Petiscos", "Entradas", "Mariscos", "Refeições", "Salgados", "Bebidas", "Coquetéis", "Sobremesas"];
const PRODUCTS = [
    { id: 1, n: "Prato do dia", c: "Prato do dia", d: "Consulte a opção e os acompanhamentos disponíveis.", p: randomPrice(240, 520), image: "imagens/pratodoDIa.png" },
    { id: 2, n: "Frango Zambeziano", c: "Refeições", d: "Consulte a nossa equipa para detalhes e acompanhamentos.", p: randomPrice(320, 760), image: "imagens/frangoZambeziano.png" },
    { id: 3, n: "Frango Michela", c: "Refeições", d: "Consulte a nossa equipa para detalhes e acompanhamentos.", p: randomPrice(340, 780), image: "imagens/frangoMichela.png" },
    { id: 4, n: "Camarão Tigre", c: "Mariscos", d: "Consulte a nossa equipa para detalhes e acompanhamentos.", p: randomPrice(420, 980), image: "imagens/camaraoTigre.png" },
    { id: 5, n: "Camarão Panado", c: "Mariscos", d: "Consulte a nossa equipa para detalhes e acompanhamentos.", p: randomPrice(380, 900), image: "imagens/camaraopanado.png" },
    { id: 6, n: "Tábua de Marisco", c: "Petiscos", d: "Consulte a nossa equipa sobre a composição e as porções.", p: randomPrice(540, 1400), image: "imagens/tabuadeMarisco.png" },
    { id: 7, n: "Tábua de Carne", c: "Petiscos", d: "Consulte a nossa equipa sobre a composição e as porções.", p: randomPrice(520, 1320), image: "imagens/tabuadeCarne.png" },
    { id: 8, n: "Salgadinhos", c: "Salgados", d: "Consulte as opções disponíveis.", p: randomPrice(180, 420), image: "imagens/salgadinhos.jpeg" },
    { id: 9, n: "Pizza", c: "Refeições", d: "Consulte a nossa equipa sobre os sabores disponíveis.", p: randomPrice(300, 700), image: "imagens/pizza.png" },
    { id: 10, n: "Peixe à Mexicana", c: "Refeições", d: "Consulte a nossa equipa para detalhes e acompanhamentos.", p: randomPrice(360, 820), image: "imagens/peixeMexicana.png" },
    { id: 11, n: "Panquecas", c: "Sobremesas", d: "Consulte as opções disponíveis.", p: randomPrice(180, 420), image: "imagens/panquecas.png" }
];
let category = "Todos", cart = {}, itemDetails = {}; const $ = id => document.getElementById(id), cats = CATEGORIES;
const rawTable = new URLSearchParams(window.location.search).get("mesa");
const tableNumber = rawTable && /^[A-Za-z0-9À-ÿ][A-Za-z0-9À-ÿ._-]{0,19}$/.test(rawTable.trim()) ? rawTable.trim() : "";
const isTableOrder = Boolean(tableNumber);
$("table").value = isTableOrder ? "Mesa " + tableNumber : "";
$("tableField").hidden = !isTableOrder;
$("deliveryFields").hidden = isTableOrder;
$("sendOrder").hidden = !isTableOrder;
$("whatsapp").hidden = isTableOrder;
$("customer").required = !isTableOrder;
$("customerLabel").textContent = isTableOrder ? "Nome (opcional)" : "Nome (obrigatório)";
$("deliveryPhone").required = !isTableOrder;
$("deliveryAddress").required = !isTableOrder;
$("tableNotice").textContent = isTableOrder
    ? "Está na " + $("table").value + ". O pedido será enviado ao Sistema do Gerente."
    : "Pedido para entrega: escolha pratos do menu ou solicite um orçamento de buffet pelo WhatsApp.";
$("flowTitle").textContent = isTableOrder ? "Pedido para consumo na mesa" : "Pedido para entrega";
$("flowDescription").textContent = isTableOrder
    ? "Revise os produtos. Pode enviar o pedido à equipa ou alterar a selecção antes de o enviar."
    : "Sem QR de mesa, use o WhatsApp para pedir pratos do menu ou solicitar um orçamento de buffet para entrega.";
const money = n => Number(n).toLocaleString("pt-MZ") + " " + CONFIG.currency;
const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
function showToast(message) {
    const toast = $("toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove("show"), 1800);
}
function renderCats() { $("cats").innerHTML = cats.map(c => `<button class="cat ${c === category ? "active" : ""}" data-c="${c}" aria-pressed="${c === category}">${c}</button>`).join(""); document.querySelectorAll("[data-c]").forEach(b => b.onclick = () => { category = b.dataset.c; renderCats(); render() }) }
function render() { let q = $("search").value.toLocaleLowerCase("pt"); let list = PRODUCTS.filter(x => (category === "Todos" || x.c === category) && (`${x.n} ${x.d} ${x.c}`).toLocaleLowerCase("pt").includes(q)); $("heading").textContent = category === "Todos" ? "O nosso menu" : category; $("items").innerHTML = list.length ? list.map(x => `<article class="card"><img class="photo" src="${x.image}" alt="${x.n}" loading="lazy"><div class="body"><h3>${x.n}</h3><div class="desc">${x.d}</div><div class="foot"><span class="price">${x.p > 0 ? money(x.p) : "Consulte o preço"}</span><button class="add" data-add="${x.id}">Pedir</button></div></div></article>`).join("") : "<p class='empty'>Não foram encontrados produtos.</p>"; document.querySelectorAll("[data-add]").forEach(b => b.onclick = () => { cart[b.dataset.add] = (cart[b.dataset.add] || 0) + 1; update(); showToast("Produto adicionado ao pedido"); }) }
function update() { let count = Object.values(cart).reduce((a, b) => a + b, 0); $("count").textContent = count; let entries = Object.entries(cart); $("lines").innerHTML = entries.length ? entries.map(([id, n]) => { let p = PRODUCTS.find(x => x.id == id); let detail = itemDetails[id] || { action: "", note: "" }; return `<div class="line-wrap"><div class="line"><span><b>${p.n}</b><br><small>${p.p ? money(p.p) : "Consulte o preço"}</small></span><span class="qty"><button data-dec="${id}" aria-label="Remover uma unidade de ${p.n}">−</button>${n}<button data-inc="${id}" aria-label="Adicionar uma unidade de ${p.n}">+</button></span></div><div class="item-details"><span class="item-details-title">Detalhes deste item</span><div class="detail-actions" aria-label="Detalhes para ${p.n}"><button type="button" class="${detail.action === "Sem ingrediente" ? "active" : ""}" data-detail-action="${id}" data-action="Sem ingrediente">Sem ingrediente</button><button type="button" class="${detail.action === "Porção maior" ? "active" : ""}" data-detail-action="${id}" data-action="Porção maior">Porção maior</button><button type="button" class="${detail.action === "Porção menor" ? "active" : ""}" data-detail-action="${id}" data-action="Porção menor">Porção menor</button></div><input class="item-detail-note" data-detail-note="${id}" value="${escapeHtml(detail.note)}" placeholder="Detalhes do pedido" aria-label="Observações para ${p.n}"></div></div>` }).join("") : "<p class='empty'>O pedido ainda está vazio.</p>"; let hasUnpricedItems = entries.some(([id]) => !PRODUCTS.find(x => x.id == id).p); $("total").textContent = hasUnpricedItems ? "A confirmar" : money(entries.reduce((s, [id, n]) => s + PRODUCTS.find(x => x.id == id).p * n, 0)); document.querySelectorAll("[data-dec]").forEach(b => b.onclick = () => change(b.dataset.dec, -1)); document.querySelectorAll("[data-inc]").forEach(b => b.onclick = () => change(b.dataset.inc, 1)); document.querySelectorAll("[data-detail-action]").forEach(b => b.onclick = () => { let id = b.dataset.detailAction; itemDetails[id] = itemDetails[id] || { action: "", note: "" }; itemDetails[id].action = itemDetails[id].action === b.dataset.action ? "" : b.dataset.action; update(); }); document.querySelectorAll("[data-detail-note]").forEach(input => input.oninput = () => { let id = input.dataset.detailNote; itemDetails[id] = itemDetails[id] || { action: "", note: "" }; itemDetails[id].note = input.value; }); $("clearCart").disabled = !entries.length; }
function change(id, n) { cart[id] = (cart[id] || 0) + n; if (cart[id] <= 0) { delete cart[id]; delete itemDetails[id]; } update() }
function getOrderItems() {
    return Object.entries(cart).map(([id, quantity]) => {
        const product = PRODUCTS.find(item => item.id === Number(id));
        const detail = itemDetails[id] || { action: "", note: "" };
        return {
            productId: product.id,
            name: product.n,
            quantity,
            unitPrice: product.p,
            details: [detail.action, detail.note].filter(Boolean).join(" — ")
        };
    });
}

async function submitTableOrder() {
    if (!Object.keys(cart).length) return showToast("Adicione produtos ao pedido primeiro");
    const button = $("sendOrder");
    button.disabled = true;
    button.textContent = "A enviar...";
    try {
        const apiBase = CONFIG.ordersApiBaseUrl.replace(/\/$/, "");
        const response = await fetch(apiBase + "/api/orders", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                table: tableNumber,
                customer: $("customer").value,
                notes: $("notes").value,
                items: getOrderItems()
            })
        });
        let result = {};
        try {
            result = await response.json();
        } catch {
            result = {};
        }
        if (!response.ok) throw new Error(result.error || "O servidor não aceitou o pedido.");
        cart = {};
        itemDetails = {};
        update();
        $("overlay").close();
        showToast(`Pedido #${result.id} enviado ao gerente`);
    } catch (error) {
        console.error("Falha ao enviar o pedido da mesa:", error);
        showToast("Não foi possível enviar. Verifique a ligação ao Sistema do Gerente.");
    } finally {
        button.disabled = false;
        button.textContent = "Enviar pedido";
    }
}

function sendDeliveryRequest() {
    const isBuffet = $("deliveryType").value === "buffet";
    const items = getOrderItems();
    if (!items.length && !isBuffet) return showToast("Adicione um prato ou escolha solicitar buffet");
    if (!$("customer").value.trim()) return showToast("Indique o seu nome");
    if (!$("deliveryPhone").value.trim()) return showToast("Indique um telefone para contacto");
    if (!$("deliveryAddress").value.trim()) return showToast("Indique a morada de entrega");

    const rows = items.map(item => {
        const product = PRODUCTS.find(product => product.id === item.productId);
        const details = item.details ? `\n  Detalhes: ${item.details}` : "";
        return `• ${item.quantity} x ${product.n} — ${product.p ? money(product.p) : "preço a confirmar"}${details}`;
    });
    const hasUnpricedItems = items.some(item => !item.unitPrice);
    const total = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    const requestType = isBuffet
        ? "Pedido de orçamento de buffet para entrega"
        : "Pedido de pratos do menu para entrega";
    const message = [
        "Olá, Quinta Michela! Gostaria de fazer um pedido para entrega.",
        requestType,
        ...rows,
        "Total estimado: " + (items.length && !hasUnpricedItems ? money(total) : "A confirmar"),
        "Nome: " + $("customer").value.trim(),
        "Telefone: " + $("deliveryPhone").value.trim(),
        "Morada de entrega: " + $("deliveryAddress").value.trim(),
        "Observações: " + ($("notes").value.trim() || "Nenhuma")
    ].join("\n");
    window.open("https://wa.me/" + CONFIG.whatsapp + "?text=" + encodeURIComponent(message), "_blank");
}

$("search").oninput = render;
$("open").onclick = () => $("overlay").showModal();
$("close").onclick = () => $("overlay").close();
$("overlay").onclick = event => {
    if (event.target === $("overlay")) $("overlay").close();
};
$("sendOrder").onclick = submitTableOrder;
$("whatsapp").onclick = sendDeliveryRequest;
$("editOrder").onclick = () => $("overlay").close();
$("deliveryType").onchange = () => {
    $("notes").placeholder = $("deliveryType").value === "buffet"
        ? "Indique tipo de buffet, data, número de pessoas ou detalhes do pedido"
        : "Indicações adicionais para o pedido";
};
$("clearCart").onclick = () => {
    cart = {};
    itemDetails = {};
    update();
    showToast("Pedido limpo");
};

if (/^258\d{9}$/.test(CONFIG.whatsapp)) {
    $("whatsapp").disabled = false;
    $("whatsapp").textContent = "Pedir entrega pelo WhatsApp";
} else {
    $("whatsapp").disabled = true;
    $("whatsapp").textContent = "WhatsApp não configurado";
}
$("modalnote").textContent = isTableOrder
    ? "O pedido será registado no Sistema do Gerente."
    : /^258\d{9}$/.test(CONFIG.whatsapp)
        ? "O WhatsApp é usado apenas para pedidos de pratos ou buffet para entrega."
        : "Configure o WhatsApp oficial para receber pedidos de entrega.";

renderCats();
render();
update();
renderCats(); render(); update();
