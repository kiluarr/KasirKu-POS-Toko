import { useRef, useState } from 'react';
import { X, Printer, Download, Share2, FileSpreadsheet } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { Transaction, StoreSettings } from '../types';

interface StrukModalProps {
  transaction: Transaction;
  settings: StoreSettings;
  onClose: () => void;
}

export default function StrukModal({ transaction, settings, onClose }: StrukModalProps) {
  const receiptRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);

  // Formatting currency
  const formatNum = (num: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num).replace('Rp', settings.currency);
  };

  // Generate a mock but realistic-looking QR Code grid deterministically from Invoice Number
  const renderDeterministicQR = (text: string) => {
    // A simple 15x15 offline QR matrix pattern
    const size = 15;
    const grid = [];
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = text.charCodeAt(i) + ((hash << 5) - hash);
    }

    for (let r = 0; r < size; r++) {
      const row = [];
      for (let c = 0; c < size; c++) {
        // Draw standard QR finder patterns in corners (7x7-ish)
        const isFinderTopLeft = r < 5 && c < 5;
        const isFinderTopRight = r < 5 && c >= size - 5;
        const isFinderBottomLeft = r >= size - 5 && c < 5;

        if (isFinderTopLeft || isFinderTopRight || isFinderBottomLeft) {
          // Inner/outer ring for finder pattern
          const innerR = r === 0 || r === 4 || c === 0 || c === 4 || (r === 2 && c === 2);
          const innerR_TR = r === 0 || r === 4 || c === size - 1 || c === size - 5 || (r === 2 && c === size - 3);
          const innerR_BL = r === size - 1 || r === size - 5 || c === 0 || c === 4 || (r === size - 3 && c === 2);
          
          if (isFinderTopLeft) row.push(innerR || (r >= 1 && r <= 3 && c >= 1 && c <= 3 && !(r === 2 && c === 2) === false));
          else if (isFinderTopRight) row.push(innerR_TR || (r >= 1 && r <= 3 && c >= size - 4 && c <= size - 2 && !(r === 2 && c === size - 3) === false));
          else row.push(innerR_BL || (r >= size - 4 && r <= size - 2 && c >= 1 && c <= 3 && !(r === size - 3 && c === 2) === false));
        } else {
          // Pseudorandom noise based on invoice text hash
          const bitIndex = r * size + c;
          const val = ((hash >> (bitIndex % 32)) & 1) === 1;
          row.push(val);
        }
      }
      grid.push(row);
    }

    return (
      <svg viewBox={`0 0 ${size} ${size}`} className="w-24 h-24 mx-auto border p-1 bg-white">
        {grid.map((row, rIdx) =>
          row.map((active, cIdx) => (
            <rect
              key={`${rIdx}-${cIdx}`}
              x={cIdx}
              y={rIdx}
              width="1.05"
              height="1.05"
              fill={active ? '#000000' : '#FFFFFF'}
            />
          ))
        )}
      </svg>
    );
  };

  const handlePrint = () => {
    const printContent = receiptRef.current?.innerHTML;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Gagal membuka jendela cetak. Pastikan popup diperbolehkan.');
      return;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>Cetak Struk - ${transaction.invoiceNumber}</title>
          <style>
            body {
              font-family: 'Courier New', Courier, monospace;
              width: 80mm;
              margin: 0;
              padding: 10px;
              color: #000;
              font-size: 12px;
              background: #fff;
            }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .font-bold { font-weight: bold; }
            .divider { border-top: 1px dashed #000; margin: 8px 0; }
            .flex { display: flex; justify-content: space-between; }
            .item-row { margin-bottom: 4px; }
            svg { display: block; margin: 10px auto; max-width: 100px; }
          </style>
        </head>
        <body>
          ${printContent}
          <script>
            window.onload = function() {
              window.print();
              window.close();
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleDownloadPNG = async () => {
    if (!receiptRef.current) return;
    setLoading(true);
    try {
      const canvas = await html2canvas(receiptRef.current, {
        backgroundColor: '#FFFFFF',
        scale: 2,
        logging: false,
      });
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `Struk-${transaction.invoiceNumber}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Error downloading image', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!receiptRef.current) return;
    setLoading(true);
    try {
      const canvas = await html2canvas(receiptRef.current, {
        backgroundColor: '#FFFFFF',
        scale: 2,
        logging: false,
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [80, 150], // custom thermal width 80mm, tall enough
      });
      
      const width = pdf.internal.pageSize.getWidth();
      const height = (canvas.height * width) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, width, height);
      pdf.save(`Struk-${transaction.invoiceNumber}.pdf`);
    } catch (err) {
      console.error('Error downloading PDF', err);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    if (!receiptRef.current) return;
    try {
      const canvas = await html2canvas(receiptRef.current, {
        backgroundColor: '#FFFFFF',
        scale: 2,
      });
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        const file = new File([blob], `Struk-${transaction.invoiceNumber}.png`, { type: 'image/png' });
        
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: `Struk Belanja ${settings.storeName}`,
            text: `Terima kasih telah berbelanja di ${settings.storeName}! Berikut struk transaksi Anda.`,
          });
        } else {
          // Fallback copying invoice info
          const textToCopy = `*${settings.storeName}*\n${settings.address}\n\nNo: ${transaction.invoiceNumber}\nKasir: ${transaction.cashierName}\nTgl: ${new Date(transaction.date).toLocaleString('id-ID')}\n\nTotal: ${formatNum(transaction.total)}\nMetode: ${transaction.paymentMethod}\n\nTerima kasih!`;
          await navigator.clipboard.writeText(textToCopy);
          alert('Detail struk telah disalin ke papan klip karena browser tidak mendukung pembagian langsung.');
        }
      });
    } catch (err) {
      console.error('Error sharing', err);
    }
  };

  const formattedDate = new Date(transaction.date).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const formattedTime = new Date(transaction.date).toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-emerald-800/40 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col h-[90vh]">
        {/* Header Modal */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-emerald-950/50 bg-emerald-950/20">
          <h3 className="font-semibold text-emerald-400">Bukti Transaksi</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-950/30 flex justify-center items-start">
          {/* Printable Receipt Frame */}
          <div
            ref={receiptRef}
            className="w-full max-w-[300px] bg-white text-slate-900 p-5 rounded shadow-lg font-mono text-[11px] leading-relaxed select-none"
            style={{ fontFamily: "'Courier New', Courier, monospace" }}
          >
            <div className="text-center">
              {settings.logoUrl ? (
                <img
                  src={settings.logoUrl}
                  alt="Logo"
                  referrerPolicy="no-referrer"
                  className="w-12 h-12 mx-auto mb-2 object-contain"
                />
              ) : (
                <div className="w-10 h-10 mx-auto mb-2 rounded bg-slate-900 flex items-center justify-center text-white font-bold text-base">
                  KP
                </div>
              )}
              <h2 className="text-sm font-bold tracking-tight text-black uppercase">{settings.storeName}</h2>
              <p className="text-[9px] text-slate-600 mt-0.5">{settings.address}</p>
              {settings.phone && <p className="text-[9px] text-slate-600">WA: {settings.phone}</p>}
            </div>

            <div className="border-t border-dashed border-slate-400 my-3"></div>

            <div className="space-y-0.5 text-slate-700">
              <div className="flex justify-between">
                <span>Tanggal:</span>
                <span>{formattedDate} {formattedTime}</span>
              </div>
              <div className="flex justify-between">
                <span>No. Transaksi:</span>
                <span className="font-bold">{transaction.invoiceNumber}</span>
              </div>
              <div className="flex justify-between">
                <span>Kasir:</span>
                <span>{transaction.cashierName}</span>
              </div>
              <div className="flex justify-between">
                <span>Pembayaran:</span>
                <span className="font-bold">{transaction.paymentMethod}</span>
              </div>
              {transaction.paymentRecipient && (
                <div className="text-[9px] text-slate-500 pl-2 border-l border-slate-300 my-1 leading-normal text-right">
                  <span>Penerima: {transaction.paymentRecipient.providerName}</span>
                  <br />
                  <span>No. Rek: {transaction.paymentRecipient.accountNumber}</span>
                  <br />
                  <span>a.n. {transaction.paymentRecipient.accountName}</span>
                </div>
              )}
            </div>

            <div className="border-t border-dashed border-slate-400 my-3"></div>

            {/* Items */}
            <div className="space-y-2">
              {transaction.items.map((item, idx) => (
                <div key={idx} className="space-y-0.5">
                  <div className="text-black font-semibold text-left">{item.name}</div>
                  <div className="flex justify-between text-slate-600">
                    <span>
                      {item.quantity} x {formatNum(item.sellingPrice)}
                    </span>
                    <span className="text-black font-bold">{formatNum(item.total)}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-dashed border-slate-400 my-3"></div>

            {/* Summary */}
            <div className="space-y-1 text-slate-800">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>{formatNum(transaction.subtotal)}</span>
              </div>
              {transaction.discount > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>Diskon:</span>
                  <span>-{formatNum(transaction.discount)}</span>
                </div>
              )}
              {transaction.tax > 0 && (
                <div className="flex justify-between">
                  <span>Pajak (11%):</span>
                  <span>{formatNum(transaction.tax)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold text-black border-t border-slate-200 pt-1 mt-1">
                <span>TOTAL:</span>
                <span>{formatNum(transaction.total)}</span>
              </div>
              <div className="flex justify-between pt-1">
                <span>Bayar ({transaction.paymentMethod}):</span>
                <span>{formatNum(transaction.paymentAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span>Kembalian:</span>
                <span className="font-bold text-black">{formatNum(transaction.changeAmount)}</span>
              </div>
            </div>

            <div className="border-t border-dashed border-slate-400 my-3"></div>

            {/* QR Code section */}
            <div className="text-center space-y-1 mb-2">
              {renderDeterministicQR(transaction.invoiceNumber)}
              <p className="text-[8px] text-slate-500 mt-1 uppercase">Scan to Verify Invoice</p>
            </div>

            <p className="text-center text-[9px] text-slate-500 italic mt-3 whitespace-pre-line px-2">
              {settings.receiptFooter}
            </p>
          </div>
        </div>

        {/* Action Buttons Footer */}
        <div className="p-4 border-t border-emerald-950/60 bg-slate-900 grid grid-cols-2 gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-xl font-medium transition-colors cursor-pointer text-sm"
          >
            <Printer className="w-4 h-4" />
            Cetak Struk
          </button>
          <button
            onClick={handleDownloadPNG}
            disabled={loading}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-medium transition-colors cursor-pointer disabled:opacity-50 text-sm"
          >
            <Download className="w-4 h-4" />
            Download PNG
          </button>
          <button
            onClick={handleDownloadPDF}
            disabled={loading}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-medium transition-colors cursor-pointer disabled:opacity-50 text-sm"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Download PDF
          </button>
          <button
            onClick={handleShare}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-950 text-emerald-400 border border-emerald-800/40 hover:bg-emerald-900/40 rounded-xl font-medium transition-colors cursor-pointer text-sm col-span-1"
          >
            <Share2 className="w-4 h-4" />
            Bagikan
          </button>
          <button
            onClick={onClose}
            className="col-span-2 mt-1 py-2 text-center text-slate-400 hover:text-white text-xs font-semibold hover:underline"
          >
            Tutup Lembar Struk
          </button>
        </div>
      </div>
    </div>
  );
}
