import type { PartialDate, StructuredCv } from "../types/cv";

function formatDateRange(startDate: PartialDate, endDate: PartialDate): string {
  return [startDate, endDate].filter(Boolean).join(" - ");
}

function SectionTitle({ children }: { children: string }) {
  return <h3 className="text-label-xs uppercase tracking-wider text-text-muted">{children}</h3>;
}

function EmptyState({ children }: { children: string }) {
  return <p className="mt-1.5 text-caption-xs italic text-text-muted">{children}</p>;
}

export function MinimalistaAts({ cv }: { cv: StructuredCv }) {
  const contact = [cv.personalInfo.email, cv.personalInfo.phone, cv.personalInfo.location, cv.personalInfo.linkedin, cv.personalInfo.website]
    .filter(Boolean)
    .join("  ·  ");
  const skills = [...cv.skills.hard, ...cv.skills.soft].join(", ");
  const languages = cv.languages.map((language) => [language.name, language.proficiency].filter(Boolean).join(" - ")).join(", ");

  return (
    <article data-testid="template-minimalista-ats" className="flex flex-col gap-4 text-text">
      <header>
        <h2 className="text-headline-2xl font-bold uppercase tracking-tight text-text">
          {cv.personalInfo.fullName || "Nombre profesional"}
        </h2>
        {contact && <p className="mt-1 text-body-sm text-text-muted">{contact}</p>}
      </header>

      <div className="h-px bg-border" />

      {cv.summary && (
        <section>
          <SectionTitle>Resumen</SectionTitle>
          <p className="mt-1.5 text-body-sm leading-relaxed text-text">{cv.summary}</p>
        </section>
      )}

      <section>
        <SectionTitle>Experiencia</SectionTitle>
        {cv.experience.length ? (
          <div className="mt-2 flex flex-col gap-3">
            {cv.experience.map((item) => (
              <div key={`${item.company}-${item.title}`}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                  <span className="text-body-sm font-semibold text-text">
                    {item.title}
                    {item.company ? ` — ${item.company}` : ""}
                  </span>
                  <span className="text-caption-xs text-text-muted">{formatDateRange(item.startDate, item.endDate)}</span>
                </div>
                {item.location && <p className="text-caption-xs text-text-muted">{item.location}</p>}
                {item.achievements.length > 0 && (
                  <ul className="mt-1 list-disc space-y-0.5 pl-4 text-body-sm text-text">
                    {item.achievements.map((achievement) => (
                      <li key={achievement}>{achievement}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        ) : (
          <EmptyState>Sin experiencia registrada.</EmptyState>
        )}
      </section>

      <section>
        <SectionTitle>Educación</SectionTitle>
        {cv.education.length ? (
          <div className="mt-2 flex flex-col gap-2">
            {cv.education.map((item) => (
              <div key={`${item.institution}-${item.program}`} className="flex flex-wrap items-baseline justify-between gap-x-2">
                <span className="text-body-sm font-semibold text-text">
                  {item.program}
                  {item.institution ? ` — ${item.institution}` : ""}
                </span>
                <span className="text-caption-xs text-text-muted">{formatDateRange(item.startDate, item.endDate)}</span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState>Sin educación registrada.</EmptyState>
        )}
      </section>

      <section>
        <SectionTitle>Habilidades</SectionTitle>
        {skills ? (
          <p className="mt-1.5 text-body-sm text-text">{skills}</p>
        ) : (
          <EmptyState>Sin habilidades registradas.</EmptyState>
        )}
      </section>

      <section>
        <SectionTitle>Idiomas</SectionTitle>
        {languages ? <p className="mt-1.5 text-body-sm text-text">{languages}</p> : <EmptyState>Sin idiomas registrados.</EmptyState>}
      </section>

      <section>
        <SectionTitle>Certificaciones</SectionTitle>
        {cv.certifications.length ? (
          <div className="mt-2 flex flex-col gap-2">
            {cv.certifications.map((item) => (
              <div key={`${item.issuer}-${item.name}`} className="flex flex-wrap items-baseline justify-between gap-x-2">
                <span className="text-body-sm font-semibold text-text">{item.name}</span>
                <span className="text-caption-xs text-text-muted">
                  {[item.issuer, formatDateRange(item.issueDate, item.expirationDate)].filter(Boolean).join("  ·  ")}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState>Sin certificaciones registradas.</EmptyState>
        )}
      </section>
    </article>
  );
}
