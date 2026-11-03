import { describe, expect, test } from 'vitest';
import { tiltFromAngles } from '../src/platform/tilt';

describe('eğim sensörü açısı', () => {
  test('telefon düz tutulunca gamma ile aynı', () => {
    expect(tiltFromAngles(0, 20, 0)).toBeCloseTo(20, 5);
    expect(tiltFromAngles(10, -15, 0)).toBeCloseTo(-15, 0);
  });

  test('telefon dik tutulunca gamma sıçrasa da sonuç sıçramaz', () => {
    // beta 90° civarında tarayıcı gamma'yı +80'den -80'e atlatabilir; gerçek eğim neredeyse aynı
    const a = tiltFromAngles(89.5, 80, 0);
    const b = tiltFromAngles(90.5, -80, 0);
    expect(Math.abs(a - b)).toBeLessThan(1.5);
    expect(Math.abs(a)).toBeLessThan(1);
  });

  test('45° ve dik tutuşta direksiyon gibi çevirince açı çevirme açısına yakın', () => {
    // Telefon beta açısıyla tutulup ekran düzleminde θ kadar çevrilince sensörün vereceği beta/gamma
    for (const tilt of [45, 60, 80]) {
      for (const th of [10, 20]) {
        const B = (tilt * Math.PI) / 180;
        const T = (th * Math.PI) / 180;
        const ux = -Math.sin(B) * Math.sin(T);
        const uy = Math.sin(B) * Math.cos(T);
        const uz = Math.cos(B);
        const beta = (Math.asin(uy) * 180) / Math.PI;
        const gamma = (Math.atan2(-ux, uz) * 180) / Math.PI;
        expect(Math.abs(tiltFromAngles(beta, gamma, 0) - th)).toBeLessThan(th * 0.15);
      }
    }
  });

  test('yatay ekranda beta kullanılır', () => {
    expect(tiltFromAngles(12, 0, 90)).toBeCloseTo(12, 5);
    expect(tiltFromAngles(12, 0, 270)).toBeCloseTo(-12, 5);
  });
});
