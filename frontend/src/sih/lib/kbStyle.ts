import { FileText, FileImage, FileSpreadsheet, ScanLine } from "lucide-react";
import type { KbDoc } from "./types";

export const SAMPLE_FILE: Record<string, string> = {
  "sop-09": "/sample-files/SOP-09_Tank_Inspection_Thickness_Limits.txt",
  "sop-14": "/sample-files/SOP-14_Confined_Space_Entry.txt",
  "insp-tk204": "/sample-files/INSP-2026-0417_TK-204_Scanned_Report_OCR.txt",
  "hse-q2": "/sample-files/HSE_Incident_Log_Q2.csv",
};

export const KIND_ICON: Record<KbDoc["kind"], typeof FileText> = {
  pdf: FileText,
  "pdf-scanned": ScanLine,
  image: FileImage,
  xlsx: FileSpreadsheet,
  docx: FileText,
};

export const CLASS_STYLE: Record<KbDoc["classification"], { bg: string; fg: string }> = {
  Internal: { bg: "var(--bg-sunken)", fg: "var(--text-secondary)" },
  Confidential: { bg: "var(--amber-100)", fg: "var(--amber-600)" },
  Restricted: { bg: "var(--alert-100)", fg: "var(--alert-600)" },
};
