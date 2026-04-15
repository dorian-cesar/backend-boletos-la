const { XMLParser } = require("fast-xml-parser");

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  parseTagValue: false,
});

function _findElement(obj, name) {
  if (!obj || typeof obj !== "object") return null;
  if (obj[name] !== undefined) return obj[name];
  for (const key of Object.keys(obj)) {
    if (typeof obj[key] === "object") {
      const found = _findElement(obj[key], name);
      if (found !== null) return found;
    }
  }
  return null;
}

function _getValue(val) {
  if (val === null || val === undefined) return "";
  if (typeof val !== "object") return String(val).trim();
  if (val["#text"] !== undefined) return String(val["#text"]).trim();
  try {
    return JSON.stringify(val);
  } catch (e) {
    return String(val);
  }
}

function parseDataSet(xml, tableTag = null) {
  if (!xml || typeof xml !== "string") return [];
  let parsed = parser.parse(xml);
  if (!parsed) return [];

  const diffgram = _findElement(parsed, "diffgr:diffgram");
  if (!diffgram) return [];

  const contentElement = diffgram.NewDataSet || diffgram.DocumentElement || diffgram.DataSetError;
  if (!contentElement) return [];

  if (contentElement.TablaError) {
    const errorData = Array.isArray(contentElement.TablaError) ? contentElement.TablaError[0] : contentElement.TablaError;
    const codigoError = _getValue(errorData.CodigoError || errorData.Error || "1");
    if (codigoError !== "0") {
      const desc = _getValue(errorData.Descripcion);
      const message = desc
        ? `Delta API [${codigoError}]: ${desc}`
        : `Delta API error (CodigoError: ${codigoError})`;
      return { error: true, code: codigoError, message: message };
    }
  }
  return [];
}

const xmlErrorAttr = `
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <Venta3Response xmlns="http://tempuri.org/">
      <Venta3Result>
        <diffgr:diffgram xmlns:diffgr="urn:schemas-microsoft-com:xml-diffgram-v1">
          <DataSetError xmlns="">
            <TablaError diffgr:id="TablaError1">
              <CodigoError>100</CodigoError>
              <Descripcion diffgr:id="Desc1">ERROR DE PRUEBA CON ATRIBUTOS</Descripcion>
            </TablaError>
          </DataSetError>
        </diffgr:diffgram>
      </Venta3Result>
    </Venta3Response>
  </soap:Body>
</soap:Envelope>
`;

console.log("Result with Attributes:", parseDataSet(xmlErrorAttr));

const xmlErrorPlain = `
<DataSetError>
  <TablaError>
    <CodigoError>200</CodigoError>
    <Descripcion>ERROR SIMPLE</Descripcion>
  </TablaError>
</DataSetError>
`;
// Para el test simple necesitamos envolverlo en diffgram para que funcione el helper actual de test
const xmlErrorPlainWrapped = `
<diffgr:diffgram xmlns:diffgr="urn:schemas-microsoft-com:xml-diffgram-v1">
  <DataSetError>
    <TablaError>
      <CodigoError>200</CodigoError>
      <Descripcion>ERROR SIMPLE</Descripcion>
    </TablaError>
  </DataSetError>
</diffgr:diffgram>
`;

console.log("Result Plain:", parseDataSet(xmlErrorPlainWrapped));
