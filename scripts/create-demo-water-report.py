from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    HRFlowable,
    Image,
    KeepTogether,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
ASSET_DIR = ROOT / "public" / "demo-evidence"
OUTPUT = ASSET_DIR / "04-community-water-quality-report.pdf"
PHOTO = ASSET_DIR / "03-community-water-sampling.png"

FOREST = colors.HexColor("#173D2D")
INK = colors.HexColor("#17261F")
MUTED = colors.HexColor("#65736B")
LINE = colors.HexColor("#DDE4DB")
PAPER = colors.HexColor("#F5F6F0")
LIME = colors.HexColor("#C9F25D")
RED = colors.HexColor("#B64A3F")
RED_SOFT = colors.HexColor("#FBE9E5")
GREEN_SOFT = colors.HexColor("#EAF2E7")


class GroundTruthReport(BaseDocTemplate):
    def __init__(self, filename: str):
        super().__init__(
            filename,
            pagesize=letter,
            leftMargin=0.62 * inch,
            rightMargin=0.62 * inch,
            topMargin=0.72 * inch,
            bottomMargin=0.62 * inch,
            title="GroundTruth Simulated Community Water Quality Report",
            author="GroundTruth Demo Team",
            subject="Synthetic evidence file for a blockchain hackathon demonstration",
        )
        frame = Frame(
            self.leftMargin,
            self.bottomMargin,
            self.width,
            self.height,
            id="normal",
        )
        self.addPageTemplates(PageTemplate(id="main", frames=[frame], onPage=self.draw_page))

    def draw_page(self, canvas, doc):
        canvas.saveState()
        canvas.setFillColor(FOREST)
        canvas.rect(0, letter[1] - 0.34 * inch, letter[0], 0.34 * inch, fill=1, stroke=0)
        canvas.setFillColor(LIME)
        canvas.circle(0.35 * inch, letter[1] - 0.17 * inch, 0.07 * inch, fill=1, stroke=0)
        canvas.setFillColor(colors.white)
        canvas.setFont("Helvetica-Bold", 9)
        canvas.drawString(0.51 * inch, letter[1] - 0.205 * inch, "GROUNDTRUTH")
        canvas.setFont("Helvetica", 7)
        canvas.drawRightString(letter[0] - 0.45 * inch, letter[1] - 0.205 * inch, "SIMULATED DEMO DOCUMENT")

        canvas.setStrokeColor(LINE)
        canvas.line(0.62 * inch, 0.42 * inch, letter[0] - 0.62 * inch, 0.42 * inch)
        canvas.setFillColor(MUTED)
        canvas.setFont("Helvetica", 6.5)
        canvas.drawString(0.62 * inch, 0.25 * inch, "GT-WQ-2026-08-27-001 | Synthetic data - no regulatory or scientific use")
        canvas.drawRightString(letter[0] - 0.62 * inch, 0.25 * inch, f"Page {doc.page}")
        canvas.restoreState()


styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name="Kicker", fontName="Helvetica-Bold", fontSize=7.5, leading=10, textColor=MUTED, spaceAfter=6, uppercase=True))
styles.add(ParagraphStyle(name="TitleGT", fontName="Helvetica-Bold", fontSize=23, leading=25, textColor=INK, spaceAfter=8))
styles.add(ParagraphStyle(name="SubtitleGT", fontName="Helvetica", fontSize=9.5, leading=14, textColor=MUTED, spaceAfter=14))
styles.add(ParagraphStyle(name="H2GT", fontName="Helvetica-Bold", fontSize=13, leading=16, textColor=INK, spaceBefore=12, spaceAfter=7))
styles.add(ParagraphStyle(name="H3GT", fontName="Helvetica-Bold", fontSize=9, leading=12, textColor=INK, spaceBefore=8, spaceAfter=4))
styles.add(ParagraphStyle(name="BodyGT", fontName="Helvetica", fontSize=8.3, leading=12.5, textColor=INK, spaceAfter=7))
styles.add(ParagraphStyle(name="SmallGT", fontName="Helvetica", fontSize=7, leading=10, textColor=MUTED))
styles.add(ParagraphStyle(name="WhiteSmall", fontName="Helvetica-Bold", fontSize=7.2, leading=10, textColor=colors.white))
styles.add(ParagraphStyle(name="AlertTitle", fontName="Helvetica-Bold", fontSize=10, leading=12, textColor=RED, spaceAfter=3))
styles.add(ParagraphStyle(name="AlertBody", fontName="Helvetica", fontSize=7.5, leading=10.5, textColor=colors.HexColor("#714D48")))
styles.add(ParagraphStyle(name="CenterSmall", fontName="Helvetica", fontSize=6.7, leading=9, alignment=TA_CENTER, textColor=MUTED))
styles.add(ParagraphStyle(name="RightSmall", fontName="Helvetica", fontSize=7, leading=9, alignment=TA_RIGHT, textColor=MUTED))


def p(text, style="BodyGT"):
    return Paragraph(text, styles[style])


def info_table():
    rows = [
        [p("PROJECT", "Kicker"), p("REPORT ID", "Kicker"), p("ISSUE DATE", "Kicker")],
        [p("North Ridge Development Site", "BodyGT"), p("GT-WQ-2026-08-27-001", "BodyGT"), p("August 27, 2026", "BodyGT")],
        [p("REQUESTING PARTY", "Kicker"), p("SAMPLE DATE", "Kicker"), p("STATUS", "Kicker")],
        [p("Authorized Community Representative", "BodyGT"), p("August 24, 2026", "BodyGT"), p("Final - Simulation Only", "BodyGT")],
    ]
    table = Table(rows, colWidths=[2.65 * inch, 2.1 * inch, 1.45 * inch], hAlign="LEFT")
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.white),
        ("BOX", (0, 0), (-1, -1), 0.5, LINE),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, LINE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 9),
        ("RIGHTPADDING", (0, 0), (-1, -1), 9),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    return table


def alert_box():
    content = [
        p("DEMO FINDING: SCREENING THRESHOLD EXCEEDANCES", "AlertTitle"),
        p(
            "Illustrative results for lead, cadmium, and arsenic exceed the fictional screening thresholds used in this demo. "
            "These values support a community dispute and automatically pause the simulated restoration bond release.",
            "AlertBody",
        ),
    ]
    table = Table([[content]], colWidths=[6.2 * inch])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), RED_SOFT),
        ("BOX", (0, 0), (-1, -1), 0.8, colors.HexColor("#E1A49C")),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
        ("RIGHTPADDING", (0, 0), (-1, -1), 12),
        ("TOPPADDING", (0, 0), (-1, -1), 9),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
    ]))
    return table


def results_table():
    header = ["Analyte", "Result", "Demo threshold", "Unit", "Flag"]
    data = [
        ["Lead", "0.028", "0.010", "mg/L", "EXCEEDS"],
        ["Cadmium", "0.0068", "0.0010", "mg/L", "EXCEEDS"],
        ["Arsenic", "0.014", "0.010", "mg/L", "EXCEEDS"],
        ["Copper", "0.004", "0.020", "mg/L", "Within"],
        ["Zinc", "0.031", "0.120", "mg/L", "Within"],
        ["Mercury", "<0.0002", "0.001", "mg/L", "Within"],
    ]
    table = Table([header] + data, colWidths=[1.35 * inch, 1.05 * inch, 1.35 * inch, 0.8 * inch, 1.1 * inch], repeatRows=1)
    style = [
        ("BACKGROUND", (0, 0), (-1, 0), FOREST),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 7.4),
        ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
        ("TEXTCOLOR", (0, 1), (-1, -1), INK),
        ("GRID", (0, 0), (-1, -1), 0.45, LINE),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (1, 1), (-2, -1), "RIGHT"),
        ("ALIGN", (-1, 1), (-1, -1), "CENTER"),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ]
    for row in range(1, 4):
        style.extend([
            ("BACKGROUND", (0, row), (-1, row), RED_SOFT),
            ("TEXTCOLOR", (-1, row), (-1, row), RED),
            ("FONTNAME", (-1, row), (-1, row), "Helvetica-Bold"),
        ])
    for row in range(4, 7):
        style.append(("BACKGROUND", (0, row), (-1, row), colors.white if row % 2 else PAPER))
    table.setStyle(TableStyle(style))
    return table


def chain_table():
    data = [
        ["Sample ID", "Location", "Matrix", "Collection", "Condition"],
        ["NR-DSB-01", "Downstream reach B", "Surface water", "Aug 24, 09:42", "Accepted"],
        ["NR-DSB-DUP", "Field duplicate", "Surface water", "Aug 24, 09:45", "Accepted"],
        ["NR-FB-01", "Field blank", "Reagent water", "Aug 24, 10:10", "Accepted"],
    ]
    table = Table(data, colWidths=[1.15 * inch, 1.75 * inch, 1.15 * inch, 1.25 * inch, 0.9 * inch])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), FOREST),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 7),
        ("GRID", (0, 0), (-1, -1), 0.45, LINE),
        ("BACKGROUND", (0, 1), (-1, -1), colors.white),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    return table


story = []
story.extend([
    Spacer(1, 0.06 * inch),
    p("COMMUNITY SUPPORTING EVIDENCE", "Kicker"),
    p("Simulated Water Quality Screening Report", "TitleGT"),
    p(
        "Prepared for the GroundTruth dynamic restoration bond demonstration. "
        "All organizations, samples, methods, thresholds, and results in this document are fictional.",
        "SubtitleGT",
    ),
    info_table(),
    Spacer(1, 0.16 * inch),
    alert_box(),
    p("Analytical summary", "H2GT"),
    results_table(),
    Spacer(1, 0.07 * inch),
    p(
        "The demo threshold is an illustrative application rule and is not a regulatory standard. "
        "No health, environmental, compliance, or remediation conclusion may be drawn from these synthetic values.",
        "SmallGT",
    ),
    p("Recommended demo action", "H2GT"),
    p(
        "Open a community dispute targeting liability decision revision 03. Attach this report and its SHA-256 hash. "
        "The GroundTruth program should increment the active dispute count and pause bond release in the same transaction.",
        "BodyGT",
    ),
    Table(
        [[p("PROGRAM DISPLAY", "WhiteSmall"), p("DISPUTED / RELEASE_PAUSED", "WhiteSmall")]],
        colWidths=[1.4 * inch, 4.8 * inch],
        style=TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), FOREST),
            ("BOX", (0, 0), (-1, -1), 0.6, FOREST),
            ("LEFTPADDING", (0, 0), (-1, -1), 10),
            ("RIGHTPADDING", (0, 0), (-1, -1), 10),
            ("TOPPADDING", (0, 0), (-1, -1), 8),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ("ALIGN", (1, 0), (1, 0), "RIGHT"),
        ]),
    ),
    Spacer(1, 0.18 * inch),
    HRFlowable(width="100%", thickness=0.5, color=LINE),
    p("This page is part of a synthetic hackathon dataset. It is not a certificate of analysis.", "CenterSmall"),
])

story.extend([
    PageBreak(),
    p("FIELD RECORD", "Kicker"),
    p("Sampling context and custody", "TitleGT"),
    Image(str(PHOTO), width=6.2 * inch, height=4.133 * inch),
    Spacer(1, 0.08 * inch),
    p("Simulated collection photograph. The image contains no real sample location or identifiable field personnel.", "CenterSmall"),
    p("Sample custody", "H2GT"),
    chain_table(),
    p("Field observations", "H2GT"),
    p(
        "Water appeared clear to slightly turbid following light rainfall. No visible sheen, odour, or acute biological stress was recorded. "
        "The absence of visible pollution does not establish chemical safety. Observations and values are included solely to support the demo workflow.",
        "BodyGT",
    ),
    KeepTogether([
        p("Illustrative method notes", "H2GT"),
        p(
            "Metals are presented as if measured by ICP-MS following preservation and digestion. Field duplicate agreement and blank results are shown as acceptable for demonstration purposes. "
            "These method labels do not represent work performed by an accredited laboratory.",
            "BodyGT",
        ),
    ]),
    Table(
        [[p("IMPORTANT", "WhiteSmall"), p("Synthetic evidence - not for scientific, legal, regulatory, or health decisions", "WhiteSmall")]],
        colWidths=[0.95 * inch, 5.25 * inch],
        style=TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), RED),
            ("LEFTPADDING", (0, 0), (-1, -1), 10),
            ("RIGHTPADDING", (0, 0), (-1, -1), 10),
            ("TOPPADDING", (0, 0), (-1, -1), 8),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ("ALIGN", (1, 0), (1, 0), "RIGHT"),
        ]),
    ),
])


OUTPUT.parent.mkdir(parents=True, exist_ok=True)
GroundTruthReport(str(OUTPUT)).build(story)
print(OUTPUT)
