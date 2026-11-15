"""Readers shared by the manually run housing snapshot builders."""
import csv
from datetime import datetime
import math
import re
from shutil import copyfileobj
from urllib.request import Request, urlopen
from xml.etree import ElementTree
from zipfile import ZipFile

NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"


def stage_file(path, url):
    if path.exists():
        return
    print(f"Downloading {url}", flush=True)
    temporary = path.with_suffix(path.suffix + ".part")
    with urlopen(Request(url, headers={"User-Agent": "Realtors Dashboard data publisher"}), timeout=120) as source:
        with temporary.open("wb") as output:
            copyfileobj(source, output)
    temporary.replace(path)


def read_acs(path, table, columns, geoids):
    def estimate(value):
        return int(value) if re.fullmatch(r"[0-9]+", value) else None

    value_columns = [(f"{table.upper()}_E{n:03d}", f"{table.upper()}_M{n:03d}") for n in columns]
    with path.open(encoding="utf-8-sig", newline="") as source:
        rows = csv.reader(source, delimiter="|")
        header = next(rows)
        indexes = [(header.index(point), header.index(margin)) for point, margin in value_columns]
        result = {}
        for row in rows:
            fips = row[0]
            if fips in geoids:
                if fips in result:
                    raise ValueError(f"{table} has duplicate FIPS {fips}")
                result[fips] = [[estimate(row[point]), estimate(row[margin])] for point, margin in indexes]
    if result.keys() != geoids:
        raise ValueError(f"{table} is missing {len(geoids - result.keys())} Census geographies")
    return result


def read_fhfa_annual(path, geography_ids, state_file=False):
    expected_header = ["State", "Abbreviation", "FIPS"] if state_file else ["State", "County", "FIPS code"]
    trends = {}
    with ZipFile(path) as book:
        strings = [
            "".join(node.text or "" for node in entry.iter(NS + "t"))
            for entry in ElementTree.fromstring(book.read("xl/sharedStrings.xml"))
        ]
        revision = None
        header_validated = False
        with book.open("xl/worksheets/sheet1.xml") as sheet:
            for _, row in ElementTree.iterparse(sheet, events=["end"]):
                if row.tag != NS + "row":
                    continue
                cells = {}
                for cell in row:
                    value = cell.findtext(NS + "v")
                    if value is not None:
                        column = cell.attrib["r"].rstrip("0123456789")
                        cells[column] = strings[int(value)] if cell.get("t") == "s" else value
                row.clear()
                if cells.get("A", "").startswith("Last updated: "):
                    revision = datetime.strptime(cells["A"].removeprefix("Last updated: ").rstrip(". "), "%B %d, %Y").date()
                if cells.get("D") == "Year":
                    header_validated = [cells.get(c) for c in "ABCDE"] == [*expected_header, "Year", "Annual Change (%)"]
                    if not header_validated:
                        raise ValueError(f"Unexpected FHFA column names in {path}")
                if not header_validated:
                    continue
                fips = cells.get("C")
                in_scope = fips in geography_ids
                change = cells.get("E")
                if in_scope and change not in (None, ".", ""):
                    value = float(change)
                    if not math.isfinite(value):
                        raise ValueError(f"Invalid FHFA change for {fips}")
                    year = int(cells["D"])
                    annual = trends.setdefault(fips, {})
                    if year in annual:
                        raise ValueError(f"Duplicate FHFA year for {fips}")
                    annual[year] = round(value, 2)
    if revision is None or not header_validated or not trends:
        raise ValueError(f"Missing FHFA metadata or data in {path}")
    return revision, trends
