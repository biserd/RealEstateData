import { useQuery } from "@tanstack/react-query";
import { GraduationCap, ExternalLink, MapPin, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface NearbySchool {
  dbn: string;
  name: string;
  district: number | null;
  address: string | null;
  gradeBand: string | null;
  academicsScore: number | null;
  climateScore: number | null;
  progressScore: number | null;
  overallScore: number | null;
  enrollment: number | null;
  studentTeacherRatio: number | null;
  graduationRate4yr: number | null;
  elaProficiency: number | null;
  mathProficiency: number | null;
  distanceMiles: number;
  detailUrl: string;
  hasPrek: boolean;
  has3k: boolean;
  hasGiftedTalented: boolean;
  hasDualLanguage: boolean;
}

interface NearbySchoolsProps {
  propertyId?: string;
  latitude?: number | null;
  longitude?: number | null;
}

function scoreColor(score: number | null): string {
  if (score === null) return "bg-muted text-muted-foreground";
  if (score >= 85) return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300";
  if (score >= 70) return "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300";
  if (score >= 55) return "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300";
  return "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300";
}

export function NearbySchools({ propertyId, latitude, longitude }: NearbySchoolsProps) {
  const useCoords = latitude != null && longitude != null;
  const url = useCoords
    ? `/api/schools/nearby?lat=${latitude}&lon=${longitude}&limit=6&radiusMiles=1.5`
    : `/api/properties/${propertyId}/schools?limit=6&radiusMiles=1.5`;
  const queryKey = useCoords
    ? ["/api/schools/nearby", latitude, longitude]
    : ["/api/properties", propertyId, "schools"];

  const { data, isLoading, error } = useQuery<NearbySchool[]>({
    queryKey,
    enabled: useCoords || !!propertyId,
    queryFn: async () => {
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to load schools");
      return res.json();
    },
  });

  if (error) return null;

  return (
    <Card data-testid="card-nearby-schools">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-primary" />
            Nearby Schools
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            asChild
            data-testid="link-schools-source"
          >
            <a
              href="https://nycschoolsratings.com"
              target="_blank"
              rel="noopener noreferrer"
              className="gap-1"
            >
              View all
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Public elementary, middle, and high schools within 1.5 miles. Data from{" "}
          <a
            href="https://nycschoolsratings.com"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover-elevate"
          >
            NYC School Ratings
          </a>
          .
        </p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-20 rounded-md bg-muted/40 animate-pulse"
              />
            ))}
          </div>
        ) : !data || data.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No public schools found within 1.5 miles.
          </p>
        ) : (
          <ul className="space-y-2">
            {data.map((school) => (
              <li key={school.dbn}>
                <a
                  href={school.detailUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-md border p-3 hover-elevate"
                  data-testid={`link-school-${school.dbn}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium truncate">{school.name}</p>
                        {school.gradeBand && (
                          <Badge variant="outline" className="text-xs">
                            {school.gradeBand}
                          </Badge>
                        )}
                        {school.hasGiftedTalented && (
                          <Badge variant="outline" className="text-xs">
                            G&amp;T
                          </Badge>
                        )}
                        {school.hasDualLanguage && (
                          <Badge variant="outline" className="text-xs">
                            Dual Language
                          </Badge>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {school.distanceMiles} mi
                          {school.district !== null && ` · District ${school.district}`}
                        </span>
                        {school.enrollment !== null && (
                          <span className="inline-flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {school.enrollment.toLocaleString()} students
                          </span>
                        )}
                        {school.studentTeacherRatio !== null && (
                          <span>{school.studentTeacherRatio}:1 ratio</span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {school.overallScore !== null && (
                        <span
                          className={`rounded-md px-2 py-1 text-sm font-semibold tabular-nums ${scoreColor(school.overallScore)}`}
                          data-testid={`score-school-${school.dbn}`}
                        >
                          {school.overallScore}
                        </span>
                      )}
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Overall
                      </span>
                    </div>
                  </div>
                  {(school.academicsScore !== null ||
                    school.climateScore !== null ||
                    school.progressScore !== null) && (
                    <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                      <div className="flex items-center justify-between rounded bg-muted/40 px-2 py-1">
                        <span className="text-muted-foreground">Academics</span>
                        <span className="font-medium tabular-nums">
                          {school.academicsScore ?? "—"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between rounded bg-muted/40 px-2 py-1">
                        <span className="text-muted-foreground">Climate</span>
                        <span className="font-medium tabular-nums">
                          {school.climateScore ?? "—"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between rounded bg-muted/40 px-2 py-1">
                        <span className="text-muted-foreground">Progress</span>
                        <span className="font-medium tabular-nums">
                          {school.progressScore ?? "—"}
                        </span>
                      </div>
                    </div>
                  )}
                </a>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
