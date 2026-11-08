// DV87 STAINED THEME · renderer. Two canvases: #scene (behind the DOM: stone, window, beam, dust, pool on the stone)
// and #light (above the DOM, screen-blended: the pool of coloured light, at reduced resolution).
// Materials are baked once per resize; a frame is one composite draw (+ one small overlay draw when the light changes).
import { createGL, program, target, bind } from './gl.js';
import { NOISE, STONE, WINDOW0, WINDOW1, COMP, OVER } from './shaders.js';

const MAX_MP = 4.6e6;          // scene canvas cap (device px)

export function createRenderer(scene, light, { fxdpr = 0 } = {}) {
  const gl = createGL(scene); if (!gl) return null;
  const gl2 = createGL(light); if (!gl2) return null;
  let P;
  try {
    P = {
      noise: program(gl, NOISE), stone: program(gl, STONE), w0: program(gl, WINDOW0), w1: program(gl, WINDOW1), comp: program(gl, COMP),
      noise2: program(gl2, NOISE), over: program(gl2, OVER),
    };
  } catch (e) { console.warn('[stained] shader build failed', e); return null; }
  const R = { gl, gl2, dpr: 1, opx: 1, W: 0, H: 0, noise: null, noise2: null, stone: null, w0: null, w1: null, wbox: null,
    draws: 0, overDraws: 0, px: 0, bakes: 0, lost: false };

  function repeatTex(g, t) {
    g.bindTexture(g.TEXTURE_2D, t.tex);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.REPEAT); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.REPEAT);
  }
  function bakeNoise() {
    for (const [g, pr, key] of [[gl, P.noise, 'noise'], [gl2, P.noise2, 'noise2']]) {
      if (R[key]) continue;
      const t = target(g, 256, 256, null, { repeat: true });
      bind(g, t); pr.use().f('uRes', 256, 256).draw(); repeatTex(g, t);
      R[key] = t;
    }
  }

  // L: layout from the app (css px, page coordinates). Called on resize / font load.
  R.resize = (L) => {
    const W = L.W, H = L.H;
    let dpr = fxdpr || Math.min(window.devicePixelRatio || 1, 3);
    if (W * H * dpr * dpr > MAX_MP) dpr = Math.sqrt(MAX_MP / (W * H));
    R.dpr = dpr; R.W = W; R.H = H;
    scene.width = Math.round(W * dpr); scene.height = Math.round(H * dpr);
    const d = window.devicePixelRatio || 1;
    R.opx = Math.min(1, Math.max(0.5, d * 0.45));
    light.width = Math.round(W * R.opx); light.height = Math.round(H * R.opx);
    bakeNoise();
    // the stone page covers the whole document (it scrolls with it), soft enough for ≤ 2 px per css px
    const spx = Math.min(dpr, 2, Math.sqrt(5e6 / (L.docW * L.docH)));
    const sw = Math.max(1, Math.round(L.docW * spx)), sh = Math.max(1, Math.round(L.docH * spx));
    if (R.stone) R.stone.free();
    R.stone = target(gl, sw, sh);
    bind(gl, R.stone); P.stone.use().f('uRes', sw, sh).f('uPx', spx).f('uBlock', L.block).draw();
    // the window, in its own box (outer frame + a 2 px margin), at the scene resolution
    const g = L.glass, F = L.F * dpr, hw = g.hw * dpr, rh = g.rh * dpr;
    const archH = Math.sqrt((2 * hw + F) ** 2 - hw * hw);
    const pad = 3;
    const bw = Math.ceil(2 * (hw + F) + 2 * pad), bh = Math.ceil(archH + 3 * rh + F + 2 * pad);
    const cx = bw / 2, ys = pad + archH, yb = ys + 3 * rh;
    R.wbox = { w: bw, h: bh, offX: g.cx * dpr - cx, offY: g.ys * dpr - ys };   // add to the box to reach page px
    for (const k of ['w0', 'w1']) { if (R[k]) R[k].free(); R[k] = target(gl, bw, bh); }
    for (const [k, pr] of [['w0', P.w0], ['w1', P.w1]]) {
      bind(gl, R[k]);
      pr.use().f('uRes', bw, bh).f('uPx', dpr).f('uWin', cx, ys, hw, yb).f('uF', F).f('uRh', rh).f('uS', hw / 160);
      gl.uniform3fv(gl.getUniformLocation(prog(pr), 'uCol[0]'), L.cols);
      pr.draw();
    }
    R.bakes++;
  };
  // program handle for array uniforms (the helper keeps it private): fetched once via the current program
  function prog() { return gl.getParameter(gl.CURRENT_PROGRAM); }

  // F: per-frame values from the app (css px, screen coordinates)
  R.frame = (F, scissor = null) => {
    const d = R.dpr, H = scene.height;
    bind(gl, null);
    if (scissor) {
      const x = Math.max(0, Math.floor(scissor[0] * d)), y = Math.max(0, Math.floor(H - (scissor[1] + scissor[3]) * d));
      const w = Math.min(scene.width - x, Math.ceil(scissor[2] * d) + 2), h = Math.min(H - y, Math.ceil(scissor[3] * d) + 2);
      gl.enable(gl.SCISSOR_TEST); gl.scissor(x, y, w, h); R.px += w * h;
    } else R.px += scene.width * scene.height;
    const c = P.comp.use();
    c.f('uRes', scene.width, scene.height).f('uDpr', d).f('uScroll', F.scrollX, F.scrollY)
      .tex('uStone', 0, R.stone.tex).f('uDoc', F.docW, F.docH)
      .tex('uW0', 1, R.w0.tex).tex('uW1', 2, R.w1.tex).tex('uNoise', 3, R.noise.tex)
      .f('uWOrg', R.wbox.offX - F.ax * d, R.wbox.offY - F.ay * d).f('uWSize', R.wbox.w, R.wbox.h)
      .f('uWin', F.glass.cx * d, F.glass.ys * d, F.glass.hw * d, F.glass.yb * d).f('uRh', F.glass.rh * d).f('uF', F.F * d)
      .f('uLight', ...F.light).f('uGlint', ...F.glint)
      .f('uSS', ...F.beam.s).f('uSE', ...F.beam.e).f('uSW', F.beam.sw).f('uEW', F.beam.ew).f('uBeamC', ...F.beamC)
      .f('uDust', F.dust).f('uPoolK', F.poolK).f('uExpo', F.expo).f('uTime', F.time);
    setPool(gl, c, F);
    const p = prog();
    gl.uniform3fv(gl.getUniformLocation(p, 'uCol[0]'), F.cols);
    gl.uniform1fv(gl.getUniformLocation(p, 'uInt[0]'), F.int);
    gl.uniform1fv(gl.getUniformLocation(p, 'uA[0]'), F.a);
    c.draw();
    if (scissor) gl.disable(gl.SCISSOR_TEST);
    R.draws++;
  };
  R.over = (F) => {
    bind(gl2, null);
    const o = P.over.use();
    o.f('uRes', light.width, light.height).f('uPx', R.opx).f('uOverK', F.overK).f('uTime', F.time).tex('uNoise', 0, R.noise2.tex);
    setPool(gl2, o, F);
    o.draw();
    R.overDraws++;
  };
  function setPool(g, pr, F) {
    const P = F.pool;
    pr.f('uPO', P.o[0], P.o[1]).f('uPTo', ...P.to).f('uPFrom', ...P.from).f('uWave', P.wave)
      .f('uWaveO', ...P.wo).f('uWaveD', ...P.wd).f('uPI', P.i).f('uCloud', P.cloud).f('uWarm', ...P.warm);
    const loc = g.getUniformLocation(g.getParameter(g.CURRENT_PROGRAM), 'uPInv');
    g.uniformMatrix2fv(loc, false, P.inv);
  }
  R.free = () => { for (const k of ['stone', 'w0', 'w1', 'noise']) if (R[k]) R[k].free(); };
  return R;
}
