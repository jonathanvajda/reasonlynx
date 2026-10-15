#!/usr/bin/env python3
"""Build OntoEagle's consolidated lookup graph from src/ontologies."""

import argparse
from pathlib import Path

import rdflib


RDF_EXT_TO_FORMAT = {
    ".ttl": "turtle",
    ".rdf": "xml",
    ".owl": "xml",
    ".nt": "nt",
    ".nq": "nquads",
    ".trig": "trig",
    ".jsonld": "json-ld",
}


def iter_rdf_files(folder: Path):
    for path in sorted(folder.rglob("*")):
        if path.is_file() and path.suffix.lower() in RDF_EXT_TO_FORMAT:
            yield path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input-folder", required=True)
    parser.add_argument("--out-jsonld", required=True)
    parser.add_argument("--out-nq")
    args = parser.parse_args()

    graph = rdflib.ConjunctiveGraph()
    files = list(iter_rdf_files(Path(args.input_folder)))
    if not files:
        raise SystemExit(f"No RDF files found in {args.input_folder}")

    for path in files:
        rdf_format = RDF_EXT_TO_FORMAT[path.suffix.lower()]
        try:
            graph.parse(str(path), format=rdf_format)
            print(f"Loaded {path} ({rdf_format})")
        except Exception as error:
            raise SystemExit(f"Failed parsing {path} as {rdf_format}: {error}") from error

    out_jsonld = Path(args.out_jsonld)
    out_jsonld.parent.mkdir(parents=True, exist_ok=True)
    out_jsonld.write_text(graph.serialize(format="json-ld", indent=2), encoding="utf-8")
    print(f"Wrote {out_jsonld} ({len(graph)} triples)")

    if args.out_nq:
        out_nq = Path(args.out_nq)
        out_nq.parent.mkdir(parents=True, exist_ok=True)
        out_nq.write_text(graph.serialize(format="nquads"), encoding="utf-8")
        print(f"Wrote {out_nq}")


if __name__ == "__main__":
    main()
