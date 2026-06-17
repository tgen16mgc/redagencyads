import type { NormalizedRow } from "@/lib/types";
import { SUFFICIENCY, hasFunnelClickVolume } from "@/lib/data-sufficiency";

export const FUNNEL_BENCHMARKS = {
  clickToCart: 0.05,
  cartToCheckout: 0.15,
  checkoutToPurchase: 0.2,
} as const;

export type FunnelLeakageStatus = "clean" | "leakage_detected" | "insufficient_data";

export type FunnelLeakage = {
  status: FunnelLeakageStatus;
  variant: "secondary" | "outline" | "destructive";
  score: number;
  label: { en: string; vi: string };
  summary: { en: string; vi: string };
  blockers: { en: string[]; vi: string[] };
  rates: {
    clickToCart: number;
    cartToCheckout: number;
    checkoutToPurchase: number;
  };
};

const labels: Record<FunnelLeakageStatus, { en: string; vi: string }> = {
  clean: { en: "Healthy funnel", vi: "Phễu chuyển đổi tốt" },
  leakage_detected: { en: "Leakage detected", vi: "Phát hiện rò rỉ" },
  insufficient_data: { en: "Insufficient data", vi: "Chưa đủ dữ liệu" },
};

export function assessFunnelLeakage(totals: NormalizedRow): FunnelLeakage {
  const clicks = totals.linkClicks || 0;
  const carts = totals.addToCart || 0;
  const checkouts = totals.initiateCheckout || 0;
  const purchases = totals.purchases || 0;

  // Non-commerce campaigns: has clicks but no funnel events
  if (carts <= 0 && checkouts <= 0 && purchases <= 0) {
    return {
      status: "insufficient_data",
      variant: "outline",
      score: 100,
      label: labels.insufficient_data,
      summary: {
        en: "No add-to-cart, checkout, or purchase events in scope; e-commerce funnel analysis does not apply to this campaign type.",
        vi: "Không có sự kiện thêm giỏ hàng, checkout hay mua hàng; phân tích phễu e-commerce không áp dụng cho loại campaign này.",
      },
      blockers: { en: [], vi: [] },
      rates: { clickToCart: 0, cartToCheckout: 0, checkoutToPurchase: 0 },
    };
  }

  // Need minimum funnel clicks + at least one downstream event
  if (!hasFunnelClickVolume({ linkClicks: clicks, addToCart: carts, initiateCheckout: checkouts, purchases })) {
    return {
      status: "insufficient_data",
      variant: "outline",
      score: 100,
      label: labels.insufficient_data,
      summary: {
        en: "Need at least 100 link clicks to analyze conversion funnel leakage.",
        vi: "Cần tối thiểu 100 lượt click để phân tích rò rỉ phễu chuyển đổi.",
      },
      blockers: { en: [], vi: [] },
      rates: { clickToCart: 0, cartToCheckout: 0, checkoutToPurchase: 0 },
    };
  }

  const clickToCart = clicks > 0 ? carts / clicks : 0;
  const cartToCheckout = carts > 0 ? checkouts / carts : 0;
  const checkoutToPurchase = checkouts > 0 ? purchases / checkouts : 0;

  const blockers = { en: [] as string[], vi: [] as string[] };
  let score = 100;

  if (clickToCart < FUNNEL_BENCHMARKS.clickToCart) {
    score -= 25;
    blockers.en.push(`Low click-to-cart rate (${(clickToCart * 100).toFixed(1)}% vs ${(FUNNEL_BENCHMARKS.clickToCart * 100).toFixed(1)}% benchmark). Optimize product landing page hook.`);
    blockers.vi.push(`Tỷ lệ thêm giỏ hàng thấp (${(clickToCart * 100).toFixed(1)}% so với mốc ${(FUNNEL_BENCHMARKS.clickToCart * 100).toFixed(1)}%). Cần tối ưu hook trang sản phẩm.`);
  }

  if (carts > 0 && cartToCheckout < FUNNEL_BENCHMARKS.cartToCheckout) {
    score -= 35;
    blockers.en.push(`Severe checkout leakage: ${(cartToCheckout * 100).toFixed(1)}% of carts reach checkout vs ${(FUNNEL_BENCHMARKS.cartToCheckout * 100).toFixed(1)}% benchmark. Review shipping costs/options.`);
    blockers.vi.push(`Rò rỉ checkout nghiêm trọng: ${(cartToCheckout * 100).toFixed(1)}% giỏ hàng vào checkout so với mốc ${(FUNNEL_BENCHMARKS.cartToCheckout * 100).toFixed(1)}%. Check phí/hình thức ship.`);
  }

  if (checkouts > 0 && checkoutToPurchase < FUNNEL_BENCHMARKS.checkoutToPurchase) {
    score -= 40;
    blockers.en.push(`Weak purchase conversion: ${(checkoutToPurchase * 100).toFixed(1)}% of checkouts purchase vs ${(FUNNEL_BENCHMARKS.checkoutToPurchase * 100).toFixed(1)}% benchmark. Check payment gate or offer trust.`);
    blockers.vi.push(`Chuyển đổi mua hàng yếu: ${(checkoutToPurchase * 100).toFixed(1)}% checkout thanh toán so với mốc ${(FUNNEL_BENCHMARKS.checkoutToPurchase * 100).toFixed(1)}%. Check cổng thanh toán hoặc độ uy tín offer.`);
  }

  score = Math.max(0, score);

  if (score < 70) {
    return {
      status: "leakage_detected",
      variant: "destructive",
      score,
      label: labels.leakage_detected,
      summary: {
        en: `Funnel leakage score is ${score}/100. Specific drops found in checkout or purchase steps.`,
        vi: `Điểm rò rỉ phễu là ${score}/100. Phát hiện sụt giảm cụ thể ở bước checkout hoặc mua hàng.`,
      },
      blockers,
      rates: { clickToCart, cartToCheckout, checkoutToPurchase },
    };
  }

  return {
    status: "clean",
    variant: "secondary",
    score,
    label: labels.clean,
    summary: {
      en: "Funnel conversion ratios are healthy and within standard benchmarks.",
      vi: "Tỷ lệ chuyển đổi phễu ở mức khỏe mạnh và nằm trong các mốc tiêu chuẩn.",
    },
    blockers,
    rates: { clickToCart, cartToCheckout, checkoutToPurchase },
  };
}
