"""Prepare the nationwide housing dataset for a manual, reviewed release."""
import argparse
from collections import defaultdict
import csv
from datetime import date
import json
import math
from pathlib import Path
import re
import unicodedata

from housing_source_files import read_acs, read_fhfa_annual, stage_file

CENSUS_BASE = "https://www2.census.gov/programs-surveys/acs/summary_file"
INVENTORY_BASE = "https://econdata.s3-us-west-2.amazonaws.com/Reports/Core"
ZCTA = "https://www2.census.gov/geo/docs/maps-data/data/rel2020/zcta520/tab20_zcta520_county20_natl.txt"
FHFA = "https://www.fhfa.gov/hpi-state/csv"
ACS_COLUMNS = {
    "b25077": (1,), "b25064": (1,), "b25002": (1, 2), "b25003": (2,),
    "b25024": tuple(range(2, 12)),
}
CENSUS_DIVISIONS = {
    "New England": "CT ME MA NH RI VT", "Middle Atlantic": "NJ NY PA",
    "East North Central": "IL IN MI OH WI", "West North Central": "IA KS MN MO NE ND SD",
    "South Atlantic": "DE DC FL GA MD NC SC VA WV", "East South Central": "AL KY MS TN",
    "West South Central": "AR LA OK TX", "Mountain": "AZ CO ID MT NV NM UT WY",
    "Pacific": "AK CA HI OR WA",
}
DIVISION_BY_CODE = {code: division for division, codes in CENSUS_DIVISIONS.items() for code in codes.split()}
NATION = "0100000US"


def slug(name):
    ascii_name = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", ascii_name).strip("-")


def rows(path, delimiter=","):
    with path.open(encoding="utf-8-sig", newline="") as source:
        yield from csv.DictReader(source, delimiter=delimiter)


def geography(path):
    states, counties, places, zips = {}, {}, {}, {}
    for row in rows(path, "|"):
        if row["COMPONENT"] != "00" or row["STATE"] == "72":
            continue
        geoid, state, name = row["GEO_ID"], row["STATE"], row["NAME"]
        level = row["SUMLEVEL"]
        if level == "040":
            states[geoid] = {
                "name": name, "fips": state, "code": row["STUSAB"], "slug": slug(name),
                "division": DIVISION_BY_CODE[row["STUSAB"]],
            }
        elif level == "050":
            label = name.rsplit(", ", 1)[0]
            counties[geoid] = {
                "name": label, "fips": state + row["COUNTY"], "slug": slug(label.removesuffix(" County")),
            }
        elif level == "160":
            label = name.rsplit(", ", 1)[0]
            places[geoid] = (label, row["STUSAB"])
        elif level == "860":
            zips[geoid] = row["ZCTA5"]
    if len(states) != 51 or len(counties) < 3100 or len(places) < 30000 or len(zips) < 32000:
        raise ValueError("Unexpected nationwide Census coverage")
    if len({(c["fips"][:2], c["slug"]) for c in counties.values()}) != len(counties):
        raise ValueError("Conflicting county slugs within a state")
    return states, counties, places, zips


def listing_data(path, identifier, period):
    result = {}
    for row in rows(path):
        identity = row.get(identifier, "")
        id_pattern = "[A-Z]{2}" if identifier == "state_id" else "[0-9]{5}"
        if not re.fullmatch(id_pattern, identity or ""):
            continue
        if row["month_date_yyyymm"] != period:
            raise ValueError(f"Unexpected month in {path}: {row['month_date_yyyymm']}")
        if row["quality_flag"] != "0" or not row["active_listing_count"] or not row["median_listing_price"]:
            continue
        active = float(row["active_listing_count"])
        price = float(row["median_listing_price"])
        days = float(row["median_days_on_market"]) if row["median_days_on_market"] else None
        if not math.isfinite(active) or not math.isfinite(price) or active < 10 or price <= 0:
            continue
        if identity in result:
            raise ValueError(f"Duplicate listing geography {identity} in {path}")
        result[identity] = (round(price), round(active), round(days) if days is not None and 0 <= days < 3650 else None)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache", type=Path, required=True)
    parser.add_argument("--acs-year", type=int, required=True)
    parser.add_argument("--adjacency-year", type=int, required=True)
    parser.add_argument("--inventory-month", required=True, help="Month of the matching set of research downloads (YYYY-MM)")
    parser.add_argument("--fhfa-period", required=True, help="Quarter shown on the FHFA state summary tables (YYYYQn)")
    parser.add_argument("--published-on", type=date.fromisoformat, required=True)
    parser.add_argument("--output", type=Path, default=Path("server"))
    args = parser.parse_args()
    cache, year = args.cache, args.acs_year
    if not re.fullmatch(r"\d{4}Q[1-4]", args.fhfa_period):
        raise ValueError("Invalid FHFA quarter")
    inventory_date = date.fromisoformat(args.inventory_month + "-01")
    if inventory_date >= args.published_on:
        raise ValueError("Inventory must be from a month already released")
    cache.mkdir(parents=True, exist_ok=True)
    base = f"{CENSUS_BASE}/{year}/table-based-SF"
    stage_file(cache / "geography.txt", f"{base}/documentation/Geos{year}5YR.txt")
    stage_file(cache / "zip-county.txt", ZCTA)
    stage_file(cache / "state-quarterly.csv", FHFA)
    stage_file(cache / "county.xlsx", "https://www.fhfa.gov/hpi/download/annual/hpi_at_county.xlsx")
    stage_file(cache / "adjacency.txt", f"https://www2.census.gov/geo/docs/reference/county_adjacency/county_adjacency{args.adjacency_year}.txt")
    for table in ACS_COLUMNS:
        stage_file(cache / f"{year}-{table}.dat", f"{base}/data/5YRData/acsdt5y{year}-{table}.dat")
    listing_files = {"state": "state_id", "county": "county_fips", "zip": "postal_code"}
    for level in listing_files:
        stage_file(cache / f"inventory-{level}.csv",
                   f"{INVENTORY_BASE}/RDC_Inventory_Core_Metrics_{level.capitalize()}.csv")

    states, counties, places, zips = geography(cache / "geography.txt")
    fips_to_state = {s["fips"]: s["code"] for s in states.values()}
    listings = {level: listing_data(cache / f"inventory-{level}.csv", ident, inventory_date.strftime("%Y%m"))
                for level, ident in listing_files.items()}
    if set(listings["state"]) != set(fips_to_state.values()) or len(listings["county"]) < 1500:
        raise ValueError("Missing asking-price coverage")
    valid_fips = {c["fips"] for c in counties.values()}
    county_hpi_revision, county_hpi = read_fhfa_annual(cache / "county.xlsx", valid_fips)
    if county_hpi_revision > args.published_on or len(county_hpi) < 1500:
        raise ValueError("Unexpected FHFA annual coverage")
    state_hpi = {row["State"]: [round(float(row[key]), 2) for key in ("1 Quarter", "1 Year", "5 Year")]
                 for row in rows(cache / "state-quarterly.csv")}
    if set(state_hpi) != {s["name"] for s in states.values()} or any(
        not math.isfinite(n) for changes in state_hpi.values() for n in changes
    ):
        raise ValueError("Missing FHFA state trends")
    latest_year = max(y for history in county_hpi.values() for y in history)
    neighbors = defaultdict(set)
    for row in rows(cache / "adjacency.txt", "|"):
        fips, other = row["County GEOID"], row["Neighbor GEOID"]
        if fips in valid_fips and other in valid_fips and fips != other and int(row["Length"] or 0) > 0:
            neighbors[fips].add(other)
    if any(fips not in neighbors[n] for fips, nearby in neighbors.items() for n in nearby):
        raise ValueError("Asymmetric county adjacency")

    overlaps = defaultdict(dict)
    for row in rows(cache / "zip-county.txt", "|"):
        zip_code, county = row["GEOID_ZCTA5_20"], row["GEOID_COUNTY_20"]
        land = int(row["AREALAND_PART"] or 0)
        if zip_code and land > 0 and county[:2] in fips_to_state:
            overlaps[zip_code][county] = land

    broad = {NATION, *states, *counties}
    local = {*broad, *places, *zips}
    tables = {table: read_acs(cache / f"{year}-{table}.dat", table, cols,
              local if table in {"b25077", "b25064", "b25002"} else broad)
              for table, cols in ACS_COLUMNS.items()}

    def values(geoid):
        return (tables["b25077"][geoid][0], tables["b25064"][geoid][0])

    def housing(geoid):
        total, occupied = tables["b25002"][geoid]
        owner = tables["b25003"][geoid][0][0]
        structure = [value for value, _ in tables["b25024"][geoid]]
        if total[0] is None or occupied[0] is None or owner is None or any(n is None for n in structure):
            raise ValueError(f"Missing required ACS housing estimates for {geoid}")
        if not 0 <= owner <= occupied[0] <= total[0] or sum(structure) != total[0]:
            raise ValueError(f"ACS totals disagree for {geoid}")
        value, rent = values(geoid)
        return {
            "homeValue": value, "rent": rent, "housingUnits": total, "occupied": occupied[0],
            "ownerOccupied": owner, "structures": [structure[0], structure[1], sum(structure[2:8]), structure[8], structure[9]],
        }

    county_rows = []
    for geoid, county in sorted(counties.items()):
        fips = county["fips"]
        county_rows.append({**county, **housing(geoid), "listing": listings["county"].get(fips),
                            "hpi": [[y, value] for y, value in sorted(county_hpi.get(fips, {}).items()) if y >= latest_year - 5],
                            "neighbors": sorted(neighbors[fips])})

    state_rows = [
        {**state, **housing(geoid), "listing": listings["state"][state["code"]], "hpi": state_hpi[state["name"]]}
        for geoid, state in sorted(states.items(), key=lambda item: item[1]["name"])
    ]
    places_rows = defaultdict(list)
    for geoid, (label, code) in sorted(places.items()):
        if code not in fips_to_state.values():
            continue
        value, rent = values(geoid)
        total = tables["b25002"][geoid][0][0]
        if total is not None and total > 0:
            places_rows[code].append([label, total, value, rent])

    zip_rows = {}
    for geoid, zip_code in sorted(zips.items()):
        county_overlaps = overlaps[zip_code]
        associated_states = sorted({fips_to_state[fips[:2]] for fips in county_overlaps})
        if not associated_states:
            continue
        value, rent = values(geoid)
        counties_by_land = sorted((fips for fips in county_overlaps if fips in valid_fips),
                                  key=lambda fips: (-county_overlaps[fips], fips))
        zip_rows[zip_code] = [associated_states, counties_by_land[:5], value, rent, listings["zip"].get(zip_code)]

    # USPS-only listing ZIPs are independently located from the publisher's postal label.
    for row in rows(cache / "inventory-zip.csv"):
        code, name = row.get("postal_code"), row.get("zip_name", "")
        if code not in listings["zip"] or code in zip_rows:
            continue
        state = name.rsplit(", ", 1)[-1].upper()
        if state in fips_to_state.values():
            zip_rows[code] = [[state], [], [None, None], [None, None], listings["zip"][code]]

    if set(places_rows) != set(fips_to_state.values()) or len(zip_rows) < 32000:
        raise ValueError("Incomplete local search coverage")
    profiles = {
        "publishedOn": args.published_on.isoformat(), "acsYear": year, "inventoryMonth": args.inventory_month,
        "fhfaPeriod": args.fhfa_period, "countyHpiYear": latest_year, "countyHpiRevision": county_hpi_revision.isoformat(),
        "adjacencyYear": args.adjacency_year, "nation": housing(NATION), "states": state_rows, "counties": county_rows,
    }
    for name, data in {"usHousingSnapshot": profiles, "usHousingPlaces": places_rows, "usHousingZips": zip_rows}.items():
        output = args.output / f"{name}.json"
        candidate = output.with_suffix(".json.tmp")
        with candidate.open("w", encoding="utf-8", newline="\n") as stream:
            json.dump(data, stream, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
            stream.write("\n")
        candidate.replace(output)
    print(f"Prepared {len(states)} state/DC hubs, {len(counties)} county records, "
          f"{sum(map(len, places_rows.values()))} Census places, and {len(zip_rows)} ZIP/ZCTA records.")


if __name__ == "__main__":
    main()
