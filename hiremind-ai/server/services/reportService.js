const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");
const { BEHAVIOR_ASSESSMENT_QUESTIONS, CATEGORY_LABELS } = require("../data/behaviorAssessmentQuestions");
const { LIKERT_LABELS } = require("./assessmentService");

async function generateReport(candidate, interview, assessment) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const dir = path.join("uploads", "reports");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const filename = `report_${candidate.userId}_${Date.now()}.pdf`;
    const filePath = path.join(dir, filename);
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    const W = 595 - 100;

    doc.rect(0, 0, 595, 80).fill("#0D1B2A");
    doc.fillColor("white").fontSize(22).font("Helvetica-Bold").text("HireMind AI", 50, 20);
    doc.fontSize(11).font("Helvetica").fillColor("#B0BEC5").text("Candidate Assessment Report", 50, 48);
    doc.fillColor("#B0BEC5").fontSize(9).text(`Generated: ${new Date().toLocaleDateString()}`, 400, 30);
    doc.moveDown(3);

    doc.fillColor("#0D1B2A").fontSize(14).font("Helvetica-Bold").text("Candidate Information");
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke("#BDBDBD");
    doc.moveDown(0.5);
    [
      ["Name", candidate.parsedResume?.name || "N/A"],
      ["Email", candidate.parsedResume?.email || "N/A"],
      ["Applied Role", candidate.selectedRole],
      ["Date", new Date().toLocaleDateString()],
    ].forEach(([k, v]) => {
      doc.fontSize(10).font("Helvetica-Bold").fillColor("#555").text(`${k}: `, { continued: true });
      doc.font("Helvetica").fillColor("#212121").text(v);
    });
    doc.moveDown();

    doc.fontSize(14).font("Helvetica-Bold").fillColor("#0D1B2A").text("Score Summary");
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke("#BDBDBD");
    doc.moveDown(0.5);
    const fs2 = interview.finalScores || {};
    [
      ["ATS Score", fs2.atsScore, "#1E88E5"],
      ["Technical Interview", fs2.technicalScore, "#27AE60"],
      ["Behavioral Interview", fs2.behavioralScore, "#FF6F00"],
      ["Communication", fs2.commScore, "#6A1B9A"],
      ["Workplace Readiness", fs2.workplaceReadinessScore, "#00897B"],
      ["FINAL SCORE", fs2.finalScore, "#0D1B2A"],
    ].forEach(([label, score, color]) => {
      const y = doc.y;
      doc.fontSize(10).font("Helvetica-Bold").fillColor("#555").text(label, 50, y);
      doc.rect(200, y + 2, W - 150, 12).fill("#EEEEEE");
      doc.rect(200, y + 2, Math.min((Number(score) || 0) / 100 * (W - 150), W - 150), 12).fill(color);
      doc.fillColor(color).font("Helvetica-Bold").text(`${score ?? 0}%`, 510, y);
      doc.moveDown(0.8);
    });
    doc.moveDown();

    const recColors = {
      "Highly Recommended": "#1E88E5",
      "Recommended": "#27AE60",
      "Consider with Training": "#FF6F00",
      "Not Recommended": "#C62828",
      "Needs Improvement": "#C62828",
    };
    const rec = interview.recommendation || "Recommended";
    doc.rect(50, doc.y, W, 40).fill(recColors[rec] || "#1E88E5");
    doc.fillColor("white").fontSize(14).font("Helvetica-Bold").text(`Recommendation: ${rec}`, 60, doc.y - 28);
    doc.moveDown(2);

    if (interview.psychIndicators) {
      doc.fontSize(14).font("Helvetica-Bold").fillColor("#0D1B2A").text("Workplace Indicators (Interview AI)");
      doc.fontSize(8).font("Helvetica").fillColor("#757575").text("Workplace suitability signals only — not a clinical or mental-health evaluation.");
      doc.moveDown(0.3);
      Object.entries(interview.psychIndicators.toObject ? interview.psychIndicators.toObject() : interview.psychIndicators).forEach(([k, v]) => {
        if (["summary", "behavioral", "workplaceReadiness"].includes(k) || typeof v === "object") return;
        doc.fontSize(10).font("Helvetica-Bold").fillColor("#555").text(`${k}: `, { continued: true });
        doc.font("Helvetica").fillColor("#212121").text(String(v));
      });
      doc.moveDown();
    }

    if (assessment?.indicators) {
      doc.fontSize(14).font("Helvetica-Bold").fillColor("#0D1B2A").text("Workplace Readiness Indicators (Self-Assessment)");
      doc.fontSize(8).font("Helvetica").fillColor("#757575").text("Based on candidate self-report. Not a medical or psychological diagnosis.");
      doc.moveDown(0.3);
      Object.entries(assessment.indicators).forEach(([k, v]) => {
        doc.fontSize(10).font("Helvetica-Bold").fillColor("#555").text(`${k}: `, { continued: true });
        doc.font("Helvetica").fillColor("#212121").text(String(v));
      });
      doc.moveDown();
    }

    if (assessment) {
      doc.addPage();
      doc.fontSize(16).font("Helvetica-Bold").fillColor("#0D1B2A").text("Workplace Readiness Assessment");
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke("#BDBDBD");
      doc.moveDown(0.5);
      doc.fontSize(11).font("Helvetica-Bold").text(`Overall Score: ${assessment.overallScore}/100`);
      doc.moveDown(0.5);

      if (assessment.categoryScores) {
        doc.fontSize(12).font("Helvetica-Bold").text("Category Scores");
        doc.moveDown(0.3);
        Object.entries(assessment.categoryScores).forEach(([cat, score]) => {
          doc.fontSize(10).font("Helvetica").text(`${CATEGORY_LABELS[cat] || cat}: ${score}%`);
        });
        doc.moveDown();
      }

      doc.fontSize(12).font("Helvetica-Bold").text("Question Responses");
      doc.moveDown(0.3);
      const answerMap = Object.fromEntries((assessment.answers || []).map((a) => [a.questionId, a.value]));
      BEHAVIOR_ASSESSMENT_QUESTIONS.forEach((q) => {
        const val = answerMap[q.id];
        const label = LIKERT_LABELS[val] || "—";
        doc.fontSize(9).font("Helvetica-Bold").fillColor("#424242").text(`Q${q.id}. ${q.text}`);
        doc.fontSize(9).font("Helvetica").fillColor("#212121").text(`   Response: ${val ?? "—"} (${label})`);
        doc.moveDown(0.2);
      });
    }

    const brief = interview.decisionBrief;
    if (brief && (brief.strengths?.length || brief.weaknesses?.length || brief.interviewSummary)) {
      doc.addPage();
      doc.fillColor("#0D1B2A").fontSize(16).font("Helvetica-Bold").text("Recruiter Brief");
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke("#BDBDBD");
      doc.moveDown();
      doc.fontSize(11).font("Helvetica-Bold").text(`Hiring Confidence Score: ${brief.hiringConfidenceScore || 0}/100`);
      doc.moveDown(0.5);
      const block = (title, items) => {
        if (!items?.length) return;
        doc.fontSize(12).font("Helvetica-Bold").fillColor("#0D1B2A").text(title);
        doc.fontSize(10).font("Helvetica").fillColor("#212121");
        items.forEach((s) => doc.text("• " + s));
        doc.moveDown(0.5);
      };
      block("Strengths", brief.strengths);
      block("Weaknesses", brief.weaknesses);
      block("Missing Skills", brief.missingSkills);
      if (brief.riskFactors?.length) {
        doc.fontSize(12).font("Helvetica-Bold").fillColor("#C62828").text("Risk Factors");
        doc.fontSize(10).font("Helvetica").fillColor("#212121");
        brief.riskFactors.forEach((r) => doc.text(`• ${r.code}: ${r.detail}`));
        doc.moveDown(0.5);
      }
      if (brief.interviewSummary) {
        doc.fontSize(12).font("Helvetica-Bold").fillColor("#0D1B2A").text("Summary");
        doc.fontSize(10).font("Helvetica-Oblique").fillColor("#424242").text(brief.interviewSummary, { align: "justify" });
      }
    }

    doc.end();
    stream.on("finish", () => resolve(filePath));
    stream.on("error", reject);
  });
}

module.exports = { generateReport };
