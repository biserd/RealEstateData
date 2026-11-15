"""Build the manually published Texas housing snapshot from official public data."""
import argparse
import csv
from datetime import date
from html.parser import HTMLParser
import json
from pathlib import Path
import re

from housing_source_files import read_acs, read_fhfa_annual, stage_file


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


def build(args):
    cache = args.cache
    cache.mkdir(parents=True, exist_ok=True)
    year = args.acs_year
    census = f"https://www2.census.gov/programs-surveys/acs/summary_file/{year}/table-based-SF/data/5YRData"
    for table in ACS_TABLES:
        stage_file(cache / f"{year}-{table}.dat", f"{census}/acsdt5y{year}-{table}.dat")
    stage_file(cache / "state.xlsx", "https://www.fhfa.gov/hpi/download/annual/hpi_at_state.xlsx")
    stage_file(cache / "county.xlsx", "https://www.fhfa.gov/hpi/download/annual/hpi_at_county.xlsx")
    stage_file(cache / "directory.html", DIRECTORY)
    adjacency_year = args.adjacency_year
    stage_file(cache / "adjacency.txt", f"https://www2.census.gov/geo/docs/reference/county_adjacency/county_adjacency{adjacency_year}.txt")

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

    geography = {"0400000US48": STATE, **{f"0500000US{fips}": fips for fips in COUNTY_FIPS}}
    tables = {
        table: {geography[key]: values for key, values in read_acs(
            cache / f"{year}-{table}.dat", table, cols, set(geography)
        ).items()}
        for table, cols in ACS_TABLES.items()
    }
    state_revision, state_hpi = read_fhfa_annual(cache / "state.xlsx", {STATE}, state_file=True)
    county_revision, county_hpi = read_fhfa_annual(cache / "county.xlsx", COUNTY_FIPS)
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
