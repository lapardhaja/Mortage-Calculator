import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function absMonthToDate(absMonth, startYear, startMonth1) {
  const totalM = startMonth1 - 1 + absMonth - 1;
  return { year: startYear + Math.floor(totalM / 12), month: totalM % 12 };
}

function formatYearsMonths(totalMonths) {
  const y = Math.floor(totalMonths / 12);
  const m = totalMonths % 12;
  const parts = [];
  if (y > 0) parts.push(`${y} year${y === 1 ? "" : "s"}`);
  if (m > 0) parts.push(`${m} month${m === 1 ? "" : "s"}`);
  if (parts.length === 0) return "0 months";
  return parts.join(" ");
}

function fmt(n) {
  return "$" + Math.round(n).toLocaleString("en-US");
}

/**
 * Builds a letter-size PDF and triggers browser download.
 * @param {object} p
 */
export function downloadMortgagePdf(p) {
  const {
    purchasePrice,
    downAmount,
    downPercent,
    principal,
    rate,
    term,
    startYear,
    startMonth,
    payoffDate,
    periods,
    base,
    withExtra,
    savedInt,
    savedY,
    savedMoR,
    totalExtra,
  } = p;

  const startLabel = `${MONTHS[startMonth]} ${startYear}`;
  const payoffLabel = `${MONTHS[payoffDate.month]} ${payoffDate.year} (${formatYearsMonths(withExtra.months)})`;
  const basePayoff = absMonthToDate(base.months, startYear, startMonth + 1);
  const basePayoffLabel = `${MONTHS[basePayoff.month]} ${basePayoff.year} (${formatYearsMonths(base.months)})`;
  const roi = totalExtra > 0 ? ((savedInt / totalExtra) * 100).toFixed(0) : "0";
  const termActual = `${Math.floor(withExtra.months / 12)}y ${withExtra.months % 12}m`;
  const totalPaidWithExtra = base.pmt * withExtra.months + totalExtra;

  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const margin = 48;
  let y = margin;

  const navy = [13, 27, 46];
  const cyan = [14, 165, 233];

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...navy);
  doc.text("Mortgage analysis report", margin, y);
  y += 26;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);
  doc.text(
    `Generated ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`,
    margin,
    y
  );
  y += 24;
  doc.setTextColor(0, 0, 0);

  autoTable(doc, {
    startY: y,
    head: [["Loan details", ""]],
    body: [
      ["Purchase price", fmt(purchasePrice)],
      ["Down payment", `${fmt(downAmount)} (${downPercent}%)`],
      ["Loan amount", fmt(principal)],
      ["Interest rate (annual)", `${rate}%`],
      ["Contract term", `${term} years`],
      ["First payment month", startLabel],
      ["Scheduled P&I payment", fmt(base.pmt)],
    ],
    theme: "striped",
    headStyles: { fillColor: navy, textColor: [255, 255, 255], fontStyle: "bold" },
    styles: { fontSize: 9, cellPadding: 5 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 150 } },
    margin: { left: margin, right: margin },
  });
  y = doc.lastAutoTable.finalY + 18;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...navy);
  doc.text("Scenario comparison", margin, y);
  y += 14;

  const compareBody = [
    ["Total interest paid", fmt(base.totalInterest), fmt(withExtra.totalInterest)],
    ["Total cash out (incl. extra principal)", fmt(base.pmt * base.months), fmt(totalPaidWithExtra)],
    ["Extra principal paid", "—", fmt(totalExtra)],
    ["Payoff date", basePayoffLabel, payoffLabel],
    ["Loan duration", `${term} y (${base.months} mo)`, `${termActual} (${withExtra.months} mo)`],
    ["Interest saved vs no extras", "—", fmt(savedInt)],
    ["Time saved", "—", `${savedY}y ${savedMoR}m`],
  ];
  if (totalExtra > 0) {
    compareBody.push(["Effective return on extra (saved interest / extra paid)", "—", `${roi}%`]);
  }

  autoTable(doc, {
    startY: y,
    head: [["Metric", "No extra payments", "Your plan"]],
    body: compareBody,
    theme: "striped",
    headStyles: { fillColor: cyan, textColor: [15, 23, 42], fontStyle: "bold" },
    styles: { fontSize: 8, cellPadding: 4 },
    margin: { left: margin, right: margin },
  });
  y = doc.lastAutoTable.finalY + 18;

  const equityRows = [25, 50, 75, 100]
    .map((pct) => {
      const targetBal = principal * (1 - pct / 100);
      const mHit = withExtra.schedule.find((r) => r.balance <= targetBal);
      const bHit = base.schedule.find((r) => r.balance <= targetBal);
      if (!mHit) return null;
      const d = absMonthToDate(mHit.month, startYear, startMonth + 1);
      const saved = (bHit ? Math.floor(bHit.month / 12) : term) - Math.floor(mHit.month / 12);
      return [
        pct === 100 ? "Loan paid off" : `${pct}% of original principal`,
        pct === 100 ? "$0 remaining" : fmt(principal * (pct / 100)),
        `${MONTHS[d.month]} ${d.year}`,
        saved > 0 ? `${saved} y vs baseline` : "—",
      ];
    })
    .filter(Boolean);

  if (equityRows.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...navy);
    doc.text("Equity milestones (your payment plan)", margin, y);
    y += 14;
    autoTable(doc, {
      startY: y,
      head: [["Milestone", "About this balance", "Reached", "Ahead of baseline"]],
      body: equityRows,
      theme: "striped",
      headStyles: { fillColor: navy, textColor: [255, 255, 255] },
      styles: { fontSize: 8, cellPadding: 4 },
      margin: { left: margin, right: margin },
    });
    y = doc.lastAutoTable.finalY + 18;
  }

  if (periods.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...navy);
    doc.text("Extra payment periods", margin, y);
    y += 14;
    const periodBody = periods.map((p, i) => {
      const capTo = Math.min(p.toAbs, withExtra.months);
      const capFrom = Math.min(p.fromAbs, withExtra.months);
      const dur = Math.max(0, capTo - capFrom + 1);
      const fd = absMonthToDate(capFrom, startYear, startMonth + 1);
      const td = absMonthToDate(capTo, startYear, startMonth + 1);
      return [
        String(i + 1),
        `${MONTHS[fd.month]} ${fd.year}`,
        `${MONTHS[td.month]} ${td.year}`,
        String(dur),
        fmt(p.amount),
        fmt(dur * p.amount),
      ];
    });
    autoTable(doc, {
      startY: y,
      head: [["#", "From", "To", "Months", "Per month", "Total extra"]],
      body: periodBody,
      theme: "striped",
      headStyles: { fillColor: navy, textColor: [255, 255, 255] },
      styles: { fontSize: 8, cellPadding: 3 },
      margin: { left: margin, right: margin },
    });
    y = doc.lastAutoTable.finalY + 18;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...navy);
  doc.text("First 12 payments (detail)", margin, y);
  y += 14;

  const first12 = withExtra.schedule.slice(0, 12).map((r) => {
    const d = absMonthToDate(r.month, startYear, startMonth + 1);
    return [
      `${MONTHS[d.month]} ${d.year}`,
      fmt(base.pmt),
      fmt(r.principal),
      fmt(r.interest),
      r.extra > 0 ? fmt(r.extra) : "—",
      fmt(r.balance),
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [["Month", "P&I", "Principal", "Interest", "Extra", "Balance"]],
    body: first12,
    theme: "striped",
    headStyles: { fillColor: navy, textColor: [255, 255, 255] },
    styles: { fontSize: 7, cellPadding: 3 },
    margin: { left: margin, right: margin },
  });
  y = doc.lastAutoTable.finalY + 18;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...navy);
  doc.text("Year-end summary (remaining loan)", margin, y);
  y += 14;

  const yearEndRows = withExtra.schedule
    .filter((r) => r.month % 12 === 0 || r.month === withExtra.months)
    .slice(0, 45)
    .map((r) => [
      `Year ${r.year}`,
      fmt(base.pmt),
      fmt(r.principal),
      fmt(r.interest),
      r.extra > 0 ? fmt(r.extra) : "—",
      fmt(r.balance),
    ]);

  autoTable(doc, {
    startY: y,
    head: [["Year", "P&I", "Principal", "Interest", "Extra", "Balance"]],
    body: yearEndRows,
    theme: "striped",
    headStyles: { fillColor: navy, textColor: [255, 255, 255] },
    styles: { fontSize: 7, cellPadding: 3 },
    margin: { left: margin, right: margin },
  });
  y = doc.lastAutoTable.finalY + 16;

  const pageH = doc.internal.pageSize.getHeight();
  if (y > pageH - 100) {
    doc.addPage();
    y = margin;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...navy);
  doc.text("Insights", margin, y);
  y += 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  const insight =
    totalExtra > 0
      ? `You plan to pay ${fmt(totalExtra)} in extra principal. That removes ${fmt(savedInt)} of interest versus scheduled payments only and shortens the loan by ${savedY} years and ${savedMoR} months. Payoff moves from ${basePayoffLabel} to ${payoffLabel}.`
      : `Scheduled payment ${fmt(base.pmt)}/month with no extras: about ${fmt(base.totalInterest)} interest through payoff ${basePayoffLabel} (${base.months} months).`;
  const insightLines = doc.splitTextToSize(insight, doc.internal.pageSize.getWidth() - margin * 2);
  doc.text(insightLines, margin, y);
  y += insightLines.length * 12 + 14;

  if (y > pageH - 72) {
    doc.addPage();
    y = margin;
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(90, 90, 90);
  const disc =
    "Illustration only: level fixed rate, no PMI/taxes/insurance/fees; extra payments applied to principal as modeled. Not tax or legal advice — confirm with your lender and advisors.";
  const lines = doc.splitTextToSize(disc, doc.internal.pageSize.getWidth() - margin * 2);
  doc.text(lines, margin, y);

  const fname = `mortgage-analysis-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(fname);
}
