import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type Sale = {
  id: string;
  message: string;
  status: string;
  created_at: string;
};

const STATUS_MAP: Record<string, string> = {
  novo: 'Novo',
  visualizado: 'Visualizado',
  separando: 'Separando',
  separado: 'Separado',
  entregue_ou_retirado: 'Entregue/Retirado',
};

export async function generateDailyReport(sales: Sale[], date: Date = new Date()) {
  // Dynamic imports so jsPDF only loads on the client (avoids SSR/Node.js errors)
  const jsPDFModule = await import('jspdf');
  const jsPDF = jsPDFModule.default;
  const autoTableModule = await import('jspdf-autotable');
  const autoTable = autoTableModule.default;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const pageW = doc.internal.pageSize.getWidth();
  const dateStr = format(date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  const generatedAt = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

  // ─── Header ───────────────────────────────────────────────────────────────
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageW, 32, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text('TORRES MADEIRA', 14, 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(148, 163, 184);
  doc.text('Relatório de Vendas Diário', 14, 22);

  doc.setFontSize(9);
  doc.setTextColor(203, 213, 225);
  doc.text(dateStr, pageW - 14, 14, { align: 'right' });
  doc.text(`Gerado em: ${generatedAt}`, pageW - 14, 22, { align: 'right' });

  // ─── Summary strip ────────────────────────────────────────────────────────
  const total = sales.length;
  const entregues = sales.filter(s => s.status === 'entregue_ou_retirado').length;
  const pendentes = total - entregues;

  doc.setFillColor(241, 245, 249);
  doc.rect(0, 32, pageW, 18, 'F');

  const cols = [
    { label: 'Total de Vendas', value: String(total) },
    { label: 'Entregues/Retirados', value: String(entregues) },
    { label: 'Em Andamento', value: String(pendentes) },
  ];
  const colW = pageW / cols.length;
  cols.forEach((c, i) => {
    const cx = colW * i + colW / 2;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text(c.value, cx, 43, { align: 'center' });
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(c.label.toUpperCase(), cx, 47, { align: 'center' });
  });

  // ─── Table ────────────────────────────────────────────────────────────────
  const rows = sales.map((s, idx) => {
    const lines = s.message.split('\n');
    const header = lines[0] || '';
    const body = lines.slice(1).join(' ') || s.message;

    const vendMatch = header.match(/Vendedor:\s*([^|]+)/);
    const vendedor = vendMatch ? vendMatch[1].trim() : '—';

    const clienteMatch = header.match(/Cliente:\s*([^|]+)/);
    const cliente = clienteMatch ? clienteMatch[1].trim() : '—';

    const notaMatch = header.match(/Nota:\s*([^|]+)/);
    const nota = notaMatch ? notaMatch[1].trim() : '—';

    return [
      String(idx + 1),
      vendedor,
      cliente,
      nota,
      body.length > 60 ? body.substring(0, 57) + '...' : body,
      STATUS_MAP[s.status] ?? s.status,
      format(new Date(s.created_at), 'HH:mm'),
    ];
  });

  autoTable(doc, {
    startY: 56,
    head: [['#', 'Vendedor', 'Cliente', 'Nota', 'Produto/Descrição', 'Status', 'Hora']],
    body: rows,
    styles: {
      fontSize: 8,
      cellPadding: 3,
      lineColor: [226, 232, 240] as [number, number, number],
      lineWidth: 0.3,
    },
    headStyles: {
      fillColor: [30, 41, 59] as [number, number, number],
      textColor: [255, 255, 255] as [number, number, number],
      fontStyle: 'bold',
      fontSize: 8,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252] as [number, number, number],
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 28 },
      2: { cellWidth: 28 },
      3: { cellWidth: 18 },
      4: { cellWidth: 'auto' },
      5: { cellWidth: 28, halign: 'center' },
      6: { cellWidth: 14, halign: 'center' },
    },
    margin: { left: 14, right: 14 },
  });

  // ─── Footer ───────────────────────────────────────────────────────────────
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pageH = doc.internal.pageSize.getHeight();
    doc.setDrawColor(226, 232, 240);
    doc.line(14, pageH - 14, pageW - 14, pageH - 14);
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.setFont('helvetica', 'normal');
    doc.text('Desenvolvido por SANZONY TECH™', 14, pageH - 8);
    doc.text(`Página ${i} de ${pageCount}`, pageW - 14, pageH - 8, { align: 'right' });
  }

  const filename = `torres-vendas-${format(date, 'yyyy-MM-dd')}.pdf`;
  doc.save(filename);
}
