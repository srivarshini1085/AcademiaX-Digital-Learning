import { useParams, Link } from 'react-router-dom';

export default function PaymentPage() {
  const { paymentId } = useParams();

  return (
    <div className="min-h-screen bg-slate-100 px-6 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">Checkout</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">Payment</h1>
          </div>
          <Link to="/student/enrollments" className="btn-secondary">Back</Link>
        </div>

        <div className="card p-8">
          <div className="flex items-center justify-between border-b border-slate-200 pb-5">
            <div>
              <div className="text-sm text-slate-500">Order ID</div>
              <div className="text-xl font-bold text-slate-900">#{paymentId}</div>
            </div>
            <div className="text-right">
              <div className="text-sm text-slate-500">Amount</div>
              <div className="text-3xl font-black text-brand-700">$149</div>
            </div>
          </div>

          <div className="mt-8 space-y-5">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Cardholder name</label>
              <input className="input-field" placeholder="Your full name" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Card number</label>
              <input className="input-field" placeholder="4242 4242 4242 4242" />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Expiry</label>
                <input className="input-field" placeholder="MM/YY" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">CVV</label>
                <input className="input-field" placeholder="123" />
              </div>
            </div>
            <button className="btn-primary w-full">Confirm payment</button>
          </div>
        </div>
      </div>
    </div>
  );
}
