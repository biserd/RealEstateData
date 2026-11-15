"""Build the manually published Texas housing snapshot from official public data."""
import argparse
import csv
from datetime import date, datetime
from html.parser import HTMLParser
import json
import math
from pathlib import Path
import re
from shutil import copyfileobj
from urllib.request import Request, urlopen
from xml.etree import ElementTree
from zipfile import ZipFile


STATE = "48"
COUNTY_FIPS = {f"{STATE}{fips:03d}" for fips in range(1, 508, 2)}
DIRECTORY = "https://comptroller.texas.gov/taxes/property-tax/county-directory/"
ACS_TABLES = {
    "b25002": (1, 2, 3),
    "b25003": (2, 3),
    "b25024": tuple(range(2, 12)),
    "b25064": (1,),
    "b25077": (1,),
}
NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"


class AppraisalDirectory(HTMLParser):
    def __init__(self):
        super().__init__()
        self.counties = {}
        self.path = None

    def handle_starttag(self, tag, attrs):
        path = dict(attrs).get("href", "")
        self.path = path if tag == "a" and re.fullmatch(r"[a-z0-9-]+\.php", path) else None

    def handle_data(self, data):
        county = re.fullmatch(r"\s*\d{3} (.+?)\s*", data)
        if self.path and county:
            name = county.group(1).lower().replace(" ", "")
            if name == "dimmitt":  # The Comptroller directory misspells Dimmit County.
                name = "dimmit"
            if name in self.counties:
                raise ValueError(f"Duplicate appraisal district link for {name}")
            self.counties[name] = self.path

    def handle_endtag(self, tag):
        if tag == "a":
            self.path = None


def download(path, url):
    if path.exists():
        return
    print(f"Downloading {url}", flush=True)
    temporary = path.with_suffix(path.suffix + ".part")
    with urlopen(Request(url, headers={"User-Agent": "Realtors Dashboard data publisher"}), timeout=120) as source:
        with temporary.open("wb") as output:
            copyfileobj(source, output)
    temporary.replace(path)


def acs(path, table, columns):
    def estimate(value):
        return int(value) if re.fullmatch(r"[0-9]+", value) else None

    value_columns = [(f"{table.upper()}_E{n:03d}", f"{table.upper()}_M{n:03d}") for n in columns]
    geography = {"0400000US48": STATE, **{f"0500000US{fips}": fips for fips in COUNTY_FIPS}}
    with path.open(encoding="utf-8-sig", newline="") as source:
        rows = csv.reader(source, delimiter="|")
        header = next(rows)
        indexes = [(header.index(point), header.index(margin)) for point, margin in value_columns]
        result = {}
        for row in rows:
            fips = geography.get(row[0])
            if fips:
                if fips in result:
                    raise ValueError(f"{table} has duplicate FIPS {fips}")
                result[fips] = [[estimate(row[point]), estimate(row[margin])] for point, margin in indexes]
    if result.keys() != set(geography.values()):
        raise ValueError(f"{table} is missing Texas geographies")
    return result


def read_hpi(path, state_file=False):
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
                texas = fips == STATE and cells.get("B") == "TX" if state_file else fips in COUNTY_FIPS and cells.get("A") == "TX"
                change = cells.get("E")
                if texas and change not in (None, ".", ""):
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


def build(args):
    cache = args.cache
    cache.mkdir(parents=True, exist_ok=True)
    year = args.acs_year
    census = f"https://www2.census.gov/programs-surveys/acs/summary_file/{year}/table-based-SF/data/5YRData"
    for table in ACS_TABLES:
        download(cache / f"{year}-{table}.dat", f"{census}/acsdt5y{year}-{table}.dat")
    download(cache / "state.xlsx", "https://www.fhfa.gov/hpi/download/annual/hpi_at_state.xlsx")
    download(cache / "county.xlsx", "https://www.fhfa.gov/hpi/download/annual/hpi_at_county.xlsx")
    download(cache / "directory.html", DIRECTORY)
    adjacency_year = args.adjacency_year
    download(cache / "adjacency.txt", f"https://www2.census.gov/geo/docs/reference/county_adjacency/county_adjacency{adjacency_year}.txt")

    names = {}
    neighbors = {fips: set() for fips in COUNTY_FIPS}
    with (cache / "adjacency.txt").open(encoding="utf-8-sig", newline="") as source:
        for row in csv.DictReader(source, delimiter="|"):
            fips, other = row["County GEOID"], row["Neighbor GEOID"]
            if fips in COUNTY_FIPS:
                name = row["County Name"].removesuffix(" County, TX")
                if not name or name == row["County Name"] or names.setdefault(fips, name) != name:
                    raise ValueError(f"Conflicting Census county name for {fips}")
                if other in COUNTY_FIPS and int(row["Length"]) > 0:
                    neighbors[fips].add(other)
    if names.keys() != COUNTY_FIPS or any(not links for links in neighbors.values()):
        raise ValueError("Incomplete Census Texas county adjacency")
    if any(fips not in neighbors[other] for fips, links in neighbors.items() for other in links):
        raise ValueError("Non-reciprocal Texas county adjacency")

    directory = AppraisalDirectory()
    directory.feed((cache / "directory.html").read_text(encoding="utf-8-sig"))
    if len(directory.counties) != len(COUNTY_FIPS):
        raise ValueError("Incomplete Texas Comptroller appraisal district directory")

    tables = {table: acs(cache / f"{year}-{table}.dat", table, cols) for table, cols in ACS_TABLES.items()}
    state_revision, state_hpi = read_hpi(cache / "state.xlsx", state_file=True)
    county_revision, county_hpi = read_hpi(cache / "county.xlsx")
    if state_revision != county_revision or args.published_on < state_revision:
        raise ValueError("FHFA sources and publication dates disagree")
    trends = {**state_hpi, **county_hpi}
    latest_year = max(trends[STATE])

    def area(fips):
        total, occupied, vacant = tables["b25002"][fips]
        owner, renter = tables["b25003"][fips]
        structure = [value for value, _ in tables["b25024"][fips]]
        if (
            any(value is None for value in [total[0], occupied[0], vacant[0], owner[0], renter[0], *structure])
            or total[0] <= 0
            or sum(structure) != total[0]
            or occupied[0] + vacant[0] != total[0]
            or owner[0] + renter[0] != occupied[0]
        ):
            raise ValueError(f"Invalid housing totals for {fips}")
        return {
            "homeValue": tables["b25077"][fips][0],
            "rent": tables["b25064"][fips][0],
            "housingUnits": total,
            "occupied": occupied[0],
            "ownerOccupied": owner[0],
            "structures": {
                "detached": structure[0],
                "attached": structure[1],
                "multiUnit": sum(structure[2:8]),
                "mobile": structure[8],
                "other": structure[9],
            },
            "hpi": sorted((y, value) for y, value in trends.get(fips, {}).items() if latest_year - 9 <= y <= latest_year),
        }

    counties = []
    for fips, name in sorted(names.items(), key=lambda item: item[1].casefold()):
        appraisal_path = directory.counties[name.lower().replace(" ", "")]
        counties.append({
            "fips": fips,
            "name": name,
            "slug": re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-"),
            "appraisalPath": appraisal_path,
            "neighbors": sorted(neighbors[fips], key=lambda other: names[other].casefold()),
            **area(fips),
        })
    if len({county["slug"] for county in counties}) != len(counties):
        raise ValueError("Duplicate county slugs")
    return {
        "publishedOn": args.published_on.isoformat(),
        "acsYear": year,
        "fhfaUpdatedOn": state_revision.isoformat(),
        "adjacencyYear": adjacency_year,
        "state": area(STATE),
        "counties": counties,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache", type=Path, required=True, help="Use a fresh cache directory for each release")
    parser.add_argument("--acs-year", type=int, required=True, help="End year of the ACS five-year estimates")
    parser.add_argument("--adjacency-year", type=int, required=True)
    parser.add_argument("--published-on", type=date.fromisoformat, required=True)
    parser.add_argument("--output", type=Path, default=Path("server/texasHousingSnapshot.json"))
    args = parser.parse_args()
    data = build(args)
    candidate = args.output.with_suffix(".json.tmp")
    with candidate.open("w", encoding="utf-8", newline="\n") as output:
        json.dump(data, output, ensure_ascii=False, separators=(",", ":"))
        output.write("\n")
    candidate.replace(args.output)
    print(f"Prepared {len(data['counties'])} Texas counties for review and release.")


if __name__ == "__main__":
    main()
