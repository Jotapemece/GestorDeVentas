#!/usr/bin/env python3
"""Genera el diagrama de Ishikawa (Anexo B) para el informe de pasantías.

Problemática base: registros/documentación contable y fiscal gestionada de forma
manual e ineficiente (contexto de la empresa Servicios y Suministros Geo, C.A.,
según el PDF de referencia de Juan Moya).

Salida: ../trabajo/imagenes/ishikawa_geo.png (PNG apaisado, alta resolución)
"""
import textwrap

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyArrowPatch, FancyBboxPatch
from matplotlib.lines import Line2D
import math

# ---------------------------------------------------------------------------
# Contenido
# ---------------------------------------------------------------------------
EFECTO = "Registro manual e ineficiente de la documentación contable y fiscal"

ESPINAS = [
    {
        "nombre": "Personal",
        "arriba": True,
        "causas": [
            "Comprobantes almacenados en discos locales de cada empleado",
            "Búsqueda manual de documentos por parte del personal",
            "Dependencia del conocimiento individual para localizar archivos",
            "Transcripción y reingreso manual de datos",
        ],
    },
    {
        "nombre": "Métodos",
        "arriba": False,
        "causas": [
            "Procesos de archivo manuales y desarticulados",
            "Sin índice centralizado de documentos",
            "Duplicidad de funciones entre las áreas",
            "Falta de flujo de trabajo (workflow) estandarizado",
        ],
    },
    {
        "nombre": "Tecnología",
        "arriba": True,
        "causas": [
            "Carencia de software estandarizado local",
            "Sin repositorio centralizado de documentos",
            "Declaración de retenciones de IVA sin automatizar",
            "Fallas de versiones de los archivos compartidos",
        ],
    },
    {
        "nombre": "Documentación",
        "arriba": False,
        "causas": [
            "Dispersión de comprobantes contables y fiscales",
            "Expedientes sin trazabilidad documental",
            "Sin catalogación ni metadatos uniformes",
            "Respaldos inexistentes o no organizados",
        ],
    },
    {
        "nombre": "Control",
        "arriba": True,
        "causas": [
            "Controles automatizados ausentes",
            "Sin medición de tiempos ni indicadores",
            "Control interno limitado frente a auditorías",
            "Sin seguimiento de retenciones y declaraciones",
        ],
    },
    {
        "nombre": "Entorno",
        "arriba": False,
        "causas": [
            "Alta exigencia regulatoria (contribuyente especial)",
            "Auditorías fiscales y operativas constantes",
            "Riesgo de sanciones por incumplimiento de IVA",
            "Sector de exigencia técnica elevada",
        ],
    },
]

TITULO = ""

# ---------------------------------------------------------------------------
# Configuración visual
# ---------------------------------------------------------------------------
FIG_W, FIG_H = 20.0, 11.0
DPI = 150
COLX = [18, 44, 70]           # columnas (x de arranque de cada espina en el eje central)
CARD_W = 22                    # (ya no usado) ancho de la caja de causas
SPAN_X = (0.0, 120.0)
SPAN_Y = (0.0, 110.0)
Y_SPINE = 52.0

# Geometría de las espinas (hueso diagonal) y sus causas
BONE_DX = 16.0                 # alcance horizontal de cada hueso de categoría
BONE_DY = 18.0                 # alcance vertical de cada hueso (alejándose de la espina)
CAUSA_FRAC = [0.08, 0.32, 0.56, 0.74]    # posiciones a lo largo del hueso
CAUSA_TICK_LEN = 2.5           # longitud de la línea corta de cada causa
CAUSA_TICK_GAP = 1.0           # separación entre el tick y su texto
CAUSA_EXTRA = 3.5              # push adicional proporcional a `frac` (las causas
                               # exteriores se alejan más del hueso y no chocan
                               # con el nombre de categoría ni entre sí)
CAUSA_WRAP = 10.0              # ancho de texto de causa (unidades de datos)

# Geometría de la cabeza (efecto) — cuadro recto
EFFECT_X0 = 95.0
EFFECT_Y0 = 34.0
EFFECT_W = 14.0
EFFECT_H = 36.0

C_SPINE = "#3b4350"
C_BRANCH = "#4a5568"
C_TICK = "#64748b"
C_CARD_FACE = "#f4f7fb"
C_CARD_EDGE = "#cbd5e1"
C_TITLE_CAT = "#1f4e79"
C_TITLE_BODY = "#20242b"
C_EFFECT_FACE = "#fdecea"
C_EFFECT_EDGE = "#c0392b"
C_EFFECT_TITLE = "#922b21"


def _wrap_to_width(s, max_units, renderer, fig, ax, fs):
    """Envuelve un texto para que quepa dentro de `max_units` unidades de datos x."""
    bbox = ax.get_window_extent(renderer=renderer)
    px_per_unit_x = bbox.width / (SPAN_X[1] - SPAN_X[0])
    max_px = max_units * px_per_unit_x

    words = s.split()
    lines = []
    current = ""
    for w in words:
        trial = (current + " " + w).strip()
        t = ax.text(0, 0, trial, fontsize=fs)
        wpx = t.get_window_extent(renderer=renderer).width
        t.remove()
        if wpx <= max_px or not current:
            current = trial
        else:
            lines.append(current)
            current = w
    if current:
        lines.append(current)
    return lines


def _text_units(renderer, fig, ax, s, fs):
    """Devuelve el alto y ancho de un texto en unidades de datos."""
    bbox = ax.get_window_extent(renderer=renderer)
    px_per_unit_x = bbox.width / (SPAN_X[1] - SPAN_X[0])
    px_per_unit_y = bbox.height / (SPAN_Y[1] - SPAN_Y[0])
    t = ax.text(0, 0, s, fontsize=fs)
    ex = t.get_window_extent(renderer=renderer)
    w_units = ex.width / px_per_unit_x
    h_units = ex.height / px_per_unit_y
    t.remove()
    return w_units, h_units


def main():
    r = plt.figure(figsize=(FIG_W, FIG_H), dpi=DPI)
    ax = r.add_subplot(111)
    ax.set_xlim(*SPAN_X)
    ax.set_ylim(*SPAN_Y)
    ax.axis("off")
    fig = r
    renderer = fig.canvas.get_renderer()

    # ---- Título (opcional, vacío por defecto) -----------------------------
    if TITULO:
        ax.text(54, 97, TITULO, ha="center", va="center", fontsize=10.5,
                fontweight="bold", color=C_TITLE_BODY)

    # ---- Espina central ----------------------------------------------------
    spine_end = EFFECT_X0 - 2.0
    ax.add_line(Line2D([2, spine_end], [Y_SPINE, Y_SPINE], color=C_SPINE, lw=2.6,
                       zorder=2))
    arrow = FancyArrowPatch((spine_end, Y_SPINE), (EFFECT_X0 - 0.5, Y_SPINE),
                            arrowstyle="->", mutation_scale=20,
                            linewidth=2.2, color=C_SPINE, zorder=2)
    ax.add_patch(arrow)

    # ---- Huesos de categorías + causas (estilo clásico) -------------------
    bone_len = math.hypot(BONE_DX, BONE_DY)

    for i, espina in enumerate(ESPINAS):
        arriba = espina["arriba"]
        cx = COLX[i % 3]
        sign = 1.0 if arriba else -1.0

        # hueso diagonal: desde la espina central hasta el nombre de categoría
        tip_x = cx + BONE_DX
        tip_y = Y_SPINE + sign * BONE_DY
        ax.add_line(Line2D([cx, tip_x], [Y_SPINE, tip_y],
                           color=C_BRANCH, lw=2.0, zorder=2))

        # marca vertical en la espina donde nace el hueso
        ax.add_line(Line2D([cx, cx], [Y_SPINE - 2.0, Y_SPINE + 2.0],
                           color=C_SPINE, lw=1.4, zorder=2))

        # nombre de la categoría al final del hueso (separado del hueso)
        ax.text(tip_x, tip_y + (0.8 if arriba else -0.8),
                espina["nombre"], ha="center",
                va="bottom" if arriba else "top",
                fontsize=8.6, fontweight="bold", color=C_TITLE_CAT, zorder=4)

        # causas: línea corta perpendicular al hueso + texto con posición fija
        for frac, causa in zip(CAUSA_FRAC, espina["causas"]):
            px = cx + BONE_DX * frac
            py = Y_SPINE + sign * BONE_DY * frac

            # dirección perpendicular que se aleja de la espina
            offx = -(BONE_DY / bone_len)
            offy = sign * (BONE_DX / bone_len)

            exx = px + offx * CAUSA_TICK_LEN
            eyy = py + offy * CAUSA_TICK_LEN
            ax.add_line(Line2D([px, exx], [py, eyy],
                               color=C_TICK, lw=1.1, zorder=2))

            # distancia fija a la que se coloca el texto (determinista):
            # proporcional a `frac` para que las causas exteriores no choquen
            # con el nombre de categoría ni entre ellas.
            d = CAUSA_TICK_GAP + CAUSA_EXTRA * frac
            cxm = exx + offx * d
            cym = eyy + offy * d

            wrapped = _wrap_to_width(causa, CAUSA_WRAP, renderer, fig, ax, 7.0)
            _, line_h = _text_units(renderer, fig, ax, "x", 7.0)
            n = len(wrapped)
            for k, ln in enumerate(wrapped):
                yy = cym - (k - (n - 1) / 2) * line_h * 1.1
                ax.text(cxm, yy, ln, ha="center", va="center",
                        fontsize=7.0, color=C_TITLE_BODY, zorder=4)

    # ---- Caja del efecto (cabeza) ------------------------------------------
    ebox = FancyBboxPatch((EFFECT_X0, EFFECT_Y0), EFFECT_W, EFFECT_H,
                          boxstyle="round,pad=0.25,rounding_size=0.8",
                          linewidth=2.0, edgecolor=C_EFFECT_EDGE,
                          facecolor=C_EFFECT_FACE, zorder=3)
    ax.add_patch(ebox)

    _ef_lines = _wrap_to_width(EFECTO, EFFECT_W - 1.2, renderer, fig, ax, 8.0)
    n_ef = len(_ef_lines)
    _, eh = _text_units(renderer, fig, ax, "x", 8.0)
    total_h = n_ef * eh * 1.35
    _start_y = EFFECT_Y0 + (EFFECT_H / 2.0) + total_h / 2.0 - eh / 2.0
    for _ln in _ef_lines:
        ax.text(EFFECT_X0 + EFFECT_W / 2.0, _start_y, _ln, ha="center", va="center",
                fontsize=8.0, color=C_EFFECT_TITLE, fontweight="bold", zorder=4)
        _start_y -= eh * 1.35

    ax.text(EFFECT_X0 + EFFECT_W / 2.0, EFFECT_Y0 + EFFECT_H + 1.2,
            "Efecto (problema)", ha="center", va="center", fontsize=8.0,
            fontweight="bold", color=C_EFFECT_TITLE)

    # ---- Verificación geométrica ------------------------------------------
    for i, espina in enumerate(ESPINAS):
        sign = 1.0 if espina["arriba"] else -1.0
        cx = COLX[i % 3] if i % 3 <= len(COLX) - 1 else COLX[-1]
        tip_x = cx + BONE_DX
        tip_y = Y_SPINE + sign * BONE_DY
        assert 2 <= cx and tip_x <= 90, f"hueso {espina['nombre']} sale del lienzo x"
        assert 4 <= tip_y <= 96, f"hueso {espina['nombre']} sale del lienzo y"
    assert EFFECT_X0 >= 2 and EFFECT_X0 + EFFECT_W <= SPAN_X[1] - 2, "efecto sale del lienzo"
    assert EFFECT_Y0 >= 2 and EFFECT_Y0 + EFFECT_H <= 98, "efecto sale vertical"
    print("[geometría OK]")

    r.tight_layout(pad=0.3)
    out = "imagenes/ishikawa_geo.png"
    fig.savefig(out, dpi=DPI, bbox_inches="tight", facecolor="white")
    print("OK ->", out)


if __name__ == "__main__":
    main()