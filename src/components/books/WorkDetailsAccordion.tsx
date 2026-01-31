import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import type { UserWorkItemDto } from "@/types";
import { cn } from "@/lib/utils";

export interface WorkDetailsAccordionProps {
  item: UserWorkItemDto;
  className?: string;
}

/**
 * Accordion with additional work details (expandable/collapsible).
 * Shows cover image, ISBN, language, full publication date, authors, and timestamps.
 */
export function WorkDetailsAccordion({ item, className }: WorkDetailsAccordionProps) {
  const { work, status_updated_at, created_at } = item;
  const edition = work.primary_edition;
  const title = edition?.title || work.title || "Brak tytułu";
  const coverUrl = edition?.cover_url;

  // Get authors from work (if available in future)
  // For now, we'll show basic details

  return (
    <Accordion type="single" collapsible className={cn("w-full", className)}>
      <AccordionItem value={`details-${work.id}`} className="border-none">
        <AccordionTrigger className="py-0 text-sm">Szczegóły</AccordionTrigger>
        <AccordionContent className="pt-4">
          <div className="space-y-4">
            {/* Cover image */}
            {coverUrl && (
              <div className="flex justify-center">
                <img
                  src={coverUrl}
                  alt={`Okładka ${title}`}
                  className="h-48 w-32 object-cover rounded"
                  loading="lazy"
                />
              </div>
            )}

            {/* Metadata */}
            <dl className="space-y-2 text-sm">
              {edition?.isbn13 && (
                <div>
                  <dt className="font-medium text-muted-foreground">ISBN-13</dt>
                  <dd>{edition.isbn13}</dd>
                </div>
              )}

              {edition?.language && (
                <div>
                  <dt className="font-medium text-muted-foreground">Język</dt>
                  <dd>{edition.language}</dd>
                </div>
              )}

              {edition?.publish_date && (
                <div>
                  <dt className="font-medium text-muted-foreground">Data publikacji</dt>
                  <dd>{edition.publish_date}</dd>
                </div>
              )}

              {work.first_publish_year && (
                <div>
                  <dt className="font-medium text-muted-foreground">Pierwsze wydanie</dt>
                  <dd>{work.first_publish_year}</dd>
                </div>
              )}

              <div>
                <dt className="font-medium text-muted-foreground">Data dodania do profilu</dt>
                <dd>{new Date(created_at).toLocaleDateString("pl-PL")}</dd>
              </div>

              {status_updated_at && (
                <div>
                  <dt className="font-medium text-muted-foreground">Ostatnia zmiana statusu</dt>
                  <dd>{new Date(status_updated_at).toLocaleDateString("pl-PL")}</dd>
                </div>
              )}
            </dl>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
