import { Download } from 'lucide-react';
import { formatDate, formatMoney } from '../lib/format';

function line(label, value) {
  return { label, value: value ?? '—' };
}

function receiptLines({ payment, enrollment, student }) {
  return [
    line('Receipt no.', payment.transactionRef),
    line('Date', formatDate(payment.paidAt || payment.createdAt, true)),
    line('Student', student?.name),
    line('Student ID', `S-${String(enrollment.studentId).padStart(5, '0')}`),
    line('Course', `${enrollment.courseCode || `#${enrollment.courseId}`} ${enrollment.courseTitle || ''}`.trim()),
    line('Credits', enrollment.credits),
    line('Enrollment', `E-${String(enrollment.id).padStart(6, '0')}`),
    line('Card', `•••• ${payment.cardLast4}`),
  ];
}

/** A printed registrar receipt: mono figures, dashed rules. Downloadable as a PDF built with jsPDF. */
export default function TuitionReceipt({ payment, enrollment, student }) {
  const lines = receiptLines({ payment, enrollment, student });
  const refunded = payment.status === 'REFUNDED';

  const download = async () => {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ unit: 'pt', format: [300, 470] });
    let y = 40;
    doc.setFont('times', 'bold').setFontSize(16).text('AcademiaX', 150, y, { align: 'center' });
    y += 16;
    doc.setFont('courier', 'normal').setFontSize(8).text('OFFICE OF THE REGISTRAR · TUITION RECEIPT', 150, y, { align: 'center' });
    y += 18;
    const dash = () => { doc.setLineDashPattern([2, 2], 0).line(24, y, 276, y); y += 16; };
    dash();
    doc.setFontSize(9);
    lines.forEach(({ label, value }) => {
      doc.text(label.toUpperCase(), 24, y);
      doc.text(String(value).slice(0, 34), 276, y, { align: 'right' });
      y += 15;
    });
    dash();
    doc.setFont('courier', 'bold').setFontSize(11).text('TUITION PAID', 24, y).text(formatMoney(payment.amount, true).replace('₹', 'INR '), 276, y, { align: 'right' });
    y += 16;
    if (refunded) { doc.setFontSize(9).text('*** REFUNDED ***', 150, y, { align: 'center' }); y += 14; }
    dash();
    doc.setFont('courier', 'normal').setFontSize(7).text('Simulated payment for academic demonstration. No funds were moved.', 150, y, { align: 'center' });
    doc.save(`receipt-${payment.transactionRef}.pdf`);
  };

  return (
    <div className="mx-auto w-full max-w-sm">
      <div className="relative border-x border-t border-rule bg-surface px-6 pb-7 pt-6 font-mono text-[12.5px] text-ink shadow-[0_14px_30px_-20px_rgb(var(--ink)/0.45)]">
        {/* torn-paper scallops along the bottom edge */}
        <span aria-hidden="true" className="absolute inset-x-0 -bottom-[6px] h-[6px]"
          style={{ background: 'radial-gradient(circle at 6px 0, rgb(var(--surface)) 5.5px, transparent 6px) 0 0 / 12px 6px repeat-x' }} />
        <p className="text-center font-display text-xl not-italic">AcademiaX</p>
        <p className="mt-1 text-center text-[10px] uppercase tracking-[0.2em] text-ink-muted">Office of the Registrar · Tuition receipt</p>
        <div className="my-4 rule-dashed" />
        <dl className="space-y-1.5">
          {lines.map(({ label, value }) => (
            <div key={label} className="flex justify-between gap-4">
              <dt className="uppercase text-ink-muted">{label}</dt>
              <dd className="truncate text-right">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="my-4 rule-dashed" />
        <div className="flex justify-between text-sm font-medium">
          <span>TUITION PAID</span>
          <span className="tabular-nums">{formatMoney(payment.amount, true)}</span>
        </div>
        {refunded && <p className="mt-3 text-center text-xs tracking-[0.3em] text-accent">*** REFUNDED ***</p>}
        <div className="my-4 rule-dashed" />
        <p className="text-center text-[10px] text-ink-muted">Simulated payment for academic demonstration.<br />No funds were moved.</p>
      </div>
      <button className="btn-secondary mt-4 w-full" onClick={download}>
        <Download size={15} /> Download PDF
      </button>
    </div>
  );
}
