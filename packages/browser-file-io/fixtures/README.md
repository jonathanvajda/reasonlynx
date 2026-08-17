# Browser File I/O Fixtures

This capability is mostly tested with browser API mocks because Node does not
provide `FileReader`, DOM anchor clicks, or object URL downloads under the
current repository Jest configuration.

Future fixture candidates:

- `simple.txt` for UTF-8 text reads.
- `empty.txt` for empty string reads.
- `binary.bin` for ArrayBuffer reads.
- `report.csv` for text download MIME assertions.
- `ontology.ttl` for downstream app adapter smoke tests.

Do not add RDF, tabular, or report parser fixtures here unless they specifically
exercise the browser file boundary. Parser fixtures belong to their own
capability packages.

