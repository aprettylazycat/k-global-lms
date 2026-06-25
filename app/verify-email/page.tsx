export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: '#FAF8F4' }}>
      <div className="bg-white rounded-3xl border border-stone-200 p-8 max-w-sm w-full text-center shadow-sm">
        <div className="w-16 h-16 rounded-full bg-stone-100 flex items-center justify-center mx-auto mb-4">
          <i className="ti ti-mail" style={{ fontSize: '28px', color: '#1C1917' }} />
        </div>
        <h1 className="font-heading text-xl font-bold text-stone-900 mb-2">Kiểm tra email</h1>
        <p className="text-sm text-stone-500 leading-relaxed mb-6">
          Chúng tôi đã gửi link xác nhận đến email của bạn. Vui lòng kiểm tra hộp thư và nhấn vào link để kích hoạt tài khoản.
        </p>
        <p className="text-xs text-stone-400">
          Không thấy email? Kiểm tra thư mục spam hoặc{' '}
          <a href="/register" className="text-stone-700 font-semibold hover:underline">thử đăng ký lại</a>
        </p>
      </div>
    </div>
  )
}