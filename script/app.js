
/* CONFIGURAR: inserir o WhatsApp oficial no formato 258XXXXXXXXX.
   Substituir os produtos e preços de demonstração pelos dados aprovados. */
const CONFIG = { whatsapp: "258XXXXXXXXX", currency: "MT" };
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
let category = "Todos", cart = {}; const $ = id => document.getElementById(id), cats = CATEGORIES;
const money = n => Number(n).toLocaleString("pt-MZ") + " " + CONFIG.currency;
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
function update() { let count = Object.values(cart).reduce((a, b) => a + b, 0); $("count").textContent = count; let entries = Object.entries(cart); $("lines").innerHTML = entries.length ? entries.map(([id, n]) => { let p = PRODUCTS.find(x => x.id == id); return `<div class="line"><span><b>${p.n}</b><br><small>${p.p ? money(p.p) : "Consulte o preço"}</small></span><span class="qty"><button data-dec="${id}" aria-label="Remover uma unidade de ${p.n}">−</button>${n}<button data-inc="${id}" aria-label="Adicionar uma unidade de ${p.n}">+</button></span></div>` }).join("") : "<p class='empty'>O pedido ainda está vazio.</p>"; let hasUnpricedItems = entries.some(([id]) => !PRODUCTS.find(x => x.id == id).p); $("total").textContent = hasUnpricedItems ? "A confirmar" : money(entries.reduce((s, [id, n]) => s + PRODUCTS.find(x => x.id == id).p * n, 0)); document.querySelectorAll("[data-dec]").forEach(b => b.onclick = () => change(b.dataset.dec, -1)); document.querySelectorAll("[data-inc]").forEach(b => b.onclick = () => change(b.dataset.inc, 1)); $("clearCart").disabled = !entries.length; }
function change(id, n) { cart[id] = (cart[id] || 0) + n; if (cart[id] <= 0) delete cart[id]; update() }
$("search").oninput = render; $("open").onclick = () => $("overlay").showModal(); $("close").onclick = () => $("overlay").close(); $("overlay").onclick = e => { if (e.target === $("overlay")) $("overlay").close() };
if (/^258\d{9}$/.test(CONFIG.whatsapp)) {
    $("whatsapp").disabled = false;
    $("whatsapp").textContent = "Pedir pelo WhatsApp";
    $("modalnote").textContent = "Revise a sua selecção e envie o pedido pelo WhatsApp.";
    $("whatsapp").onclick = () => {
        let entries = Object.entries(cart);
        if (!entries.length) return showToast("Adicione produtos ao pedido primeiro");
        let rows = entries.map(([id, n]) => { let p = PRODUCTS.find(x => x.id == id); return `• ${n} x ${p.n} — ${p.p ? money(p.p) : "preço a confirmar"}` });
        let hasUnpricedItems = entries.some(([id]) => !PRODUCTS.find(x => x.id == id).p);
        let total = entries.reduce((s, [id, n]) => s + PRODUCTS.find(x => x.id == id).p * n, 0);
        let msg = ["Olá, Quinta Michela! Gostaria de confirmar este pedido:", ...rows, "Total estimado: " + (hasUnpricedItems ? "A confirmar" : money(total)), "Nome: " + ($("customer").value || "Não indicado"), "Mesa/local: " + ($("table").value || "A confirmar"), "Observações: " + ($("notes").value || "Nenhuma")].join("\n");
        window.open("https://wa.me/" + CONFIG.whatsapp + "?text=" + encodeURIComponent(msg), "_blank");
    };
}
if (!/^258\d{9}$/.test(CONFIG.whatsapp)) {
    $("modalnote").textContent = "Para concluir o pedido, mostre esta selecção a um colaborador. O pedido pelo WhatsApp estará disponível em breve.";
}
$("waiter").onclick = () => {
    if (!Object.keys(cart).length) return showToast("Adicione produtos ao pedido primeiro");
    showToast("Pedido pronto para mostrar à equipa");
    $("overlay").close();
};
$("clearCart").onclick = () => { cart = {}; update(); showToast("Pedido limpo"); };
renderCats(); render(); update();
