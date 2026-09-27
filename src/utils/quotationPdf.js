import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../firebase";

// Global constants
const PAGE_COUNT = 8;
const PAGE_WIDTH = 595.3;
const PAGE_HEIGHT = 841.9;
const MARGIN_X = 44;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;

function safeText(value, fallback = "") {
    return String(value || fallback).trim();
}

function formatDate(date = new Date()) {
    return date.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

function formatFileDate(date = new Date()) {
    return date.toISOString().slice(0, 10);
}

function sanitizeFileName(value) {
    return safeText(value, "Lead").replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "");
}

function toNumber(value) {
    const match = String(value || "").replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
    return match ? parseFloat(match[0]) : 0;
}

export function numberToWords(n) {
    if (!n || isNaN(n)) return "";
    const num = Math.round(n);
    const ones = ["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
    const tens = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
    function words(value) {
        if (value < 20) return ones[value];
        if (value < 100) return tens[Math.floor(value / 10)] + (value % 10 ? " " + ones[value % 10] : "");
        if (value < 1000) return ones[Math.floor(value / 100)] + " Hundred" + (value % 100 ? " " + words(value % 100) : "");
        if (value < 100000) return words(Math.floor(value / 1000)) + " Thousand" + (value % 1000 ? " " + words(value % 1000) : "");
        if (value < 10000000) return words(Math.floor(value / 100000)) + " Lakh" + (value % 100000 ? " " + words(value % 100000) : "");
        return words(Math.floor(value / 10000000)) + " Crore" + (value % 10000000 ? " " + words(value % 10000000) : "");
    }
    return words(num) + " Rupees Only";
}

function getFinancialGrandTotal(rows = []) {
    if (!Array.isArray(rows)) return 0;
    return rows.reduce((sum, row) => {
        const rate = toNumber(row?.[1]);
        const discount = toNumber(row?.[3]);
        const savedFinal = toNumber(row?.[4]);
        const finalAmount = rate || discount ? rate - discount : savedFinal;
        return sum + finalAmount;
    }, 0);
}

function getQuotationNo(lead, type) {
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const phone = safeText(lead.phone).replace(/\D/g, "");
    const suffix = phone.slice(-4) || String(Date.now()).slice(-4);
    return `Q${yy}${suffix}-${type.id ? type.id.toUpperCase().slice(0, 3) : "NEW"}`;
}

async function loadLogoDataUrl(settings) {
    if (settings && settings.logoImage) {
        return await loadImageDataUrl(settings.logoImage);
    }
    return await loadImageDataUrl("/logo.png");
}

const IMAGE_CACHE_MAX = 50;
const imageCache = {};

async function loadImageDataUrl(url) {
    if (!url) return null;
    if (imageCache[url]) return imageCache[url];

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error("Image not found: " + url);
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                // Evict oldest entry if cache is full
                const keys = Object.keys(imageCache);
                if (keys.length >= IMAGE_CACHE_MAX) {
                    delete imageCache[keys[0]];
                }
                imageCache[url] = reader.result;
                resolve(reader.result);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (err) {
        console.warn("Failed to load PDF image:", err);
        return null;
    }
}

function drawHeader(doc, pageNumber, logoDataUrl, settings) {
    if (pageNumber > 1) {
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.5);
        doc.line(MARGIN_X, 35, PAGE_WIDTH - MARGIN_X, 35);
        if (logoDataUrl) {
            doc.addImage(logoDataUrl, "PNG", MARGIN_X, 10, 20, 20);
        }
        return;
    }

    doc.setFillColor(248, 250, 252);
    doc.rect(0, 0, PAGE_WIDTH, 110, "F");

    if (logoDataUrl) {
        doc.addImage(logoDataUrl, "PNG", MARGIN_X, 20, 60, 60);
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(30, 58, 138);
    doc.text(settings.companyName || "", PAGE_WIDTH - MARGIN_X, 35, { align: "right" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(settings.companyAddress1 || "", PAGE_WIDTH - MARGIN_X, 50, { align: "right" });
    if (settings.companyAddress2) {
        doc.text(settings.companyAddress2, PAGE_WIDTH - MARGIN_X, 62, { align: "right" });
    }

    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    let certs = [];
    if (settings.gstin) certs.push(`GSTIN: ${settings.gstin}`);
    if (settings.udyam) certs.push(`UDYAM: ${settings.udyam}`);
    if (certs.length > 0) {
        doc.text(certs.join("  |  "), PAGE_WIDTH - MARGIN_X, 76, { align: "right" });
    }

    doc.setFillColor(37, 99, 235);
    doc.rect(0, 110, PAGE_WIDTH, 3, "F");
}

function drawFooter(doc, pageNumber, logoDataUrl, settings, pageCount = PAGE_COUNT) {
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(MARGIN_X, PAGE_HEIGHT - 45, PAGE_WIDTH - MARGIN_X, PAGE_HEIGHT - 45);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(37, 99, 235);
    // Use websiteUrl from settings if available, fall back to company default
    const websiteUrl = settings.websiteUrl || "https://www.vrsolartech.in/";
    doc.text(websiteUrl, MARGIN_X, PAGE_HEIGHT - 32);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    
    let contacts = [];
    if (settings.contact1Name || settings.contact1Phone) {
        contacts.push(`${settings.contact1Name || "Contact"}: ${settings.contact1Phone || ""}`.trim());
    }
    if (settings.contact2Name || settings.contact2Phone) {
        contacts.push(`${settings.contact2Name || "Contact"}: ${settings.contact2Phone || ""}`.trim());
    }
    if (contacts.length > 0) {
        doc.text(contacts.join("  |  "), PAGE_WIDTH / 2, PAGE_HEIGHT - 32, { align: "center" });
    }

    doc.setFont("helvetica", "italic");
    doc.setTextColor(148, 163, 184);
    doc.text(`Page ${pageNumber} of ${pageCount}`, PAGE_WIDTH - MARGIN_X, PAGE_HEIGHT - 32, { align: "right" });
}

function addPage(doc, pageNumber, logoDataUrl, settings, pageCount = PAGE_COUNT) {
    if (pageNumber > 1) doc.addPage();
    drawHeader(doc, pageNumber, logoDataUrl, settings);
    drawFooter(doc, pageNumber, logoDataUrl, settings, pageCount);
    return pageNumber === 1 ? 140 : 60;
}

function sectionTitle(doc, title, y) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(title, MARGIN_X, y);
    return y + 18;
}

function paragraph(doc, text, y, options = {}) {
    const width = options.width || CONTENT_WIDTH;
    const lineHeight = options.lineHeight || 13;
    const fontSize = options.fontSize || 9.5;
    const x = options.x || MARGIN_X;

    doc.setFont("helvetica", options.bold ? "bold" : "normal");
    doc.setFontSize(fontSize);
    doc.setTextColor(options.color || 51, options.colorG || 65, options.colorB || 85);

    const lines = doc.splitTextToSize(text, width);
    doc.text(lines, x, y);
    return y + lines.length * lineHeight + (options.after || 8);
}

function bulletList(doc, items, y) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(51, 65, 85);

    items.forEach((item) => {
        const lines = doc.splitTextToSize(item, CONTENT_WIDTH - 16);
        doc.text("-", MARGIN_X, y);
        doc.text(lines, MARGIN_X + 14, y);
        y += lines.length * 13 + 5;
    });

    return y + 4;
}

function drawImageBox(doc, title, y, imageDataUrl) {
    doc.setDrawColor(191, 219, 254);
    doc.setFillColor(239, 246, 255);
    doc.roundedRect(MARGIN_X, y, CONTENT_WIDTH, 160, 6, 6, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(37, 99, 235);
    doc.text(title, PAGE_WIDTH / 2, y + 20, { align: "center" });

    if (imageDataUrl) {
        // center image
        const imgWidth = 200;
        const imgHeight = 120;
        const imgX = PAGE_WIDTH / 2 - imgWidth / 2;
        doc.addImage(imageDataUrl, "PNG", imgX, y + 30, imgWidth, imgHeight);
    } else {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(71, 85, 105);
        doc.text("Diagram not available", PAGE_WIDTH / 2, y + 80, { align: "center" });
    }

    return y + 176;
}

function buildPageOne(doc, lead, type, logoDataUrl, settings, pageNumber = 1, pageCount = PAGE_COUNT) {
    let y = addPage(doc, pageNumber, logoDataUrl, settings, pageCount);
    const today = new Date();

    doc.setFont("helvetica", "bold");
    doc.setFontSize(28);
    doc.setTextColor(30, 58, 138);
    doc.text("QUOTATION", PAGE_WIDTH / 2, y, { align: "center" });
    y += 24;

    doc.setDrawColor(37, 99, 235);
    doc.setLineWidth(1.5);
    doc.line(PAGE_WIDTH / 2 - 40, y, PAGE_WIDTH / 2 + 40, y);
    y += 28;

    doc.setFontSize(9.5);
    doc.text(type.quotationNumber || `Quotation - ${getQuotationNo(lead, type)}`, MARGIN_X, y);
    doc.setFont("helvetica", "normal");
    doc.text(type.preparationDate || formatDate(today), PAGE_WIDTH - MARGIN_X, y, { align: "right" });
    y += 16;
    doc.text(`Issue Version - ${type.issueVersion || "V.1"}`, PAGE_WIDTH - MARGIN_X, y, { align: "right" });
    y += 28;

    const customerName = type.customerName || safeText(lead.name, "Customer");
    const place = safeText(lead.company || lead.source);
    const customerTo = type.customerTo || (place ? `${customerName}, ${place}` : customerName);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("To,", MARGIN_X, y);
    y += 16;
    doc.text(customerTo, MARGIN_X, y);
    y += 16;
    if (type.customerMobile || lead.phone) {
        doc.text(type.customerMobile || safeText(lead.phone), MARGIN_X, y);
        y += 26;
    }

    doc.setFont("helvetica", "bold");
    doc.text(`Project - ${type.projectTitle}`, MARGIN_X, y);
    y += 34;

    y = sectionTitle(doc, "Statement of Confidentiality", y);
    const cname = settings.companyName || "our company";
    const confText = type.confidentialityText || `These documents contain proprietary trade secret and confidential information to be used solely for evaluating ${cname}. The information contained herein is to be considered confidential. Customer, by receiving these documents agrees that neither this document nor the information disclosed herein, nor any part thereof, shall be reproduced or transferred to other documents or used or disclosed to others for any purpose except as specifically authorized in writing by ${cname}.`;
    y = paragraph(doc, confText, y, { lineHeight: 14 });

    y += 14;
    autoTable(doc, {
        startY: y,
        margin: { left: MARGIN_X, right: MARGIN_X },
        theme: "plain",
        body: [
            ["Project:-", type.projectName, "Prepared By:", type.preparedBy || settings.companyName || ""],
            ["Preparation Date:-", type.preparationDate || formatDate(today), "Quotation Type:", type.name],
        ],
        styles: { fontSize: 9.5, cellPadding: 4, textColor: [51, 65, 85] },
        columnStyles: {
            0: { fontStyle: "bold", cellWidth: 92 },
            1: { cellWidth: 170 },
            2: { fontStyle: "bold", cellWidth: 96 },
            3: { cellWidth: 150 },
        },
    });
}

function buildPageTwo(doc, type, logoDataUrl, settings, pageNumber = 2, pageCount = PAGE_COUNT) {
    let y = addPage(doc, pageNumber, logoDataUrl, settings, pageCount);
    y = paragraph(doc, "To,", y, { after: 4 });

    // Use introConfig if available, fall back to old intro string
    const cfg = type.introConfig;
    let salutation = "Respected Sir,";
    let introText = type.intro || "";

    if (cfg && cfg.capacities && cfg.capacities.length > 0) {
        salutation = cfg.salutation || "Respected Sir,";
        const UNITS_PER_KW_PER_YEAR = 4 * 365; // 1460
        const capParts = cfg.capacities.map(c => {
            const units = Math.round(c.kw * UNITS_PER_KW_PER_YEAR);
            return `(${c.kw} KW DC capacities to generate approx. ${units.toLocaleString("en-IN")} AC units respectively annually.)`;
        }).join(" ");
        const projectType = cfg.projectType || "Net-Metering based Rooftop PV Solar Power Plant";
        const closing = cfg.closing || "";
        introText = `We are delighted to present to you the quotation/proposal for a ${projectType} of ${capParts} ${closing}`.trim();
    }

    y = paragraph(doc, salutation, y, { after: 12 });
    y = paragraph(doc, introText, y, { lineHeight: 14 });


    const aboutText = type.aboutText !== undefined ? type.aboutText : settings.aboutText;
    if (aboutText) {
        y = sectionTitle(doc, "About us:-", y + 4);
        y = paragraph(doc, aboutText, y, { lineHeight: 14 });
    }

    const expertiseList = type.expertiseList !== undefined ? type.expertiseList : settings.expertiseList;
    if (expertiseList && expertiseList.length > 0) {
        y = paragraph(doc, "Our areas of expertise include the following:", y + 8, { bold: true, after: 8 });
        y = bulletList(doc, expertiseList, y);
    }

    y = paragraph(doc, type.whyUsTitle || "Why us:-", y + 12, { bold: true, after: 8 });
    y = paragraph(doc, type.whyUsText1 || "Top quality, maximum performance, and custom-made design.", y, { lineHeight: 14 });
    const companyName = settings.companyName || "Our company";
    y = paragraph(doc, type.whyUsText2 || `All components of a ${companyName} power plant are subject to the strictest testing requirements. The solar panels, invertors, and associated components are tested to withstand extreme environmental conditions to ensure reliability and maximum power output.`, y, { lineHeight: 14 });
    
    paragraph(doc, type.whyUsText3 || "Solar energy helps the country for better environment with Green Energy.", y + 8, { bold: true });
}

function buildPageThree(doc, type, logoDataUrl, diagramImageDataUrl, singleLineImageDataUrl, settings, pageNumber = 3, pageCount = PAGE_COUNT) {
    let y = addPage(doc, pageNumber, logoDataUrl, settings, pageCount);
    y = sectionTitle(doc, `How does ${type.projectName} work?`, y);
    y = drawImageBox(doc, type.diagramTitle, y + 8, diagramImageDataUrl);

    const text1 = type.howItWorksText1 || "The solar panels convert sunlight into electric energy, which is Direct Current (DC). This current is sent to an inverter or controller as per the system design. The power is then converted or regulated for useful consumption at the customer site.";
    const text2 = type.howItWorksText2 || "The generated power from the plant can fulfill the power requirement of the customer site during the daytime. The generated power is utilized, and surplus power is fed into the grid for later use.";
    const text3 = type.howItWorksText3 || "All electrical components will be tested in accordance with manufacturer instructions and project requirements before handover.";

    y = paragraph(doc, text1, y, { lineHeight: 14 });
    if (text2) y = paragraph(doc, text2, y, { lineHeight: 14 });
    if (text3) y = paragraph(doc, text3, y, { lineHeight: 14 });

    // Benefits section — merged into same page
    y = sectionTitle(doc, type.benefitsTitle || "Benefits", y + 10);
    y = bulletList(doc, type.benefits || [], y);
    y = sectionTitle(doc, "Single Line Diagram", y + 8);
    y = drawImageBox(doc, "SOLAR POWER SYSTEM FLOW", y + 8, singleLineImageDataUrl);
    // Track y properly to avoid printing below the page boundary
    y = paragraph(doc, "A Solar Power system consists of following main elements:", y, { bold: true, after: 8 });
    paragraph(doc, "Solar Panels | Mounting Structure | Inverter / Controller | Solar Cables & Connectors | Protection System | Distribution Box", y, { lineHeight: 14 });
}

function buildPageFour(doc, type, logoDataUrl, settings, pageNumber = 4, pageCount = PAGE_COUNT) {
    let y = addPage(doc, pageNumber, logoDataUrl, settings, pageCount);
    autoTable(doc, {
        startY: y,
        margin: { left: MARGIN_X, right: MARGIN_X },
        head: [["Parts / Material", "Make", "Specification"]],
        body: type.materialRows,
        styles: { fontSize: 8.5, cellPadding: 6, textColor: [51, 65, 85], lineColor: [226, 232, 240], lineWidth: 0.5 },
        headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255] },
    });

    y = doc.lastAutoTable.finalY + 20;
    y = sectionTitle(doc, "Material Reports:-", y);
    y = paragraph(doc, "Panels Data Sheet\nInverter / Equipment Test Certificate", y, { lineHeight: 14 });
    y = paragraph(doc, "All the material is approved as per applicable guidelines and selected for proper generation, safety, and long service life.", y, { lineHeight: 14 });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text("FINANCIAL OFFER", PAGE_WIDTH / 2, y + 16, { align: "center" });

    autoTable(doc, {
        startY: y + 32,
        margin: { left: MARGIN_X, right: MARGIN_X },
        head: [["Description", "Rate", "Total", "Discount", "Final"]],
        body: Array.isArray(type.financialRows) ? type.financialRows : [],
        styles: { fontSize: 8.5, cellPadding: 6, textColor: [51, 65, 85], lineColor: [226, 232, 240], lineWidth: 0.5 },
        headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255] },
        columnStyles: { 3: { fontStyle: "bold" }, 4: { fontStyle: "bold" } },
    });

    y = doc.lastAutoTable.finalY + 18;
    const grandTotal = getFinancialGrandTotal(type.financialRows);
    const typedAmount = toNumber(type.amountLabel);
    const displayTotal = typedAmount || grandTotal;
    const amountLabel = safeText(type.amountLabel) || (displayTotal > 0 ? `Rs. ${Math.round(displayTotal).toLocaleString("en-IN")}/-` : "");
    const amountWords = safeText(type.amountWords) || numberToWords(displayTotal);
    if (amountLabel) y = paragraph(doc, `TOTAL AMOUNT: - ${amountLabel}`, y, { bold: true, after: 8 });
    if (amountWords) y = paragraph(doc, `IN WORDS: - ${amountWords}`, y, { bold: true, after: 14 });
    y = paragraph(doc, "Note*: GST will be applied as per applicable government norms. All taxes, installation, structure, and service inclusions will follow the final agreed scope.", y, { lineHeight: 13 });
    paragraph(doc, "Note: Any additional fabrication charges will be paid extra as per changes if done or if required by clients.", y + 4, { lineHeight: 13 });
}

function buildPageFive(doc, type, logoDataUrl, settings, pageNumber = 5, pageCount = PAGE_COUNT) {
    let y = addPage(doc, pageNumber, logoDataUrl, settings, pageCount);
    y = sectionTitle(doc, "Return on Investment (ROI) & SIP Analysis", y);

    function toNum(v) { return parseFloat(String(v || "").replace(/,/g, "")) || 0; }
    const rows = Array.isArray(type.financialRows) ? type.financialRows : [];
    const quotedAmount  = rows.reduce((s, r) => { const rt = toNum(r[1]); const d = toNum(r[3]); return s + (rt - d); }, 0);
    const govtSubsidy   = toNum(type.govtSubsidy);
    const actualInvest  = Math.max(0, quotedAmount - govtSubsidy);
    const monthlyBill   = toNum(type.monthlyBill);
    const annualSavings = monthlyBill * 12;
    const paybackYears  = annualSavings > 0 ? actualInvest / annualSavings : 0;
    const pwY = Math.floor(paybackYears);
    const pwM = Math.round((paybackYears - pwY) * 12);
    const total25 = annualSavings * 25;
    const systemInfo = type.name || type.projectName || "Solar Power System";
    const fmt = n => Math.round(n).toLocaleString("en-IN");
    function toLakhs(n) {
        if (n >= 10000000) return `Rs.${(n/10000000).toFixed(1)} Crore`;
        if (n >= 100000) return `Rs.${(n/100000).toFixed(1)} Lakhs`;
        return `Rs.${fmt(n)}`;
    }

    // Summary Table
    autoTable(doc, {
        startY: y + 8,
        margin: { left: MARGIN_X, right: MARGIN_X },
        head: [["System Info", "Monthly Bill", "Quoted Amount", "Govt. Subsidy", "Actual Investment", "Estimated ROI"]],
        body: [[
            systemInfo,
            monthlyBill > 0 ? `Rs.${fmt(monthlyBill)}/month` : "Not provided",
            quotedAmount > 0 ? `Rs.${fmt(quotedAmount)}` : "—",
            govtSubsidy > 0 ? `Rs.${fmt(govtSubsidy)}` : "—",
            actualInvest > 0 ? `Rs.${fmt(actualInvest)}` : "—",
            annualSavings > 0 && actualInvest > 0 ? `${pwY} Year${pwY !== 1 ? "s" : ""} ${pwM} Month${pwM !== 1 ? "s" : ""}` : "—",
        ]],
        styles: { fontSize: 8.5, cellPadding: 7, textColor: [51, 65, 85], lineColor: [226, 232, 240], lineWidth: 0.5 },
        headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255], fontStyle: "bold" },
        columnStyles: {
            4: { fontStyle: "bold", textColor: [234, 88, 12] },
            5: { fontStyle: "bold", textColor: [37, 99, 235] },
        },
        alternateRowStyles: { fillColor: [239, 246, 255] },
    });

    y = doc.lastAutoTable.finalY + 18;

    if (monthlyBill > 0 && actualInvest > 0) {
        // Professional Savings Text
        doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(30, 64, 175);
        doc.text("Professional Savings Summary", MARGIN_X, y);
        y += 14;

        y = paragraph(doc, `After approximately ${pwY} Year${pwY !== 1 ? "s" : ""} ${pwM} Month${pwM !== 1 ? "s" : ""}, your solar system can recover its installation cost and start generating estimated savings of around Rs.${fmt(monthlyBill)} per month for the remaining lifespan of the system.`, y, { lineHeight: 14 });
        y = paragraph(doc, `Over 25 years, this may result in an estimated direct electricity bill saving of approximately ${toLakhs(total25)}.*`, y, { lineHeight: 14 });

        y += 10;
        // SIP Line
        doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(88, 28, 135);
        doc.text("Investment Comparison", MARGIN_X, y);
        y += 14;
        doc.setFont("helvetica", "oblique"); doc.setFontSize(9); doc.setTextColor(75, 85, 99);
        const sipLines = doc.splitTextToSize("If the equivalent monthly savings are invested through SIPs with an assumed average annual return of 12%, the long-term value may become significantly higher over 25 years.*", CONTENT_WIDTH);
        doc.text(sipLines, MARGIN_X, y);
        y += sipLines.length * 13 + 12;

        // Disclaimer
        doc.setFont("helvetica", "italic"); doc.setFontSize(8); doc.setTextColor(107, 114, 128);
        const disc = doc.splitTextToSize("* Savings are estimated values based on current electricity tariffs, sunlight conditions, and system performance. Actual results may vary.", CONTENT_WIDTH);
        doc.text(disc, MARGIN_X, y);
    } else {
        paragraph(doc, "Monthly electricity bill and govt. subsidy are required to calculate the ROI. Please fill them in the quotation form.", y, { lineHeight: 14 });
    }
}

function buildPageSix(doc, logoDataUrl, settings, type, warranteeImageDataUrl, pageNumber = 6, pageCount = PAGE_COUNT) {
    let y = addPage(doc, pageNumber, logoDataUrl, settings, pageCount);
    y = sectionTitle(doc, "Warrantee Details:-", y);
    
    const panelsText = type.warranteePanels || "The solar modules are warranted by the solar panel manufacturer for a period of 25 years. The warranty of modules and their respective DC connectors and cables shall be free from material defects in design, materials, and workmanship that affect the performance of the module.";
    const performanceText = type.warranteePerformance || "80% efficiency up to 25 years";
    const inverterText = type.warranteeInverter || "Inverter and equipment warranty will be as per manufacturer warranty terms. Additional warranty can be added by paying additional charges where applicable.";
    const bosText = type.warranteeBos || "A standard 12-month warranty against manufacturing defects is provided. After the warranty period, spares will be supplied for the system at actual cost.";
    const notes = type.warranteeNotes && type.warranteeNotes.length > 0 ? type.warranteeNotes : [
        "All warranty will start from the date of delivery",
        "Test Report will be provided after completion",
        "Performance report will be provided after 7 days of live working site where applicable"
    ];

    y = paragraph(doc, "Panels:", y, { bold: true, after: 8 });
    y = paragraph(doc, panelsText, y, { lineHeight: 14 });
    
    y = paragraph(doc, "Performance warranty for the system:", y + 4, { bold: true, after: 8 });
    y = paragraph(doc, performanceText, y, { lineHeight: 14 });
    
    y = paragraph(doc, "Inverter / Equipment:", y + 4, { bold: true, after: 8 });
    y = paragraph(doc, inverterText, y, { lineHeight: 14 });
    
    y = paragraph(doc, "Balance of the Systems:", y + 4, { bold: true, after: 8 });
    y = paragraph(doc, bosText, y, { lineHeight: 14 });
    
    y = paragraph(doc, "Note:", y + 4, { bold: true, after: 8 });
    y = bulletList(doc, notes, y);

    if (warranteeImageDataUrl) {
        if (y + 190 > PAGE_HEIGHT - MARGIN_X) {
            // Use pageNumber + 1 for the overflow page so header/footer are correct
            y = addPage(doc, pageNumber + 1, logoDataUrl, settings, pageCount);
        } else {
            y += 10;
        }
        drawImageBox(doc, "Warrantee Information", y, warranteeImageDataUrl);
    }
}

function buildPageSeven(doc, logoDataUrl, settings, type = {}, pageNumber = 7, pageCount = PAGE_COUNT) {
    let y = addPage(doc, pageNumber, logoDataUrl, settings, pageCount);
    const defaultClientScope = [
        "Provide all the papers and documentation required for approval or net metering where applicable.",
        "Provide a suitable and secure space for storage of equipment and materials.",
        "Provide permission and approval for project execution.",
        "Any government, electricity operator, or net metering charges to be paid as per actual where applicable.",
        "Facilitate access of work crew to the work site 7 days a week.",
        "Provision of water during cleaning of solar panels.",
        "Providing labor manpower at the site if required.",
        "Additional ladder to access the roof if required.",
        "Core cutting if the earthing location has RCC surface.",
    ];
    const clientScope = Array.isArray(type.clientScope)
        ? type.clientScope.map(item => safeText(item)).filter(Boolean)
        : [];

    const companyScope = Array.isArray(type.companyScope)
        ? type.companyScope.map(item => safeText(item)).filter(Boolean)
        : [
            "Prepare a full system design to include civil, structural, electrical, and mechanical components, with construction drawings and specifications.",
            "Procure equipment and materials and deliver to site.",
            "Perform complete system installation.",
            "Test all electrical components in accordance with manufacturer instructions.",
            "Commission the system to full operability.",
        ];

    y = sectionTitle(doc, `${settings.companyName || "Company"} Scope of work:-`, y);
    y = bulletList(doc, companyScope, y);

    y = sectionTitle(doc, "Client scope:-", y + 10);
    bulletList(doc, clientScope.length > 0 ? clientScope : defaultClientScope, y);
}

function buildPageEight(doc, type, logoDataUrl, settings, pageNumber = 8, pageCount = PAGE_COUNT) {
    let y = addPage(doc, pageNumber, logoDataUrl, settings, pageCount);
    y = sectionTitle(doc, "Terms & conditions:-", y);
    y = paragraph(doc, "System Information", y, { bold: true, after: 8 });
    y = paragraph(doc, "System will be installed by our certified system Integrator.", y, { lineHeight: 14 });
    y = paragraph(doc, "Delivery", y + 4, { bold: true, after: 8 });
    y = paragraph(doc, type.delivery || "", y, { lineHeight: 14 });
    const paymentTerms = Array.isArray(type.paymentTerms) ? type.paymentTerms : [];
    y = paragraph(doc, "Payment Terms:-", y + 4, { bold: true, after: 8 });
    y = paragraph(doc, paymentTerms.join("\n"), y, { lineHeight: 14 });

    y = paragraph(doc, "Bank Details:-", y + 8, { bold: true, after: 8 });

    // Build rows from bankAccounts array, fall back to legacy flat fields
    const sourceBankAccounts = type.bankAccounts !== undefined 
        ? type.bankAccounts 
        : (Array.isArray(settings.bankAccounts) && settings.bankAccounts.length > 0 ? settings.bankAccounts : [{
            bankName: settings.bankName || "",
            accountName: settings.accountName || "",
            accountNumber: settings.accountNumber || "",
            ifscCode: settings.ifscCode || "",
            branch: settings.branch || "",
        }]);

    const bankRows = sourceBankAccounts.map(acc => [
        acc.bankName || "",
        acc.accountName || "",
        acc.accountNumber || "",
        acc.ifscCode || "",
        acc.branch || "",
    ]);

    autoTable(doc, {
        startY: y,
        margin: { left: MARGIN_X, right: MARGIN_X },
        head: [["Bank Name", "Account Holder Name", "Account Number", "IFSC Code", "Branch"]],
        body: bankRows,
        styles: { fontSize: 8.5, cellPadding: 6, textColor: [51, 65, 85], lineColor: [226, 232, 240], lineWidth: 0.5 },
        headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255] },
        alternateRowStyles: { fillColor: [239, 246, 255] },
    });


    y = doc.lastAutoTable.finalY + 28;
    y = paragraph(doc, "We look forward to your response and the opportunity to work with you!", y, { lineHeight: 14 });
    y = paragraph(doc, "Any dispute will be consider under Mumbai Jurisdiction", y + 20, { lineHeight: 14 });
    y = paragraph(doc, "Regards,", y + 20, { after: 34 });
    paragraph(doc, settings.companyName || "", y, { bold: true });
}

// buildPageEight replaced — ROI moved to page 5 above

async function fetchGlobalSettings() {
    try {
        const snap = await getDoc(doc(db, "settings", "branding"));
        if (snap.exists()) return snap.data();
    } catch (err) {
        console.error("Failed to load global settings for PDF:", err);
    }
    return {};

}

export async function createQuotationPdf(lead, formData) {
    // Normalize nested arrays — Firestore stores them as JSON strings
    const type = {
        ...formData,
        materialRows:  typeof formData.materialRows  === "string" ? JSON.parse(formData.materialRows)  : (formData.materialRows  || []),
        financialRows: typeof formData.financialRows === "string" ? JSON.parse(formData.financialRows) : (formData.financialRows || []),
    };
    const settings = await fetchGlobalSettings();
    const logoDataUrl = await loadLogoDataUrl(settings);
    const diagramImageDataUrl = type.diagramImage ? await loadImageDataUrl(type.diagramImage) : null;
    const singleLineImageDataUrl = type.singleLineImage ? await loadImageDataUrl(type.singleLineImage) : null;
    const warranteeImageDataUrl = type.warranteeImage ? await loadImageDataUrl(type.warranteeImage) : null;

    const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
    doc.setProperties({
        title: `Quotation - ${safeText(lead.name, "Customer")}`,
        subject: `${type.name} quotation`,
        author: settings.companyName || "CRM System",
    });

    const includeRoiInPdf = type.includeRoiInPdf !== false;
    const pageCount = includeRoiInPdf ? PAGE_COUNT : PAGE_COUNT - 1;
    let pageNumber = 1;

    buildPageOne(doc, lead, type, logoDataUrl, settings, pageNumber++, pageCount);
    buildPageTwo(doc, type, logoDataUrl, settings, pageNumber++, pageCount);
    buildPageThree(doc, type, logoDataUrl, diagramImageDataUrl, singleLineImageDataUrl, settings, pageNumber++, pageCount);
    buildPageFour(doc, type, logoDataUrl, settings, pageNumber++, pageCount);
    if (includeRoiInPdf) {
        buildPageFive(doc, type, logoDataUrl, settings, pageNumber++, pageCount);
    }
    buildPageSix(doc, logoDataUrl, settings, type, warranteeImageDataUrl, pageNumber++, pageCount);
    buildPageSeven(doc, logoDataUrl, settings, type, pageNumber++, pageCount);
    buildPageEight(doc, type, logoDataUrl, settings, pageNumber, pageCount);

    return { doc, type };
}

export async function createQuotationPreviewUrl(lead, formData) {
    const { doc } = await createQuotationPdf(lead, formData);
    return URL.createObjectURL(doc.output("blob"));
}

export async function downloadQuotationPdf(lead, formData) {
    const { doc, type } = await createQuotationPdf(lead, formData);
    doc.save(`${sanitizeFileName(lead.name)}_${sanitizeFileName(type.name)}_${formatFileDate()}.pdf`);
    return type;
}

export async function createQuotationFile(lead, formData) {
    const { doc, type } = await createQuotationPdf(lead, formData);
    const blob = doc.output("blob");
    const file = new File([blob], `${sanitizeFileName(lead.name)}_${sanitizeFileName(type.name)}_${formatFileDate()}.pdf`, { type: "application/pdf" });
    return { doc, type, file };
}
