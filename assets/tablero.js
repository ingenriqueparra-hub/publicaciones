// Plantilla del tablero de revisión. Fuente: herramientas/plantilla_tablero/ (no editar en el repo de publicaciones).
// Lee datos.json de la carpeta de la corrida y pinta las piezas. Los botones son DEMO: cambian el estado solo en
// este navegador (localStorage) y no envían nada.
(function () {
  const $ = (s, el = document) => el.querySelector(s);
  const h = (tag, attrs = {}, ...hijos) => {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") el.className = v; else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else if (v !== false && v != null) el.setAttribute(k, v === true ? "" : v);
    }
    for (const x of hijos.flat()) if (x != null) el.append(x.nodeType ? x : document.createTextNode(x));
    return el;
  };
  const NOMBRE = { generado: "Por revisar", aprobado: "Aprobado", exportado: "Aprobado", rehacer: "Regenerando",
    denegado: "Denegado", programado: "Programado", publicado: "Publicado", planificado: "Planificado" };
  const FORMATO = { foto: "Post 4:5", carrusel: "Carrusel", reel: "Reel 9:16", story: "Story 9:16" };
  const guardado = (clave) => { try { return JSON.parse(localStorage.getItem(clave) || "{}"); } catch { return {}; } };
  const guardar = (clave, v) => { try { localStorage.setItem(clave, JSON.stringify(v)); } catch { /* sin almacenamiento */ } };

  let toastT;
  function toast(msg) {
    let t = $(".toast"); if (!t) { t = h("div", { class: "toast", role: "status" }); document.body.append(t); }
    t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), 2600);
  }

  function fecha(iso) { const [y, m, d] = iso.split("-"); return `${d}/${m}`; }

  async function iniciar() {
    const raiz = $("#app");
    let d;
    try { d = await (await fetch("datos.json", { cache: "no-store" })).json(); }
    catch (e) { raiz.append(h("p", {}, "No se pudo leer datos.json de esta corrida.")); return; }
    const clave = "tablero:" + d.corrida;
    const local = guardado(clave);
    const estadoDe = (p) => local[p.id]?.estado || p.estado;
    document.title = `${d.marca} · ${d.corrida}`;

    raiz.append(
      h("header", { class: "top" },
        h("h1", {}, `Revisión de piezas · ${d.marca}`),
        h("span", { class: "ruta" }, h("a", { href: "../../../" }, "empresas"), " / ",
          h("a", { href: `../../../empresas/${d.marca_id}/` }, d.marca_id), ` / ${d.corrida}`)),
      h("section", { class: "resumen", "aria-label": "Datos de la corrida" },
        d.producto?.foto ? h("img", { src: d.producto.foto, alt: "Foto de partida del producto" }) : h("div"),
        h("dl", { class: "kv" },
          ...[["Producto", d.producto?.nombre || "—"], ["Semana", `${fecha(d.semana)} (lunes)`], ["Piezas", d.piezas.length],
            ["Modelo", d.modelo || "—"], ["Texto", d.modelo_texto], ["Imagen", d.modelo_imagen],
            ["Corrida", d.creada], ["Redes", d.redes.join(", ")],
            ...(d.producto?.descripcion ? [["Descripción del producto", d.producto.descripcion, "ancho"]] : [])]
            .map(([k, v, c]) => h("div", { class: c }, h("dt", {}, k), h("dd", {}, String(v)))))));

    const barra = h("div", { class: "barra", role: "group", "aria-label": "Filtrar por estado" });
    const lista = h("section", { class: "piezas" });
    raiz.append(barra, lista,
      h("footer", { class: "pie" }, "Prueba interna. Imágenes generadas con IA (modelo sintética), reducidas para revisión. ",
        "Los botones son una demo: guardan la decisión solo en este navegador."));

    let filtro = "todas";
    function pintarBarra() {
      barra.replaceChildren();
      const cuenta = {}; d.piezas.forEach((p) => { const e = NOMBRE[estadoDe(p)] || estadoDe(p); cuenta[e] = (cuenta[e] || 0) + 1; });
      for (const [k, n] of [["todas", d.piezas.length], ...Object.entries(cuenta)])
        barra.append(h("button", { class: "filtro", "aria-pressed": String(filtro === k), onclick: () => { filtro = k; pintar(); } },
          k === "todas" ? "Todas" : k, h("b", {}, n)));
      barra.append(h("span", { class: "aviso-demo" }, "Acciones en modo demo"));
    }

    function decidir(p, estado, extra = {}, msg) {
      local[p.id] = { estado, ...extra, cuando: new Date().toISOString() }; guardar(clave, local);
      toast(msg + " (demo: no se envía nada)"); pintar();
    }

    function tarjeta(p) {
      const est = estadoDe(p);
      const n = p.imagenes.length;
      const pista = h("div", { class: "pista" }, p.imagenes.map((src, i) =>
        h("img", { src, alt: `${p.id} imagen ${i + 1} de ${n}`, loading: "lazy" })));
      const cont = n > 1 ? h("span", { class: "contador" }, `1/${n}`) : null;
      if (cont) pista.addEventListener("scroll", () => { cont.textContent = `${Math.round(pista.scrollLeft / pista.clientWidth) + 1}/${n}`; });
      const texto = h("div", { class: "texto cerrado" }, p.texto);
      const mas = h("button", { class: "mas", onclick: () => { const c = texto.classList.toggle("cerrado"); mas.textContent = c ? "Ver texto completo" : "Ver menos"; } }, "Ver texto completo");
      const prog = local[p.id]?.programado;
      const campo = h("input", { type: "datetime-local", id: `prog-${p.id}`, value: `${p.fecha}T${p.hora}` });
      const cerrada = ["denegado", "publicado", "programado"].includes(est);
      return h("article", { class: "pieza" },
        h("div", { class: "cab" }, h("span", { class: "id" }, p.id),
          h("span", { class: "cuando" }, `${p.dia} ${fecha(p.fecha)} · ${p.hora}`),
          h("span", { class: `estado ${est}` }, NOMBRE[est] || est)),
        h("div", { class: "etq" }, h("span", {}, FORMATO[p.formato] || p.formato), h("span", {}, p.pilar.replace("_", " ")),
          n > 1 ? h("span", {}, `${n} imágenes`) : null),
        h("div", { class: `media ${p.formato}` }, pista, cont),
        texto, mas,
        (p.avisos.length || p.movimiento || prog) ? h("div", { class: "avisos" },
          p.avisos.map((a) => h("p", {}, "⚠ " + a)),
          p.movimiento ? h("p", { class: "info" }, "Movimiento del reel: " + p.movimiento) : null,
          prog ? h("p", { class: "info" }, "Programado para " + prog.replace("T", " ")) : null) : null,
        h("div", { class: "acciones" },
          h("button", { class: "aprobar", disabled: cerrada || est === "aprobado", onclick: () => decidir(p, "aprobado", {}, `${p.id} aprobada`) }, "Aprobar"),
          h("button", { class: "regenerar", disabled: cerrada, onclick: () => decidir(p, "rehacer", {}, `${p.id} enviada a regenerar`) }, "Regenerar"),
          h("button", { class: "denegar", disabled: cerrada, onclick: () => decidir(p, "denegado", {}, `${p.id} denegada`) }, "Denegar"),
          h("span", { class: "sep" }),
          h("button", { class: "publicar", disabled: est !== "aprobado" && est !== "exportado", onclick: () => decidir(p, "publicado", {}, `${p.id} publicada`) }, "Publicar ahora"),
          h("button", { disabled: est !== "aprobado" && est !== "exportado", onclick: (ev) => { const f = ev.target.closest(".pieza").querySelector(".prog"); f.hidden = !f.hidden; } }, "Programar")),
        h("div", { class: "prog", hidden: true },
          h("label", { for: `prog-${p.id}` }, "Fecha y hora"), campo,
          h("button", { class: "filtro", onclick: () => decidir(p, "programado", { programado: campo.value }, `${p.id} programada`) }, "Confirmar")),
        est !== p.estado ? h("div", { class: "prog" }, h("button", { class: "mas", onclick: () => { delete local[p.id]; guardar(clave, local); pintar(); } }, "Deshacer decisión")) : null);
    }

    function pintar() {
      pintarBarra();
      lista.replaceChildren(...d.piezas.filter((p) => filtro === "todas" || (NOMBRE[estadoDe(p)] || estadoDe(p)) === filtro).map(tarjeta));
    }
    pintar();
  }
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", iniciar) : iniciar();
})();
