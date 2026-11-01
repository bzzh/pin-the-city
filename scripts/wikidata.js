// Small helper for the Wikidata Query Service (https://query.wikidata.org).
const ENDPOINT = 'https://query.wikidata.org/sparql';
// Wikidata asks every tool to identify itself.
const USER_AGENT = 'pin-the-city/0.1 (hobby geography game; data build script)';

const ATTEMPTS = 3;

async function runQuery(query) {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/sparql-results+json',
      'User-Agent': USER_AGENT,
    },
    body: new URLSearchParams({ query }),
  });
  if (!response.ok) {
    throw new Error(`Wikidata query failed: ${response.status} ${await response.text()}`);
  }
  // A query that times out mid-response ends in an error message, so this parse fails too.
  return response.json();
}

export async function sparql(query) {
  for (let attempt = 1; ; attempt++) {
    try {
      const json = await runQuery(query);
      // Flatten { var: { value } } bindings into plain { var: value } rows.
      return json.results.bindings.map((row) =>
        Object.fromEntries(Object.entries(row).map(([key, cell]) => [key, cell.value])),
      );
    } catch (error) {
      if (attempt === ATTEMPTS) throw error;
      console.error(`Query failed (${error.message.slice(0, 80)}), retrying...`);
      await new Promise((resolve) => setTimeout(resolve, 5000 * attempt));
    }
  }
}

export const qid = (uri) => uri.replace('http://www.wikidata.org/entity/', '');
