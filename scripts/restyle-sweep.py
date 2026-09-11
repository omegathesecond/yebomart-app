#!/usr/bin/env python3
"""
One-shot sweep converting the app's old dark-slate/amber utilities to the
Omevision house tokens defined in src/index.css.

This ran once, on the feat/omevision-redesign branch, to move ~2,300 hardcoded
Tailwind palette classes onto semantic tokens. It is kept in the repo so the
mapping decisions stay reviewable, and so the same table can be replayed if a
stale branch needs converting. It is NOT part of the build.

    python3 scripts/restyle-sweep.py --dry-run     # report only
    python3 scripts/restyle-sweep.py               # write
    python3 scripts/restyle-sweep.py --root ../admin-dashboard/src

Two things make this safe to run over real source:

1. Edits are confined to spans a real scanner has proven are string literal
   CONTENT. A regex that merely pairs quote characters gets this wrong — the
   gap between two adjacent literals looks exactly like a literal — and
   rewriting those gaps destroys code formatting.
2. Token removals eat one adjacent space, so no whitespace "tidy" pass is
   needed afterwards. Newlines are never touched, so multi-line className
   templates keep their shape.

The one genuinely context-sensitive rule is `text-white`: on a cream ground
most instances become ink, but the ones sitting on a fill that stays dark in
the new system (red, green, ink) must stay cream. See keeps_white().
"""
from __future__ import annotations

import argparse
import pathlib
import re
import sys
from collections import Counter

DEFAULT_ROOT = pathlib.Path(__file__).resolve().parent.parent / "src"

# ── Per-utility-family shade maps ─────────────────────────────────────────
# On dark, a higher slate number sits further back; on cream that inverts, but
# the SEPARATION is what carries: page -> panel -> control.
NEUTRAL = {
    "text": {"50": "ink", "100": "ink", "200": "ink", "300": "body", "400": "mute",
             "500": "mist", "600": "mist", "700": "mist", "800": "ink", "900": "ink"},
    "bg": {"50": "cream", "100": "cream", "200": "sand", "300": "sand",
           "400": "mist", "500": "mist", "600": "shade", "700": "shade",
           "800": "sand", "900": "cream", "950": "cream"},
    "border": {"200": "line", "300": "line-strong", "400": "line-strong",
               "500": "line-strong", "600": "line-strong", "700": "line",
               "800": "line", "900": "line"},
    "divide": {"500": "line-strong", "600": "line-strong", "700": "line", "800": "line"},
    "placeholder": {"400": "mist", "500": "mist", "600": "mist"},
    "ring": {"500": "line-strong", "600": "line-strong", "700": "line-strong"},
}

# Brand orange. Small text on cream must use brick — #ff6b00 fails AA there.
BRAND = {
    "text": "brick",
    "bg": "brand",
    "border": "ink",
    "ring": "ink",
    "divide": "line-strong",
    "placeholder": "mist",
    "fill": "brand",
    "stroke": "brand",
}

# Status colours are reserved and always ship beside a word, never alone.
STATUS = {
    "emerald": "ok", "green": "ok",
    "red": "bad", "rose": "bad",
    "yellow": "warn",
}

# Not house colours. Teal was the scanner accent, purple/violet the assistant;
# both fold into brand/ink. Info blues become neutral.
FOLD = {
    "teal": {"text": "brick", "bg": "brand", "border": "ink", "ring": "ink"},
    "cyan": {"text": "brick", "bg": "brand", "border": "ink", "ring": "ink"},
    "purple": {"text": "brick", "bg": "ink", "border": "ink", "ring": "ink"},
    "violet": {"text": "brick", "bg": "ink", "border": "ink", "ring": "ink"},
    "fuchsia": {"text": "brick", "bg": "ink", "border": "ink", "ring": "ink"},
    "pink": {"text": "brick", "bg": "ink", "border": "ink", "ring": "ink"},
    "blue": {"text": "body", "bg": "sand", "border": "line-strong", "ring": "line-strong"},
    "sky": {"text": "body", "bg": "sand", "border": "line-strong", "ring": "line-strong"},
    "indigo": {"text": "body", "bg": "sand", "border": "line-strong", "ring": "line-strong"},
    "lime": {"text": "ok", "bg": "ok", "border": "ok", "ring": "ok"},
}

NEUTRAL_FAMILIES = {"slate", "gray", "zinc", "neutral", "stone"}
BRAND_FAMILIES = {"amber", "orange"}
FAMILIES = NEUTRAL_FAMILIES | BRAND_FAMILIES | set(STATUS) | set(FOLD)
FAM = "|".join(sorted(FAMILIES))

UTILS = ("bg", "text", "border", "ring", "divide", "placeholder", "shadow",
         "outline", "accent", "caret", "fill", "stroke", "decoration")
UTL = "|".join(UTILS)

unmapped: Counter = Counter()
changes: Counter = Counter()


# ── A real scanner, not a quote-pairing regex ─────────────────────────────
def literal_spans(src: str):
    """Spans of string-literal CONTENT: '...', "...", and the text parts of
    `...` templates. Code inside a template's ${ } is excluded, and comments
    are skipped so an apostrophe in prose cannot desynchronise the pairing."""
    spans = []
    i, n = 0, len(src)
    mode, quote, start = "code", "", 0
    depth = []  # one entry per open ${ }, counting nested braces

    while i < n:
        c = src[i]
        if mode == "code":
            if c == "/" and i + 1 < n and src[i + 1] == "/":
                j = src.find("\n", i)
                i = n if j < 0 else j
                continue
            if c == "/" and i + 1 < n and src[i + 1] == "*":
                j = src.find("*/", i + 2)
                i = n if j < 0 else j + 2
                continue
            if c in "\"'":
                mode, quote, start = "str", c, i + 1
                i += 1
                continue
            if c == "`":
                mode, start = "tpl", i + 1
                i += 1
                continue
            if c == "}" and depth:
                if depth[-1] == 0:
                    depth.pop()
                    mode, start = "tpl", i + 1
                else:
                    depth[-1] -= 1
                i += 1
                continue
            if c == "{" and depth:
                depth[-1] += 1
            i += 1
            continue

        if mode == "str":
            if c == "\\":
                i += 2
                continue
            if c == quote or c == "\n":
                spans.append((start, i))
                mode = "code"
                i += 1
                continue
            i += 1
            continue

        # mode == "tpl"
        if c == "\\":
            i += 2
            continue
        if c == "`":
            spans.append((start, i))
            mode = "code"
            i += 1
            continue
        if c == "$" and i + 1 < n and src[i + 1] == "{":
            spans.append((start, i))
            depth.append(0)
            mode = "code"
            i += 2
            continue
        i += 1

    if mode in ("str", "tpl"):
        spans.append((start, n))
    return spans


def token(util: str, family: str, step: str):
    """Map one `<util>-<family>-<step>` base class to its house token."""
    if family in NEUTRAL_FAMILIES:
        return NEUTRAL.get(util, {}).get(step)
    if family in BRAND_FAMILIES:
        return BRAND.get(util)
    if family in STATUS:
        if util in ("text", "bg", "border", "ring", "divide", "fill", "stroke"):
            return STATUS[family]
        return None
    if family in FOLD:
        return FOLD[family].get(util)
    return None


# Removals eat one leading space (never a newline) so no tidy pass is needed.
SHADOW_RE = re.compile(r"[ \t]*(?<![\w-])(?:[a-z][\w-]*:)*shadow-(" + FAM + r")-\d{2,3}(/\d{1,3})?(?![\w-])")
GRAD_RE = re.compile(r"[ \t]*(?<![\w-])(?:[a-z][\w-]*:)*bg-(?:gradient|linear)-to-[trblxy]{1,2}(?![\w-])")
STOP_RE = re.compile(r"[ \t]*(?<![\w-])(?:[a-z][\w-]*:)*(from|via|to)-(" + FAM + r")-(\d{2,3})(/\d{1,3})?(?![\w-])")
BLUR_RE = re.compile(r"[ \t]*(?<![\w-])(?:[a-z][\w-]*:)*backdrop-blur(-[a-z0-9]+)?(?![\w-])")
GLASS_RE = re.compile(r"[ \t]*(?<![\w-])glass(?![\w-])")
GRADCLS_RE = re.compile(r"[ \t]*(?<![\w-])gradient-(?:primary|success)(?![\w-])")
GLOW_RE = re.compile(r"[ \t]*(?<![\w-])(?:[a-z][\w-]*:)*glow-[a-z]+(?![\w-])")

CLASS_RE = re.compile(r"(?<![\w-])(" + UTL + r")-(" + FAM + r")-(\d{2,3})(/\d{1,3})?(?![\w-])")
RADIUS_RE = re.compile(r"(?<![\w-])rounded(-[trbl]{1,2}|-[a-z]+-[trbl]{1,2})?(?:-(?:sm|md|lg|xl|2xl|3xl))?(?![\w-])")

# White stays white only on a fill that is still dark after the swap.
DARK_FILL_RE = re.compile(
    r"(?<![\w-])bg-(?:red|rose|emerald|green|lime)-\d{2,3}(?![\w/-])"
    r"|(?<![\w-])bg-slate-900(?![\w/-])"
    r"|(?<![\w-])bg-(?:violet|purple|fuchsia|pink)-\d{2,3}(?![\w/-])"
)


def keeps_white(seg: str) -> bool:
    return bool(DARK_FILL_RE.search(seg))


def _drop(label: str):
    def fn(_m):
        changes[label] += 1
        return ""
    return fn


def convert_segment(seg: str) -> str:
    """Transform one string literal's contents."""
    original = seg
    # 1. Gradients: strip the machinery, keep the `from` colour as a flat fill.
    if GRAD_RE.search(seg):
        fill = None
        for m in STOP_RE.finditer(seg):
            if m.group(1) == "from":
                fill = token("bg", m.group(2), m.group(3))
                break
        seg = GRAD_RE.sub((" bg-" + fill) if fill else "", seg, count=1)
        seg = GRAD_RE.sub("", seg)
        changes["gradient flattened"] += 1
    # Orphan stops (a gradient whose direction class sits in a sibling string).
    seg = STOP_RE.sub("", seg)

    # 2. The house system has no glow, glass or blur.
    seg = SHADOW_RE.sub(_drop("tinted shadow removed"), seg)
    seg = BLUR_RE.sub(_drop("backdrop-blur removed"), seg)
    seg = GLASS_RE.sub(_drop("glass removed"), seg)
    seg = GLOW_RE.sub(_drop("glow-* removed"), seg)
    seg = GRADCLS_RE.sub(lambda m: (changes.__setitem__("gradient-* -> bg-brand",
                                                        changes["gradient-* -> bg-brand"] + 1),
                                    " bg-brand")[1], seg)

    # 3. white -> ink, except on a fill that stays dark.
    if "white" in seg:
        target = "cream" if keeps_white(seg) else "ink"
        before = seg
        seg = re.sub(r"(?<![\w-])text-white(?![\w-])", "text-" + target, seg)
        seg = re.sub(r"(?<![\w-])bg-white(?![\w-])", "bg-cream", seg)
        seg = re.sub(r"(?<![\w-])border-white(?![\w-])", "border-cream", seg)
        seg = re.sub(r"(?<![\w-])(text|bg|border)-white/(\d{1,3})(?![\w-])", r"\1-cream/\2", seg)
        if seg != before:
            changes["white -> " + target] += 1

    # 4. The palette itself.
    def sub(m):
        util, family, step, opacity = m.group(1), m.group(2), m.group(3), m.group(4) or ""
        new = token(util, family, step)
        if new is None:
            unmapped[m.group(0)] += 1
            return m.group(0)
        # A low-opacity brand fill is the wash tint, not translucent orange.
        if family in BRAND_FAMILIES and util == "bg" and opacity in ("/5", "/10", "/20"):
            changes[m.group(0) + " -> bg-wash"] += 1
            return "bg-wash"
        changes[m.group(0) + " -> " + util + "-" + new + opacity] += 1
        return util + "-" + new + opacity

    seg = CLASS_RE.sub(sub, seg)

    # 5. Every radius is 2px; round dots and avatars keep rounded-full.
    def rad(m):
        changes["radius -> sharp"] += 1
        return "rounded" + (m.group(1) or "") + "-sharp"

    seg = RADIUS_RE.sub(rad, seg)


    # Removals can leave a space the original did not have. Only tidy the
    # exact artefacts this pass introduced — never reflow prose strings.
    if seg != original:
        if not original.startswith(" "):
            seg = seg.lstrip(" ")
        if "  " not in original:
            seg = re.sub(r"  +", " ", seg)
    return seg


def convert(src: str) -> str:
    out, last = [], 0
    for a, b in literal_spans(src):
        out.append(src[last:a])
        out.append(convert_segment(src[a:b]))
        last = b
    out.append(src[last:])
    return "".join(out)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument(
        "--root",
        type=pathlib.Path,
        default=DEFAULT_ROOT,
        help="src directory to convert (defaults to this repo's). The admin "
             "dashboard shares the same @theme, so it shares this table.",
    )
    args = ap.parse_args()
    root = args.root.resolve()

    # AppleDouble siblings (._Foo.tsx) match a *.tsx glob and are binary.
    files = sorted(
        p for p in list(root.rglob("*.tsx")) + list(root.rglob("*.ts"))
        if ".test." not in p.name and not p.name.startswith("._")
    )

    touched = 0
    for p in files:
        original = p.read_text()
        converted = convert(original)
        if converted != original:
            touched += 1
            if not args.dry_run:
                p.write_text(converted)

    print("files changed: %d / %d" % (touched, len(files)))
    print("total substitutions: %d" % sum(changes.values()))
    print("\ntop mappings:")
    for k, v in changes.most_common(24):
        print("  %5d  %s" % (v, k))
    if unmapped:
        print("\nUNMAPPED (needs a hand decision):")
        for k, v in unmapped.most_common(20):
            print("  %5d  %s" % (v, k))
    return 0


if __name__ == "__main__":
    sys.exit(main())
