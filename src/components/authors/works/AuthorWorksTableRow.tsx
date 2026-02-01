import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import type { WorkListItemDto } from "@/types";

interface AuthorWorksTableRowProps {
  work: WorkListItemDto;
  isSelected: boolean;
  isInProfile: boolean;
  onToggle: () => void;
}

export function AuthorWorksTableRow({ work, isSelected, isInProfile, onToggle }: AuthorWorksTableRowProps) {
  const title = work.primary_edition?.title || work.title || "Brak tytułu";
  const coverUrl = work.primary_edition?.cover_url;
  const publishYear = work.publish_year;
  const language = work.primary_edition?.language || "N/A";
  const isbn13 = work.primary_edition?.isbn13;
  const publishDate = work.primary_edition?.publish_date;

  return (
    <tr className="border-b hover:bg-muted/50" data-testid="author-work-row" data-work-id={work.id}>
      <td className="p-4">
        <Checkbox checked={isSelected} onCheckedChange={onToggle} aria-label={`Zaznacz ${title}`} />
      </td>
      <td className="p-4">
        {coverUrl ? (
          <img src={coverUrl} alt={`Okładka ${title}`} className="h-16 w-12 object-cover rounded" loading="lazy" />
        ) : (
          <div className="h-16 w-12 bg-muted rounded flex items-center justify-center text-xs text-muted-foreground">
            Brak
          </div>
        )}
      </td>
      <td className="p-4">
        <div className="font-medium">{title}</div>
      </td>
      <td className="p-4">{publishYear || "N/A"}</td>
      <td className="p-4">{language}</td>
      <td className="p-4">{isInProfile && <Badge variant="secondary">Dodane</Badge>}</td>
      <td className="p-4">
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value={`details-${work.id}`} className="border-none">
            <AccordionTrigger className="py-0 text-sm">Szczegóły</AccordionTrigger>
            <AccordionContent className="pt-2">
              <div className="space-y-1 text-sm text-muted-foreground">
                {isbn13 && <div>ISBN-13: {isbn13}</div>}
                {publishDate && <div>Data publikacji: {publishDate}</div>}
                {work.first_publish_year && <div>Pierwsze wydanie: {work.first_publish_year}</div>}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </td>
    </tr>
  );
}
