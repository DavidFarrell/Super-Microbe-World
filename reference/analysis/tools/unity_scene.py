#!/usr/bin/env python3
"""Extract entity / collider layout from a Unity 4.3 text-serialised scene.

Secondary-source helper for the Super Microbe World port (the Flash original is
canonical). Unity 4.3 scenes contain every instantiated prefab object in full
(GameObject/Transform/components with m_PrefabParentObject links), so world
positions can be computed by walking m_Father chains; no prefab merging needed.

Usage:
  python3 unity_scene.py Assets/Scenes/kitchen1.unity            # ASCII grid (0.5 u cells)
  python3 unity_scene.py Assets/Scenes/kitchen1.unity --json     # entities + ground AABBs

Requires PyYAML. Run from the repository root (it scans Assets/**/*.meta for GUIDs).
"""
import json, math, os, re, sys
import yaml

TILE = 0.5  # 50 px tiles at spritePixelsToUnits 100


def build_guid_map(root='Assets'):
    m = {}
    for d, _, files in os.walk(root):
        for f in files:
            if f.endswith('.meta'):
                p = os.path.join(d, f)
                g = re.search(r'guid: (\w+)', open(p, errors='ignore').read())
                if g:
                    m[g.group(1)] = p[:-5]
    return m


_num = re.compile(r'[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$')


def _fix(o):
    # PyYAML (YAML 1.1) leaves Unity's "-.5" style floats as strings.
    if isinstance(o, dict):
        return {k: _fix(v) for k, v in o.items()}
    if isinstance(o, list):
        return [_fix(v) for v in o]
    if isinstance(o, str) and _num.match(o):
        return float(o)
    return o


def load(path):
    txt = open(path, encoding='utf-8', errors='ignore').read()
    parts = re.split(r'^--- !u!(\d+) &(\d+)(?: stripped)?\s*$', txt, flags=re.M)
    objs = {}
    for i in range(1, len(parts), 3):
        fid, body = int(parts[i + 1]), parts[i + 2]
        try:
            d = _fix(yaml.safe_load(body))
        except Exception:
            continue
        if not isinstance(d, dict) or len(d) != 1:
            continue
        (k, v), = d.items()
        v = v or {}
        v['_cls'], v['_id'] = k, fid
        objs[fid] = v
    return objs


def _ref(r):
    return r.get('fileID') if isinstance(r, dict) else None


def _mat(t):
    """local TRS -> 3x4 affine (row-major)."""
    p = t.get('m_LocalPosition') or {}
    s = t.get('m_LocalScale') or {}
    q = t.get('m_LocalRotation') or {}
    x, y, z, w = (q.get('x', 0), q.get('y', 0), q.get('z', 0), q.get('w', 1))
    R = [[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
         [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
         [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]]
    S = (s.get('x', 1), s.get('y', 1), s.get('z', 1))
    return [[R[r][c] * S[c] for c in range(3)] + [(p.get('x', 0), p.get('y', 0), p.get('z', 0))[r]] for r in range(3)]


def _mul(a, b):
    return [[sum(a[r][k] * b[k][c] for k in range(3)) + (a[r][3] if c == 3 else 0) for c in range(4)] for r in range(3)]


def _apply(m, x, y):
    return (m[0][0] * x + m[0][1] * y + m[0][3], m[1][0] * x + m[1][1] * y + m[1][3])


class Scene:
    def __init__(self, path, guids):
        self.objs = load(path)
        self.guids = guids
        self._wm = {}

    def gpath(self, r):
        return self.guids.get(r['guid'], r['guid']) if isinstance(r, dict) and r.get('guid') else None

    def world(self, tid):
        if tid not in self._wm:
            t = self.objs[tid]
            m = _mat(t)
            f = _ref(t.get('m_Father'))
            self._wm[tid] = _mul(self.world(f), m) if f in self.objs else m
        return self._wm[tid]

    def gameobjects(self):
        for fid, o in self.objs.items():
            if o['_cls'] != 'GameObject':
                continue
            comps = {}
            for c in o.get('m_Component', []):
                (_, r), = c.items()
                co = self.objs.get(_ref(r))
                if co:
                    comps.setdefault(co['_cls'], []).append(co)
            t = (comps.get('Transform') or [None])[0]
            if not t:
                continue
            names, tt = [], t
            while tt:
                g = self.objs.get(_ref(tt.get('m_GameObject')))
                names.append(g.get('m_Name') if g else '?')
                tt = self.objs.get(_ref(tt.get('m_Father')))
            m = self.world(t['_id'])
            yield dict(name=o.get('m_Name'), path='/'.join(reversed(names)), layer=o.get('m_Layer'),
                       tag=o.get('m_TagString'), active=o.get('m_IsActive'), matrix=m,
                       pos=(m[0][3], m[1][3]), prefab=self.gpath(o.get('m_PrefabParentObject')), comps=comps)

    def collider_aabbs(self, go):
        m = go['matrix']
        for kind in ('BoxCollider2D', 'PolygonCollider2D', 'EdgeCollider2D', 'CircleCollider2D'):
            for c in go['comps'].get(kind, []):
                if c.get('m_Enabled', 1) == 0:
                    continue
                if kind == 'BoxCollider2D':
                    sz, ce = c.get('m_Size') or {}, c.get('m_Center') or {}
                    hx, hy, cx, cy = sz.get('x', 1) / 2, sz.get('y', 1) / 2, ce.get('x', 0), ce.get('y', 0)
                    pts = [(cx - hx, cy - hy), (cx + hx, cy - hy), (cx + hx, cy + hy), (cx - hx, cy + hy)]
                elif kind == 'PolygonCollider2D':
                    pts = [(p['x'], p['y']) for path in (c.get('m_Poly') or {}).get('m_Paths', []) for p in path]
                elif kind == 'EdgeCollider2D':
                    pts = [(p['x'], p['y']) for p in c.get('m_Points', [])]
                else:
                    r, ce = c.get('m_Radius', 0.5), c.get('m_Center') or {}
                    cx, cy = ce.get('x', 0), ce.get('y', 0)
                    pts = [(cx - r, cy - r), (cx + r, cy + r), (cx - r, cy + r), (cx + r, cy - r)]
                if not pts:
                    continue
                w = [_apply(m, x, y) for x, y in pts]
                xs, ys = [p[0] for p in w], [p[1] for p in w]
                yield dict(kind=kind, trigger=bool(c.get('m_IsTrigger')), x0=min(xs), x1=max(xs), y0=min(ys), y1=max(ys))


def scripts(scene, go):
    out = []
    for mb in go['comps'].get('MonoBehaviour', []):
        s = scene.gpath(mb.get('m_Script')) or '?'
        fields = {k: v for k, v in mb.items() if not k.startswith(('m_', '_')) and not isinstance(v, dict) or
                  (isinstance(v, dict) and set(v) <= {'x', 'y'})}
        out.append((os.path.basename(s), fields))
    return out


# Legend: '#' solid Ground-layer collider (non-trigger), '@' level_start (player spawn), 'P' portal,
# 'M' milk glass, 'Y' yoghurt pot, pickups: 'o' soap, 'w' white blood cell, 'a' antibiotic;
# microbes: L lucy, p patty, d donna, g slarg, u slurm, c colin, C super_colin, n sandy, v steve,
# i iggy, U super_slurm, X superinfection.
MICROBE = {'lucy': 'L', 'patty': 'p', 'donna': 'd', 'slarg': 'g', 'slurm': 'u', 'colin': 'c', 'super_colin': 'C',
           'sandy': 'n', 'steve': 'v', 'iggy': 'i', 'super_slurm': 'U', 'superinfection': 'X', 'super_infection': 'X'}
MARK = {'portal.js': 'P', 'Milk.js': 'M', 'Yoghurt.js': 'Y'}
MICROBE_SCRIPTS = ('Microbe.js', 'MicrobeLucy.js', 'WalkingMicrobe.js', 'ThreeBallStaph.js', 'SuperInfection.js')


def grid(scene):
    gos = [g for g in scene.gameobjects() if g['active'] != 0]
    solids = []
    for g in gos:
        if g['layer'] == 12:
            solids += [a for a in scene.collider_aabbs(g) if not a['trigger']]
    marks = []
    for g in gos:
        for s, f in scripts(scene, g):
            ch = MARK.get(s)
            if s in MICROBE_SCRIPTS:   # object names are 'NNname'; Microbe.js strips the 2-digit prefix too
                ch = MICROBE.get(g['name'][2:], '?')
            if s == 'pickups.js':
                ch = 'o' if f.get('isSoap') else ('a' if f.get('isAntibiotic') else 'w')
            if ch:
                marks.append((g['pos'], ch))
        if g['name'] == 'level_start':
            marks.append((g['pos'], '@'))
    xs = [a['x0'] for a in solids] + [a['x1'] for a in solids] + [p[0] for p, _ in marks]
    ys = [a['y0'] for a in solids] + [a['y1'] for a in solids] + [p[1] for p, _ in marks]
    x0, x1 = math.floor(min(xs) / TILE), math.ceil(max(xs) / TILE)
    y0, y1 = math.floor(min(ys) / TILE), math.ceil(max(ys) / TILE)
    W, H = x1 - x0, y1 - y0
    cells = [['.'] * W for _ in range(H)]
    for a in solids:
        for cx in range(math.floor(a['x0'] / TILE + 0.25), math.ceil(a['x1'] / TILE - 0.25)):
            for cy in range(math.floor(a['y0'] / TILE + 0.25), math.ceil(a['y1'] / TILE - 0.25)):
                if 0 <= cx - x0 < W and 0 <= cy - y0 < H:
                    cells[cy - y0][cx - x0] = '#'
    for (px, py), ch in marks:
        cx, cy = math.floor(px / TILE) - x0, math.floor(py / TILE) - y0
        if 0 <= cx < W and 0 <= cy < H:
            cells[cy][cx] = ch
    lines = [f'# grid origin (col 0,row 0 bottom-left) = world ({x0 * TILE}, {y0 * TILE}); cell = {TILE} u; {W}x{H}']
    for r in range(H - 1, -1, -1):
        lines.append(f'{(r + y0) * TILE:6.1f} ' + ''.join(cells[r]))
    return '\n'.join(lines)


if __name__ == '__main__':
    scene = Scene(sys.argv[1], build_guid_map())
    if '--json' in sys.argv:
        out = []
        for g in scene.gameobjects():
            out.append(dict(path=g['path'], layer=g['layer'], tag=g['tag'], active=g['active'],
                            x=round(g['pos'][0], 3), y=round(g['pos'][1], 3), prefab=g['prefab'],
                            scripts=scripts(scene, g),
                            colliders=list(scene.collider_aabbs(g))))
        json.dump(out, sys.stdout, indent=1, default=str)
    else:
        print(grid(scene))
