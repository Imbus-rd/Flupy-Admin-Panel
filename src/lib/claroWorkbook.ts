const SPREADSHEET_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const PROPERTIES_NS = "http://schemas.openxmlformats.org/officeDocument/2006/extended-properties";
const XMLNS_NS = "http://www.w3.org/2000/xmlns/";

export function unprefixSpreadsheetXml(source: string): string | null {
  if (/<!DOCTYPE/i.test(source)) throw new Error("El Excel contiene una definición XML no admitida.");
  const parsed = new DOMParser().parseFromString(source, "application/xml");
  if (parsed.getElementsByTagName("parsererror").length) throw new Error("El Excel contiene una estructura XML dañada.");
  const namespace = parsed.documentElement.namespaceURI;
  if (!namespace || ![SPREADSHEET_NS, PROPERTIES_NS].includes(namespace) || !Array.from(parsed.getElementsByTagNameNS(namespace, "*")).some(node => node.prefix)) return null;
  const output = parsed.implementation.createDocument(null, "", null);
  // Some OpenXML exporters prefix every spreadsheet tag. ExcelJS expects default-namespace tags.
  function copy(node: Node): Node {
    if (node.nodeType !== 1) return output.importNode(node, false);
    const element = node as Element;
    const core = element.namespaceURI === namespace;
    const result = output.createElementNS(element.namespaceURI, core ? element.localName : element.tagName);
    for (const attr of Array.from(element.attributes)) {
      if (attr.namespaceURI === XMLNS_NS && attr.value === namespace) continue;
      if (attr.namespaceURI === namespace) result.setAttribute(attr.localName, attr.value);
      else result.setAttributeNS(attr.namespaceURI, attr.name, attr.value);
    }
    for (const child of Array.from(node.childNodes)) result.appendChild(copy(child));
    return result;
  }
  output.appendChild(copy(parsed.documentElement));
  return new XMLSerializer().serializeToString(output);
}

export async function compatibleClaroWorkbook(buffer: ArrayBuffer): Promise<ArrayBuffer> {
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(buffer);
  let changed = false;
  let characters = 0;
  for (const entry of Object.values(zip.files)) {
    if (entry.dir || !/^(?:xl\/(?:workbook|styles|sharedStrings|worksheets\/[^/]+)|docProps\/app)\.xml$/.test(entry.name)) continue;
    const source = await entry.async("string");
    characters += source.length;
    if (characters > 80 * 1024 * 1024) throw new Error("El Excel expandido excede el límite de lectura. Divida el archivo.");
    const normalized = unprefixSpreadsheetXml(source);
    if (normalized !== null) { zip.file(entry.name, normalized); changed = true; }
  }
  return changed ? zip.generateAsync({ type: "arraybuffer", compression: "DEFLATE" }) : buffer;
}
