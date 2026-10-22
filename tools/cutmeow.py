"""Cut the chosen sampler meow (B1 on sing-test.html) exactly as the test rendered it. usage: python -I cutmeow.py <wav> <start> <dur> <out wav>"""
import sys, numpy as np, parselmouth
src, start, dur, out = sys.argv[1], float(sys.argv[2]), float(sys.argv[3]), sys.argv[4]
s = parselmouth.Sound(src).resample(44100).extract_part(from_time=start - 0.01, to_time=start + dur + 0.04, preserve_times=False)
y = s.values[0]; f = int(0.006 * 44100); y[:f] *= np.linspace(0, 1, f); y[-f:] *= np.linspace(1, 0, f)
s.values[0] = y / max(np.sqrt(np.mean(y ** 2)), 1e-6) * 0.1; s.save(out, 'WAV'); print('dur', round(s.duration, 3))
