// ══════════════════════════════════════════════════════════
//  K-GLOBAL LMS — Space / Neon theme
//  Bảng màu dùng chung cho toàn hệ thống.
//  Sửa ở đây là đổi tone cả site (trang chủ, dashboard, bài học, admin).
// ══════════════════════════════════════════════════════════

// ── Nền ──
export const SPACE = '#070B15'   // nền trang (vũ trụ sâu)
export const PANEL = '#0E1526'   // bề mặt card / panel
export const CHIP = '#141E36'    // chip, tile, ô lồng trong card
export const RAISED = '#1A2542'  // lớp nổi cao nhất (dropdown, modal)

// ── Chữ ──
export const TEXT = '#EEF3FB'    // chữ chính (trắng lạnh)
export const MUTED = '#8FA9C6'   // chữ phụ
export const FAINT = 'rgba(143,169,198,0.45)' // chữ mờ / disabled

// ── Điểm nhấn thương hiệu ──
export const GOLD = '#FFC94D'                       // gold neon
export const GOLD_GLOW = 'rgba(255,201,77,0.35)'    // quầng sáng gold
export const GOLD_SOFT = 'rgba(255,201,77,0.12)'    // nền gold rất mờ
export const NAVY = '#466898'                       // navy brand (giữ cho điểm nhấn)
export const BLUE = '#5B9BE8'                       // xanh sáng (link, nhấn phụ)

// ── Viền ──
export const BORDER = 'rgba(155,196,232,0.16)'      // viền chuẩn
export const BORDER_STRONG = 'rgba(155,196,232,0.28)' // viền rõ hơn
export const CREAM = CHIP                            // alias tương thích code cũ

// ── Màu trạng thái (đã chỉnh cho nền tối) ──
export const OK = '#4ADE80'                          // thành công
export const OK_BG = 'rgba(74,222,128,0.12)'
export const OK_BORDER = 'rgba(74,222,128,0.35)'

export const WARN = '#FBBF24'                        // cảnh báo / chờ duyệt
export const WARN_BG = 'rgba(251,191,36,0.12)'
export const WARN_BORDER = 'rgba(251,191,36,0.35)'

export const ERR = '#F87171'                         // lỗi / từ chối
export const ERR_BG = 'rgba(248,113,113,0.12)'
export const ERR_BORDER = 'rgba(248,113,113,0.35)'

export const INFO = '#60A5FA'                        // thông tin
export const INFO_BG = 'rgba(96,165,250,0.12)'
export const INFO_BORDER = 'rgba(96,165,250,0.35)'

// ── Đổ bóng ──
export const SHADOW = '0 16px 48px rgba(0,0,0,0.5)'
export const SHADOW_GOLD = `0 0 32px ${GOLD_GLOW}`
