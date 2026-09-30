// Plantilla del sitio de publicaciones. Fuente: herramientas/plantilla_tablero/ (no editar en el repo).
// Dos páginas: la lista de empresas (index.html de la raíz) y la ficha de una empresa (empresas/<id>/).
// Sin base de datos: la ficha se edita aquí y se EXPORTAN solo los cambios (JSON). En el estudio se aplican con
//   herramientas/ficha.py aplicar <archivo.json>
(function () {
  const $ = (s, el = document) => el.querySelector(s);
  const h = (tag, attrs = {}, ...hijos) => {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") el.className = v; else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else if (k === "value") el.value = v; else if (k === "checked") el.checked = v;
      else if (v !== false && v != null) el.setAttribute(k, v === true ? "" : v);
    }
    for (const x of hijos.flat()) if (x != null && x !== false) el.append(x.nodeType ? x : document.createTextNode(x));
    return el;
  };
  const leer = (c) => { try { return JSON.parse(localStorage.getItem(c) || "null"); } catch { return null; } };
  const escribir = (c, v) => { try { v == null ? localStorage.removeItem(c) : localStorage.setItem(c, JSON.stringify(v)); } catch { /* sin almacenamiento */ } };
  const igual = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  const ahora = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };  // hora local
  const slug = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  let toastT;
  function toast(msg) {
    let t = $(".toast"); if (!t) { t = h("div", { class: "toast", role: "status" }); document.body.append(t); }
    t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), 2600);
  }
  async function copiar(texto, pre) {
    try { await navigator.clipboard.writeText(texto); toast("Cambios copiados"); }
    catch { const r = document.createRange(); r.selectNodeContents(pre); const s = getSelection(); s.removeAllRanges(); s.addRange(r); toast("Selecciona y copia con Ctrl+C"); }
  }
  function descargar(nombre, texto) {
    const a = h("a", { href: URL.createObjectURL(new Blob([texto], { type: "application/json" })), download: nombre });
    document.body.append(a); a.click(); a.remove();
  }

  // ---------------------------------------------------------------- esquema de la ficha (igual para todas)
  const SECCIONES = [
    ["Identidad", [
      { k: "nombre", t: "texto", l: "Nombre comercial" },
      { k: "estado", t: "select", l: "Estado", ops: [["borrador", "Borrador"], ["activa", "Activa"], ["pausada", "Pausada"]] },
      { k: "pagina_facebook", t: "texto", l: "Página de Facebook" },
      { k: "enlace", t: "texto", l: "Web o enlace de venta" },
      { k: "rubro", t: "area", l: "Rubro: qué vende y dónde", ancho: true }]],
    ["Público y voz", [
      { k: "publico", t: "area", l: "Público objetivo", ancho: true },
      { k: "problemas_del_publico", t: "lista", l: "Problemas o deseos del público", ayuda: "Uno por línea. Cada publicación parte de uno de estos.", ancho: true },
      { k: "tono", t: "area", l: "Tono", ancho: true },
      { k: "tratamiento", t: "select", l: "Tratamiento", ops: [["tú", "tú"], ["usted", "usted"], ["ustedes", "ustedes"]] },
      { k: "idioma", t: "texto", l: "Idioma" }]],
    ["Canales y publicación", [
      { k: "redes", t: "checks", l: "Redes", ops: [["facebook", "Facebook"], ["instagram", "Instagram"], ["tiktok", "TikTok"]] },
      { k: "llamada_a_la_accion", t: "texto", l: "Llamada a la acción", ancho: true },
      { k: "frecuencia", t: "frecuencia", l: "Piezas por semana", ancho: true },
      { k: "hashtags_base", t: "lista", l: "Hashtags fijos", ayuda: "Uno por línea, con #." },
      { k: "declaracion_ia", t: "texto", l: "Declaración de IA", ayuda: "Va al final de cada texto. Obligatoria." }]],
    ["Contenido", [
      { k: "modelo", t: "modelo", l: "Modelo sintética" },
      { k: "testimonios", t: "lista", l: "Testimonios reales", ayuda: "Solo reales, citados tal cual. Sin testimonios no se usa el pilar de prueba social.", ancho: true },
      { k: "notas", t: "area", l: "Notas internas", ancho: true }]],
  ];
  const PRODUCTO = [
    { k: "nombre", t: "texto", l: "Nombre" }, { k: "precio", t: "texto", l: "Precio", ayuda: "Solo si es real." },
    { k: "descripcion", t: "area", l: "Descripción", ancho: true },
    { k: "datos", t: "texto", l: "Otros datos reales", ayuda: "Tallas, tela, colores disponibles…", ancho: true }];

  function control(c, valor, alCambiar, ctx) {
    const id = `f-${ctx}-${c.k}`;
    const lbl = h("label", { for: id }, c.l);
    let el;
    if (c.t === "texto") el = h("input", { type: "text", id, value: valor ?? "", oninput: (e) => alCambiar(e.target.value) });
    else if (c.t === "area") el = h("textarea", { id, rows: 3, oninput: (e) => alCambiar(e.target.value) }, valor ?? "");
    else if (c.t === "lista") el = h("textarea", { id, rows: 4, oninput: (e) => alCambiar(e.target.value.split("\n").map((x) => x.trim()).filter(Boolean)) }, (valor || []).join("\n"));
    else if (c.t === "select" || c.t === "modelo") {
      const ops = c.t === "modelo" ? [["", "Sin modelo (solo producto)"], ...Object.entries(ctx.modelos || window.__MODELOS || {}).map(([k, d]) => [k, `${k} · ${d}`])] : c.ops;
      if (valor && !ops.some(([k]) => k === valor)) ops.push([valor, valor]);
      el = h("select", { id, onchange: (e) => alCambiar(e.target.value) }, ops.map(([k, t]) => h("option", { value: k, selected: k === (valor ?? "") }, t)));
    } else if (c.t === "checks") {
      const sel = new Set(valor || []);
      el = h("div", { class: "grupo", role: "group", "aria-label": c.l }, c.ops.map(([k, t]) => h("label", {},
        h("input", { type: "checkbox", checked: sel.has(k), onchange: (e) => { e.target.checked ? sel.add(k) : sel.delete(k); alCambiar(c.ops.map(([x]) => x).filter((x) => sel.has(x))); } }), t)));
      return h("div", { class: "campo" + (c.ancho ? " ancho" : "") }, h("span", { class: "lbl" }, c.l), el);
    } else if (c.t === "frecuencia") {
      const f = JSON.parse(JSON.stringify(valor || { mezcla: {}, horas: [] }));
      const emitir = () => { f.posts_semana = Object.values(f.mezcla).reduce((a, b) => a + (+b || 0), 0); alCambiar(JSON.parse(JSON.stringify(f))); };
      el = h("div", { class: "grupo" },
        [["foto", "Posts"], ["carrusel", "Carruseles"], ["reel", "Reels"]].map(([k, t]) => h("label", {}, t,
          h("input", { type: "number", min: 0, max: 14, value: f.mezcla[k] ?? 0, oninput: (e) => { f.mezcla[k] = Math.max(0, +e.target.value || 0); emitir(); } }))),
        h("label", {}, "Horas", h("input", { type: "text", value: (f.horas || []).join(", "), style: "width:130px",
          oninput: (e) => { f.horas = e.target.value.split(/[,\s]+/).filter((x) => /^\d{1,2}:\d{2}$/.test(x)); emitir(); } })));
      return h("div", { class: "campo ancho" }, h("span", { class: "lbl" }, c.l), el, h("span", { class: "ayuda" }, "Horas separadas por coma (24 h). El total se calcula solo."));
    }
    return h("div", { class: "campo" + (c.ancho ? " ancho" : "") }, lbl, el, c.ayuda ? h("span", { class: "ayuda" }, c.ayuda) : null);
  }

  // ---------------------------------------------------------------- página de una empresa
  async function empresa(raiz) {
    const [ficha, sitio, corridas] = await Promise.all(["ficha.json", "../../empresas.json", "../../corridas.json"]
      .map((u) => fetch(u, { cache: "no-store" }).then((r) => r.json())));
    window.__MODELOS = sitio.modelos;
    const id = ficha.id, clave = "ficha:" + id + ":" + ficha._version;
    const original = JSON.parse(JSON.stringify(ficha));
    const actual = Object.assign(JSON.parse(JSON.stringify(ficha)), leer(clave) || {});
    document.title = `${ficha.nombre} · ficha`;

    const pre = h("pre", { "aria-label": "Cambios exportables" });
    const cuenta = h("strong");
    const btnCopiar = h("button", { class: "btn prim", onclick: () => copiar(pre.textContent, pre) }, "Copiar cambios");
    const btnBajar = h("button", { class: "btn", onclick: () => descargar(`cambios-${id}-${ahora().replace(/[-:T]/g, "")}.json`, pre.textContent) }, "Descargar .json");
    const btnDescartar = h("button", { class: "btn", onclick: () => { escribir(clave, null); location.reload(); } }, "Descartar");

    function cambios() {
      const c = {};
      for (const k of Object.keys(actual)) {
        if (k.startsWith("_") || k === "id") continue;
        if (k === "productos") {
          const ps = actual.productos.map((p, i) => {
            const o = original.productos[i], d = { id: p.id };
            for (const f of PRODUCTO) if (!igual(p[f.k] || "", o[f.k] || "")) d[f.k] = p[f.k];
            return Object.keys(d).length > 1 ? d : null;
          }).filter(Boolean);
          if (ps.length) c.productos = ps;
        } else if (!igual(actual[k], original[k])) c[k] = actual[k];
      }
      return c;
    }
    function refrescar() {
      const c = cambios(), n = Object.keys(c).length;
      const guardables = {}; for (const k of Object.keys(c)) guardables[k] = actual[k];
      escribir(clave, n ? guardables : null);
      pre.textContent = JSON.stringify({ empresa: id, version_base: ficha._version, exportado: ahora(), cambios: c }, null, 2);
      cuenta.textContent = n ? `${n} campo${n > 1 ? "s" : ""} modificado${n > 1 ? "s" : ""}` : "Sin cambios";
      [btnCopiar, btnBajar, btnDescartar].forEach((b) => (b.disabled = !n));
      document.querySelectorAll(".campo[data-k]").forEach((el) => el.classList.toggle("cambiado", k_cambiado(el.dataset.k, c)));
    }
    const k_cambiado = (k, c) => {
      if (!k.includes("/")) return k in c;
      const [pid, campo] = k.split("/");
      return (c.productos || []).some((p) => p.id === pid && campo in p);
    };

    const secciones = SECCIONES.map(([titulo, cs]) => h("section", { class: "panel" }, h("h2", {}, titulo),
      h("div", { class: "campos" }, cs.map((c) => { const el = control(c, actual[c.k], (v) => { actual[c.k] = v; refrescar(); }, id); el.dataset.k = c.k; return el; }))));
    const prods = h("section", { class: "panel" }, h("h2", {}, "Productos", h("small", {}, `${actual.productos.length}`)),
      actual.productos.length ? actual.productos.map((p) => h("div", { class: "prod" },
        p.foto ? h("img", { src: p.foto, alt: p.nombre }) : h("div"),
        h("div", { class: "campos" }, PRODUCTO.map((c) => { const el = control(c, p[c.k], (v) => { p[c.k] = v; refrescar(); }, `${id}-${p.id}`); el.dataset.k = `${p.id}/${c.k}`; return el; }))))
        : h("p", { class: "vacio" }, "Sin productos."),
      h("p", { class: "vacio" }, "Para añadir un producto hace falta su foto: envíala al estudio (se da de alta con contenido.py producto)."));
    const mias = corridas.filter((c) => c.marca_id === id);

    raiz.append(
      h("header", { class: "top" }, h("h1", {}, ficha.nombre), h("span", { class: `chip ${actual.estado || "borrador"}` }, actual.estado || "borrador"),
        h("span", { class: "ruta" }, h("a", { href: "../../" }, "empresas"), ` / ${id}`)),
      h("div", { class: "cols" },
        h("div", { class: "campos-col", style: "display:grid;gap:14px;min-width:0" }, secciones, prods),
        h("aside", { class: "lateral" },
          h("section", { class: "panel" }, h("h2", {}, "Exportar cambios"),
            h("div", { class: "export" }, cuenta,
              h("p", {}, "Aún no hay base de datos: lo que edites queda solo en este navegador. Copia o descarga los cambios y envíalos al estudio; allí se aplican a la ficha."),
              h("div", { class: "fila" }, btnCopiar, btnBajar, btnDescartar), pre)),
          h("section", { class: "panel" }, h("h2", {}, "Corridas", h("small", {}, `${mias.length}`)),
            mias.length ? h("div", { class: "lista-c" }, mias.map((c) => h("a", { href: "../../" + c.ruta },
              h("b", {}, c.producto || "general"), h("span", {}, `semana ${c.semana.slice(8)}/${c.semana.slice(5, 7)} · ${c.piezas} piezas`))))
              : h("p", { class: "vacio" }, "Todavía sin corridas.")))),
      h("footer", { class: "pie" }, `Ficha exportada el ${ficha._version.replace("T", " ")}. Prueba interna.`));
    refrescar();
  }

  // ---------------------------------------------------------------- lista de empresas
  async function lista(raiz) {
    const sitio = await fetch("empresas.json", { cache: "no-store" }).then((r) => r.json());
    const filas = sitio.empresas.map((e) => h("tr", {},
      h("td", {}, e.miniatura ? h("img", { src: e.miniatura, alt: "" }) : ""),
      h("td", {}, h("a", { href: `empresas/${e.id}/` }, e.nombre)),
      h("td", {}, h("span", { class: `chip ${e.estado}` }, e.estado)),
      h("td", { class: "corto" }, e.rubro || "Ficha sin completar"),
      h("td", {}, e.productos), h("td", {}, e.corridas),
      h("td", {}, e.ultima ? h("a", { href: e.ultima.ruta }, e.ultima.corrida) : "—")));
    const nombre = h("input", { type: "text", id: "n-nombre" }), fb = h("input", { type: "text", id: "n-fb" }), rubro = h("textarea", { id: "n-rubro", rows: 2 });
    const pre = h("pre");
    const pintar = () => { pre.textContent = JSON.stringify({ empresa: slug(nombre.value) || "nueva-empresa", nueva: true, exportado: ahora(),
      cambios: { nombre: nombre.value.trim(), pagina_facebook: fb.value.trim() || nombre.value.trim(), rubro: rubro.value.trim() } }, null, 2); };
    [nombre, fb, rubro].forEach((x) => x.addEventListener("input", pintar)); pintar();
    const form = h("section", { class: "panel", hidden: true }, h("h2", {}, "Nueva empresa"),
      h("div", { class: "cols", style: "padding:12px;gap:12px" },
        h("div", { class: "campos", style: "padding:0" },
          h("div", { class: "campo ancho" }, h("label", { for: "n-nombre" }, "Nombre comercial"), nombre),
          h("div", { class: "campo ancho" }, h("label", { for: "n-fb" }, "Página de Facebook"), fb),
          h("div", { class: "campo ancho" }, h("label", { for: "n-rubro" }, "Rubro"), rubro)),
        h("div", { class: "export", style: "padding:0" }, h("p", {}, "Se crea como borrador. Envía este JSON al estudio; el resto de la ficha se completa luego en su página."),
          h("div", { class: "fila" }, h("button", { class: "btn prim", onclick: () => copiar(pre.textContent, pre) }, "Copiar"),
            h("button", { class: "btn", onclick: () => descargar(`nueva-${slug(nombre.value) || "empresa"}.json`, pre.textContent) }, "Descargar .json")), pre)));
    raiz.append(
      h("header", { class: "top" }, h("h1", {}, "Empresas"), h("span", { class: "ruta" }, `${sitio.empresas.length} fichas · prueba interna`),
        h("button", { class: "btn", style: "margin-left:auto", onclick: () => { form.hidden = !form.hidden; if (!form.hidden) nombre.focus(); } }, "Nueva empresa")),
      form,
      h("div", { class: "tabla" }, h("table", {},
        h("thead", {}, h("tr", {}, ["", "Empresa", "Estado", "Rubro", "Productos", "Corridas", "Última corrida"].map((t) => h("th", {}, t)))),
        h("tbody", {}, filas))),
      h("footer", { class: "pie" }, "Imágenes generadas con IA (modelo sintética). Las fichas se editan en la página de cada empresa y se exportan como cambios."));
  }

  function iniciar() {
    const raiz = $("#app");
    (raiz.dataset.pagina === "empresa" ? empresa : lista)(raiz)
      .catch((e) => raiz.append(h("p", {}, "No se pudieron leer los datos: " + e.message)));
  }
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", iniciar) : iniciar();
})();
