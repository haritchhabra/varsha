import re
import sys

css_path = 'c:/Users/Prakhar/Downloads/VARSHA - SIH 26/varsha/frontend/src/index.css'
with open(css_path, 'r', encoding='utf-8') as f:
    original = f.read()

root_vars = """
:root {
  --c-void: #04070d;
  --c-ink-1: #070c16;
  --c-ink-2: #0b1322;
  --c-ink-3: #111c30;
  --c-line: #1c2a42;
  --c-line-2: #26395a;
  --c-fg: #e6edf7;
  --c-fg-2: #9fb0c8;
  --c-fg-3: #647795;
  --c-neon: #22d3ee;
  --c-neon-2: #67e8f9;
  --c-plasma: #a78bfa;

  --bg-space: radial-gradient(1px 1px at 12% 18%, #ffffff55 50%, transparent 51%), radial-gradient(1px 1px at 78% 12%, #ffffff44 50%, transparent 51%), radial-gradient(1px 1px at 34% 72%, #ffffff33 50%, transparent 51%), radial-gradient(1.5px 1.5px at 88% 64%, #67e8f955 50%, transparent 51%), radial-gradient(1px 1px at 56% 38%, #ffffff2a 50%, transparent 51%), radial-gradient(1.5px 1.5px at 6% 88%, #a78bfa55 50%, transparent 51%), radial-gradient(1200px 700px at 70% 40%, #0d2a4a66, transparent 60%), radial-gradient(900px 600px at 20% 80%, #2b145060, transparent 60%), radial-gradient(600px 400px at 85% 90%, #06404840, transparent 60%), radial-gradient(1400px 500px at 50% -10%, #0e3a5a40, transparent 70%);
  --glass-bg: radial-gradient(120% 80% at 0% 0%, #22d3ee0a, transparent 50%), linear-gradient(180deg, #0e192ccc, #080f1cd9);
  --glass-strong-bg: radial-gradient(120% 60% at 100% 0%, #a78bfa12, transparent 50%), linear-gradient(180deg, #0c1628f5, #070d19f5);
  --glass-border: #ffffff08;
  --glass-shadow: 0 0 0 1px #00000050, 0 24px 60px -24px #000000e0, 0 30px 80px -50px #22d3ee40, inset 0 1px 0 #ffffff12, inset 0 0 40px -20px #22d3ee14;
  --corner-border: #22d3eebb;
  --ring-shadow: 0 0 0 1px #22d3ee88, 0 0 24px -4px #22d3ee88, inset 0 0 20px -12px #22d3ee;
  --edge-color: #22d3ee;
  --glow-soft: 0 0 24px -4px #22d3ee66;
  --text-shadow-glow: 0 0 18px #22d3ee88, 0 0 2px #22d3eeaa;
  --text-shadow-kpi: 0 0 22px color-mix(in srgb, currentColor 35%, transparent);
  --grad-text: linear-gradient(95deg, #a5f3fc 0%, #22d3ee 35%, #a78bfa 100%);
  --grad-div: linear-gradient(90deg, transparent, #22d3ee55 30%, #a78bfa55 70%, transparent);
  --skeleton-bg: linear-gradient(180deg, #0f1a2e, #0b1322);
  --skeleton-sweep: linear-gradient(90deg, transparent, #22d3ee12 40%, #a78bfa14 60%, transparent);
  --skeleton-border: #1c2a4288;
  --scanline-bg: linear-gradient(180deg, transparent, #22d3ee0d 60%, #22d3ee22 98%, transparent);
  --shimmer-grad: linear-gradient(90deg, #67e8f9, #a78bfa, #f0abfc, #67e8f9);
  --btn-hover-bg: #ffffff0d;
  --btn-hover-shadow: inset 0 0 0 1px #22d3ee22;
  --btn-on-bg: linear-gradient(180deg, #a5f3fc, #22d3ee 55%, #0fb5d0);
  --btn-on-shadow: 0 0 18px -2px #22d3ee99, inset 0 1px 0 #ffffff99, inset 0 -1px 0 #0891b2;
  --btn-on-color: #04070d;
  --btn-on-color-slide: #04070d;
  --accent-range: #22d3ee;
}

:root[data-theme="light"] {
  --c-void: #f8fafc;
  --c-ink-1: #ffffff;
  --c-ink-2: #f1f5f9;
  --c-ink-3: #e2e8f0;
  --c-line: #e2e8f0;
  --c-line-2: #cbd5e1;
  --c-fg: #0f172a;
  --c-fg-2: #334155;
  --c-fg-3: #64748b;
  --c-neon: #2563eb;
  --c-neon-2: #3b82f6;
  --c-plasma: #818cf8;

  --bg-space: radial-gradient(circle at 100% 0%, rgba(37,99,235,0.05) 0%, transparent 40%), radial-gradient(circle at 0% 100%, rgba(59,130,246,0.05) 0%, transparent 40%);
  --glass-bg: rgba(255,255,255,0.85);
  --glass-strong-bg: rgba(255,255,255,0.98);
  --glass-border: rgba(37,99,235,0.1);
  --glass-shadow: 0 10px 30px rgba(0,0,0,0.05);
  --corner-border: #cbd5e1;
  --ring-shadow: 0 0 0 1px #94a3b8;
  --edge-color: #e2e8f0;
  --glow-soft: 0 4px 12px rgba(0,0,0,0.05);
  --text-shadow-glow: none;
  --text-shadow-kpi: none;
  --grad-text: linear-gradient(95deg, #3b82f6 0%, #2563eb 100%);
  --grad-div: linear-gradient(90deg, transparent, #e2e8f0 30%, #e2e8f0 70%, transparent);
  --skeleton-bg: #f1f5f9;
  --skeleton-sweep: linear-gradient(90deg, transparent, #ffffff88 40%, #ffffff88 60%, transparent);
  --skeleton-border: #e2e8f0;
  --scanline-bg: linear-gradient(180deg, transparent, #e2e8f055 60%, #cbd5e1 98%, transparent);
  --shimmer-grad: linear-gradient(90deg, #3b82f6, #2563eb, #1d4ed8, #3b82f6);
  --btn-hover-bg: rgba(0,0,0,0.03);
  --btn-hover-shadow: inset 0 0 0 1px #cbd5e1;
  --btn-on-bg: #3b82f6;
  --btn-on-shadow: 0 2px 4px rgba(59,130,246,0.3);
  --btn-on-color: #ffffff;
  --btn-on-color-slide: #0f172a;
  --accent-range: #2563eb;
}
"""

new_css = original.replace('@theme {', root_vars + '\n@theme {')
new_css = re.sub(r'--color-void:\s*[^;]+;', '--color-void: var(--c-void);', new_css)
new_css = re.sub(r'--color-ink-1:\s*[^;]+;', '--color-ink-1: var(--c-ink-1);', new_css)
new_css = re.sub(r'--color-ink-2:\s*[^;]+;', '--color-ink-2: var(--c-ink-2);', new_css)
new_css = re.sub(r'--color-ink-3:\s*[^;]+;', '--color-ink-3: var(--c-ink-3);', new_css)
new_css = re.sub(r'--color-line:\s*[^;]+;', '--color-line: var(--c-line);', new_css)
new_css = re.sub(r'--color-line-2:\s*[^;]+;', '--color-line-2: var(--c-line-2);', new_css)
new_css = re.sub(r'--color-fg:\s*[^;]+;', '--color-fg: var(--c-fg);', new_css)
new_css = re.sub(r'--color-fg-2:\s*[^;]+;', '--color-fg-2: var(--c-fg-2);', new_css)
new_css = re.sub(r'--color-fg-3:\s*[^;]+;', '--color-fg-3: var(--c-fg-3);', new_css)
new_css = re.sub(r'--color-neon:\s*[^;]+;', '--color-neon: var(--c-neon);', new_css)
new_css = re.sub(r'--color-neon-2:\s*[^;]+;', '--color-neon-2: var(--c-neon-2);', new_css)
new_css = re.sub(r'--color-plasma:\s*[^;]+;', '--color-plasma: var(--c-plasma);', new_css)

new_css = re.sub(r'\.space-bg \{\s*background: [^}]+?\}', '.space-bg { background: var(--color-void); background-image: var(--bg-space), var(--color-void); }', new_css)
new_css = re.sub(r'\.glass,\s*\.glass-strong\s*\{[^\}]+\}', '.glass,\n  .glass-strong {\n    position: relative;\n    border: 1px solid var(--glass-border);\n    box-shadow: var(--glass-shadow);\n    backdrop-filter: blur(14px);\n    -webkit-backdrop-filter: blur(14px);\n  }', new_css)
new_css = re.sub(r'\.glass \{\s*background: [^}]+?\}', '.glass { background: var(--glass-bg); }', new_css)
new_css = re.sub(r'\.glass-strong \{\s*background:[^\}]+box-shadow:[^\}]+\}', '.glass-strong { background: var(--glass-strong-bg); box-shadow: var(--glass-shadow); }', new_css)
new_css = re.sub(r'border: 1\.5px solid #cbd5e1;', 'border: 1.5px solid var(--corner-border);', new_css)
new_css = re.sub(r'\.glow-ring \{\s*box-shadow:[^\}]+\}', '.glow-ring { box-shadow: var(--ring-shadow); }', new_css)
new_css = re.sub(r'var\(--edge, #e2e8f0\)', 'var(--edge, var(--edge-color))', new_css)
new_css = re.sub(r'\.glow-text \{\s*text-shadow:[^\}]+\}', '.glow-text { text-shadow: var(--text-shadow-glow); }', new_css)
new_css = re.sub(r'\.glow-soft \{\s*box-shadow:[^\}]+\}', '.glow-soft { box-shadow: var(--glow-soft); }', new_css)
new_css = re.sub(r'\.kpi-number \{([^\}]+)text-shadow:[^\}]+\}', r'.kpi-number {\1text-shadow: var(--text-shadow-kpi);\n}', new_css)
new_css = re.sub(r'\.text-gradient \{\s*background: [^\}]+', '.text-gradient { background: var(--grad-text);', new_css)
new_css = re.sub(r'\.divider-glow \{\s*height: 1px;\s*border: 0;\s*background: [^\}]+', '.divider-glow { height: 1px; border: 0; background: var(--grad-div);', new_css)

new_css = re.sub(r'\.skeleton \{\s*position: relative;\s*overflow: hidden;\s*background: [^\}]+border:[^\}]+\}', '.skeleton { position: relative; overflow: hidden; background: var(--skeleton-bg); border: 1px solid var(--skeleton-border); }', new_css)
new_css = re.sub(r'\.skeleton::after \{([^\}]+)background:[^\}]+animation:', r'.skeleton::after {\1background: var(--skeleton-sweep);\n  animation:', new_css)
new_css = re.sub(r'\.scanline \{([^\}]+)background:[^\}]+animation:', r'.scanline {\1background: var(--scanline-bg);\n  animation:', new_css)
new_css = re.sub(r'\.shimmer-text \{\s*background: [^\}]+background-size:', '.shimmer-text { background: var(--shimmer-grad); background-size:', new_css)
new_css = re.sub(r'\.btn-seg:hover \{\s*color: var\(--color-fg\);\s*background-color: [^;]+;\s*box-shadow: [^\}]+\}', '.btn-seg:hover { color: var(--color-fg); background-color: var(--btn-hover-bg); box-shadow: var(--btn-hover-shadow); }', new_css)
new_css = re.sub(r'\.btn-seg\[data-on=\"true\"\] \{\s*color: [^;]+;\s*font-weight: 600;\s*background: [^;]+;\s*box-shadow: [^\}]+\}', '.btn-seg[data-on="true"] { color: var(--btn-on-color); font-weight: 600; background: var(--btn-on-bg); box-shadow: var(--btn-on-shadow); }', new_css)
new_css = re.sub(r'\.btn-seg\.seg-slide\[data-on=\"true\"\] \{\s*background: transparent;\s*box-shadow: none;\s*color: [^\}]+\}', '.btn-seg.seg-slide[data-on="true"] { background: transparent; box-shadow: none; color: var(--btn-on-color-slide); }', new_css)
new_css = re.sub(r'accent-color: [^;]+;', 'accent-color: var(--accent-range);', new_css)

with open(css_path, 'w', encoding='utf-8') as f:
    f.write(new_css)
