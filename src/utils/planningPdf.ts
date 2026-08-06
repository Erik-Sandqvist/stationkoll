import { format } from "date-fns";
import { sv } from "date-fns/locale";
import type { jsPDF } from "jspdf";
import { fromDateKey } from "@/utils/date";
import type { StationLayout } from "@/hooks/useStations";
import {
  buildStationColors,
  readableTextColor,
  stationColor,
  tint,
  type Rgb,
} from "@/utils/stationColors";

/**
 * Underlaget för dagens bemanning, i samma form som planeringsvyn håller det.
 * Allt kommer in som argument — modulen läser varken från databasen eller DOM:en,
 * så den går att köra och testa utan en renderad sida.
 */
export interface PlanningPdfInput {
  /** Datumnyckel (YYYY-MM-DD) */
  date: string;
  shift: string;
  /** Stationer med eget kort, i visningsordning */
  topLevelStationNames: string[];
  /** Alla stationer i visningsordning — styr färgtilldelningen */
  stationNames: string[];
  getSubStationNames: (station: string) => string[];
  getLayout: (station: string) => StationLayout;
  getSlots: (station: string) => number | null;
  /** Stationen som bemannas för hand visar ingen behovsräknare */
  manualStationName: string | null;
  assignments: Record<string, string[]>;
  stationNeeds: Record<string, number>;
  /** Medarbetarens namn, eller id:t om hen inte hittas */
  employeeName: (id: string) => string;
  /** Valda för dagen men utan station */
  unassignedIds: string[];
  organizationName: string;
}

// Alla mått i millimeter på ett liggande A4
const PAGE_W = 297;
const PAGE_H = 210;
const MARGIN = 10;
const COLUMN_GAP = 4;
const CARD_PAD = 2.8;
const CARD_HEADER_H = 7.5;
const CARD_GAP = 4;
const ROW_H = 5.4;
const SUB_HEADER_H = 6;
const SUB_GAP = 2;
/** Numrerade platser ställs i två spalter först när de är många nog att tjäna på det */
const TWO_COLUMN_SLOTS = 8;
/** Detsamma för stationer utan platsnummer, som annars kan bli högre än sidan */
const TWO_COLUMN_ROWS = 10;
/** Tre spalter ger läsbara kort; en fjärde tas till bara om det sparar en sida */
const PREFERRED_COLUMNS = 3;
const MAX_COLUMNS = 4;

const GREY_TEXT: Rgb = { r: 110, g: 116, b: 126 };
const DARK_TEXT: Rgb = { r: 26, g: 26, b: 26 };
const EMPTY_SLOT: Rgb = { r: 175, g: 180, b: 188 };

/** Kortens bredd, som beror på hur många spalter sidan delats i */
interface Geometry {
  columns: number;
  cardW: number;
  contentW: number;
}

const geometryFor = (columns: number): Geometry => {
  const cardW = (PAGE_W - 2 * MARGIN - (columns - 1) * COLUMN_GAP) / columns;
  return { columns, cardW, contentW: cardW - 2 * CARD_PAD };
};

const setText = (doc: jsPDF, { r, g, b }: Rgb) => doc.setTextColor(r, g, b);
const setFill = (doc: jsPDF, { r, g, b }: Rgb) => doc.setFillColor(r, g, b);

/** Kortar av text som inte får plats, med tre punkter på slutet */
const fit = (doc: jsPDF, text: string, maxWidth: number): string => {
  if (doc.getTextWidth(text) <= maxWidth) return text;

  let cut = text;
  while (cut.length > 1 && doc.getTextWidth(`${cut}...`) > maxWidth) {
    cut = cut.slice(0, -1);
  }
  return `${cut}...`;
};

/** Förnamn + efternamnets initial, samma korta form som planeringsvyn visar */
const shortName = (name: string): string => {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return parts[0] ?? name;
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
};

/** Hela namnet om det får plats, annars den korta formen */
const nameForWidth = (doc: jsPDF, name: string, maxWidth: number): string =>
  doc.getTextWidth(name) <= maxWidth ? name : fit(doc, shortName(name), maxWidth);

interface StationBody {
  /** Namn per rad, tom sträng = ledig plats. Numrerade om stationen har platser. */
  cells: string[];
  numbered: boolean;
  columns: 1 | 2;
  rows: number;
}

const stationBody = (input: PlanningPdfInput, station: string): StationBody => {
  const assigned = input.assignments[station] || [];
  const slots = input.getSlots(station);
  const isGrid = input.getLayout(station) === "grid" && slots !== null;

  if (isGrid) {
    const cells = Array.from({ length: slots }, (_, idx) =>
      assigned[idx] ? input.employeeName(assigned[idx]) : ""
    );
    const columns = slots >= TWO_COLUMN_SLOTS ? 2 : 1;
    return { cells, numbered: true, columns, rows: Math.ceil(slots / columns) };
  }

  const cells = assigned.filter(Boolean).map((id) => input.employeeName(id));
  // Långa listor ställs i två spalter, annars växer kortet ur sidan
  const columns = cells.length >= TWO_COLUMN_ROWS ? 2 : 1;
  // Ett tomt kort ska ändå ha en rad, annars ser det ut som att något saknas
  return {
    cells,
    numbered: false,
    columns,
    rows: Math.max(Math.ceil(cells.length / columns), 1),
  };
};

const filledCount = (input: PlanningPdfInput, station: string): number =>
  (input.assignments[station] || []).filter(Boolean).length;

const cardHeight = (input: PlanningPdfInput, station: string): number => {
  let height = CARD_HEADER_H + CARD_PAD + stationBody(input, station).rows * ROW_H;

  for (const sub of input.getSubStationNames(station)) {
    height += SUB_GAP + SUB_HEADER_H + 0.8 + stationBody(input, sub).rows * ROW_H;
  }

  return height + CARD_PAD;
};

/** Ritar raderna och returnerar y-läget under dem */
const drawRows = (
  doc: jsPDF,
  geometry: Geometry,
  body: StationBody,
  x: number,
  y: number,
  color: Rgb
): number => {
  const cellW =
    body.columns === 2 ? (geometry.contentW - 1.5) / 2 : geometry.contentW;
  const rowFill = tint(color, 0.87);

  doc.setFontSize(8);

  body.cells.forEach((name, idx) => {
    const column = body.columns === 2 ? idx % 2 : 0;
    const row = body.columns === 2 ? Math.floor(idx / 2) : idx;
    const cellX = x + column * (cellW + 1.5);
    const cellY = y + row * ROW_H;

    if (name) {
      setFill(doc, rowFill);
      doc.roundedRect(cellX, cellY, cellW, ROW_H - 0.8, 0.8, 0.8, "F");
    }

    let textX = cellX + 1.6;

    if (body.numbered) {
      doc.setFont("helvetica", "normal");
      setText(doc, GREY_TEXT);
      const label = `${idx + 1}.`;
      doc.text(label, textX, cellY + 3.3);
      textX += Math.max(doc.getTextWidth(label), 3.6) + 1.2;
    }

    if (!name) {
      doc.setFont("helvetica", "normal");
      setText(doc, EMPTY_SLOT);
      doc.text("–", textX, cellY + 3.3);
      return;
    }

    doc.setFont("helvetica", "bold");
    setText(doc, DARK_TEXT);
    doc.text(
      nameForWidth(doc, name, cellX + cellW - 1.6 - textX),
      textX,
      cellY + 3.3
    );
  });

  if (body.cells.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    setText(doc, GREY_TEXT);
    doc.text("Ingen tilldelad", x + 1.6, y + 3.3);
  }

  return y + body.rows * ROW_H;
};

const drawBadge = (
  doc: jsPDF,
  text: string,
  rightX: number,
  centerY: number,
  background: Rgb,
  textColor: Rgb
) => {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  const width = doc.getTextWidth(text) + 3.4;

  setFill(doc, background);
  doc.roundedRect(rightX - width, centerY - 2.2, width, 4.4, 2.2, 2.2, "F");
  setText(doc, textColor);
  doc.text(text, rightX - width / 2, centerY + 1.4, { align: "center" });
};

const drawCard = (
  doc: jsPDF,
  input: PlanningPdfInput,
  geometry: Geometry,
  colors: Map<string, Rgb>,
  station: string,
  x: number,
  y: number
): void => {
  const color = stationColor(colors, station);
  const height = cardHeight(input, station);

  // Färgad platta med vit kropp inuti: rubriken bär stationens färg och en tunn
  // ram av samma färg håller ihop kortet
  setFill(doc, color);
  doc.roundedRect(x, y, geometry.cardW, height, 1.8, 1.8, "F");
  setFill(doc, { r: 255, g: 255, b: 255 });
  doc.roundedRect(
    x + 0.9,
    y + CARD_HEADER_H,
    geometry.cardW - 1.8,
    height - CARD_HEADER_H - 0.9,
    1.2,
    1.2,
    "F"
  );

  const needed = input.stationNeeds[station] || 0;
  const filled = filledCount(input, station);
  const isManual = station === input.manualStationName;
  const badge = isManual ? "" : `${filled}/${needed}`;

  doc.setFontSize(7.5);
  const badgeW = badge ? doc.getTextWidth(badge) + 3.4 : 0;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  setText(doc, readableTextColor(color));
  doc.text(
    fit(doc, station, geometry.contentW - badgeW - 2),
    x + CARD_PAD,
    y + CARD_HEADER_H / 2 + 1.3
  );

  if (badge) {
    const complete = filled >= needed;
    drawBadge(
      doc,
      badge,
      x + geometry.cardW - CARD_PAD,
      y + CARD_HEADER_H / 2,
      complete ? tint(color, 0.82) : { r: 255, g: 255, b: 255 },
      complete ? DARK_TEXT : { r: 178, g: 40, b: 45 }
    );
  }

  let cursorY = drawRows(
    doc,
    geometry,
    stationBody(input, station),
    x + CARD_PAD,
    y + CARD_HEADER_H + CARD_PAD,
    color
  );

  for (const sub of input.getSubStationNames(station)) {
    const subColor = stationColor(colors, sub);
    cursorY += SUB_GAP;

    setFill(doc, subColor);
    doc.roundedRect(x + CARD_PAD, cursorY, geometry.contentW, SUB_HEADER_H, 1, 1, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    setText(doc, readableTextColor(subColor));

    const subBadge = `${filledCount(input, sub)}/${input.stationNeeds[sub] || 0}`;
    const subBadgeW = doc.getTextWidth(subBadge) + 4;

    doc.text(
      fit(doc, sub, geometry.contentW - subBadgeW - 3),
      x + CARD_PAD + 1.6,
      cursorY + 4.1
    );
    doc.text(subBadge, x + CARD_PAD + geometry.contentW - 1.6, cursorY + 4.1, {
      align: "right",
    });

    cursorY = drawRows(
      doc,
      geometry,
      stationBody(input, sub),
      x + CARD_PAD,
      cursorY + SUB_HEADER_H + 0.8,
      subColor
    );
  }
};

/** Sidhuvud på varje sida. Returnerar y-läget där innehållet får börja. */
const drawPageHeader = (
  doc: jsPDF,
  input: PlanningPdfInput,
  assignedTotal: number
): number => {
  const dateText = format(fromDateKey(input.date), "EEEE d MMMM yyyy", { locale: sv });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  setText(doc, DARK_TEXT);
  doc.text("Bemanning", MARGIN, MARGIN + 5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  setText(doc, GREY_TEXT);
  doc.text(
    `${dateText.charAt(0).toUpperCase()}${dateText.slice(1)}  ·  ${input.shift}`,
    MARGIN,
    MARGIN + 10.8
  );

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  setText(doc, DARK_TEXT);
  doc.text(input.organizationName, PAGE_W - MARGIN, MARGIN + 4.5, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  setText(doc, GREY_TEXT);
  doc.text(
    `${assignedTotal} medarbetare · ${input.topLevelStationNames.length} stationer`,
    PAGE_W - MARGIN,
    MARGIN + 9.5,
    { align: "right" }
  );

  doc.setDrawColor(220, 223, 228);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, MARGIN + 13.5, PAGE_W - MARGIN, MARGIN + 13.5);

  return MARGIN + 17.5;
};

/** Remsa med dem som inte fick någon station. Returnerar nytt y-läge. */
const drawUnassigned = (doc: jsPDF, names: string[], y: number): number => {
  if (names.length === 0) return y;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  const label = `Ofördelade (${names.length}):`;
  const labelW = doc.getTextWidth(label) + 5;

  doc.setFont("helvetica", "normal");
  const lines: string[] = doc.splitTextToSize(
    names.join(",   "),
    PAGE_W - 2 * MARGIN - labelW - 5
  );
  const height = 4.6 + lines.length * 3.6;

  doc.setFillColor(243, 244, 246);
  doc.roundedRect(MARGIN, y, PAGE_W - 2 * MARGIN, height, 1.5, 1.5, "F");

  doc.setFont("helvetica", "bold");
  setText(doc, GREY_TEXT);
  doc.text(label, MARGIN + 2.5, y + 4.5);

  doc.setFont("helvetica", "normal");
  setText(doc, DARK_TEXT);
  doc.text(lines, MARGIN + 2.5 + labelW, y + 4.5);

  return y + height + CARD_GAP;
};

const drawFooters = (doc: jsPDF) => {
  const pages = doc.getNumberOfPages();
  const printed = format(new Date(), "yyyy-MM-dd HH:mm");

  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    setText(doc, GREY_TEXT);
    doc.text(`Utskriven ${printed}`, MARGIN, PAGE_H - 5);
    doc.text(`Sida ${page} av ${pages}`, PAGE_W - MARGIN, PAGE_H - 5, {
      align: "right",
    });
  }
};

/**
 * Antal spalter. Tre är utgångsläget eftersom korten då blir breda nog att rymma
 * hela namn; en fjärde spalt tas till först när den håller ihop planeringen på
 * färre sidor.
 */
const chooseColumns = (totalHeight: number, usableHeight: number): number => {
  const pagesWith = (columns: number) =>
    Math.ceil(totalHeight / (columns * usableHeight));

  return pagesWith(MAX_COLUMNS) < pagesWith(PREFERRED_COLUMNS)
    ? MAX_COLUMNS
    : PREFERRED_COLUMNS;
};

/** Bygger dokumentet. Bruten ur exporten för att kunna köras utan nedladdning. */
export const buildPlanningPdf = (doc: jsPDF, input: PlanningPdfInput): jsPDF => {
  const colors = buildStationColors(input.stationNames, input.getSubStationNames);
  const assignedIds = new Set(
    Object.values(input.assignments).flat().filter(Boolean)
  );

  let contentTop = drawPageHeader(doc, input, assignedIds.size);
  contentTop = drawUnassigned(
    doc,
    input.unassignedIds.map((id) => input.employeeName(id)),
    contentTop
  );

  const bottom = PAGE_H - MARGIN - 3;
  const usableHeight = bottom - contentTop;
  const heights = new Map(
    input.topLevelStationNames.map((station) => [station, cardHeight(input, station)])
  );
  const totalHeight = [...heights.values()].reduce(
    (sum, height) => sum + height + CARD_GAP,
    0
  );

  const geometry = geometryFor(chooseColumns(totalHeight, usableHeight));
  const pages = Math.max(
    1,
    Math.ceil(totalHeight / (geometry.columns * usableHeight))
  );
  // Jämnhög fyllning: utan den staplas allt i första spalten och halva sidan
  // blir tom. Ordningen behålls — spalten byts när den nått sin andel.
  const targetHeight = Math.min(
    usableHeight,
    totalHeight / (geometry.columns * pages)
  );

  let column = 0;
  let cursorY = contentTop;

  for (const station of input.topLevelStationNames) {
    const height = heights.get(station) as number;
    const isFull = cursorY - contentTop >= targetHeight;
    const overflows = cursorY + height > bottom;

    if (cursorY > contentTop && (isFull || overflows)) {
      column += 1;
      cursorY = contentTop;

      if (column >= geometry.columns) {
        doc.addPage();
        contentTop = drawPageHeader(doc, input, assignedIds.size);
        column = 0;
        cursorY = contentTop;
      }
    }

    drawCard(
      doc,
      input,
      geometry,
      colors,
      station,
      MARGIN + column * (geometry.cardW + COLUMN_GAP),
      cursorY
    );
    cursorY += height + CARD_GAP;
  }

  drawFooters(doc);
  return doc;
};

/** Filnamn utan tecken som krånglar i Windows Utforskaren */
export const planningPdfFileName = (input: Pick<PlanningPdfInput, "date" | "shift">) =>
  `${`Bemanning ${input.date} ${input.shift}`.replace(/[\\/:*?"<>|]/g, "-")}.pdf`;

/**
 * Skapar och laddar ner bemanningen som ett liggande A4.
 *
 * jsPDF hämtas dynamiskt så att biblioteket inte ligger i huvudbundlen — de
 * flesta besök på sidan slutar aldrig i en export.
 */
export const exportPlanningPdf = async (input: PlanningPdfInput): Promise<void> => {
  const { jsPDF: JsPdf } = await import("jspdf");
  const doc = new JsPdf({ orientation: "landscape", unit: "mm", format: "a4" });

  buildPlanningPdf(doc, input);
  doc.save(planningPdfFileName(input));
};
